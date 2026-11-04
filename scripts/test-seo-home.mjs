import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoPainel } from '../src/lib/rotasPainel.ts';

test('links antigos chegam diretamente ao tema público, sem outro protótipo', () => {
  for (const aba of [undefined, 'economia', 'mercado', 'congresso', 'desconhecida']) assert.equal(destinoPainel({aba}), '/');
  for (const aba of ['ambiente', 'queimadas']) assert.equal(destinoPainel({aba}), '/meio-ambiente');
  assert.equal(destinoPainel({aba:'dinheiro'}), '/dinheiro');
});

test('a migração preserva o primeiro território e mandato e descarta a visão obsoleta', () => {
  assert.equal(destinoPainel({aba:['queimadas','dinheiro'],uf:['pa','sp'],mandato:['lula_1','lula_3'],visao:'mapa'}), '/meio-ambiente?uf=PA&mandato=lula_1');
  assert.equal(destinoPainel({aba:'dinheiro',uf:'SP',mandato:'a&aba=ambiente'}), '/dinheiro?uf=SP&mandato=a%26aba%3Dambiente');
});
