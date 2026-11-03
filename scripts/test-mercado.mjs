import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarIbovespa, janelaMercado, montarIbovespa } from '../src/app/prototipo/_dados/mercadoModelo.ts';

test('B3 converte pontos brasileiros, preserva calendário e exclui ausências/futuro', () => {
  const json = { results: [
    { day: 2, rateValue1: '123.456,78', rateValue2: '', rateValue3: null },
    { day: 31, rateValue2: '999,00', rateValue10: '1.000,00' },
    { day: 30, rateValue10: '124.000,01', rateValue11: '125.000,00' },
  ] };
  assert.deepEqual(normalizarIbovespa(json, 2026, '2026-10-30'), [
    { data: '2026-01-02', valor: 123456.78 }, { data: '2026-10-30', valor: 124000.01 },
  ]);
  assert.deepEqual(normalizarIbovespa({ results: [{ day: 29, rateValue2: '1,00' }] }, 2024, '2026-10-30'), [{ data: '2024-02-29', valor: 1 }]);
});
test('B3 rejeita formato incorreto e duplicações conflitantes, sem duplicar valores idênticos', () => {
  const r = { day: 2, rateValue1: '123.456,78' };
  assert.equal(normalizarIbovespa({ results: [r, r] }, 2026, '2026-10-30').length, 1);
  assert.throws(() => normalizarIbovespa({ results: [r, { ...r, rateValue1: '99,00' }] }, 2026, '2026-10-30'));
  for (const json of [null, {}, { results: [{ day: 0 }] }, { results: [{ day: 1, rateValue1: 'abc' }] }, { results: [{ day: 1, rateValue1: '0' }] }]) {
    assert.throws(() => normalizarIbovespa(json, 2026, '2026-10-30'));
  }
});
test('janela usa data real, base estritamente anterior e unidade de variação correta', () => {
  const ds = ['2025-10-29', '2025-10-30', '2026-10-29', '2026-10-31'];
  const janela = janelaMercado(ds, [100, 120, 150, 999], '1a', '2026-10-30', false);
  assert.equal(janela.base.data, '2025-10-29'); assert.equal(janela.ultimo.valor, 150); assert.equal(janela.variacao, 50);
  assert.equal(janela.pontos.length, 2);
  assert.equal(janelaMercado(ds, [10, 12, 15, 99], '1a', '2026-10-30', true).variacao, 5);
  assert.equal(janelaMercado(ds, [0, 12, 15, 99], '1a', '2026-10-30', false).variacao, null);
  assert.equal(janelaMercado([], [], '1a', '2026-10-30', false).ultimo, null);
  assert.equal(janelaMercado(ds, [100, null, null, 99], '1a', '2026-10-30', false).variacao, null);
  assert.equal(janelaMercado(ds, [100, 120, 150, 999], '2021', '2026-10-30', false).base, null);
  assert.equal(janelaMercado(ds, [100, 120, 150, 999], '3a', '2026-10-30', false).inicio, '2023-10-30');
  const mandato = janelaMercado(['2022-12-29', '2023-01-02', '2026-10-29'], [100, 105, 150], 'mandato', '2026-10-30', false);
  assert.equal(mandato.base.data, '2022-12-29'); assert.equal(mandato.pontos.length, 2); assert.equal(mandato.variacao, 50);
});
test('falha anual sinaliza indisponibilidade e interrompe a linha; cache antigo sinaliza defasagem', () => {
  const hoje = '2026-10-30'; const agora = Date.parse('2026-10-30T15:00:00Z');
  const ok = { status: 'fulfilled', value: { pontos: [{ data: '2025-10-30', valor: 100 }], coletadoEm: '2026-10-30T14:00:00Z' } };
  const erro = { status: 'rejected', reason: new Error('Fonte fora do ar') };
  const parcial = montarIbovespa([2025, 2026], [ok, erro], hoje, agora);
  assert.deepEqual(parcial.anosAusentes, [2026]); assert.equal(parcial.defasada, true); assert.deepEqual(parcial.valores, [100, null]);
  const antigo = { status: 'fulfilled', value: { pontos: [{ data: '2026-10-29', valor: 110 }], coletadoEm: '2026-10-29T15:00:00Z' } };
  assert.equal(montarIbovespa([2026], [antigo], hoje, agora).defasada, true);
  assert.deepEqual(montarIbovespa([2026], [erro], hoje, agora).valores, [null]);
});
