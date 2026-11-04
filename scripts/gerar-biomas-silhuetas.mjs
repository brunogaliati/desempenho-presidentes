/**
 * O desenho de cada bioma e o do Brasil, para as miniaturas do seletor na aba de
 * meio ambiente.
 *
 *     node scripts/gerar-biomas-silhuetas.mjs
 *
 * Junta os contornos dos municípios de cada bioma, os mesmos que o mapa enquadra
 * ao tocar nele: a miniatura e o mapa não discordam. Vizinhos usam os mesmos
 * vértices, então uma aresta que aparece duas vezes é fronteira interna e sai; o
 * que sobra é o contorno. Depois simplifica, porque o desenho sai com uns 40 px, e
 * tira os anéis pequenos demais para aparecer.
 *
 * Rodar de novo depois de `gerar-biomas-municipios.mjs`. Lê
 * `public/painel/municipios-brasil.json` e
 * `src/app/_painel/_dados/biomas-municipios.json`, e grava
 * `src/app/_painel/_dados/biomas-silhuetas.json`.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { areaDoAnel, simplificarAnel } from "./lib-contornos.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOLERANCIA = 4;
const AREA_MINIMA = 180;

/** Os anéis de um caminho "M..L..Z" como listas de [x, y], sem repetir o ponto final. */
function aneisDe(d) {
  return d
    .split("M")
    .filter(Boolean)
    .map((trecho) => {
      const n = (trecho.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      const pontos = [];
      for (let i = 0; i + 1 < n.length; i += 2) pontos.push([n[i], n[i + 1]]);
      const [p, u] = [pontos[0], pontos.at(-1)];
      if (pontos.length > 1 && p[0] === u[0] && p[1] === u[1]) pontos.pop();
      return pontos;
    });
}

/** Os anéis do contorno de um grupo de formas: fica só a aresta que aparece um número ímpar de vezes. */
function contorno(formas) {
  const arestas = new Map();
  for (const f of formas) {
    for (const anel of aneisDe(f.d)) {
      anel.forEach((a, i) => {
        const b = anel[(i + 1) % anel.length];
        const [ka, kb] = [String(a), String(b)];
        const chave = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        if (arestas.has(chave)) arestas.delete(chave);
        else arestas.set(chave, [ka, kb]);
      });
    }
  }
  const vizinhos = new Map();
  for (const [chave, [a, b]] of arestas) {
    for (const [de, para] of [[a, b], [b, a]]) {
      if (!vizinhos.has(de)) vizinhos.set(de, []);
      vizinhos.get(de).push({ para, chave });
    }
  }
  const usadas = new Set();
  const aneis = [];
  for (const inicio of vizinhos.keys()) {
    for (;;) {
      const primeira = vizinhos.get(inicio).find((v) => !usadas.has(v.chave));
      if (!primeira) break;
      const anel = [inicio];
      let atual = inicio;
      for (;;) {
        const prox = vizinhos.get(atual).find((v) => !usadas.has(v.chave));
        if (!prox) break;
        usadas.add(prox.chave);
        atual = prox.para;
        if (atual === inicio) break;
        anel.push(atual);
      }
      aneis.push(anel.map((p) => p.split(",").map(Number)));
    }
  }
  return aneis;
}

function caminho(formas) {
  return contorno(formas)
    .filter((anel) => areaDoAnel(anel) >= AREA_MINIMA)
    .map((anel) => simplificarAnel(anel, TOLERANCIA))
    .filter((anel) => anel.length >= 3)
    .map((anel) => `M${anel.map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join("L")}Z`)
    .join("");
}

const malha = JSON.parse(await readFile(join(RAIZ, "public", "painel", "municipios-brasil.json"), "utf8"));
const biomas = JSON.parse(await readFile(join(RAIZ, "src", "app", "_painel", "_dados", "biomas-municipios.json"), "utf8"));

const grupos = {};
for (const m of malha.municipios) {
  const b = biomas.municipios[m.codigo];
  if (b) (grupos[b] ??= []).push(m);
}
const IDS = Object.keys(biomas.caixas);
if (IDS.some((b) => !grupos[b]?.length)) throw new Error("bioma sem municípios");

let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
for (const m of malha.municipios) {
  for (const anel of aneisDe(m.d)) {
    for (const [x, y] of anel) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
}

const saida = {
  viewBox: `${Math.floor(x0)} ${Math.floor(y0)} ${Math.ceil(x1 - x0)} ${Math.ceil(y1 - y0)}`,
  brasil: caminho(malha.municipios),
  biomas: Object.fromEntries(IDS.map((b) => [b, caminho(grupos[b])])),
};
const texto = `${JSON.stringify(saida)}\n`;
await writeFile(join(RAIZ, "src", "app", "_painel", "_dados", "biomas-silhuetas.json"), texto);
console.log(`${(texto.length / 1024).toFixed(1)} KB`, saida.viewBox);
for (const [k, d] of [["brasil", saida.brasil], ...Object.entries(saida.biomas)]) {
  console.log(k, `${d.length} bytes`, `${d.split("M").length - 1} anéis`);
}
