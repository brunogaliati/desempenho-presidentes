// Usa somente o site em 3000; não inicia nem encerra o Next.js.
// node scripts/test-capa-recorte.mjs
// BASE=http://localhost:3000 também serve para o worker local (opennextjs-cloudflare preview).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.BASE ?? 'http://localhost:3000';
const ROBOS = {
  WhatsApp: 'WhatsApp/2.23.20.0 A',
  Telegram: 'TelegramBot (like TwitterBot)',
  Facebook: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'iMessage': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
  X: 'Twitterbot/1.0',
  LinkedIn: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  Bluesky: 'Mozilla/5.0 (compatible; Cardyb/1.1; +mailto:support@bsky.app)',
};

const decodificar = (t) => t.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

/** Lê como um robô: só até o fim do <head>. O que vier depois, ele não vê. */
async function cabecalho(link, ua = ROBOS.WhatsApp) {
  const resposta = await fetch(base + link, { headers: { 'user-agent': ua } });
  assert.equal(resposta.status, 200, link);
  const leitor = resposta.body.getReader();
  let html = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    html += Buffer.from(value).toString('utf8');
    if (html.includes('</head>')) { await leitor.cancel(); break; }
  }
  const fim = html.indexOf('</head>');
  assert(fim > 0, `${link}: sem </head>`);
  const head = html.slice(0, fim);
  const meta = (nome, atributo = 'property') => {
    const m = head.match(new RegExp(`<meta[^>]*${atributo}="${nome}"[^>]*content="([^"]*)"`));
    return m ? decodificar(m[1]) : null;
  };
  return { head, meta, byte: html.indexOf('og:image'), canonica: head.match(/rel="canonical" href="([^"]*)"/)?.[1] };
}
const caminhoDe = (url) => { const u = new URL(url); return u.pathname + u.search; };

const DIVIDA = '/economia?mandato=lula_3&r.serie=divida_bruta_pib&painel=de-perto';

// Todo robô precisa achar o cartão no <head>: quem só lê o começo não veria a metatag no corpo.
for (const [nome, ua] of Object.entries(ROBOS)) {
  const { meta, byte, canonica } = await cabecalho(DIVIDA, ua);
  assert.match(meta('og:image') ?? '', /\/compartilhar\/recorte\?mandato=lula_3&serie=divida_bruta_pib&d=\d{4}-\d{2}-\d{2}&v=/, `${nome}: ${meta('og:image')}`);
  assert.equal(meta('twitter:image', 'name'), meta('og:image'), `${nome}: o X vê o mesmo cartão`);
  assert.match(meta('og:title') ?? '', /^Dívida bruta no governo Lula: de [\d,]+% para [\d,]+% do PIB$/, `${nome}: ${meta('og:title')}`);
  assert(byte > 0 && byte < 16 * 1024, `${nome}: og:image no byte ${byte}`);
  // O Facebook raspa o que o og:url disser: na home, sem o recorte, ele veria a capa genérica.
  assert.match(meta('og:url') ?? '', /\/economia\?mandato=lula_3&r\.serie=divida_bruta_pib&painel=de-perto$/, `${nome}: ${meta('og:url')}`);
  // A busca continua vendo a página, e não uma cópia por recorte.
  assert.doesNotMatch(canonica ?? '', /\?/, `${nome}: canônica ${canonica}`);
}
console.log(`PASSOU: ${Object.keys(ROBOS).join(', ')} acham o cartão no <head>.`);

// A regra: o que cada botão do painel leva e o cartão que isso abre.
const REGRA = [
  ['/economia', /\/compartilhar\?pagina=%2Feconomia/, 'sem recorte, a capa da página'],
  ['/economia?mandato=lula_3', /recorte\?mandato=lula_3&d=/, 'botão do painel: o placar'],
  ['/economia?mandato=lula_3&painel=de-perto', /recorte\?mandato=lula_3&serie=inflacao12m&d=/, 'gráfico sem série no link: a que o painel abre'],
  ['/economia?mandato=lula_3&painel=governo-a-governo', /recorte\?tema=economia&mandato=lula_3&secao=governo-a-governo/, 'a tabela comparativa tem capa própria'],
  ['/economia?mandato=lula_3&painel=mapa-economia', /recorte\?mandato=lula_3&leitura=desocupacao&d=/, 'o mapa: a primeira medida'],
  ['/economia?mandato=lula_3&painel=mapa-economia&r.mapa.indicador=subutilizacao', /leitura=subutilizacao/, 'o mapa: a medida escolhida'],
  ['/economia?mandato=lula_3&uf=BA&painel=mapa-economia', /leitura=desocupacao&uf=BA&d=/, 'o mapa com um estado'],
  ['/economia?mandato=lula_3&uf=BA&painel=de-perto', /leitura=desocupacao&uf=BA&d=/, 'o gráfico do estado'],
  ['/economia?mandato=lula_3&uf=BA&painel=de-perto&r.leitura=null&r.serie=selic', /serie=selic/, 'no estado, a série nacional escolhida'],
  ['/economia?uf=BA&mandato=lula_3', /\/compartilhar\?pagina=%2Feconomia/, 'painel de um estado: a capa da página'],
  ['/economia?mandato=gov-2015&uf=BA&painel=mapa-economia', /mandato=gov-2015&leitura=/, 'o mandato de governador de 2015'],
  ['/economia?mandato=fhc_1&painel=mapa-economia', /recorte\?mandato=fhc_1&d=/, 'governo sem dado por estado: o placar, como a frase'],
  ['/economia?mandato=naoexiste', /recorte\?mandato=lula_3&d=/, 'mandato que não existe: o painel abre o atual, e o cartão também'],
  ['/economia?mandato=lula_3&r.serie=naoexiste&painel=de-perto', /\/compartilhar\?pagina=%2Feconomia/, 'série que não existe: a capa da página'],
  ['/meio-ambiente', /\/compartilhar\?pagina=%2Fmeio-ambiente/, 'meio ambiente sem recorte'],
  ['/meio-ambiente?mandato=lula_3', /recorte\?tema=ambiente&mandato=lula_3&d=/, 'o placar do meio ambiente'],
  ['/meio-ambiente?mandato=lula_3&painel=de-perto', /tema=ambiente&mandato=lula_3&serie=prodes_amazonia/, 'o gráfico do meio ambiente'],
  ['/meio-ambiente?mandato=lula_3&painel=desmatamento', /grafico=desmatamento&bioma=amazonia/, 'barras por ano e governo, sem virar placar do mandato'],
  ['/meio-ambiente?mandato=lula_3&painel=mapa-ambiente', /secao=mapa-ambiente/, 'o mapa não deve virar o placar do governo'],
  ['/dinheiro?mandato=lula_3', /\/compartilhar\?pagina=%2Fdinheiro/, 'dinheiro não tem cartão por mandato'],
  ['/presidente/lula', /\/presidente\/lula\/opengraph-image/, 'o perfil sem recorte'],
  ['/presidente/lula?mandato=lula_1', /recorte\?mandato=lula_1&d=/, 'o perfil num mandato'],
  ['/presidente/lula?mandato=bolsonaro', /recorte\?mandato=lula_3&d=/, 'mandato de outra pessoa no perfil: o último dela, como a tela'],
  ['/presidente/lula?mandato=lula_2&r.serie=selic&painel=de-perto', /mandato=lula_2&serie=selic/, 'o gráfico no perfil'],
];
for (const [link, esperado, porque] of REGRA) {
  const { meta } = await cabecalho(link);
  assert.match(meta('og:image') ?? '', esperado, `${porque}: ${link} -> ${meta('og:image')}`);
}
console.log(`PASSOU: os ${REGRA.length} tipos de link pedem o cartão certo.`);

// O botão das barras leva o bioma e a história inteira, e não o placar de Lula.
for (const [bioma, nome, inicio] of [
  ['amazonia', 'Amazônia Legal', '1988'], ['cerrado', 'Cerrado'],
  ['caatinga', 'Caatinga', '2017'], ['mata_atlantica', 'Mata Atlântica', '2017'],
  ['pampa', 'Pampa', '2017'], ['pantanal', 'Pantanal', '2017'], ['todos', 'Seis biomas', '2017'],
]) {
  const link = `/meio-ambiente?mandato=lula_3&painel=desmatamento&r.desmatamento.bioma=${bioma}`;
  const { meta } = await cabecalho(link);
  assert.match(meta('og:title'), /^Desmatamento por ano e por governo: /);
  assert(meta('og:title').includes(nome));
  if (inicio) assert(meta('og:title').includes(`(${inicio}–`));
  assert.doesNotMatch(meta('og:title'), /no governo Lula|melhoraram/);
  assert.equal(meta('og:url'), new URL(link, base).href.replace(new URL(base).origin, 'https://desempenhodogoverno.com.br'));
  assert.match(meta('og:image'), new RegExp(`grafico=desmatamento&bioma=${bioma}&d=`));
  const r = await fetch(base + caminhoDe(meta('og:image')));
  assert.equal(r.status, 200, bioma);
  assert.equal(r.headers.get('content-type'), 'image/png');
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert(bytes.length < 300 * 1024);
}
console.log('PASSOU: os sete recortes de desmatamento têm título e gráfico próprios, preservando o link.');

// Todos os botões dos terminais devem identificar a seção em vez de cair no placar.
const SECOES = [
  ['/economia', 'governo-a-governo', 'Economia governo a governo'],
  ['/economia', 'estados', 'Indicadores econômicos por estado'],
  ['/economia', 'emprego-e-credito', 'Emprego com carteira'],
  ['/economia', 'bloco-credito-e-inadimplencia', 'Crédito e inadimplência'],
  ['/economia', 'bloco-ritmo-no-mandato', 'Ritmo no mandato'],
  ['/economia', 'bloco-governadores-por-partido', 'Governadores por partido'],
  ['/economia', 'bloco-brasil-e-o-mundo', 'Brasil e o mundo'],
  ['/economia', 'bloco-ultimos-dados', 'Últimos dados'],
  ['/economia', 'bloco-orcamento-federal-em-2026', 'Orçamento federal'],
  ['/economia', 'fontes', 'Fontes dos indicadores econômicos'],
  ['/meio-ambiente', 'mapa-ambiente', 'Meio ambiente no mapa'],
  ['/meio-ambiente', 'biomas', 'Indicadores dos biomas'],
  ['/meio-ambiente', 'temporada', 'Temporada do fogo'],
  ['/meio-ambiente', 'protegidas', 'Desmatamento em áreas protegidas'],
  ['/meio-ambiente', 'municipios', 'Onde se desmata e o que o Ibama fez lá'],
  ['/meio-ambiente', 'estados', 'Meio ambiente por estado'],
  ['/meio-ambiente', 'fontes', 'Fontes dos indicadores ambientais'],
  ['/meio-ambiente', 'bloco-ritmo-no-mandato', 'Ritmo ambiental no mandato'],
  ...[['orcamento', 'Para onde vai cada R$ 100'], ['orcamento-detalhe', 'Orçamento: detalhe da despesa'], ['ano-a-ano', 'Orçamento ano a ano'], ['de-onde-veio', 'De onde veio o dinheiro público'], ['emendas', 'Emendas Pix'], ['todas-as-linhas', 'Todas as linhas do orçamento'], ['fontes-dinheiro', 'Fontes e limites do orçamento']].map(([secao, titulo]) => ['/dinheiro', secao, titulo]),
];
for (const [caminho, secao, titulo] of SECOES) {
  const { meta, canonica } = await cabecalho(`${caminho}?mandato=lula_3&painel=${secao}`);
  assert(meta('og:title').startsWith(titulo), `${secao}: ${meta('og:title')}`);
  assert.match(meta('og:image'), new RegExp(`secao=${secao}(?:&[^&]+=[^&]*)*&d=`));
  assert.match(meta('og:image'), /conteudo=dados-v1/);
  assert.doesNotMatch(canonica, /\?/);
  const r = await fetch(base + caminhoDe(meta('og:image')));
  assert.equal(r.status, 200, secao);
  assert.equal(r.headers.get('content-type'), 'image/png');
  await r.arrayBuffer();
}
for (const link of ['/economia?mandato=lula_3&uf=SP&painel=bloco-quem-governou-sp', '/dinheiro?mandato=lula_3&uf=BA&r.ano=2024&painel=orcamento']) {
  const { meta } = await cabecalho(link);
  assert.match(meta('og:image'), /&uf=(SP|BA)/);
  if (link.startsWith('/dinheiro')) { assert.match(meta('og:title'), /Bahia · 2024/); assert.match(meta('og:image'), /ano=2024/); }
}
console.log(`PASSOU: ${SECOES.length} seções têm capa específica, com território/ano e canônica preservados.`);

// Mudar um filtro precisa mudar a imagem dos dados, não só o endereço da imagem.
async function imagemFiltrada(link,nome) {
 const {meta}=await cabecalho(link),r=await fetch(base+caminhoDe(meta('og:image')));
 assert.equal(r.status,200,link);const bytes=Buffer.from(await r.arrayBuffer());
 assert.equal(bytes.subarray(1,4).toString(),'PNG');
 assert(bytes.length<300*1024,`${nome}: imagem grande demais (${bytes.length})`);
 if(process.env.CAPAS_DIR){await fs.mkdir(process.env.CAPAS_DIR,{recursive:true});await fs.writeFile(path.join(process.env.CAPAS_DIR,nome+'.png'),bytes);}
 return createHash('sha256').update(bytes).digest('hex');
}
const VARIACOES=[
 ['credito','/economia?mandato=lula_3&painel=bloco-credito-e-inadimplencia','r.credito.pessoa=pf','r.credito.pessoa=pj'],
 ['estados','/economia?mandato=lula_3&painel=estados','r.estados.modo=posse','r.estados.modo=hoje'],
 ['ordem','/economia?mandato=lula_3&painel=estados',`r.estados.ordem=${encodeURIComponent(JSON.stringify({id:'desocupacao',desc:true}))}`,`r.estados.ordem=${encodeURIComponent(JSON.stringify({id:'desocupacao',desc:false}))}`],
 ['biomas','/meio-ambiente?mandato=lula_3&painel=biomas','r.fiscalizacao.modo=posse','r.fiscalizacao.modo=hoje'],
 ['protegidas','/meio-ambiente?mandato=lula_3&painel=protegidas','r.protegidas.tipo=ti','r.protegidas.tipo=uc'],
 ['ano-protegidas','/meio-ambiente?mandato=lula_3&painel=protegidas','r.protegidas.ano=2024','r.protegidas.ano=2025'],
 ['orcamento','/dinheiro?mandato=lula_3&painel=orcamento','r.ano=2024','r.ano=2025'],
 ['familia','/dinheiro?mandato=lula_3&painel=orcamento','r.ano=2025','r.ano=2025&r.orcamento.familia=beneficios'],
 ['emendas','/dinheiro?mandato=lula_3&painel=emendas&r.ano=2025','r.emendas.modo=hab','r.emendas.modo=tot'],
 ['busca','/dinheiro?mandato=lula_3&painel=emendas&r.ano=2025','','r.emendas.busca=zzzzzzzzzzzz'],
 ['mapa','/meio-ambiente?mandato=lula_3&painel=mapa-ambiente','r.mapa.modo=total','r.mapa.modo=posse'],
 ['mapa-recorte','/meio-ambiente?mandato=lula_3&painel=mapa-ambiente','r.mapa.recorte=municipios','r.mapa.recorte=estados'],
 ['mapa-areas','/meio-ambiente?mandato=lula_3&painel=mapa-ambiente','r.mapa.lente=ti','r.mapa.lente=uc'],
 ['historico','/economia?mandato=lula_3&painel=de-perto&r.serie=selic','r.faixa=mandato','r.faixa=tudo'],
 ['tabela-historica','/economia?mandato=lula_3&painel=de-perto&r.serie=selic&r.faixa=tudo','r.historico.tabela=false','r.historico.tabela=true'],
];
for(const [nome,link,a,b] of VARIACOES){const antes=await imagemFiltrada(link+'&'+a,nome+'-a'),depois=await imagemFiltrada(link+'&'+b,nome+'-b');assert.notEqual(antes,depois,`${nome}: filtro não mudou a imagem`);}
console.log(`PASSOU: ${VARIACOES.length} variações alteram os pixels da imagem com os filtros selecionados.`);

const emendas=await(await fetch(base+'/api/painel/dinheiro?tipo=emendas&ano=2025')).json();
const municipioComPlano=emendas.municipios.find(m=>m[3]>0);
assert(municipioComPlano,'A fonte deve ter um município com planos para validar o detalhe.');
const planos=await(await fetch(base+'/api/painel/dinheiro?tipo=planos&ano=2025&cnpj='+municipioComPlano[5])).json();
assert(planos.length>0,'O município selecionado deve retornar os planos anunciados pela fonte.');
const filtroPlano='r.emendas.detalhe='+encodeURIComponent('cnpj:'+municipioComPlano[5]);
const listaPlanos=await imagemFiltrada('/dinheiro?mandato=lula_3&painel=emendas&r.ano=2025&'+filtroPlano,'lista-planos');
const plano=await imagemFiltrada('/dinheiro?mandato=lula_3&painel=emendas&r.ano=2025&'+filtroPlano+'&r.emendas.plano='+planos[0].id,'plano-selecionado');
assert.notEqual(listaPlanos,plano,'Abrir um plano deve mudar a tabela da imagem.');
console.log('PASSOU: a lista e o plano específico de emenda têm tabelas próprias.');

// A imagem existe, e o mesmo molde vale para todo governo.
for (const mandato of ['fhc_1', 'fhc_2', 'lula_1', 'lula_2', 'dilma_1', 'dilma_2', 'temer', 'bolsonaro', 'lula_3']) {
  const { meta } = await cabecalho(`/economia?mandato=${mandato}`);
  assert.match(meta('og:title'), /^Economia no governo .+ \(\d{4}–\d{4}\): /, meta('og:title'));
  assert.doesNotMatch(meta('og:title'), /\b0 /, 'Nada de "0 pioraram"');
  const r = await fetch(base + caminhoDe(meta('og:image')));
  assert.equal(r.status, 200, mandato);
  assert.equal(r.headers.get('content-type'), 'image/png', mandato);
  const bytes = Buffer.from(await r.arrayBuffer());
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG', mandato);
  assert(bytes.length < 300 * 1024, `${mandato}: o WhatsApp recusa imagem grande (${bytes.length})`);
}
console.log('PASSOU: os nove mandatos têm cartão, com o mesmo título.');

// O número muda: nenhum pedido pode mandar o navegador guardar a imagem por um ano.
for (const vez of ['primeiro pedido', 'segundo pedido']) {
  const r = await fetch(`${base}/compartilhar/recorte?mandato=lula_3&d=2026-01-01&v=${process.pid}`);
  assert.equal(r.status, 200);
  await r.arrayBuffer();
  assert.doesNotMatch(r.headers.get('cache-control') ?? '', /immutable|31536000/, `${vez}: ${r.headers.get('cache-control')}`);
}
console.log('PASSOU: a imagem não fica presa no navegador.');

// Só ids dos dados chegam ao desenho, e nada do endereço chega às metatags sem codificar.
for (const q of ['', 'mandato=naoexiste', 'mandato=lula_3&serie=naoexiste', 'mandato=lula_3&leitura=naoexiste', 'mandato=lula_3&leitura=desocupacao&uf=ZZ', 'mandato=lula_3&leitura=desocupacao&periodo=9999', 'mandato=gov-2015', 'mandato=lula_3&d=lixo', 'mandato=lula_3&d=<script>', 'mandato=lula_3&grafico=naoexiste', 'mandato=lula_3&grafico=desmatamento&bioma=naoexiste', 'mandato=lula_3&tema=economia&secao=constructor', 'mandato=lula_3&tema=dinheiro&secao=orcamento&uf=ZZ', 'mandato=lula_3&tema=dinheiro&secao=orcamento&ano=NaN']) {
  const r = await fetch(`${base}/compartilhar/recorte?${q}`);
  assert.equal(r.status, 404, `A imagem precisa recusar: ${q} (${r.status})`);
}
const { head } = await cabecalho(`${DIVIDA}&r.x=${encodeURIComponent('"><script>alert(1)</script>')}`);
assert.doesNotMatch(head, /<script>alert/, 'O endereço não vira HTML');
console.log('PASSOU: a imagem recusa id que não existe, e o endereço não vira HTML.');
