/**
 * O resto do mundo em volta do Brasil, para o fundo do mapa da economia.
 *
 *     node scripts/gerar-mundo.mjs
 *
 * Grava `src/app/_painel/_dados/mundo.json`: os países que podem aparecer em
 * volta do Brasil (Américas do Sul e Central, Caribe e a costa da África),
 * sem o Brasil, como paths SVG na mesma projeção e no mesmo viewBox de
 * `ufs.json`. Contornos do Natural Earth 1:110m (domínio público). Escala
 * pequena de propósito: no fundo, detalhe de litoral não aparece e só pesaria.
 *
 * Grava também `public/painel/terra.webp`: o recorte da mesma caixa no
 * Blue Marble Next Generation da NASA (dezembro de 2004; domínio público,
 * crédito à NASA Earth Observatory), só com a terra. A água sai transparente:
 * o mar da página é uma cor lisa, e o relevo do fundo do oceano, que a imagem
 * traz, carregava demais o fundo. Água é o pixel em que o azul passa do
 * vermelho e não fica atrás do verde; a borda é uma rampa curta, para o
 * litoral não sair serrilhado. O mapa usa as versões tingidas: depois deste,
 * rode `scripts/tingir-terra.mjs`.
 *
 * A imagem é equiretangular, linear em longitude e latitude como a nossa
 * projeção, e entra no SVG como um retângulo esticado: cai exatamente sob os
 * contornos. `mundo.json` leva onde ela fica no viewBox.
 *
 * A projeção é recalculada a partir da mesma malha do IBGE que
 * `gerar-malhas.mjs` usa, com as mesmas contas. Se uma mudar, a outra muda
 * junto, ou os vizinhos descolam da fronteira.
 */

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "src", "app", "_painel", "_dados", "mundo.json");
const SAIDA_IMAGEM = join(RAIZ, "public", "painel", "terra.webp");

const URL_BR =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF";
const URL_MUNDO =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson";
const URL_SATELITE =
  "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg";

/** O Blue Marble tem 5400 px para 360°: 15 px por grau. */
const PX_POR_GRAU = 15;
/** Largura final do recorte: com o mapa a ~0,5× na tela, sobra nitidez. */
const LARGURA_IMAGEM = 1800;

const LARGURA = 1000;

/** Até onde o palco pode mostrar, com folga: do Pacífico à costa da África. */
const CAIXA = { lonMin: -130, lonMax: 30, latMin: -60, latMax: 30 };

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

// --- Projeção: as mesmas contas de gerar-malhas.mjs ------------------------------

const brasil = await baixar(URL_BR);
const pontos = brasil.features.flatMap((f) => poligonos(f.geometry).flat(2));
const lats = pontos.map(([, lat]) => lat);
const lons = pontos.map(([lon]) => lon);
const latMedia = (Math.min(...lats) + Math.max(...lats)) / 2;
const k = Math.cos((latMedia * Math.PI) / 180);
const xMin = Math.min(...lons) * k;
const yMin = -Math.max(...lats);
const escala = LARGURA / (Math.max(...lons) * k - xMin);

const projetar = ([lon, lat]) => [(lon * k - xMin) * escala, (-lat - yMin) * escala];
const arred = (v) => Math.round(v * 10) / 10;

// --- Satélite --------------------------------------------------------------------

const resposta = await fetch(URL_SATELITE);
if (!resposta.ok) throw new Error(`${URL_SATELITE} respondeu ${resposta.status}`);
const { data: rgb, info } = await sharp(Buffer.from(await resposta.arrayBuffer()))
  .extract({
    left: (CAIXA.lonMin + 180) * PX_POR_GRAU,
    top: (90 - CAIXA.latMax) * PX_POR_GRAU,
    width: (CAIXA.lonMax - CAIXA.lonMin) * PX_POR_GRAU,
    height: (CAIXA.latMax - CAIXA.latMin) * PX_POR_GRAU,
  })
  .resize(LARGURA_IMAGEM)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const rgba = Buffer.alloc(info.width * info.height * 4);
for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
  const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
  // Quanto o azul passa do vermelho: até 10, terra; de 20 em diante, água.
  // Nas fossas o oceano é tão escuro que a diferença some; ali, escuro e
  // puxado para o azul já é água.
  const fossa = Math.max(r, g, b) < 45 && b >= r + 4;
  const agua = fossa ? 1 : b + 6 >= g ? Math.min(1, Math.max(0, (b - r - 10) / 10)) : 0;
  rgba.set([r, g, b, Math.round(255 * (1 - agua))], j);
}
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .webp({ quality: 78, alphaQuality: 70 })
  .toFile(SAIDA_IMAGEM);

const [x0, y0] = projetar([CAIXA.lonMin, CAIXA.latMax]);
const [x1, y1] = projetar([CAIXA.lonMax, CAIXA.latMin]);
const imagem = {
  href: "/painel/terra.webp",
  fonte: URL_SATELITE,
  x: arred(x0),
  y: arred(y0),
  largura: arred(x1 - x0),
  altura: arred(y1 - y0),
};

// --- Países em volta -------------------------------------------------------------

const mundo = await baixar(URL_MUNDO);
const naCaixa = ([lon, lat]) =>
  lon >= CAIXA.lonMin && lon <= CAIXA.lonMax && lat >= CAIXA.latMin && lat <= CAIXA.latMax;

const paises = mundo.features
  .filter((f) => f.properties.ADM0_A3 !== "BRA")
  .map((f) => {
    // Só os pedaços que encostam na caixa: a França entra pela Guiana.
    const pedacos = poligonos(f.geometry).filter((p) => p[0].some(naCaixa));
    if (!pedacos.length) return null;
    const d = pedacos
      .flatMap((p) => p.map((anel) => "M" + anel.map((c) => projetar(c).map(arred).join(",")).join("L") + "Z"))
      .join("");
    return { codigo: f.properties.ADM0_A3, nome: f.properties.NAME_PT ?? f.properties.NAME, d };
  })
  .filter(Boolean)
  .sort((a, b) => a.codigo.localeCompare(b.codigo));

await writeFile(
  SAIDA,
  JSON.stringify({ fonte: URL_MUNDO, coletadoEm: new Date().toISOString(), imagem, paises }, null, 1) + "\n",
);
console.log(`${paises.length} países em volta do Brasil; satélite em ${SAIDA_IMAGEM}`);
