// Usa somente o servidor existente em 3000; não inicia ou encerra o Next.js.
// node scripts/test-navbar.mjs [diretorio-das-capturas]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = 'http://localhost:3000/prototipo';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch { /* Aguarda o navegador ou o React. */ }
    await delay(150);
  }
  throw new Error(`Tempo esgotado: ${label}`);
}

const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
assert.equal(response.status, 200, 'O servidor compartilhado 3000 precisa estar disponível');
const profile = await mkdtemp(join(tmpdir(), 'desempenho-navbar-'));
const browser = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
let send;
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
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  });
  send = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, { resolve, reject });
    socket.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const viewport = async (width, height) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 760 });
    await delay(350);
  };
  const capture = async name => {
    if (!process.argv[2]) return;
    await mkdir(process.argv[2], { recursive: true });
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(process.argv[2], name), Buffer.from(shot.data, 'base64'));
  };
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await viewport(1440, 900);
  await send('Page.navigate', { url });
  await until(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('.tema-interruptor')`), 'cabeçalho');
  await delay(3000);
  await capture('navbar-desktop.png');
  const overlay = await evaluate(`(() => { const h = document.querySelector('.prototipo-cabecalho'), mapa = document.querySelector('.sala-tema'), painel = h.parentElement; return { background: getComputedStyle(h).backgroundColor, position: getComputedStyle(h).position, mapTop: mapa.getBoundingClientRect().top, padding: parseFloat(getComputedStyle(painel).paddingTop), height: h.offsetHeight, mapBehind: !!document.elementFromPoint(8, 6)?.closest('.sala-tema') }; })()`);
  assert.equal(overlay.background, 'rgba(0, 0, 0, 0)', 'Sem faixa opaca atrás da navbar');
  assert.equal(overlay.position, 'fixed');
  assert(Math.abs(overlay.mapTop) < 1 && overlay.mapBehind, 'Mapa contínuo sob a navbar');
  assert(Math.abs(overlay.padding - overlay.height) < 1, 'Conteúdo inicial abaixo da navbar');
  assert.equal(await evaluate(`document.querySelector('.cabecalho-painel').textContent.includes('Protótipo')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.navegacao-temas button').length`), 4);
  const progress = await evaluate(`(() => { const p = document.querySelector('.mandato-trilho'); return [Number(p.getAttribute('aria-valuenow')), Number(p.getAttribute('aria-valuemax'))]; })()`);
  assert(progress[0] >= 0 && progress[0] <= progress[1]);
  const marcos = await evaluate(`Array.from(document.querySelectorAll('a.mandato-marco')).map(m => ({ url: m.href, label: m.getAttribute('aria-label'), target: m.target }))`);
  assert.equal(marcos.length, 4, 'Quatro atos verificados na timeline');
  assert(marcos.every(m => m.url.startsWith('https://') && new URL(m.url).hostname.endsWith('.leg.br') && m.target === '_blank' && !m.label.includes('exemplo')), 'Cada marco abre uma fonte legislativa oficial e não se apresenta como exemplo');
  await evaluate(`document.querySelector('.mandato-marco').focus()`);
  await until(() => evaluate(`!!document.querySelector('.mandato-marcos [role="status"]')`), 'marco por teclado');
  await evaluate(`document.activeElement.blur()`);
  const initialTheme = await evaluate(`document.querySelector('.tema-interruptor').getAttribute('aria-checked')`);
  await click('.tema-interruptor');
  assert.notEqual(await evaluate(`document.querySelector('.tema-interruptor').getAttribute('aria-checked')`), initialTheme);
  await click('.tema-interruptor');
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__linkCopiado = text; } } })`);
  await click('button[aria-label="Compartilhar"]');
  await until(() => evaluate(`window.__linkCopiado === location.href && !!document.querySelector('button[aria-label="Link copiado"]')`), 'compartilhamento');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.navegacao-temas button')).map(b => [b.dataset.opcao, b.disabled])`), [['economia', false], ['ambiente', false], ['congresso', true], ['dinheiro', false]]);
  await click('.navegacao-temas [data-opcao="congresso"]');
  assert.equal(await evaluate(`document.querySelector('.painel-prototipo').dataset.aba`), 'economia');
  await click('.navegacao-temas [data-opcao="ambiente"]');
  await until(() => evaluate(`!!document.querySelector('[data-aba="ambiente"]')`), 'troca de aba');
  await click('.navegacao-temas [data-opcao="economia"]');
  await until(() => evaluate(`!!document.querySelector('.segmentos')`), 'seletores do mapa');
  await click('.segmentos [data-opcao="mudanca"]');
  assert.equal(await evaluate(`document.querySelector('.segmentos [data-opcao="mudanca"]').getAttribute('aria-checked')`), 'true');
  await click('.segmentos [data-opcao="valor"]');
  assert.equal(await evaluate(`document.querySelector('.segmentos [data-opcao="valor"]').getAttribute('aria-checked')`), 'true');
  console.log('PASSOU: selo removido, navegação, tema, compartilhamento, marcos por foco e seletores do mapa.');
  const topBefore = await evaluate(`document.querySelector('.cabecalho-painel').getBoundingClientRect().top`);
  await evaluate(`window.scrollTo({ top: 650, behavior: 'instant' })`);
  await delay(250);
  const topAfter = await evaluate(`document.querySelector('.cabecalho-painel').getBoundingClientRect().top`);
  assert(Math.abs(topAfter - topBefore) < 1 && topAfter >= 0, 'Navbar acompanha a rolagem');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await click('[data-pais="inflacao12m"]');
  await delay(300);
  const anchor = await evaluate(`({ top: document.getElementById('de-perto').getBoundingClientRect().top, headerBottom: document.querySelector('.cabecalho-painel').getBoundingClientRect().bottom })`);
  assert(anchor.top >= anchor.headerBottom, 'Links internos não ficam atrás da navbar');
  await capture('navbar-rolagem.png');
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`);
  console.log('PASSOU: fundo contínuo do mapa, navbar fixa durante rolagem e âncoras sem sobreposição.');
  await delay(3000);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await viewport(width, 900);
    const layout = await evaluate(`(() => { const h = document.querySelector('.prototipo-cabecalho'); const r = h.getBoundingClientRect(); return { width: innerWidth, header: r.right, height: r.height, measured: parseFloat(h.parentElement.style.getPropertyValue('--altura-cabecalho')), tabs: [...h.querySelectorAll('.navegacao-temas button')].map(b => { const q = b.getBoundingClientRect(); return [q.left, q.right]; }) }; })()`);
    assert(layout.header <= layout.width && Math.abs(layout.height - layout.measured) < 1, `Altura/largura do cabeçalho em ${width}px`);
    assert(layout.tabs.every(([left, right]) => left >= 0 && right <= layout.width), `Abas cortadas em ${width}px`);
    if (width === 1440) await capture('navbar-desktop.png');
    if (width === 390) await capture('navbar-celular.png');
  }
  console.log('PASSOU: cabeçalho e abas íntegros em 320, 390, 768, 1024 e 1440px; altura sincronizada com o mapa.');
} finally {
  if (socket?.readyState === WebSocket.OPEN) await Promise.race([send('Browser.close').catch(() => {}), delay(1500)]);
  socket?.close();
  browser.kill();
}
