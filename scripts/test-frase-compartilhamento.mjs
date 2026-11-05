// node --test scripts/test-frase-compartilhamento.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { fraseDeCrescimento, fraseDeMudanca, fraseDePosicao, fraseDoPlacar, juntar, nomeNaFrase, posicaoDoRitmo } from '../src/lib/fraseCompartilhamento.ts';

const divida = { nome: 'Dívida bruta', unidade: 'do PIB', deTexto: '71,7%', paraTexto: '82,9%', de: 71.66, para: 82.92, governo: 'Lula', periodo: 'dez/2022 a set/2026' };

test('o verbo diz para onde o número foi, e a frase não escreve a diferença', () => {
  assert.equal(fraseDeMudanca(divida), 'Dívida bruta subiu de 71,7% para 82,9% do PIB no governo Lula (dez/2022 a set/2026).');
  assert.doesNotMatch(fraseDeMudanca(divida), /11,[23]/, '82,9 − 71,7 dá 11,2 e o placar diz +11,3: lado a lado, parece erro');
});

test('a mesma frase para qualquer governo e qualquer direção', () => {
  const queda = fraseDeMudanca({ ...divida, deTexto: '75,3%', paraTexto: '71,7%', de: 75.3, para: 71.7, governo: 'Bolsonaro', periodo: 'dez/2018 a dez/2022' });
  assert.equal(queda, 'Dívida bruta caiu de 75,3% para 71,7% do PIB no governo Bolsonaro (dez/2018 a dez/2022).');
  // A frase não pode trocar de tom com o partido, com o lado ou com o sinal.
  for (const frase of [fraseDeMudanca(divida), queda]) assert.doesNotMatch(frase, /explod|dispar|despenc|recorde|culpa|aument(ou|a) a|melhor|pior/i);
});

test('o que o leitor enxerga manda: igual nos dois lados é "ficou em"', () => {
  assert.equal(fraseDeMudanca({ nome: 'Dólar', deTexto: 'R$ 5,28', paraTexto: 'R$ 5,28', de: 5.281, para: 5.284 }), 'Dólar ficou em R$ 5,28.');
});

test('concorda com o substantivo do rótulo', () => {
  assert.match(fraseDeMudanca({ nome: 'Juros reais', deTexto: '6,1%', paraTexto: '9,2%', de: 6.1, para: 9.2 }), /^Juros reais subiram de/);
  assert.match(fraseDeMudanca({ nome: 'Focos de queimada', deTexto: '200', paraTexto: '150', de: 200, para: 150 }), /^Focos de queimada caíram de/);
  assert.match(fraseDeMudanca({ nome: 'Desmatamento nos outros biomas', deTexto: '200', paraTexto: '150', de: 200, para: 150 }), /^Desmatamento nos outros biomas caiu de/);
  assert.match(fraseDeMudanca({ nome: 'Área queimada na Amazônia', deTexto: '1', paraTexto: '2', de: 1, para: 2 }), /^Área queimada na Amazônia subiu de/);
});

test('PIB e renda dizem o quanto cresceram no mandato', () => {
  assert.equal(fraseDeCrescimento({ nome: 'PIB', texto: '+9,1%', governo: 'Lula', ate: '2º tri/2026' }), 'PIB cresceu 9,1% no governo Lula (até 2º tri/2026).');
  assert.equal(fraseDeCrescimento({ nome: 'PIB', texto: '−3,2%', governo: 'Dilma' }), 'PIB encolheu 3,2% no governo Dilma.');
  assert.equal(fraseDeCrescimento({ nome: 'PIB', texto: 'igual' }), 'PIB ficou estável.');
});

test('a posição conta quem foi para o mesmo lado, pelo ritmo', () => {
  // Lula 2, Dilma 1, Dilma 2, Temer, Bolsonaro, Lula 3: a dívida, em pontos por ano.
  const ritmos = [-0.92, 1.13, 7.44, 2.83, -0.9, 3.0];
  assert.deepEqual(posicaoDoRitmo(ritmos, 5), { ordem: 2, lado: 'alta', total: 6 });
  assert.deepEqual(posicaoDoRitmo(ritmos, 2), { ordem: 1, lado: 'alta', total: 6 });
  assert.deepEqual(posicaoDoRitmo(ritmos, 0), { ordem: 1, lado: 'queda', total: 6 });
  assert.equal(fraseDePosicao(posicaoDoRitmo(ritmos, 5), 9), '2º maior ritmo de alta em 6 mandatos com dado.');
  assert.equal(fraseDePosicao(posicaoDoRitmo(ritmos, 0), 6), 'Maior ritmo de queda em 6 mandatos.');
});

test('só o que se destaca vale dizer', () => {
  const ritmos = [-0.92, 1.13, 7.44, 2.83, -0.9, 3.0];
  assert.equal(posicaoDoRitmo(ritmos, 3), null, 'A 3ª maior alta não se destaca');
  assert.equal(posicaoDoRitmo(ritmos, 4), null, 'A 2ª maior entre duas quedas é a menor delas');
  assert.equal(posicaoDoRitmo([1, 2, 3], 2), null, 'Entre poucos mandatos, a fila não diz nada');
  assert.equal(posicaoDoRitmo([1, 2, 3, 4], -1), null, 'Mandato fora da série');
  assert.equal(posicaoDoRitmo([1, 2, null, 4, 5], 2), null, 'Mandato sem dado');
  assert.equal(posicaoDoRitmo([1, 2, 0, 4, 5], 2), null, 'Parado não é alta nem queda');
});

test('o nome na frase, onde o rótulo do painel não abre uma oração', () => {
  assert.deepEqual(nomeNaFrase('divida_bruta_pib', 'Dívida bruta'), { nome: 'Dívida bruta', unidade: 'do PIB' });
  assert.deepEqual(nomeNaFrase('pib', 'Crescimento do PIB'), { nome: 'PIB' });
  assert.deepEqual(nomeNaFrase('selic', 'Juros (Selic)'), { nome: 'Selic' });
  assert.deepEqual(nomeNaFrase('desemprego', 'Desemprego'), { nome: 'Desemprego' });
});

test('junta só as partes que existem', () => {
  assert.equal(juntar('a', null, undefined, false, '', 'b'), 'a b');
});

test('o painel diz a contagem do placar, com a concordância certa', () => {
  assert.equal(fraseDoPlacar({ governo: 'Lula', periodo: '2023–2026', bons: 8, iguais: 0, ruins: 4 }), 'Economia no governo Lula (2023–2026): de 12 indicadores, 8 melhoraram e 4 pioraram desde a posse. Confira um a um:');
  assert.match(fraseDoPlacar({ governo: 'Dilma', periodo: '2015–2016', bons: 1, iguais: 2, ruins: 1 }), /de 4 indicadores, 1 melhorou, 2 ficaram iguais e 1 piorou desde a posse/);
  assert.match(fraseDoPlacar({ governo: 'Lula', periodo: '2003–2006', bons: 6, iguais: 0, ruins: 0 }), /de 6 indicadores, 6 melhoraram e nenhum piorou desde a posse/, 'Nada de "0 pioraram"');
});
