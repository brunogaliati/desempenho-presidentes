import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orientacaoDoGoverno } from './congresso-coleta-modelo.mjs';
import { HISTORICO, LEGISLATURA, VOTO_POR_LETRA, porcento, taxa } from '../src/app/_painel/_dados/congressoModelo.ts';

const ler = casa => JSON.parse(readFileSync(new URL(`../public/painel/congresso/plenario-${casa}.json`, import.meta.url), 'utf8'));
const fotografia = JSON.parse(readFileSync(new URL('../src/app/_painel/_dados/fotografia.json', import.meta.url), 'utf8'));

test('taxa sem base fica nula e porcentagem arredonda', () => {
  assert.equal(taxa([3, 4]), 0.75);
  assert.equal(taxa([0, 0]), null);
  assert.equal(porcento(null), '—');
  assert.equal(porcento(0.996), '100%');
  assert.equal(porcento(0.814), '81%');
});

test('orientação do governo reconhece as siglas históricas sem incluir partidos ou voto liberado', () => {
  for (const nome of ['Governo','GOV.','GOV',' governo ']) {
    assert.equal(orientacaoDoGoverno(nome,'SIM'),'Sim');
    assert.equal(orientacaoDoGoverno(nome,'Não'),'Não');
    assert.equal(orientacaoDoGoverno(nome,'Liberado'),null);
  }
  assert.equal(orientacaoDoGoverno('PT','Sim'),null);
  assert.equal(orientacaoDoGoverno(null,null),null);
});

for (const casa of ['deputados', 'senadores']) {
  test(`plenário dos ${casa}: períodos, pessoas e votos batem entre si`, () => {
    const p = ler(casa);
    assert.equal(p.casa, casa);
    const periodos = [...p.anos.map(String), LEGISLATURA, HISTORICO];
    for (const periodo of periodos) assert.ok(p.totais[periodo], `falta o total de ${periodo}`);
    // A legislatura soma os anos.
    const somaAnos = p.anos.reduce((s, a) => s + p.totais[a].votacoes, 0);
    assert.equal(p.totais[HISTORICO].votacoes, somaAnos);
    assert.ok(p.totais[HISTORICO].votacoes > p.totais[LEGISLATURA].votacoes);
    if (casa === 'deputados') assert.ok(p.totais[2019].governo > 0, 'orientações GOV. do Plenário de 2019 entram no histórico');

    const ids = fotografia[casa].map(x => String(x.id));
    assert.deepEqual(Object.keys(p.votos).sort(), [...ids].sort(), 'uma linha de votos por pessoa da fotografia');
    for (const [id, letras] of Object.entries(p.votos)) {
      assert.equal(letras.length, p.votacoes.length, `votos de ${id} fora do tamanho da lista`);
      for (const l of letras) assert.ok(l in VOTO_POR_LETRA, `letra desconhecida "${l}" em ${id}`);
    }
    for (const [id, porPeriodo] of Object.entries(p.pessoas)) {
      for (const chave of ['s','v','g']) {
        if (!porPeriodo[HISTORICO]?.[chave]) continue;
        const soma = p.anos.reduce((s,a) => s.map((v,i) => v + (porPeriodo[a]?.[chave]?.[i] ?? 0)), [0,0]);
        assert.deepEqual(porPeriodo[HISTORICO][chave], soma, `${id}: soma histórica de ${chave}`);
      }
      for (const [periodo, x] of Object.entries(porPeriodo)) {
        assert.ok(periodos.includes(periodo), `${id}: período ${periodo}`);
        for (const par of [x.s, x.v, x.g].filter(Boolean)) assert.ok(par[0] >= 0 && par[0] <= par[1], `${id} ${periodo}: ${par}`);
        assert.ok(x.v[1] <= p.totais[periodo].votacoes, `${id} ${periodo}: mais votações que a casa`);
        if (x.s) assert.ok(x.s[1] <= p.totais[periodo].sessoes, `${id} ${periodo}: mais sessões que a casa`);
      }
    }
    // A lista vem da mais nova para a mais antiga, com placar e orientação válidos.
    const datas = p.votacoes.map(v => v.data);
    assert.deepEqual(datas, [...datas].sort().reverse());
    for (const v of p.votacoes) {
      assert.ok(v.governo === null || v.governo === 'Sim' || v.governo === 'Não');
      assert.ok(v.sim + v.nao > 0 || v.placarInformado === false, `votação ${v.id}: falta indicar ausência de placar`);
      assert.ok(v.ementa.length <= 321 && v.descricao.length <= 261, `votação ${v.id}: texto longo demais`);
    }
  });
}
