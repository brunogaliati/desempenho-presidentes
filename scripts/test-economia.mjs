import test from 'node:test';
import assert from 'node:assert/strict';
import { inadimplenciaNacional, organizarExpectativas, serieComplementar, urlExpectativas } from '../src/app/_painel/_dados/panoramaModelo.ts';
import { corDaMudanca } from '../src/lib/formatar.ts';
import { acumulado12, contraAnoAnterior, regularizar, recortar, governosNoPeriodo, criarCsv, organizarPnad, mesesEntre, alinharTerritorio, compararUf, variacaoDesdeReferencia, reguaComparacao } from '../src/app/_painel/_dados/economiaModelo.ts';

const mandatos = [
  { id: 'dilma_2', nomeCurto: 'Dilma', mandato: 2, inicio: '2015-01-01', fim: '2016-08-31' },
  { id: 'temer', nomeCurto: 'Temer', mandato: 1, inicio: '2016-08-31', fim: '2018-12-31' },
  { id: 'bolsonaro', nomeCurto: 'Bolsonaro', mandato: 1, inicio: '2019-01-01', fim: '2022-12-31' },
  { id: 'lula_3', nomeCurto: 'Lula', mandato: 3, inicio: '2023-01-01', fim: '2026-12-31', emCurso: true },
];

test('crédito nacional exige as 27 UFs e preserva ausência; razão ponderada por carteira', () => {
  assert.equal(inadimplenciaNacional(1000, 60, 27), 6);
  assert.equal(inadimplenciaNacional(1000, 0, 27), 0);
  for (const args of [[1000, 60, 26], [null, 60, 27], [1000, null, 27], [0, 0, 27], [100, 101, 27], [Infinity, 60, 27]]) {
    assert.equal(inadimplenciaNacional(...args), null);
  }
});

test('Focus usa uma fotografia, mesmo horizonte e comparação de pelo menos sete dias', () => {
  const url = urlExpectativas('2026-10-29');
  assert(!url.includes('+'), 'OData do BCB exige espaços como %20, não sinal de soma');
  assert(new URL(url).searchParams.get('$filter').includes("Data le '2026-10-29'"));
  const row = (Data, DataReferencia, Mediana, extra = {}) => ({ Indicador: 'IPCA', IndicadorDetalhe: null, baseCalculo: 0, Data, DataReferencia, Mediana, numeroRespondentes: 100, ...extra });
  const resultado = organizarExpectativas([
    row('2026-10-23', '2026', 4.5), row('2026-10-23', '2027', 4),
    row('2026-10-22', '2026', 99), row('2026-10-16', '2026', 4.6), row('2026-10-16', '2027', 4.1),
    row('2026-10-30', '2026', 100), row('2026-10-23', '2025', 100),
    row('2026-10-23', '2028', null), row('2026-10-23', '2028', 100, { baseCalculo: 1 }),
  ], '2026-10-29');
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map(r => [r.ano, r.mediana, r.anterior, r.dataAnterior]), [
    ['2026', 4.5, 4.6, '2026-10-16'], ['2027', 4, 4.1, '2026-10-16'],
  ]);
  assert.deepEqual(organizarExpectativas([], '2026-10-29'), []);
  assert.throws(() => organizarExpectativas({}, '2026-10-29'));
});

test('séries complementares não criam zeros nem adotam valor ausente como última referência', () => {
  const s = serieComplementar('saldo', 'Saldo', 'Vagas?', 'inteiro', 'vínculos', 'MTE', 'https://example.com', 'Saldo mensal', [
    { mes: '2026-08', valor: null, coletado_em: null }, { mes: '2026-06', valor: 0, coletado_em: null },
    { mes: '2026-07', valor: -100, coletado_em: '2026-10-01' },
  ]);
  assert.deepEqual(s.valores, [0, -100, null]);
  assert.equal(s.referencia, '2026-07'); assert.equal(s.cobertura.lacunas, 1);
});

test('mapa distingue melhora, piora, estabilidade e ausência conforme a direção do indicador', () => {
  assert.equal(corDaMudanca(-2.5, 'menor_melhor'), 'var(--mapa-melhor)');
  assert.equal(corDaMudanca(0.4, 'menor_melhor'), 'var(--mapa-pior)');
  assert.equal(corDaMudanca(2.5, 'maior_melhor'), 'var(--mapa-melhor)');
  assert.equal(corDaMudanca(-0.4, 'maior_melhor'), 'var(--mapa-pior)');
  assert.equal(corDaMudanca(0.01, 'menor_melhor'), 'var(--mapa-estavel)');
  assert.equal(corDaMudanca(2, 'neutro'), 'var(--mapa-estavel)');
  assert.equal(corDaMudanca(null, 'menor_melhor'), 'var(--grade)');
  assert.equal(corDaMudanca(NaN, 'menor_melhor'), 'var(--grade)');
});
test('comparação estadual usa o Brasil da fonte, mesmo período, empates e apenas UFs com dado', () => {
  const l = { brasil: [4, 7], ufs: { SP: [2, 8], SC: [2, 0], BA: [6, 8], RJ: [null, null], AC: [NaN, Infinity] } };
  assert.deepEqual(compararUf(l, 'SP', 0), { valor: 2, brasil: 4, diferenca: -2, total: 3, menor: 1, maior: 2, empatados: 2 });
  assert.deepEqual(compararUf(l, 'SP', 1), { valor: 8, brasil: 7, diferenca: 1, total: 3, menor: 2, maior: 1, empatados: 2 });
  assert.equal(compararUf(l, 'SC', 1).valor, 0);
  assert.equal(compararUf(l, 'RJ', 0), null);
  assert.equal(compararUf(l, 'AC', 0), null);
  assert.equal(compararUf(l, 'XX', 0), null);
  assert.equal(compararUf(l, 'SP', 2), null);
  const semBrasil = compararUf({ ...l, brasil: [null] }, 'SP', 0);
  assert.equal(semBrasil.brasil, null);
  assert.equal(semBrasil.diferenca, null);
  assert.equal(semBrasil.menor, 1);
});

test('mudança começa na referência com zero neutro, conserva unidades e não inventa base ausente', () => {
  assert.equal(variacaoDesdeReferencia([10, 8, 6], 1, 0, true), null);
  assert.equal(variacaoDesdeReferencia([10, 8, 6], 1, 1, true), 0);
  assert.equal(corDaMudanca(variacaoDesdeReferencia([10, 8, 6], 1, 1, true), 'menor_melhor'), 'var(--mapa-estavel)');
  assert.equal(variacaoDesdeReferencia([10, 8, 6], 1, 2, true), -2);
  assert.equal(variacaoDesdeReferencia([10, 8, 6], 1, 2, false), -25);
  assert.equal(variacaoDesdeReferencia([0, 3], 0, 0, false), 0);
  assert.equal(variacaoDesdeReferencia([0, 3], 0, 1, false), null);
  for (const base of [null, NaN, Infinity]) {
    assert.equal(variacaoDesdeReferencia([base, 3], 0, 0, true), null);
    assert.equal(variacaoDesdeReferencia([base, 3], 0, 1, true), null);
  }
  assert.equal(variacaoDesdeReferencia([8, null], 0, 1, true), null);
  assert.equal(variacaoDesdeReferencia([8, 6], null, 1, true), null);
});

test('régua estadual conserva escala entre UFs, compara valores iguais e preserva ausência', () => {
  const contexto = [2, 4, 8, null, NaN];
  const primeira = reguaComparacao(2, 4, contexto), segunda = reguaComparacao(8, 4, contexto);
  assert.deepEqual(primeira, { minimo: 0, maximo: 10, estado: 20, brasil: 40 });
  assert.equal(segunda.maximo, primeira.maximo);
  assert.equal(segunda.brasil, primeira.brasil);
  assert.equal(reguaComparacao(4, 4, contexto).estado, primeira.brasil);
  assert.deepEqual(reguaComparacao(0, 0), { minimo: 0, maximo: 1, estado: 0, brasil: 0 });
  assert.equal(reguaComparacao(null, 4).estado, null);
  assert.equal(reguaComparacao(4, null).brasil, null);
  assert.equal(reguaComparacao(NaN, Infinity).estado, null);
  assert.equal(reguaComparacao(NaN, Infinity).brasil, null);
  const negativo = reguaComparacao(-2, 4);
  assert(negativo.minimo < -2 && negativo.estado > 0 && negativo.estado < negativo.brasil && negativo.brasil < 100);
  const reais = reguaComparacao(74931, 51478);
  assert(reais.maximo > 74931 && reais.estado > reais.brasil && reais.estado < 100);
});

test('IPCA: 1% por 12 meses compõe 12,68%, sem somar taxas', () => {
  const datas = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual(acumulado12({ datas, valores: datas.map(() => 1) }), { datas: ['2025-12'], valores: [12.68] });
  const lacuna = datas.map(() => 1); lacuna[3] = null;
  assert.deepEqual(acumulado12({ datas, valores: lacuna }).valores, [null]);
});
test('calendário mensal preserva lacuna e exclui futuro e moeda anterior ao Real', () => {
  assert.deepEqual(regularizar({ datas: ['1994-06', '2026-01', '2026-03', '2026-12'], valores: [999, 2, 0, 9] }, 'mensal', '2026-03-12'), { datas: ['2026-01', '2026-02', '2026-03'], valores: [2, null, 0] });
});
test('PIB usa fim do trimestre civil e somente trimestres concluídos', () => {
  assert.deepEqual(regularizar({ datas: ['2026-01', '2026-04', '2026-07'], valores: [100, 102, 103] }, 'trimestral', '2026-08-15'), { datas: ['2026-03', '2026-06'], valores: [100, 102] });
});
test('comparação anual usa o mesmo período e não a posição anterior disponível', () => {
  const s = { datas: ['2024-03', '2024-09', '2025-03', '2025-06', '2025-09'], valores: [100, 0, 110, 120, 2] };
  assert.deepEqual(contraAnoAnterior(s), { datas: ['2025-03', '2025-06', '2025-09'], valores: [10, null, null] });
});
test('transformação antes do recorte conserva a janela de cálculo', () => {
  const datas = Array.from({ length: 24 }, (_, i) => `${2024 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`);
  const p = recortar(acumulado12({ datas, valores: datas.map(() => 1) }), '2025-01', '2025-03');
  assert.deepEqual(p.valores, [12.68, 12.68, 12.68]);
});
test('contexto identifica meses e trimestres que atravessam mandatos', () => {
  assert.deepEqual(governosNoPeriodo('2016-08', 1, mandatos).map(p => p.id), ['dilma_2', 'temer']);
  assert.deepEqual(governosNoPeriodo('2023-01', 3, mandatos).map(p => p.id), ['bolsonaro', 'lula_3']);
  assert.deepEqual(governosNoPeriodo('2023-03', 3, mandatos).map(p => p.id), ['lula_3']);
  assert.deepEqual(governosNoPeriodo('2023-11', 12, mandatos).map(p => p.id), ['bolsonaro', 'lula_3']);
});
test('PNAD não troca ausência por zero e rejeita duplicação da medida', () => {
  const linhas = [{ nivel: 'N1', codigo_territorio: '1', periodo: '202601', valor: '5.8' }, { nivel: 'N1', codigo_territorio: '1', periodo: '202602', valor: 5.6 }, { nivel: 'N3', codigo_territorio: '35', periodo: '202602', valor: 0 }];
  const dados = organizarPnad(linhas);
  assert.deepEqual(dados.brasil, [5.8, 5.6]); assert.deepEqual(dados.ufs['35'], [null, 0]);
  assert.throws(() => organizarPnad([...linhas, linhas[0]]), /duplicadas/);
});
test('CSV conserva valores negativos, ausência, acentos e aspas; bloqueia fórmulas textuais', () => {
  assert.equal(criarCsv(['rótulo', 'valor'], [['A "B"', -1.25], ['=1+1', null]]), '\ufeff"rótulo";"valor"\r\n"A ""B""";"-1,25"\r\n"\'=1+1";""');
});
test('território alinha meses, mantém ausência nula e ignora período fora da lista', () => {
  assert.deepEqual(mesesEntre('2025-11', '2026-02'), ['2025-11', '2025-12', '2026-01', '2026-02']);
  const s = alinharTerritorio([
    { nivel: 'N3', codigo: '35', periodo: '2026-01', valor: 6.1 },
    { nivel: 'N3', codigo: '35', periodo: '2026-03', valor: 6.4 },
    { nivel: 'N1', codigo: '1', periodo: '2026-02', valor: 0 },
    { nivel: 'N3', codigo: '35', periodo: '2027-01', valor: 9 },
  ], ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(s.ufs['35'], [6.1, null, 6.4]);
  assert.deepEqual(s.brasil, [null, 0, null]);
});
