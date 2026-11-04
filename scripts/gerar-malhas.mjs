/**
 * Contornos das 27 UFs e dos municípios de cada uma, numa projeção só.
 *
 *     node scripts/gerar-malhas.mjs
 *
 * Grava:
 * - `src/app/_painel/_dados/ufs.json`: UFs com path, centro e caixa (para o
 *   zoom), e os parâmetros da projeção.
 * - `public/painel/municipios/<codigo da UF>.json`: municípios da UF, baixados
 *   pelo navegador só quando o leitor entra no estado.
 * - `public/painel/municipios-brasil.json`: os 5.570 municípios do país, com
 *   nome e área, para o mapa nacional de queimadas.
 *
 * A área em km² é calculada na esfera a partir das coordenadas (fórmula de
 * Chamberlain e Duquette, a mesma do d3 e do turf), não no plano projetado: a
 * projeção achata o Sul e superestimaria a área do Norte. Sobre a malha de
 * qualidade mínima o erro fica em poucos por cento, suficiente para "focos por
 * 1.000 km²" e declarado como aproximação.
 *
 * A mesma projeção nos dois níveis é o que permite o zoom: entrar no Pará é só
 * trocar o viewBox para a caixa do Pará, e os municípios caem exatamente dentro
 * do contorno do estado.
 *
 * Projeção equiretangular com a longitude multiplicada pelo cosseno da latitude
 * média; sem a correção o Brasil sai achatado. Qualidade mínima da API de
 * Malhas do IBGE: suficiente para o país inteiro e leve o bastante para baixar
 * um estado por clique.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA_UFS = join(RAIZ, "src", "app", "_painel", "_dados", "ufs.json");
const PASTA_MUN = join(RAIZ, "public", "painel", "municipios");

const MALHAS = "https://servicodados.ibge.gov.br/api/v3/malhas";
const PARAMS = "formato=application/vnd.geo%2Bjson&qualidade=minima";
const URL_BR = `${MALHAS}/paises/BR?${PARAMS}&intrarregiao=UF`;
const urlUF = (codigo) => `${MALHAS}/estados/${codigo}?${PARAMS}&intrarregiao=municipio`;

const LARGURA = 1000;
const RAIO_TERRA_KM = 6371.0088;
const PASTA_PUBLICA = join(RAIZ, "public", "painel");

async function baixar(url) {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (tentativa >= 4 || r.status < 500) throw new Error(`${url} respondeu ${r.status}`);
    await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
  }
}

/** Lista de polígonos (cada um: lista de anéis) de uma geometria. */
function poligonos(geometria) {
  if (geometria.type === "Polygon") return [geometria.coordinates];
  if (geometria.type === "MultiPolygon") return geometria.coordinates;
  throw new Error(`Geometria inesperada: ${geometria.type}`);
}

// --- Projeção, a partir do país inteiro ---------------------------------------

const brasil = await baixar(URL_BR);
if (brasil.features?.length !== 27) {
  throw new Error(`Esperava 27 UFs, vieram ${brasil.features?.length}`);
}

const pontos = brasil.features.flatMap((f) => poligonos(f.geometry).flat(2));
const lats = pontos.map(([, lat]) => lat);
const lons = pontos.map(([lon]) => lon);
const latMedia = (Math.min(...lats) + Math.max(...lats)) / 2;
const k = Math.cos((latMedia * Math.PI) / 180);
const xMin = Math.min(...lons) * k;
const yMin = -Math.max(...lats);
const escala = LARGURA / (Math.max(...lons) * k - xMin);
const ALTURA = Math.round((-Math.min(...lats) - yMin) * escala);

const arred = (v, casas) => Math.round(v * 10 ** casas) / 10 ** casas;
const projetar = ([lon, lat]) => [(lon * k - xMin) * escala, (-lat - yMin) * escala];

/** Área e centroide de um anel projetado (fórmula do polígono simples). */
function areaECentro(anel) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [x0, y0] = anel[i];
    const [x1, y1] = anel[i + 1];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  a /= 2;
  if (a === 0) return { area: 0, centro: anel[0] };
  return { area: Math.abs(a), centro: [cx / (6 * a), cy / (6 * a)] };
}

/**
 * Path SVG, centro do maior pedaço, área e caixa de uma geometria.
 *
 * O centro vai no maior pedaço porque o centro do conjunto cai no mar em UFs
 * com ilhas, como o Pará com o Marajó.
 */
function desenhar(geometria, casas) {
  const projetados = poligonos(geometria).map((p) => p.map((anel) => anel.map(projetar)));
  const d = projetados
    .flatMap((p) =>
      p.map(
        (anel) =>
          "M" + anel.map(([x, y]) => `${arred(x, casas)},${arred(y, casas)}`).join("L") + "Z",
      ),
    )
    .join("");

  const pedacos = projetados.map((p) => areaECentro(p[0]));
  const maior = pedacos.reduce((m, p) => (p.area > m.area ? p : m));
  const todos = projetados.flat(2);
  const xs = todos.map(([x]) => x);
  const ys = todos.map(([, y]) => y);

  return {
    d,
    centro: maior.centro.map((v) => arred(v, 1)),
    area: Math.round(pedacos.reduce((s, p) => s + p.area, 0) * 100) / 100,
    caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) =>
      arred(v, 1),
    ),
  };
}

const rad = (g) => (g * Math.PI) / 180;

/** Área esférica de um anel [lon, lat], em km². */
function areaAnel(anel) {
  let soma = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    const [lon1, lat1] = anel[i];
    const [lon2, lat2] = anel[i + 1];
    soma += rad(lon2 - lon1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((soma * RAIO_TERRA_KM * RAIO_TERRA_KM) / 2);
}

/** Área de uma geometria em km²: anel externo menos os buracos. */
function areaKm2(geometria) {
  return Math.round(
    poligonos(geometria).reduce(
      (s, [externo, ...buracos]) =>
        s + areaAnel(externo) - buracos.reduce((b, anel) => b + areaAnel(anel), 0),
      0,
    ),
  );
}

// --- UFs -----------------------------------------------------------------------

const ufs = brasil.features
  .map((f) => {
    const { d, centro, area, caixa } = desenhar(f.geometry, 1);
    return {
      codigo: String(f.properties.codarea),
      d,
      centro,
      area: Math.round(area),
      areaKm2: areaKm2(f.geometry),
      caixa,
    };
  })
  .sort((a, b) => a.codigo.localeCompare(b.codigo));

await writeFile(
  SAIDA_UFS,
  JSON.stringify(
    {
      fonte: URL_BR,
      coletadoEm: new Date().toISOString(),
      largura: LARGURA,
      altura: ALTURA,
      ufs,
    },
    null,
    1,
  ) + "\n",
);
console.log(`27 UFs, viewBox ${LARGURA}×${ALTURA}`);

// --- Municípios, um arquivo por UF ----------------------------------------------

// Duas casas decimais: dentro de Sergipe a caixa tem ~30 unidades de largura, e
// com uma casa só os municípios pequenos viravam serrote.
await mkdir(PASTA_MUN, { recursive: true });

// Nomes e siglas do cadastro do IBGE, para o arquivo nacional não depender do
// banco: o mapa de queimadas carrega só arquivos estáticos.
const cadastro = await baixar("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
const nomes = new Map(cadastro.map((m) => [String(m.id), m.nome]));
const siglas = new Map(
  (await baixar("https://servicodados.ibge.gov.br/api/v1/localidades/estados")).map((e) => [
    String(e.id),
    e.sigla,
  ]),
);

const nacional = [];
let total = 0;
for (const uf of ufs) {
  const malha = await baixar(urlUF(uf.codigo));
  const municipios = malha.features
    .map((f) => {
      const codigo = String(f.properties.codarea);
      const { d, centro } = desenhar(f.geometry, 2);
      const km2 = areaKm2(f.geometry);
      // No mapa do país inteiro uma casa decimal basta e o arquivo cai pela metade.
      nacional.push({
        codigo,
        nome: nomes.get(codigo) ?? codigo,
        uf: siglas.get(uf.codigo),
        areaKm2: km2,
        d: desenhar(f.geometry, 1).d,
      });
      return { codigo, d, centro, areaKm2: km2 };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (municipios.some((m) => !m.codigo.startsWith(uf.codigo))) {
    throw new Error(`UF ${uf.codigo}: município fora da UF`);
  }
  total += municipios.length;
  await writeFile(
    join(PASTA_MUN, `${uf.codigo}.json`),
    JSON.stringify({ fonte: urlUF(uf.codigo), municipios }),
  );
  process.stdout.write(`${uf.codigo}:${municipios.length} `);
}

nacional.sort((a, b) => a.codigo.localeCompare(b.codigo));
await writeFile(
  join(PASTA_PUBLICA, "municipios-brasil.json"),
  JSON.stringify({
    fonte: `${MALHAS}/estados/<UF>?${PARAMS}&intrarregiao=municipio`,
    municipios: nacional,
  }),
);
console.log(`\n${total} municípios`);
