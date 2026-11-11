import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoPainel, linkDaEconomia } from '../src/lib/rotasPainel.ts';
import { TEMAS_PAINEL, temaDoCaminho } from '../src/lib/temasPainel.ts';

test('links antigos chegam diretamente ao tema público, sem outro protótipo', () => {
  for (const aba of [undefined, 'economia', 'mercado', 'congresso', 'desconhecida']) assert.equal(destinoPainel({aba}), '/economia');
  assert.equal(destinoPainel({aba:'resumo'}), '/');
  for (const aba of ['ambiente', 'queimadas']) assert.equal(destinoPainel({aba}), '/meio-ambiente');
  assert.equal(destinoPainel({aba:'dinheiro'}), '/dinheiro');
});

test('a migração preserva o primeiro território e mandato e descarta a visão obsoleta', () => {
  assert.equal(destinoPainel({aba:['queimadas','dinheiro'],uf:['pa','sp'],mandato:['lula_1','lula_3'],visao:'mapa'}), '/meio-ambiente?uf=PA&mandato=lula_1');
  assert.equal(destinoPainel({aba:'dinheiro',uf:'SP',mandato:'a&aba=ambiente'}), '/dinheiro?uf=SP&mandato=a%26aba%3Dambiente');
});

test('Congresso é uma rota adicional e mantém os caminhos dos painéis existentes', () => {
  for (const [caminho, tema] of [['/', 'resumo'], ['/economia', 'economia'], ['/meio-ambiente', 'ambiente'], ['/dinheiro', 'dinheiro'], ['/congresso', 'congresso']]) {
    assert.equal(temaDoCaminho(caminho), tema);
    assert.equal(TEMAS_PAINEL[tema].caminho, caminho);
  }
  assert.equal(temaDoCaminho('/presidente/lula'), 'economia');
  assert.equal(temaDoCaminho('/congresso/deputados/aecio-neves-74646'), 'congresso', 'a página do parlamentar fica na aba');
  assert.equal(temaDoCaminho('/congressoX'), 'economia');
  assert.equal(temaDoCaminho('/resumo'), 'resumo', '/resumo continua abrindo o Resumo');
  assert.equal(destinoPainel({aba:'congresso',uf:'SP'}), '/economia?uf=SP');
});

test('a home é o Resumo; os links da Economia de quando ela era a home seguem para /economia', () => {
  const q = (s) => new URLSearchParams(s);
  for (const s of ['r.serie=selic&painel=de-perto', 'mandato=lula_3&painel=governo-a-governo', 'painel=mapa-economia&r.mapa.indicador=subutilizacao', 'uf=SP&painel=bloco-quem-governou-sp', 'r.estados.modo=posse'])
    assert.equal(linkDaEconomia(q(s)), true, s);
  for (const s of ['', 'uf=SP', 'mandato=lula_3', 'uf=PI&r.resumo.partido=PT', 'painel=resumo-saude', 'painel=bloco-orcamento-federal-em-2026'])
    assert.equal(linkDaEconomia(q(s)), false, s);
});
