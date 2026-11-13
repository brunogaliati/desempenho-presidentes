/**
 * Miniaturas dos retratos oficiais do Congresso, servidas pelo próprio site.
 *
 *     node scripts/coletar-fotos-parlamentares.mjs            # só as que faltam
 *     node scripts/coletar-fotos-parlamentares.mjs --refazer  # todas de novo
 *
 * Lê quem está no cargo em `src/app/_painel/_dados/fotografia.json` e grava:
 * - `public/painel/congresso/fotos/{deputados|senadores}/{id}.webp`: um quadrado de 112 px, o
 *   alto do retrato (como a lista e o plenário recortam), em WebP. Serve às listas (28 a 56 px)
 *   e às bolhas do plenário, também em tela de densidade 2;
 * - `src/app/_painel/_dados/fotos-parlamentares.json`: os ids que têm miniatura. Quem não está nele
 *   continua com a foto oficial (`fotoParlamentar`).
 *
 * Por quê: a aba carregava de 80 a 120 fotos direto das casas. A Câmara só fala HTTP/1.1, então o
 * navegador baixa 6 por vez e as últimas chegavam em uns 3,5 s; as fotos vêm com `no-cache` e em
 * tamanho cheio (354×472, até 48 KB). As do Senado têm 480×600 e uns 230 KB cada, depois de um 301.
 * Os perfis usam o retrato vertical de 224 px (`{id}-perfil.webp`), também servido pelo site.
 *
 * Fontes: https://www.camara.leg.br/internet/deputado/bandep/{id}.jpg e
 * https://legis.senado.leg.br/senadores/fotos-oficiais/{id}. Não toca no banco.
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const FOTOGRAFIA = join(RAIZ, "src/app/_painel/_dados/fotografia.json");
const MANIFESTO = join(RAIZ, "src/app/_painel/_dados/fotos-parlamentares.json");
const PASTA = join(RAIZ, "public/painel/congresso/fotos");
const LADO = 112;
const AO_MESMO_TEMPO = 6;
const AGENTE = { "user-agent": "desempenho-do-governo/coleta (dados abertos)", accept: "image/*" };
const refazer = process.argv.includes("--refazer");

const ORIGEM = {
  deputados: (id) => `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`,
  senadores: (id) => `https://legis.senado.leg.br/senadores/fotos-oficiais/${id}`,
};

const existe = (arquivo) => stat(arquivo).then(() => true, () => false);

async function baixar(url) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(url, { headers: AGENTE, redirect: "follow", signal: AbortSignal.timeout(30_000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const tipo = r.headers.get("content-type") ?? "";
      if (!tipo.startsWith("image/")) throw new Error(`não é imagem: ${tipo}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (erro) {
      if (tentativa >= 3) throw erro;
      await new Promise((ok) => setTimeout(ok, 800 * tentativa));
    }
  }
}

/** O quadrado do alto do retrato, como `Plenario3D` recorta: centrado na largura, 5% abaixo do topo. */
async function miniatura(bruto) {
  const { data, info } = await sharp(bruto).rotate().toBuffer({ resolveWithObject: true });
  const lado = Math.min(info.width, info.height);
  const left = Math.round((info.width - lado) / 2);
  const top = info.height > info.width ? Math.min(info.height - lado, Math.round(info.height * 0.05)) : 0;
  return sharp(data).extract({ left, top, width: lado, height: lado }).resize(LADO, LADO).webp({ quality: 74, effort: 6 }).toBuffer();
}

async function casa(nome, pessoas) {
  const pasta = join(PASTA, nome);
  await mkdir(pasta, { recursive: true });
  const ids = [...new Set(pessoas.map((p) => p.id))].filter((id) => Number.isSafeInteger(id) && id > 0);
  const feitos = [];
  const perfis = [];
  const falhas = [];
  let baixadas = 0, bytes = 0;
  const fila = [...ids];
  await Promise.all(Array.from({ length: AO_MESMO_TEMPO }, async () => {
    for (let id = fila.shift(); id !== undefined; id = fila.shift()) {
      const arquivo = join(pasta, `${id}.webp`);
      const arquivoPerfil = join(pasta, `${id}-perfil.webp`);
      const temMiniatura = await existe(arquivo), temPerfil = await existe(arquivoPerfil);
      if (temMiniatura) feitos.push(id);
      if (temPerfil) perfis.push(id);
      if (!refazer && temMiniatura && temPerfil) continue;
      try {
        const bruto = await baixar(ORIGEM[nome](id));
        if (!bruto) { falhas.push(`${id} (sem foto na casa)`); continue; }
        if (refazer || !temMiniatura) {
          const webp = await miniatura(bruto);
          await writeFile(arquivo, webp);
          if (!temMiniatura) feitos.push(id);
          bytes += webp.length;
        }
        const retrato = await sharp(bruto).rotate().resize({ width: 224, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toBuffer();
        await writeFile(arquivoPerfil, retrato);
        if (!temPerfil) perfis.push(id);
        baixadas++;
        bytes += retrato.length;
      } catch (erro) {
        falhas.push(`${id} (${erro.message})`);
      }
    }
  }));
  // Quem saiu do cargo sai da pasta: o manifesto e os arquivos andam juntos.
  const atuais = new Set([...feitos.map((id) => `${id}.webp`), ...perfis.map((id) => `${id}-perfil.webp`)]);
  const sobras = (await readdir(pasta)).filter((a) => a.endsWith(".webp") && !atuais.has(a));
  await Promise.all(sobras.map((a) => rm(join(pasta, a))));
  console.log(`${nome}: ${feitos.length} miniaturas e ${perfis.length} retratos de ${ids.length}; ${baixadas} baixadas agora (${Math.round(bytes / 1024)} KB); ${sobras.length} removidas.`);
  if (falhas.length) console.log(`  sem miniatura: ${falhas.join(", ")}`);
  return { miniaturas: feitos.sort((a, b) => a - b), perfis: perfis.sort((a, b) => a - b) };
}

const fotografia = JSON.parse(await readFile(FOTOGRAFIA, "utf8"));
const deputados = await casa("deputados", fotografia.deputados);
const senadores = await casa("senadores", fotografia.senadores);
const manifesto = {
  lado: LADO,
  coletadoEm: new Date().toISOString(),
  deputados: deputados.miniaturas,
  senadores: senadores.miniaturas,
  perfis: { deputados: deputados.perfis, senadores: senadores.perfis },
};
await writeFile(MANIFESTO, `${JSON.stringify(manifesto)}\n`);
console.log(`manifesto: ${MANIFESTO}`);
