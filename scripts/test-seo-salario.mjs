import test from 'node:test';
import assert from 'node:assert/strict';
import { montarSalarioMinimo, compararSalario } from '../src/lib/salarioMinimoModelo.ts';
import { jsonLd, podeIndexar, metadataPagina } from '../src/lib/seo.ts';

const obs = (serie_id, mes, valor) => ({ serie_id, mes, valor });
const linhas = [
  obs('salario_minimo', '1994-07', 147627),
  obs('salario_minimo', '2022-12', 1212), obs('salario_minimo', '2023-01', 1302),
  obs('salario_minimo', '2023-04', 1302), obs('salario_minimo', '2023-05', 1320),
  obs('salario_minimo', '2023-06', 1320), obs('salario_minimo', '2023-12', 1320),
  obs('salario_minimo_real', '2022-12', 1500), obs('salario_minimo_real', '2023-01', 1600),
  obs('salario_minimo_real', '2023-04', 1580), obs('salario_minimo_real', '2023-05', 1590),
  obs('ipca', '2023-05', 0.5),
];

test('exclui moeda anterior ao recorte e meses futuros; preserva os dois reajustes de 2023', () => {
  const r = montarSalarioMinimo(linhas, '2023-06-10');
  assert.equal(r.historico[0].mes, '2022-12');
  assert.equal(r.ultimo.mes, '2023-06');
  assert.deepEqual(r.reajustes.map((m) => [m.mes, m.nominal]), [['2022-12',1212], ['2023-01',1302], ['2023-05',1320]]);
  assert.equal(r.reajuste.mes, '2023-05');
  assert.equal(r.anterior.nominal, 1302);
});

test('tabela anual alinha nominal e real ao mesmo mês; não inventa real depois do IPCA', () => {
  const r = montarSalarioMinimo(linhas, '2023-06-10');
  assert.equal(r.referenciaReal, '2023-05');
  assert.equal(r.ultimo.real, null);
  assert.equal(r.anuais[0].mes, '2023-05');
  assert.equal(r.anuais[0].real, 1590);
});

test('comparação distingue ganho nominal de perda real e preserva lacunas', () => {
  const r = montarSalarioMinimo(linhas, '2023-06-10');
  const c = compararSalario(r.historico, '2023-01', '2023-05');
  assert(c.nominal > 0); assert(c.real < 0);
  assert.equal(compararSalario(r.historico, '2023-01', '2023-06').real, null);
  assert.equal(compararSalario(r.historico, '2023-06', '2023-01'), null);
  assert.equal(compararSalario(r.historico, '', '2023-06'), null);
  assert.deepEqual(compararSalario(r.historico, '2023-01', '2023-01'), { nominal: 0, real: 0 });
});

test('dados ausentes, não finitos ou IPCA futuro não viram números publicados', () => {
  assert.throws(() => montarSalarioMinimo([], '2023-06-10'));
  assert.throws(() => montarSalarioMinimo([...linhas, obs('ipca','2023-12',0.5)], '2023-06-10'), /futura/);
  const r = montarSalarioMinimo([...linhas, obs('salario_minimo','2023-06',NaN)], '2023-06-10');
  assert(r.historico.every((m) => Number.isFinite(m.nominal)));
});

test('produção indexa; desenvolvimento, preview e bloqueio explícito não indexam', () => {
  assert.equal(podeIndexar({ NODE_ENV: 'production' }), true);
  assert.equal(podeIndexar({ NODE_ENV: 'development' }), false);
  assert.equal(podeIndexar({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }), false);
  assert.equal(podeIndexar({ NODE_ENV: 'production', SEO_INDEXING: 'false' }), false);
  assert.equal(podeIndexar({ NODE_ENV: 'production', VERCEL_ENV: 'preview', SEO_INDEXING: 'true' }), false);
});

test('canônica e compartilhamento apontam para a própria página; JSON-LD não permite fechar script', () => {
  const m = metadataPagina('Salário mínimo', 'Descrição específica', '/economia/salario-minimo');
  assert.equal(m.alternates.canonical, '/economia/salario-minimo');
  assert.equal(m.openGraph.url, m.alternates.canonical);
  const conteudo = { name: '</script><script>alert(1)</script>' };
  assert(!jsonLd(conteudo).includes('<'));
  assert.deepEqual(JSON.parse(jsonLd(conteudo)), conteudo);
});
