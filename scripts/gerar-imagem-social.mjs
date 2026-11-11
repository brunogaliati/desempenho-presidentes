/** Prévia local: JSON validado pelo backend -> PNG. Não abre servidor nem publica. */
import React from 'react';
import { ImageResponse } from 'next/og.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const h = React.createElement;
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [, , entrada, saida, paleta = 'escura'] = process.argv;
assert(entrada && saida, 'Uso: node scripts/gerar-imagem-social.mjs modelo.json imagem.png [azul|verde|escura]');
const m = JSON.parse(await readFile(entrada, 'utf8'));
assert(m.versao === 1 && m.indicador === 'ipca' && m.pontos.length === 12);
assert(m.pontos.every(p => /^\d{4}-\d{2}-01$/.test(p.periodo) && Number.isFinite(p.valor)));
const paletas = {
  azul: { fundo: '#ffffff', tinta: '#172a40', secundaria: '#5b6b7b', acumulado: '#172a40', historico: '#b7c7d8', queda: '#d55649', destaque: '#245dcc', eixo: '#bcc7d1' },
  verde: { fundo: '#ffffff', tinta: '#202d28', secundaria: '#617269', acumulado: '#202d28', historico: '#b5cbc2', queda: '#d36651', destaque: '#14765c', eixo: '#bccbc4' },
  escura: { fundo: '#141b25', tinta: '#f1f5f9', secundaria: '#b0bdcd', acumulado: '#f1f5f9', historico: '#52687f', queda: '#ff947b', destaque: '#7cc8ef', eixo: '#546578' },
};
assert(Object.hasOwn(paletas, paleta), 'Paleta desconhecida');
const cores = paletas[paleta];
const flex = (s = {}) => ({ display: 'flex', ...s });
const texto = (s, style = {}) => h('div', { style: flex(style) }, s);
const numero = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const x0 = 18, x1 = 1454, topo = 37, fundo = 289, altura = 338;
const valores = m.pontos.map(p => p.valor);
const min = Math.min(0, Math.floor(Math.min(...valores) * 2) / 2);
const max = Math.max(0.5, Math.ceil(Math.max(...valores) * 2) / 2);
const y = v => topo + (max - v) / (max - min) * (fundo - topo);
const passo = (x1 - x0) / m.pontos.length;
const x = i => x0 + passo * (i + 0.5);
const marca = `data:image/svg+xml;base64,${(await readFile(resolve(raiz, 'public/icone.svg'))).toString('base64')}`;
const virouAlta = valores.at(-1) > 0 && valores.at(-2) < 0;
const corBarra = (p, i) => i === 11 ? cores.destaque : p.valor < 0 ? cores.queda : cores.historico;
const destaques = new Set([valores.indexOf(Math.max(...valores)), 10, 11]);

const grafico = h('div', { style: flex({ position: 'relative', width: 1472, height: altura }) },
  texto('@desempenhodogov', { position: 'absolute', left: 468, top: 112, fontSize: 46, fontWeight: 600, color: cores.tinta, opacity: 0.055 }),
  h('svg', { width: 1472, height: altura, viewBox: `0 0 1472 ${altura}`, style: { position: 'absolute', left: 0, top: 0 } },
    h('line', { x1: x0, x2: x1, y1: y(0), y2: y(0), stroke: cores.eixo, strokeWidth: 1 }),
    ...m.pontos.map((p, i) => h('rect', { key: p.periodo, x: x(i) - 37, y: Math.min(y(p.valor), y(0)), width: 74, height: Math.max(1, Math.abs(y(p.valor) - y(0))), rx: 3, fill: corBarra(p, i) })),
  ),
  ...m.pontos.map((p, i) => h(React.Fragment, { key: p.periodo },
    destaques.has(i) && texto(numero(p.valor), { position: 'absolute', left: x(i) - 49, top: p.valor < 0 ? y(p.valor) + 5 : y(p.valor) - 37, width: 98, justifyContent: 'center', fontSize: 29, fontWeight: 600, color: i === 11 || p.valor < 0 ? corBarra(p, i) : cores.secundaria }),
    texto(`${meses[Number(p.periodo.slice(5, 7)) - 1]}${i === 0 || p.periodo.slice(5, 7) === '01' || i === 11 ? `/${p.periodo.slice(2, 4)}` : ''}`, { position: 'absolute', left: x(i) - 48, top: 305, width: 96, justifyContent: 'center', fontSize: 25, color: i === 11 ? cores.destaque : cores.secundaria }),
  )),
);

const card = h('div', { style: flex({ width: '100%', height: '100%', flexDirection: 'column', background: cores.fundo, color: cores.tinta, padding: '46px 64px 30px', fontFamily: 'Inter', position: 'relative' }) },
  h('div', { style: flex({ alignItems: 'center', gap: 13, paddingBottom: 29 }) },
    h('img', { src: marca, width: 44, height: 44, alt: '' }),
    texto('Desempenho do Governo', { fontSize: 28, fontWeight: 600, letterSpacing: -0.7 }),
  ),
  texto(virouAlta ? 'Preços voltam a subir' : m.titulo, { fontSize: 70, fontWeight: 600, letterSpacing: -2.8, marginTop: 10 }),
  h('div', { style: flex({ alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 43 }) },
    h('div', { style: flex({ flexDirection: 'column' }) },
      texto(m.valor, { fontSize: 143, fontWeight: 600, color: cores.destaque, letterSpacing: -6, lineHeight: 1.02 }),
      texto(`IPCA de ${m.referencia}`, { marginTop: 8, fontSize: 29, color: cores.secundaria }),
    ),
    h('div', { style: flex({ flexDirection: 'column', marginRight: 9, paddingTop: 20 }) },
      texto(m.acumulado, { fontSize: 64, fontWeight: 600, letterSpacing: -2, color: cores.acumulado }),
      texto('em 12 meses', { marginTop: 4, fontSize: 28, color: cores.secundaria }),
    ),
  ),
  texto('Mês a mês, em %', { fontSize: 24, color: cores.secundaria, marginBottom: 4 }),
  grafico,
  h('div', { style: flex({ marginTop: 'auto', paddingTop: 24, alignItems: 'center', justifyContent: 'space-between' }) },
      texto(`Fonte: ${m.fonte}`, { fontSize: 23, color: cores.secundaria }),
      texto('@desempenhodogov', { fontSize: 25, fontWeight: 600, color: cores.tinta }),
  ),
);
const fonts = await Promise.all([['Inter-Regular.ttf', 400], ['Inter-SemiBold.ttf', 600]].map(async ([nome, weight]) => ({ name: 'Inter', data: await readFile(resolve(raiz, 'public/fontes', nome)), weight, style: 'normal' })));
const response = new ImageResponse(card, { width: 1600, height: 900, fonts });
const png = Buffer.from(await response.arrayBuffer());
assert(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
await mkdir(dirname(resolve(saida)), { recursive: true });
await writeFile(saida, png);
console.log(JSON.stringify({ arquivo: resolve(saida), width: 1600, height: 900, bytes: png.length, assinatura: m.assinatura, paleta }));
