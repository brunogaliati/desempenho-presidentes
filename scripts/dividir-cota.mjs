/**
 * Divide os arquivos da cota para a página de um parlamentar, que mostra uma pessoa só.
 *
 *     node scripts/dividir-cota.mjs
 *
 * Roda sozinho no fim de `coletar-cota.mjs` e lê o que ele gravou em `public/painel/congresso/`.
 * Sem rede: dá para rodar de novo a qualquer hora. Grava dois tipos de arquivo:
 *
 * - `cota/{casa}/{id}.json`: tudo de uma pessoa, período a período (cada ano, a legislatura e o
 *   histórico), com meses, categorias e fornecedores. As categorias vão com o nome, numa lista
 *   da própria pessoa, para o arquivo não depender da ordem das categorias de outro.
 * - `cota-{casa}-{periodo}-resumo.json`: o período sem o detalhe de cada um. Fica a média por
 *   mês e o total de cada parlamentar, que a página usa para a posição e a bancada.
 *
 * Antes, a página do deputado baixava `cota-deputados-historico.json` (228 KB em gzip), com a
 * série mensal de todos os 513, para desenhar uma pessoa. Os arquivos inteiros continuam: a
 * aba Congresso compara todo mundo e precisa deles.
 */

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = join(RAIZ, "public", "painel", "congresso");

export async function dividirCota() {
  const fotografia = JSON.parse(await readFile(join(RAIZ, "src", "app", "_painel", "_dados", "fotografia.json"), "utf8"));
  const arquivos = await readdir(PASTA);
  for (const casa of ["deputados", "senadores"]) {
    const indice = JSON.parse(await readFile(join(PASTA, `cota-${casa}.json`), "utf8"));
    const periodos = [...indice.anos.map(String), "legislatura", "historico"].filter(p => arquivos.includes(`cota-${casa}-${p}.json`));
    // Todo mundo da fotografia ganha arquivo, mesmo sem nota: a página não confunde "sem nota" com erro.
    const porPessoa = new Map(fotografia[casa].map(p => [String(p.id), {}]));
    const resumos = [];
    for (const periodo of periodos) {
      // Os fornecedores da casa inteira ficam de fora: a página da pessoa não os mostra.
      const { pessoas, categorias, ...resto } = JSON.parse(await readFile(join(PASTA, `cota-${casa}-${periodo}.json`), "utf8"));
      delete resto.fornecedores;
      const totais = {};
      for (const [id, gasto] of Object.entries(pessoas)) {
        totais[id] = gasto.t;
        const daPessoa = porPessoa.get(id);
        if (!daPessoa) continue;
        // A categoria j da pessoa é o j-ésimo nome da lista dela.
        daPessoa[periodo] = { ...gasto, c: gasto.c.map(([, v], j) => [j, v]), categorias: gasto.c.map(([i]) => categorias[i]) };
      }
      const nome = `cota-${casa}-${periodo}-resumo.json`;
      await writeFile(join(PASTA, nome), `${JSON.stringify({ ...resto, totais })}\n`);
      resumos.push(nome);
    }
    const pasta = join(PASTA, "cota", casa);
    // Quem saiu da fotografia não deixa arquivo velho para trás.
    await rm(pasta, { recursive: true, force: true });
    await mkdir(pasta, { recursive: true });
    let bytes = 0;
    for (const [id, porPeriodo] of porPessoa) {
      const json = JSON.stringify({ casa, id: Number(id), coletadoEm: indice.coletadoEm, periodos: porPeriodo });
      bytes += json.length;
      await writeFile(join(pasta, `${id}.json`), `${json}\n`);
    }
    console.log(`${casa}: ${porPessoa.size} arquivos por pessoa (média de ${(bytes / porPessoa.size / 1024).toFixed(1)} KB) e ${resumos.length} resumos`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await dividirCota();
