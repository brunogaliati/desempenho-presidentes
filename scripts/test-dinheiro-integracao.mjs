// Com o dev ligado e DATABASE_URL no ambiente:
//   node --env-file=.env.local scripts/test-dinheiro-integracao.mjs [porta]
import assert from 'node:assert/strict';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
const base = `http://localhost:${process.argv[2] ?? 3000}/api/painel/dinheiro`;
async function get(query) {
  const r = await fetch(`${base}?${query}`);
  assert.equal(r.status, 200, query);
  return r.json();
}

const painel = await get('tipo=painel');
assert.ok(Object.keys(painel.entes).length === 28, '27 estados e a União');

// Blocos fecham com o total em todo ente e período.
for (const [sigla, e] of Object.entries(painel.entes)) {
  for (const [k, p] of Object.entries(e.anos)) {
    const soma = Object.values(p.v).reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(soma - p.t) / p.t < 0.005, `${sigla} ${k}: ${soma} contra ${p.t}`);
  }
}

// Conferência com o Tesouro (R$ bilhões, liquidado, sem refinanciamento).
const bi = (x) => Math.round(x / 1e8) / 10;
const u = painel.entes.BR.anos['2025'];
const [{ pensoes }] = await sql`select coalesce(sum(realizado), 0)::float8 as pensoes from mart.orcamento_acao where exercicio=2025 and funcao='28' and subfuncao='846' and acao='0179'`;
assert.equal(bi(u.t), 3705.4);
assert.equal(bi(u.v.previdencia - pensoes), 1101.5);
assert.equal(bi(u.v.divida), 593.4);
assert.equal(bi(u.v.transf), 469.9);
// Banco Central em bloco próprio; com a CGU no banco, as pensões militares voltam a Previdência.
assert.equal(bi(u.v.bancocentral), 124);
assert.ok(painel.abertura, 'orçamento por ação carregado');
assert.equal(bi(pensoes), 26);
assert.equal(bi(u.v.outros + u.v.bancocentral + pensoes), 345.8);
// A dívida abre com as linhas do próprio Anexo 02.
assert.equal(bi(painel.entes.BR.abre['2025'].divida.reduce((s, [, x]) => s + x, 0)), bi(u.v.divida));
// "O que tem dentro" soma a linha inteira.
const dentro = painel.entes.BR.abre['2025'].outros;
assert.ok(Math.abs(dentro.reduce((s, [, x]) => s + x, 0) - u.v.outros) < 2);
assert.equal(bi(u.v.saude), 217.1);
assert.equal(bi(u.v.educacao), 157);
const sp = painel.entes.SP.anos['2025'];
// O repasse a municípios fica fora da base dos estados, e o total da fonte segue fechando.
assert.equal(bi(sp.t + sp.fora), 355.4);
assert.equal(bi(sp.fora), 75.9);
assert.equal(sp.v.transf, undefined);
assert.equal(bi(sp.v.educacao), 69.3);
assert.equal(bi(sp.v.seguranca), 17.7);

// 2022 fecha com o Anexo 01, sem o refinanciamento contratual.
assert.equal(bi(painel.entes.BR.anos['2022'].t), 2675.8);

// População do IBGE: em 2025, 213,4 milhões no Brasil, e Roraima não fica 14% abaixo.
const [ibge] = await sql`select populacao::float8 as p from mart.populacao_estimada where nivel='N1' and ano=2025`;
assert.equal(u.p, ibge.p);
const [rr] = await sql`select populacao::float8 as p from mart.populacao_estimada where nivel='N3' and codigo_ibge='14' and ano=2025`;
assert.equal(painel.entes.RR.anos['2025'].p, rr.p);

// "Arrecadado" não leva empréstimo novo.
const r = painel.receita['2025'];
const [corrente] = await sql`select valor::float8 as v from mart.rreo_federal where exercicio=2025 and bimestre=6 and conta_codigo='ReceitasCorrentes' and coluna='Até o Bimestre (c)' and (rotulo='Padrão' or rotulo is null)`;
assert.ok(Math.abs(r.t - r.emp - r.cap - corrente.v) < 1);

// Emendas: total igual ao do banco e municípios ligados ao CNPJ.
const emendas = await get('tipo=emendas&ano=2025');
const [total] = await sql`select count(*)::int as q, sum(coalesce(valor_custeio_plano_acao,0)+coalesce(valor_investimento_plano_acao,0))::float8 as v from mart.transferegov_plano_acao_especial where ano_plano_acao=2025`;
assert.equal(emendas.total.q, total.q);
assert.ok(Math.abs(emendas.total.v - total.v) < 1);
assert.ok(emendas.municipios.length > 4000);

// Planos por município e o detalhe sem multiplicar vínculos.
const m = emendas.municipios[0];
const planos = await get(`tipo=planos&ano=2025&cnpj=${m[5]}`);
assert.ok(planos.length > 0 && planos.every((p) => p.uf === m[1]));
const detalhe = await get(`tipo=detalhe&ano=2025&id=${planos[0].id}`);
const [empenhos] = await sql`select count(*)::int as n from mart.transferegov_empenho_especial where id_plano_acao=${planos[0].id}::bigint`;
assert.equal(detalhe.empenhos.length, empenhos.n);

console.log('PASSOU (orçamento e emendas consultados no banco).');
