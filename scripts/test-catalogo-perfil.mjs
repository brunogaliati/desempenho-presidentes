// Usa somente o servidor existente em 3000; não inicia nem encerra o Next.js.
// node scripts/test-catalogo-perfil.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = 'http://localhost:3000';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch { /* Aguarda o navegador ou o React. */ }
    await delay(150);
  }
  throw new Error(`Tempo esgotado: ${label}`);
}

const profile = await mkdtemp(join(tmpdir(), 'desempenho-catalogo-'));
const browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  const port = await until(async () => Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]), 'Chrome');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, { resolve, reject });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  const abrir = async (caminho, seletor) => {
    await send('Page.navigate', { url: base + caminho });
    await until(() => evaluate(`document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(seletor)})`), caminho);
    await delay(1500);
  };
  const naFrente = seletor => `(() => { const e = document.querySelector(${JSON.stringify(seletor)}), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === t || e.contains(t); })()`;

  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await viewport(1280, 800);

  // Antes o perfil abria rolado até "Como ler os mandatos", no fim da página.
  for (const pessoa of ['fhc', 'lula', 'dilma', 'temer', 'bolsonaro']) {
    await abrir('/explorar', `a[href="/presidente/${pessoa}"]`);
    await evaluate(`window.scrollTo({ top: 300, behavior: 'instant' }); document.querySelector('a[href="/presidente/${pessoa}"]').click()`);
    await until(() => evaluate(`location.pathname === '/presidente/${pessoa}' && !!document.getElementById('contexto-presidente')`), `perfil ${pessoa}`);
    await delay(1200);
    assert.equal(await evaluate('scrollY'), 0, `${pessoa}: o perfil abre no topo do painel`);
    assert(await evaluate(`!!document.querySelector('#mapa-economia h1')`), `${pessoa}: o painel aparece`);
  }
  console.log('PASSOU: os cinco perfis abrem no topo do painel a partir do catálogo.');

  // A sala do mapa sobe por trás da linha da trilha e não pode tomar os cliques dela.
  await abrir('/presidente/lula', 'nav[aria-label^="Mandatos de"]');
  assert(await evaluate(naFrente('nav[aria-label^="Mandatos de"] a[aria-label^="1º"]')), 'O mapa não cobre os mandatos');
  assert(await evaluate(naFrente('.compartilhar-gatilho')), 'O mapa não cobre o compartilhar do perfil');
  await evaluate(`document.querySelector('nav[aria-label^="Mandatos de"] a[aria-label^="1º"]').click()`);
  await until(() => evaluate(`location.search.includes('mandato=lula_1')`), 'troca de mandato');
  await abrir('/economia', '.compartilhar-gatilho');
  assert(await evaluate(naFrente('.compartilhar-gatilho')), 'O mapa não cobre o compartilhar da Economia');
  console.log('PASSOU: a linha acima do mapa recebe os cliques e o mandato troca sem sair do perfil.');

  // O expansor: sem triângulo nativo, e fechar não deixa rastro no endereço.
  await abrir('/economia/populacao/bahia', 'details > summary');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('details > summary')).listStyleType`), 'none', 'Sem o triângulo nativo');
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('details > summary'), '::after').content`), 'none', 'Com o chevron do site');
  await evaluate(`document.querySelector('details > summary').click()`);
  await until(() => evaluate(`location.search.includes('=true')`), 'abrir');
  await evaluate(`document.querySelector('details > summary').click()`);
  await until(() => evaluate(`!location.search.includes('r.detalhe')`), 'fechar limpa o endereço');
  console.log('PASSOU: expansor sem marcador nativo; fechar limpa o endereço.');

  // A tabela é o dado: nenhum número pode ficar cortado no celular.
  for (const largura of [360, 390, 430]) {
    await viewport(largura, 800, true);
    await abrir('/economia/populacao/bahia', '#panorama table');
    const medida = await evaluate(`(() => { const caixa = document.querySelector('#panorama table').parentElement; return { tabela: caixa.scrollWidth, caixa: caixa.clientWidth, pagina: document.documentElement.scrollWidth, tela: innerWidth }; })()`);
    assert(medida.tabela <= medida.caixa, `Tabela cortada a ${largura}px: ${medida.tabela} > ${medida.caixa}`);
    assert(medida.pagina <= medida.tela, `Rolagem lateral a ${largura}px`);
  }
  console.log('PASSOU: tabela do panorama inteira em 360, 390 e 430px, sem rolagem lateral.');

  // A frase do recorte: a mesma para qualquer governo, com os números da tela.
  await viewport(1280, 800);
  const dialogo = `(() => { const zap = new URL(document.querySelector('.compartilhar-destinos a').href).searchParams.get('text'), i = zap.lastIndexOf('http'); return { frase: document.querySelector('.compartilhar-frase textarea').value, url: zap.slice(i) }; })()`;
  let linkDaDivida;
  for (const [mandato, nome] of [['lula_3', 'Lula'], ['bolsonaro', 'Bolsonaro'], ['dilma_2', 'Dilma']]) {
    await abrir(`/economia?mandato=${mandato}`, '.grupo-cotacao .compartilhar-gatilho');
    await evaluate(`[...document.querySelectorAll('.grupo-cotacao')].find(c => c.textContent.includes('Dívida bruta')).querySelector('.compartilhar-gatilho').click()`);
    await until(() => evaluate(`!!document.querySelector('.compartilhar-frase textarea')`), 'o diálogo abre');
    const { frase, url } = await evaluate(dialogo);
    assert.match(frase, new RegExp(`^Dívida bruta (subiu|caiu) de [\\d,]+% para [\\d,]+% do PIB no governo ${nome} \\(`), frase);
    assert.match(frase, /Compare os governos:$/, frase);
    assert(frase.length <= 160, `No celular a caixa mostra cinco linhas: ${frase.length} caracteres`);
    assert.doesNotMatch(frase, / · /, `Sem o sufixo do painel: ${frase}`);
    assert.doesNotMatch(url, /r\.(mapa|estados|credito|partido|comparar|leitura|faixa|historico)/, `Só o que difere do padrão: ${url}`);
    assert.match(url, /r\.serie=divida_bruta_pib/);
    if (mandato === 'lula_3') linkDaDivida = url;
  }
  await send('Page.navigate', { url: linkDaDivida });
  await until(() => evaluate(`document.querySelector('#de-perto h3')?.textContent === 'Dívida bruta'`), 'quem recebe abre na dívida');
  console.log('PASSOU: a frase é a mesma para qualquer governo, e o link curto abre no mesmo recorte.');

  // A medida que o mapa mostra sozinho não vai para o link, a não ser que seja dela que se fala.
  await abrir('/economia?mandato=lula_3', '[data-destaque] .compartilhar-gatilho');
  const primeira = await evaluate(`document.querySelector('[data-destaque]').getAttribute('data-destaque')`);
  await until(() => evaluate(`document.querySelector('[data-destaque]').getAttribute('data-destaque') !== ${JSON.stringify(primeira)}`), 'o mapa passeia');
  await evaluate(`document.querySelector('#de-perto .compartilhar-gatilho').click()`);
  await until(() => evaluate(`!!document.querySelector('.compartilhar-frase textarea')`), 'o diálogo abre');
  assert.doesNotMatch((await evaluate(dialogo)).url, /r\.mapa/, 'O passeio do mapa fora do link do gráfico');
  await abrir('/economia?mandato=lula_3', '[data-destaque] .compartilhar-gatilho');
  const medida = await evaluate(`document.querySelector('[data-destaque]').getAttribute('data-destaque')`);
  await until(() => evaluate(`document.querySelector('[data-destaque]').getAttribute('data-destaque') !== ${JSON.stringify(medida)}`), 'o mapa passeia');
  await evaluate(`document.querySelector('[data-destaque] .compartilhar-gatilho').click()`);
  await until(() => evaluate(`!!document.querySelector('.compartilhar-frase textarea')`), 'o diálogo abre');
  assert.match((await evaluate(dialogo)).url, /r\.mapa\.indicador=/, 'O compartilhar do mapa leva a medida de que fala');
  console.log('PASSOU: o passeio do mapa só entra no link quando é dele que se fala.');

  // A prévia do diálogo não pode prometer outro cartão: pede o link como o WhatsApp e compara.
  const metaDoLink = async (link) => {
    const u = new URL(link);
    const html = await (await fetch(base + u.pathname + u.search, { headers: { 'user-agent': 'WhatsApp/2.23.20.0 A' } })).text();
    const meta = (nome) => html.slice(0, html.indexOf('</head>')).match(new RegExp(`<meta[^>]*property="${nome}"[^>]*content="([^"]*)"`))?.[1].replace(/&amp;/g, '&');
    const og = new URL(meta('og:image'));
    return { imagem: og.pathname + og.search, titulo: meta('og:title') };
  };
  const previa = `(() => { const zap = new URL(document.querySelector('.compartilhar-destinos a').href).searchParams.get('text'), i = zap.lastIndexOf('http'); const capa = document.querySelector('.compartilhar-capa img'); return { link: zap.slice(i), imagem: capa && capa.getAttribute('src'), titulo: document.querySelector('.compartilhar-previa strong, .compartilhar-capa ~ * strong')?.textContent }; })()`;
  const conferirPrevia = async (rotulo, caminho, seletor, clicar) => {
    await abrir(caminho, seletor);
    await evaluate(clicar);
    await until(() => evaluate(`!!document.querySelector('.compartilhar-frase textarea')`), `${rotulo}: o diálogo abre`);
    const p = await evaluate(previa);
    const real = await metaDoLink(p.link);
    assert.equal(p.imagem, real.imagem, `${rotulo}: a prévia e o cartão real (${p.link})`);
    assert.match(p.imagem, /\/compartilhar\/recorte\?/, `${rotulo}: ${p.imagem}`);
    return { ...p, real };
  };
  const dividaNaPrevia = await conferirPrevia('série', '/economia?mandato=lula_3', '.grupo-cotacao .compartilhar-gatilho', `[...document.querySelectorAll('.grupo-cotacao')].find(c => c.textContent.includes('Dívida bruta')).querySelector('.compartilhar-gatilho').click()`);
  assert.match(dividaNaPrevia.imagem, /serie=divida_bruta_pib/);
  const placarNaPrevia = await conferirPrevia('placar', '/economia?mandato=bolsonaro', '.compartilhar-gatilho', `document.querySelector('.compartilhar-gatilho').click()`);
  assert.match(placarNaPrevia.imagem, /recorte\?mandato=bolsonaro&d=/);
  // Quem abriu um recorte e compartilha outro bloco vê o cartão desse outro, e não o da página aberta.
  const outra = await conferirPrevia('outro bloco', '/economia?mandato=lula_3&r.serie=selic&painel=de-perto', '.grupo-cotacao .compartilhar-gatilho', `[...document.querySelectorAll('.grupo-cotacao')].find(c => c.textContent.includes('Dívida bruta')).querySelector('.compartilhar-gatilho').click()`);
  assert.match(outra.imagem, /serie=divida_bruta_pib/, outra.imagem);
  const ambienteNaPrevia = await conferirPrevia('meio ambiente', '/meio-ambiente?mandato=lula_3', '#de-perto .compartilhar-gatilho', `document.querySelector('#de-perto .compartilhar-gatilho').click()`);
  assert.match(ambienteNaPrevia.imagem, /tema=ambiente/);
  console.log('PASSOU: a prévia do diálogo é o cartão que os aplicativos recebem.');

  // A contagem do cartão é a do placar da tela.
  await abrir('/economia?mandato=lula_3', '[data-destaque]');
  const naTela = await evaluate(`document.body.innerText`);
  const placarReal = await metaDoLink(base + '/economia?mandato=lula_3');
  const conta = placarReal.titulo.match(/(\d+) melhor\S+ e (\d+) pior/);
  assert(conta, placarReal.titulo);
  assert(new RegExp(`${conta[1]}\\s+melhor`).test(naTela) && new RegExp(`${conta[2]}\\s+pior`).test(naTela), `A tela não diz ${conta[0]}`);
  console.log(`PASSOU: o cartão e o placar da tela dizem o mesmo (${conta[0]}).`);

  // A página de indicador fala com os números dela, e sem nada mudado o link é o endereço.
  await abrir('/economia/emprego-formal/alagoas/maceio', '.compartilhar-gatilho');
  await evaluate(`document.querySelector('.compartilhar-gatilho').click()`);
  await until(() => evaluate(`!!document.querySelector('.compartilhar-frase textarea')`), 'o diálogo abre');
  const maceio = await evaluate(dialogo);
  assert.match(maceio.frase, /^Maceió \(AL\) teve saldo de [+\-−]?[\d.]+ empregos formais em /, maceio.frase);
  assert.match(maceio.url, /\/economia\/emprego-formal\/alagoas\/maceio$/, maceio.url);
  console.log('PASSOU: a página de indicador tem frase própria e link limpo.');
} finally {
  socket?.close();
  browser.kill();
}
