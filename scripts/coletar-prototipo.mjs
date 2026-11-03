/**
 * Fotografia das APIs públicas que o protótipo usa e o Neon ainda não tem.
 *
 *     node scripts/coletar-prototipo.mjs
 *
 * Grava `src/app/prototipo/_dados/fotografia.json`. Não toca no banco: a carga
 * definitiva dessas fontes é trabalho do backend, e este arquivo só existe para
 * a tela poder ser discutida com dado real.
 *
 * - Câmara: deputados em exercício, com UF e partido informado.
 * - Senado: senadores em exercício, com UF e partido informado.
 * - SIDRA 4099: desocupação trimestral desde 2021, no Brasil, por região e
 *   por UF.
 *
 * Se uma soma não bater (vaga, suplente em exercício), o número real fica
 * registrado em `conferencia`. Corrigir à mão esconderia exatamente o que a
 * tela precisa mostrar.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SAIDA = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "prototipo",
  "_dados",
  "fotografia.json",
);

const CAMARA = "https://dadosabertos.camara.leg.br/api/v2/deputados";
const SENADO = "https://legis.senado.leg.br/dadosabertos/senador/lista/atual";
// Brasil, regiões e UFs da mesma tabela: a série nacional do Neon é trimestre
// móvel (tabela 6381), e comparar uma com a outra misturaria recortes.
const SIDRA = "https://apisidra.ibge.gov.br/values/t/4099/n1/all/n2/all/n3/all/v/4099/p";

async function json(url) {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (r.ok) return r.json();
    // SIDRA e Câmara devolvem 5xx intermitentes sob carga.
    if (tentativa >= 4 || r.status < 500) {
      throw new Error(`${url} respondeu ${r.status}`);
    }
    await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
  }
}

// --- Câmara -----------------------------------------------------------------

const deputados = [];
const vistas = new Set();
let url = `${CAMARA}?itens=100&ordem=ASC&ordenarPor=nome`;
while (url) {
  const u = new URL(url);
  if (u.host !== "dadosabertos.camara.leg.br" || vistas.has(url)) {
    throw new Error(`Câmara: paginação inválida ou cíclica (${url})`);
  }
  vistas.add(url);
  const pagina = await json(url);
  for (const d of pagina.dados) {
    deputados.push({
      id: d.id,
      nome: d.nome,
      partido: d.siglaPartido ?? null,
      uf: d.siglaUf,
    });
  }
  url = pagina.links.find((l) => l.rel === "next")?.href ?? null;
}

// --- Senado -----------------------------------------------------------------

const senado = await json(SENADO);
const senadores = senado.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.map(
  (p) => ({
    id: Number(p.IdentificacaoParlamentar.CodigoParlamentar),
    nome: p.IdentificacaoParlamentar.NomeParlamentar,
    partido: p.IdentificacaoParlamentar.SiglaPartidoParlamentar ?? null,
    uf: p.IdentificacaoParlamentar.UfParlamentar,
  }),
);

// --- SIDRA ------------------------------------------------------------------

/**
 * Série trimestral da desocupação desde 2021, para Brasil, regiões e UFs.
 *
 * Começa dois anos antes da posse para a régua do tempo poder mostrar de onde
 * o governo partiu. A primeira linha é o cabeçalho descritivo, e "...", "-" e
 * "X" marcam ausência, como trata `backend/desempenho/fontes.py`. Ausência vira
 * `null` na posição do trimestre, nunca zero.
 */
const PRIMEIRO_TRIMESTRE = "202101";

const linhasSidra = (await json(`${SIDRA}/all`)).slice(1);
if (linhasSidra.some((l) => l.D2C !== "4099")) throw new Error("SIDRA: variável trocada");

const periodos = [
  ...new Map(
    linhasSidra
      .filter((l) => l.D3C >= PRIMEIRO_TRIMESTRE)
      .map((l) => [l.D3C, { codigo: l.D3C, nome: l.D3N }]),
  ).values(),
].sort((a, b) => a.codigo.localeCompare(b.codigo));
const posicao = new Map(periodos.map((p, i) => [p.codigo, i]));

const serieVazia = () => periodos.map(() => null);
const desocupacao = { periodos, brasil: serieVazia(), regioes: {}, ufs: {} };
for (const l of linhasSidra) {
  const i = posicao.get(l.D3C);
  const v = Number(l.V);
  if (i === undefined || ["...", "-", "X", ".."].includes(l.V) || !Number.isFinite(v)) continue;
  if (l.NC === "1") desocupacao.brasil[i] = v;
  else if (l.NC === "2") (desocupacao.regioes[l.D1C] ??= serieVazia())[i] = v;
  else if (l.NC === "3") (desocupacao.ufs[l.D1C] ??= serieVazia())[i] = v;
}

// --- Saída ------------------------------------------------------------------

const contar = (lista) =>
  lista.reduce((m, p) => ({ ...m, [p.uf]: (m[p.uf] ?? 0) + 1 }), {});

const fotografia = {
  coletadoEm: new Date().toISOString(),
  fontes: {
    camara: `${CAMARA}`,
    senado: SENADO,
    sidra: "https://sidra.ibge.gov.br/tabela/4099",
  },
  conferencia: {
    deputados: deputados.length,
    senadores: senadores.length,
    ufsComDeputados: Object.keys(contar(deputados)).length,
    ufsComSenadores: Object.keys(contar(senadores)).length,
    ufsComDesocupacao: Object.keys(desocupacao.ufs).length,
    regioesComDesocupacao: Object.keys(desocupacao.regioes).length,
    trimestres: `${periodos[0].nome} → ${periodos.at(-1).nome} (${periodos.length})`,
  },
  deputados,
  senadores,
  desocupacao,
};

await writeFile(SAIDA, JSON.stringify(fotografia) + "\n");
console.log(fotografia.conferencia);
