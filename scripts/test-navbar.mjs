// Usa somente o servidor existente em 3000; não inicia ou encerra o Next.js.
// node scripts/test-navbar.mjs [diretorio-das-capturas]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.BASE ?? 'http://localhost:3000/';
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
  const capture = async (name, clip) => {
    if (!process.argv[2]) return;
    await mkdir(process.argv[2], { recursive: true });
    const shot = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}) });
    await writeFile(join(process.argv[2], name), Buffer.from(shot.data, 'base64'));
    return shot.data;
  };
  await send('Page.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await viewport(1440, 900);
  await send('Page.navigate', { url });
  await until(() => evaluate(`document.readyState === 'complete' && !!document.querySelector('.tema-interruptor')`), 'cabeçalho');
  await delay(3000);
  if (process.env.TESTE_MOBILE) {
    for (const rota of ['/', '/economia/populacao/santa-catarina/florianopolis']) {
      await send('Page.navigate', { url:new URL(rota, url).href });
      await until(() => evaluate(`!!document.querySelector('h1') && !!document.querySelector('.navegacao-temas a')`), 'página carregada');
      for (const width of [320, 390, 760, 1024, 1440]) {
        await viewport(width, 900);
        await evaluate(`document.activeElement?.blur(); window.scrollTo({ top:0, behavior:'instant' })`);
        await until(() => evaluate(`!document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido') && Math.abs(document.querySelector('.painel-cabecalho').offsetHeight - parseFloat(getComputedStyle(document.querySelector('.painel-governo')).paddingTop)) < 1`), 'cabeçalho completo');
        const inicial = await evaluate(`(() => { const h=document.querySelector('.cabecalho-painel'), p=h.closest('.painel-governo'), t=document.querySelector('main'); return { altura:h.offsetHeight, reserva:parseFloat(getComputedStyle(p).paddingTop), conteudo:t.getBoundingClientRect().top+scrollY, overflow:document.documentElement.scrollWidth>innerWidth, abas:[...h.querySelectorAll('.navegacao-temas a')].map(a=>{const r=a.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,align:getComputedStyle(a).alignItems}}) }; })()`);
        assert(!inicial.overflow, `${rota}: sem overflow em ${width}px`);
        assert(inicial.abas.every(a=>a.left>=0 && a.right<=width), 'Abas inteiras');
        if (width<=760) assert(inicial.abas.every(a=>a.height>=44 && a.align==='center'), 'Abas centralizadas e com área de toque');
        if (width===390) await capture(rota==='/'?'mobile-inicio.png':'municipal-inicio.png');
        await evaluate(`window.scrollTo({ top:600, behavior:'instant' })`);
        if (width<=760) await until(() => evaluate(`document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido') && document.querySelector('.cabecalho-painel').offsetHeight<65`), 'recolhimento');
        else await delay(100);
        const rolado=await evaluate(`(() => { const h=document.querySelector('.cabecalho-painel'), p=h.closest('.painel-governo'); return { recolhido:h.hasAttribute('data-recolhido'), altura:h.offsetHeight, reserva:parseFloat(getComputedStyle(p).paddingTop), conteudo:document.querySelector('main').getBoundingClientRect().top+scrollY, marca:getComputedStyle(h.querySelector('.marca-painel')).display, mandato:h.querySelector('.mandato-faixa')?getComputedStyle(h.querySelector('.mandato-faixa')).display:null, visivel:parseFloat(getComputedStyle(p).getPropertyValue('--altura-cabecalho-visivel')), limite:h.getBoundingClientRect().bottom }; })()`);
        assert.equal(rolado.recolhido, width<=760, 'Recolhe apenas no celular');
        assert(Math.abs(rolado.reserva-inicial.reserva)<1 && Math.abs(rolado.conteudo-inicial.conteudo)<1, `Conteúdo não pula ao recolher (${rota}, ${width}px): ${JSON.stringify({inicial,rolado})}`);
        if (width<=760) {
          assert(rolado.altura<65 && rolado.marca==='none' && (!rolado.mandato || rolado.mandato==='none'), 'Só as abas permanecem');
          assert(Math.abs(rolado.visivel-rolado.limite-10)<2, 'Altura visível atualiza as sobreposições');
          await send('Emulation.setDeviceMetricsOverride', {width,height:820,deviceScaleFactor:1,mobile:true});
          await delay(100);
          assert(await evaluate(`document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido')`), 'Barra de endereço do celular não expande o cabeçalho');
          if (width===390) await capture(rota==='/'?'mobile-rolagem.png':'municipal-rolagem.png');
          await evaluate(`window.scrollTo({ top:598, behavior:'instant' })`);
          await delay(100);
          assert(await evaluate(`document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido')`), 'Pequena oscilação não expande');
          await evaluate(`window.scrollTo({ top:540, behavior:'instant' })`);
          await until(() => evaluate(`!document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido') && document.querySelector('.cabecalho-painel').getAnimations().length===0`), 'retorno ao subir');
          assert.equal(await evaluate(`document.querySelector('.cabecalho-painel').offsetHeight`), inicial.altura, 'Cabeçalho completo volta ao subir');
        }
      }
      await viewport(390, 900);
      await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);
      await until(() => evaluate(`!document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido') && document.querySelector('.cabecalho-painel').getAnimations().length===0`), 'início da animação');
      for (const top of [600, 540, 650]) {
        await evaluate(`window.scrollTo({top:${top},behavior:'instant'})`);
        await delay(50);
      }
      await until(() => evaluate(`document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido') && document.querySelector('.cabecalho-painel').getAnimations().length===0`), 'animação interrompida');
      assert.equal(await evaluate(`document.querySelector('.painel-cabecalho').style.height`), '', 'Interrupção não deixa altura temporária');
      await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      await evaluate(`window.scrollTo({top:500,behavior:'instant'})`);
      await until(() => evaluate(`!document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido')`), 'abrir com movimento reduzido');
      await evaluate(`window.scrollTo({top:600,behavior:'instant'})`);
      await until(() => evaluate(`document.querySelector('.cabecalho-painel').hasAttribute('data-recolhido')`), 'recolher com movimento reduzido');
      assert.equal(await evaluate(`document.querySelector('.cabecalho-painel').getAnimations().length`), 0, 'Movimento reduzido sem animação espacial');
      await send('Emulation.setEmulatedMedia', {features:[]});
    }
    console.log('PASSOU: abertura, abas alinhadas, recolhimento/retorno sem saltos, oscilação, interrupção, movimento reduzido e desktop preservado na home e na página municipal (320, 390, 760, 1024 e 1440px).');
  } else if (process.env.TESTE_MARCA) {
    const sprite = await fetch(new URL('/marca/bandeira-vento.webp', url));
    assert.equal(sprite.status, 200, 'Sprite disponível');
    await until(() => evaluate(`document.querySelector('.marca-logo')?.dataset.animando === 'true'`), 'animação visível');
    const movimento = await evaluate(`(() => { const e = document.querySelector('.marca-bandeira-quadros'); const s = getComputedStyle(e); return { nome:s.animationName, passos:s.animationTimingFunction, estado:s.animationPlayState, duracao:s.animationDuration }; })()`);
    assert.deepEqual(movimento, { nome:'marca-bandeira-vento', passos:'steps(48)', estado:'running', duracao:'1.6s' });
    const antes = await evaluate(`getComputedStyle(document.querySelector('.marca-bandeira-quadros')).transform`);
    await delay(250);
    assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.marca-bandeira-quadros')).transform`), antes, 'Bandeira troca de quadro');
    if (process.argv[2]) {
      const clip = await evaluate(`(() => { const r = document.querySelector('.marca-logo').getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, scale:2 }; })()`);
      const poses = [];
      for (let i = 0; i < 48; i++) {
        await evaluate(`(() => { const a = document.querySelector('.marca-bandeira-quadros').getAnimations()[0]; a.pause(); a.currentTime = ${(i + .5) * 1600 / 48}; })()`);
        await delay(30);
        poses.push(await capture('logo-quadro-'+i+'.png', clip));
      }
      assert.equal(new Set(poses).size, 48, 'O navegador deve mostrar 48 poses visualmente distintas');
      await evaluate(`document.querySelector('.marca-bandeira-quadros').getAnimations()[0].play()`);
    }
    await capture('marca-desktop-claro.png');
    await click('.tema-interruptor');
    await capture('marca-desktop-escuro.png');
    await click('.tema-interruptor');
    await evaluate(`Object.defineProperty(document, 'hidden', { configurable:true, value:true }); document.dispatchEvent(new Event('visibilitychange'));`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.marca-bandeira-quadros')).animationPlayState`), 'paused', 'Pausa na aba oculta');
    await evaluate(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));`);
    await until(() => evaluate(`document.querySelector('.marca-logo').dataset.animando === 'true'`), 'retomada');
    await evaluate(`document.querySelector('.marca-logo').style.visibility = 'hidden'; document.querySelector('.marca-painel').style.transform = 'translateX(-200vw)'`);
    await until(() => evaluate(`document.querySelector('.marca-logo').dataset.animando === 'false'`), 'pausa fora da tela');
    await evaluate(`document.querySelector('.marca-logo').style.visibility = ''; document.querySelector('.marca-painel').style.transform = ''`);
    await until(() => evaluate(`document.querySelector('.marca-logo').dataset.animando === 'true'`), 'retomada visível');
    await send('Emulation.setEmulatedMedia', { features:[{ name:'prefers-reduced-motion', value:'reduce' }] });
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.marca-bandeira-quadros')).animationName`), 'none', 'Preferência de movimento reduzido');
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.marca-bandeira-quadros')).transform`), 'none', 'Primeiro quadro estático');
    await capture('marca-movimento-reduzido.png');
    await send('Emulation.setEmulatedMedia', { features:[] });
    for (const width of [1440, 390, 320]) {
      await viewport(width, 900);
      const layout = await evaluate(`(() => { const e = document.querySelector('.marca-logo'), r = e.getBoundingClientRect(); return { esquerda:r.left, direita:r.right, largura:r.width, altura:r.height, nome:e.closest('a').getAttribute('aria-label') }; })()`);
      assert(layout.esquerda >= 0 && layout.direita <= width && layout.largura > 0 && layout.altura > 0, 'Logo íntegra em '+width+'px');
      assert.equal(layout.nome, 'Desempenho do Governo — início');
      if (width === 390) await capture('marca-celular.png');
    }
    console.log('PASSOU: logo com 48 quadros em 1,6s, poses distintas, pausa oculta/fora da tela, movimento reduzido e encaixe em 1440, 390 e 320px.');
  } else {
  await capture('navbar-desktop.png');
  const overlay = await evaluate(`(() => { const h = document.querySelector('.painel-cabecalho'), mapa = document.querySelector('.sala-tema'), painel = h.parentElement; return { background: getComputedStyle(h).backgroundColor, position: getComputedStyle(h).position, mapTop: mapa.getBoundingClientRect().top, padding: parseFloat(getComputedStyle(painel).paddingTop), height: h.offsetHeight, mapBehind: !!document.elementFromPoint(8, 6)?.closest('.sala-tema') }; })()`);
  assert.equal(overlay.background, 'rgba(0, 0, 0, 0)', 'Sem faixa opaca atrás da navbar');
  assert.equal(overlay.position, 'fixed');
  assert(Math.abs(overlay.mapTop) < 1 && overlay.mapBehind, 'Mapa contínuo sob a navbar');
  assert(Math.abs(overlay.padding - overlay.height) < 1, 'Conteúdo inicial abaixo da navbar');
  assert.equal(await evaluate(`document.querySelector('.cabecalho-painel').textContent.includes('Protótipo')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.navegacao-temas :is(a,button)').length`), 4);
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
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.navegacao-temas a')).map(b => b.getAttribute('href'))`), ['/', '/meio-ambiente', '/dinheiro']);
  await click('.navegacao-temas button[disabled]');
  assert.equal(await evaluate(`document.querySelector('.painel-governo').dataset.aba`), 'economia');
  await click('.navegacao-temas a[href="/meio-ambiente"]');
  await until(() => evaluate(`!!document.querySelector('[data-aba="ambiente"]')`), 'troca de aba');
  await click('.navegacao-temas a[href="/"]');
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
    const layout = await evaluate(`(() => { const h = document.querySelector('.painel-cabecalho'); const r = h.getBoundingClientRect(); return { width: innerWidth, header: r.right, height: r.height, measured: parseFloat(h.parentElement.style.getPropertyValue('--altura-cabecalho')), tabs: [...h.querySelectorAll('.navegacao-temas :is(a,button)')].map(b => { const q = b.getBoundingClientRect(); return [q.left, q.right]; }) }; })()`);
    assert(layout.header <= layout.width && Math.abs(layout.height - layout.measured) < 1, `Altura/largura do cabeçalho em ${width}px`);
    assert(layout.tabs.every(([left, right]) => left >= 0 && right <= layout.width), `Abas cortadas em ${width}px`);
    if (width === 1440) await capture('navbar-desktop.png');
    if (width === 390) await capture('navbar-celular.png');
  }
  console.log('PASSOU: cabeçalho e abas íntegros em 320, 390, 768, 1024 e 1440px; altura sincronizada com o mapa.');
  }
} finally {
  if (socket?.readyState === WebSocket.OPEN) await Promise.race([send('Browser.close').catch(() => {}), delay(1500)]);
  socket?.close();
  browser.kill();
}
