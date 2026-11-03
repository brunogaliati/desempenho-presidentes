import test from 'node:test';
import assert from 'node:assert/strict';
import { acumuladoPeriodo, montarInflacao } from '../src/app/prototipo/_dados/economiaModelo.ts';
import { metadataPagina } from '../src/lib/seo.ts';
import { ROTA_INFLACAO } from '../src/lib/catalogoEconomia.ts';

const ano = (taxa = 1) => ({ datas: Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`), valores: Array(12).fill(taxa) });

test('IPCA compõe os fatores: 1% ao mês por 12 meses é 12,68%, não 12%', () => {
  const r = montarInflacao(ano(), '2025-12-31');
  assert.equal(r.ultimo.mensal, 1);
  assert.equal(r.ultimo.ano, 12.68);
  assert.equal(r.ultimo.dozeMeses, 12.68);
  assert.equal(r.historico[10].dozeMeses, null);
  assert.equal(acumuladoPeriodo(r.mensal, '2025-01', '2025-12'), 12.68);
});

test('acumulado no ano reinicia em janeiro, enquanto 12 meses atravessa os anos', () => {
  const s = ano(); s.datas.push('2026-01'); s.valores.push(2);
  const r = montarInflacao(s, '2026-01-31');
  assert.equal(r.ultimo.ano, 2);
  assert.equal(r.ultimo.dozeMeses, 13.8);
  assert.equal(r.anuais[0].mes, '2026-01');
  assert.equal(r.anuais[1].mes, '2025-12');
});

test('meses ausentes não viram zero e impedem acumulados que atravessam a lacuna', () => {
  const s = ano(); s.datas.splice(1, 1); s.valores.splice(1, 1);
  const r = montarInflacao(s, '2025-12-31');
  assert.equal(r.historico[1].mes, '2025-02'); assert.equal(r.historico[1].mensal, null);
  assert.equal(r.ultimo.ano, null); assert.equal(r.ultimo.dozeMeses, null);
  assert.equal(acumuladoPeriodo(s, '2025-01', '2025-03'), null);
  assert.equal(acumuladoPeriodo(r.mensal, '2025-03', '2025-04'), 2.01);
});

test('deflação e zero são dados válidos; intervalo inclui os dois meses', () => {
  const s = { datas: ['2025-01', '2025-02', '2025-03'], valores: [-1, 0, 1] };
  const r = montarInflacao(s, '2025-03-31');
  assert.equal(r.historico[0].mensal, -1);
  assert.equal(r.historico[1].mensal, 0);
  assert.equal(acumuladoPeriodo(s, '2025-01', '2025-01'), -1);
  assert.equal(acumuladoPeriodo(s, '2025-01', '2025-03'), -0.01);
  assert.equal(acumuladoPeriodo(s, '2025-02', '2025-02'), 0);
});

test('recorte não cruza o Plano Real nem inclui mês futuro', () => {
  const datas = Array.from({ length: 12 }, (_, i) => `${1994 + Math.floor((i + 6) / 12)}-${String((i + 6) % 12 + 1).padStart(2,'0')}`);
  const s = { datas: ['1994-06', ...datas, '2026-12'], valores: [50, ...Array(12).fill(1), 90] };
  const r = montarInflacao(s, '1995-06-30');
  assert.equal(r.historico[0].mes, '1994-07');
  assert.equal(r.ultimo.mes, '1995-06');
  assert.equal(r.ultimo.dozeMeses, 12.68);
  assert.equal(r.historico[5].ano, null);
  assert.equal(r.anuais.length, 1);
});

test('vazio, não finitos, inflação impossível e datas inválidas não produzem acumulados', () => {
  assert.throws(() => montarInflacao({ datas: [], valores: [] }, '2025-12-31'));
  const s = ano(); s.valores[1] = NaN; s.valores[2] = -100; s.valores[3] = Infinity;
  const r = montarInflacao(s, '2025-12-31');
  assert.equal(r.historico[1].mensal, null); assert.equal(r.historico[2].mensal, null);
  assert.equal(r.ultimo.ano, null);
  assert.equal(acumuladoPeriodo(ano(), '2025-12', '2025-01'), null);
  assert.equal(acumuladoPeriodo(ano(), '', '2025-12'), null);
});

test('inflação tem canônica e compartilhamento próprios', () => {
  const m = metadataPagina('IPCA acumulado', 'Dados do IBGE', ROTA_INFLACAO);
  assert.equal(m.alternates.canonical, '/economia/inflacao');
  assert.equal(m.openGraph.url, ROTA_INFLACAO);
  assert.equal(m.twitter.title, 'IPCA acumulado');
});
