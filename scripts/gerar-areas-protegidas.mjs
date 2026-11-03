/**
 * Os contornos das Terras Indígenas e das Unidades de Conservação, na projeção do
 * mapa, para a aba de meio ambiente pintar cada área com o desmatamento dela.
 *
 *     node scripts/gerar-areas-protegidas.mjs
 *
 * Vem das camadas do PRODES no TerraBrasilis, uma por bioma: são os mesmos recortes
 * em que o INPE mede o desmatamento, então o nome casa com
 * `mart.desmatamento_recorte` (conferido em 02/11/2026: nenhuma área do banco ficou
 * sem contorno). A mesma área em dois biomas aparece duas vezes, uma em cada, e os
 * pedaços de mesmo nome num bioma viram um só caminho, mesmo com grafias diferentes.
 *
 * A projeção é a de `gerar-malhas.mjs`, recalculada a partir da malha do país, e o
 * script confere se ela bate com a de `ufs.json`.
 *
 * Grava `public/prototipo/areas-protegidas.json`. Baixa perto de 100 MB.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chaveDaArea } from "../src/app/prototipo/_dados/ambienteMunicipal.ts";
import { areaDoAnel, simplificarAnel } from "./lib-contornos.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const WFS = "https://terrabrasilis.dpi.inpe.br/geoserver/ows";
const URL_BR =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF";
const LARGURA = 1000;
/** Um quarto de pixel no mapa inteiro: nítido ainda com zoom de 3×. */
const TOLERANCIA = 0.4;
/** Ilha ou buraco menor que isto some, mas a área nunca perde o maior pedaço: o traço a mantém visível. */
const ANEL_MINIMO = 0.4;
const POR_PAGINA = 250;

const BIOMAS = [
  { id: "amazonia", espaco: "prodes-amazon-nb", sufixo: "amazon" },
  { id: "cerrado", espaco: "prodes-cerrado-nb", sufixo: "cerrado" },
  { id: "caatinga", espaco: "prodes-caatinga-nb", sufixo: "caatinga" },
  { id: "mata_atlantica", espaco: "prodes-mata-atlantica-nb", sufixo: "mata_atlantica" },
  { id: "pampa", espaco: "prodes-pampa-nb", sufixo: "pampa" },
  { id: "pantanal", espaco: "prodes-pantanal-nb", sufixo: "pantanal" },
];
const RECORTES = [
  { id: "ti", camada: (s) => `indigenous_area_${s}_biome`, campo: "terrai_nom" },
  { id: "uc", camada: (s) => `conservation_units_${s}_biome`, campo: "nome" },
];

async function baixarJson(url) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (r.ok) return await r.json();
      if (r.status < 500) throw new Error(`respondeu ${r.status}`);
      throw new Error(`respondeu ${r.status}`);
    } catch (erro) {
      if (tentativa >= 5) throw new Error(`${url}: ${erro.message}`);
      await new Promise((ok) => setTimeout(ok, 3000 * tentativa));
    }
  }
}

/** Todas as feições de uma camada, em páginas: o total tem de bater com o que o servidor anuncia. */
async function feicoes(camada) {
  const todas = [];
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const q = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: camada,
      outputFormat: "application/json",
      sortBy: "id",
      count: String(POR_PAGINA),
      startIndex: String(inicio),
    });
    const j = await baixarJson(`${WFS}?${q}`);
    todas.push(...j.features);
    const total = j.numberMatched ?? j.totalFeatures;
    if (todas.length >= total || j.features.length === 0) {
      if (todas.length !== total) throw new Error(`${camada}: ${todas.length} de ${total} feições`);
      return todas;
    }
  }
}

const poligonos = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);

// A projeção do mapa.
const brasil = await baixarJson(URL_BR);
const pontos = brasil.features.flatMap((f) => poligonos(f.geometry).flat(2));
const lats = pontos.map(([, lat]) => lat);
const lons = pontos.map(([lon]) => lon);
const latMedia = (Math.min(...lats) + Math.max(...lats)) / 2;
const k = Math.cos((latMedia * Math.PI) / 180);
const xMin = Math.min(...lons) * k;
const yMin = -Math.max(...lats);
const escala = LARGURA / (Math.max(...lons) * k - xMin);
const projetar = ([lon, lat]) => [(lon * k - xMin) * escala, (-lat - yMin) * escala];

const malha = JSON.parse(await readFile(join(RAIZ, "src", "app", "prototipo", "_dados", "ufs.json"), "utf8"));
const altura = Math.round((-Math.min(...lats) - yMin) * escala);
if (malha.largura !== LARGURA || malha.altura !== altura) {
  throw new Error(`A projeção não bate com ufs.json: ${malha.largura}×${malha.altura} contra ${LARGURA}×${altura}`);
}

/** O caminho de uma feição, com a área que ele ocupa no mapa. */
function desenhar(geometria) {
  const aneis = poligonos(geometria).flatMap((p) =>
    p.map((anel) => {
      const fechado = anel.at(-1)[0] === anel[0][0] && anel.at(-1)[1] === anel[0][1];
      return (fechado ? anel.slice(0, -1) : anel).map(projetar);
    }),
  );
  if (!aneis.length) return { d: "", area: 0 };
  const areas = aneis.map(areaDoAnel);
  const maior = Math.max(...areas);
  const d = aneis
    .filter((_, i) => areas[i] >= ANEL_MINIMO || areas[i] === maior)
    .map((anel) => {
      const s = simplificarAnel(anel, TOLERANCIA);
      const final = s.length >= 3 ? s : anel.slice(0, 3);
      return `M${final.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join("L")}Z`;
    })
    .join("");
  return { d, area: maior };
}

const areas = new Map();
for (const b of BIOMAS) {
  for (const r of RECORTES) {
    const camada = `${b.espaco}:${r.camada(b.sufixo)}`;
    const lista = await feicoes(camada);
    let bytes = 0;
    for (const f of lista) {
      const nome = String(f.properties[r.campo] ?? "").trim();
      if (!nome || !f.geometry) continue;
      const { d, area } = desenhar(f.geometry);
      if (!d) continue;
      bytes += d.length;
      const chave = chaveDaArea(r.id, b.id, nome);
      const ja = areas.get(chave);
      if (ja) {
        ja.d += d;
        ja.area += area;
      } else {
        areas.set(chave, { r: r.id, b: b.id, n: nome, d, area });
      }
    }
    console.log(camada, lista.length, `${(bytes / 1024).toFixed(0)} KB`);
  }
}

// As maiores embaixo: uma APA grande não pode cobrir o parque que está dentro dela.
const saida = {
  fonte: "INPE, TerraBrasilis: recortes do PRODES por bioma",
  coletadoEm: new Date().toISOString(),
  areas: [...areas.values()].sort((a, b) => b.area - a.area).map(({ r, b, n, d }) => ({ r, b, n, d })),
};
const texto = `${JSON.stringify(saida)}\n`;
await writeFile(join(RAIZ, "public", "prototipo", "areas-protegidas.json"), texto);
console.log(`${saida.areas.length} áreas, ${(texto.length / 1024).toFixed(0)} KB`);
