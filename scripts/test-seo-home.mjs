import test from 'node:test';
import assert from 'node:assert/strict';
import { destinoPainel, linkDaEconomia } from '../src/lib/rotasPainel.ts';
import { TEMAS_PAINEL, temaDoCaminho } from '../src/lib/temasPainel.ts';
import { previaHome } from '../src/lib/previaHome.ts';
import { imagemDaPagina } from '../src/lib/seo.ts';
import { readFileSync } from 'node:fs';

test('home entrega prévia social completa sem carregar o painel e usa PNG estático válido', () => {
  const imagem = imagemDaPagina('/');
  assert.match(imagem, /^\/capas\/[^?]+\.png\?v=/);
  const png = readFileSync(new URL('../public' + imagem.split('?')[0], import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  for (const ua of ['WhatsApp/2.24.1.1 A', 'facebookexternalhit/1.1', 'Twitterbot/1.0', 'TelegramBot', 'LinkedInBot', 'Cardyb', 'Discordbot']) {
    const html = previaHome('https://desempenhodogoverno.com.br/', ua);
    assert(html.includes(TEMAS_PAINEL.resumo.titulo));
    assert(html.includes(TEMAS_PAINEL.resumo.descricao));
    assert(html.includes('property="og:image:type" content="image/png"'));
    assert(html.includes(imagem.replaceAll('&', '&amp;')));
    assert(html.includes('property="og:url" content="https://desempenhodogoverno.com.br/"'));
    assert(Buffer.byteLength(html) < 4096);
    assert.doesNotMatch(html, /<script|<meta[^>]*http-equiv="refresh"/);
  }
});

test('prévia rápida preserva navegador, Google e cartões com recortes de governo ou estado', () => {
  for (const ua of ['', 'Mozilla/5.0', 'Googlebot', 'Bingbot']) assert.equal(previaHome('https://desempenhodogoverno.com.br/', ua), null);
  for (const path of ['/economia', '/?mandato=lula_3', '/?uf=SP', '/?painel=de-perto', '/?r.resumo.area=saude']) assert.equal(previaHome('https://desempenhodogoverno.com.br' + path, 'WhatsApp/2.24.1.1 A'), null);
  assert.match(imagemDaPagina('/', '/compartilhar/recorte?mandato=lula_3'), /^\/compartilhar\/recorte\?mandato=lula_3&v=/);
});

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
