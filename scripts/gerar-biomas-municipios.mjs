/**
 * O bioma predominante de cada município, do IBGE, e a caixa de cada bioma no
 * mapa, para a aba de meio ambiente enquadrar e destacar um bioma.
 *
 *     node scripts/gerar-biomas-municipios.mjs
 *
 * Usa a lista oficial "Bioma predominante por município" (IBGE, 2024): um
 * bioma por município, o de maior área nele. Município de transição fica no
 * bioma que predomina; o desmatamento dele continua somando os dois biomas.
 * A caixa de cada bioma sai dos contornos dos seus municípios em
 * `public/painel/municipios-brasil.json`, na mesma projeção do mapa: não
 * precisa de outra malha.
 *
 * Grava `src/app/_painel/_dados/biomas-municipios.json`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL_IBGE =
  "https://geoftp.ibge.gov.br/informacoes_ambientais/estudos_ambientais/biomas/documentos/Bioma_Predominante_por_Municipio_2024.csv";
const IDS = {
  "Amazônia": "amazonia",
  Cerrado: "cerrado",
  Caatinga: "caatinga",
  "Mata Atlântica": "mata_atlantica",
  Pampa: "pampa",
  Pantanal: "pantanal",
};

const resposta = await fetch(URL_IBGE);
if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
const texto = new TextDecoder("utf-8").decode(await resposta.arrayBuffer()).replace(/^﻿/, "");
// O arquivo termina com um dicionário dos campos, depois de uma linha de traços.
const [cabecalho, ...resto] = texto.trim().split(/\r?\n/);
const fimDosDados = resto.findIndex((l) => l.startsWith("---"));
const linhas = fimDosDados < 0 ? resto : resto.slice(0, fimDosDados);
const colunas = cabecalho.split(";");
const iCodigo = colunas.findIndex((c) => c.startsWith("Geoc"));
const iBioma = colunas.findIndex((c) => c.startsWith("Bioma"));
if (iCodigo < 0 || iBioma < 0) throw new Error(`cabeçalho inesperado: ${cabecalho}`);

const municipios = {};
for (const linha of linhas) {
  const v = linha.split(";");
  const id = IDS[v[iBioma]?.trim()];
  if (!/^\d{7}$/.test(v[iCodigo]) || !id) throw new Error(`linha inesperada: ${linha}`);
  municipios[v[iCodigo]] = id;
}

const malha = JSON.parse(await readFile(join(RAIZ, "public", "painel", "municipios-brasil.json"), "utf8"));
const caixas = {};
let semBioma = 0;
for (const m of malha.municipios) {
  const b = municipios[m.codigo];
  if (!b) {
    semBioma++;
    continue;
  }
  const c = (caixas[b] ??= [Infinity, Infinity, -Infinity, -Infinity]);
  for (const [, x, y] of m.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)) {
    c[0] = Math.min(c[0], Number(x));
    c[1] = Math.min(c[1], Number(y));
    c[2] = Math.max(c[2], Number(x));
    c[3] = Math.max(c[3], Number(y));
  }
}
for (const b of Object.keys(caixas)) caixas[b] = caixas[b].map((n) => Math.round(n * 10) / 10);

await writeFile(
  join(RAIZ, "src", "app", "_painel", "_dados", "biomas-municipios.json"),
  JSON.stringify({ fonte: URL_IBGE, coletadoEm: new Date().toISOString(), municipios, caixas }) + "\n",
);
console.log(`${Object.keys(municipios).length} municípios; ${semBioma} da malha sem bioma; caixas:`, caixas);
