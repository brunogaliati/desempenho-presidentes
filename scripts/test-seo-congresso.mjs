import { registerHooks, createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

// Mesmo carregamento de TS/TSX de test-secoes-visuais.mjs, sem dependência adicional.
const require = createRequire(import.meta.url), ts = require('typescript');
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('.') || spec.startsWith('@/')) {
      const base = fileURLToPath(spec.startsWith('@/') ? new URL('../src/' + spec.slice(2), import.meta.url) : new URL(spec, ctx.parentURL));
      const p = [base, base + '.ts', base + '.tsx', base + '.json'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (p) return { url: pathToFileURL(p).href, shortCircuit: true };
    }
    return next(spec, ctx);
  },
  load(url, ctx, next) {
    // O sitemap real usa o catálogo real; apenas as consultas externas de outras famílias ficam isoladas.
    const isolados = { 'db.ts': 'sql', 'dadosEconomiaPublica.ts': 'paginasEconomiaPublicaveis', 'dadosIndicadoresMunicipais.ts': 'paginasMunicipaisPublicaveis', 'hubsEconomia.ts': 'hubsEconomia', 'revisoesPublicadas.ts': 'revisoesPublicadas' };
    for (const [arquivo, funcao] of Object.entries(isolados)) if (url.endsWith('/lib/' + arquivo)) return { format: 'commonjs', shortCircuit: true, source: `exports.${funcao} = async () => [];` };
    if (url.endsWith('.css')) return { format: 'commonjs', shortCircuit: true, source: 'module.exports = {};' };
    if (url.startsWith('file:') && /\.(ts|tsx)$/.test(url)) return { format: 'commonjs', shortCircuit: true, source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), { fileName: fileURLToPath(url), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText };
    return next(url, ctx);
  },
});
const { acharParlamentar, paginasParlamentares, historicoDaCota, metaParlamentar, perfilOficialParlamentar } = require('../src/app/_painel/_dados/paginaParlamentar.ts');
const { reaisInteiros, MESES_POR_EXTENSO } = require('../src/app/_painel/_dados/congressoModelo.ts');
const { imagemDaPagina } = require('../src/lib/seo.ts');
const { ContextoParlamentar } = require('../src/app/_painel/_componentes/ContextoParlamentar.tsx');
const { renderToStaticMarkup } = require('react-dom/server');
const exemplos = [acharParlamentar('deputados', 'itamar-paim-225846'), acharParlamentar('senadores', 'randolfe-rodrigues-5012')];

test('catálogo publica uma URL por parlamentar, valida ids e normaliza aliases', () => {
  const paginas = paginasParlamentares();
  assert(paginas.length > 500);
  assert.equal(new Set(paginas.map(p => p.caminho)).size, paginas.length);
  for (const p of paginas) assert.equal(acharParlamentar(p.casa, String(p.pessoa.id)).caminho, p.caminho);
  for (const [casa, id] of [['deputados', '999999999'], ['senadores', '225846'], ['prefeitos', '1'], ['deputados', '../225846']]) assert.equal(acharParlamentar(casa, id), null);
  assert.equal(acharParlamentar('senadores', 'nome-antigo-5012').caminho, exemplos[1].caminho);
});

test('sitemap de produção inclui o Congresso e todos os perfis uma única vez, sem data de revisão inventada', async () => {
  const anterior = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const { sitemapPublico } = require('../src/lib/sitemapPublico.ts');
    const sitemap = await sitemapPublico();
    const urls = sitemap.map(p => p.url);
    assert(urls.includes('https://desempenhodogoverno.com.br/congresso'));
    for (const p of paginasParlamentares()) {
      const linhas = sitemap.filter(l => l.url === 'https://desempenhodogoverno.com.br' + p.caminho);
      assert.equal(linhas.length, 1, p.caminho);
      assert.equal(linhas[0].lastModified, undefined);
    }
  } finally {
    if (anterior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = anterior;
  }
});

test('descrições e tabela usam valores e referência da fonte, sem converter ausência em zero', () => {
  for (const p of exemplos) {
    const h = historicoDaCota(p), ultimo = h.anos.at(-1), meta = metaParlamentar(p);
    assert.match(meta.titulo, new RegExp(p.pessoa.nome));
    assert.match(meta.titulo, /cota e votações/);
    assert(meta.descricao.includes(reaisInteiros(ultimo.total)));
    assert(meta.descricao.includes(String(ultimo.ano)));
    assert.equal(ultimo.parcial, true);
    assert(ultimo.mes >= 1 && ultimo.mes <= 12);
    assert(meta.descricao.includes(`até ${MESES_POR_EXTENSO[ultimo.mes - 1]}`));
    assert.match(imagemDaPagina(p.caminho), new RegExp(p.caminho + '/opengraph-image'));
  }
  assert(historicoDaCota({ ...exemplos[0], pessoa: { ...exemplos[0].pessoa, id: -1 } }).anos.every(a => a.total === null));
});

test('resumo disponível sem JavaScript contém identidade, totais, fontes e limites', () => {
  for (const parlamentar of exemplos) {
    const html = renderToStaticMarkup(ContextoParlamentar({ parlamentar }));
    assert.match(html, /id="contexto-parlamentar"/);
    assert.match(html, /<caption>/);
    assert.match(html, /Sem registro não significa gasto zero/);
    assert(html.includes(perfilOficialParlamentar(parlamentar)));
    assert(html.includes(historicoDaCota(parlamentar).fontes.dados));
    for (const a of historicoDaCota(parlamentar).anos) if (a.total !== null) assert(html.includes(reaisInteiros(a.total)));
    assert.doesNotMatch(html, /<script|display:none/);
  }
});

// Opcional: valida o servidor existente; SEO_BASE_URL=http://localhost:3000 node --test scripts/test-seo-congresso.mjs
if (process.env.SEO_BASE_URL) {
  const base = process.env.SEO_BASE_URL;
  for (const parlamentar of exemplos) test(`HTML real, canônica e entidades: ${parlamentar.pessoa.nome}`, async () => {
    const response = await fetch(base + parlamentar.caminho + '?r.congresso.ano=2025', { headers: { 'user-agent': 'Googlebot' } });
    assert.equal(response.status, 200);
    const html = await response.text();
    const visivel = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.match(visivel, /id="contexto-parlamentar"/);
    for (const a of historicoDaCota(parlamentar).anos) if (a.total !== null) assert(visivel.includes(reaisInteiros(a.total)));
    assert(html.includes(`<link rel="canonical" href="https://desempenhodogoverno.com.br${parlamentar.caminho}"`));
    const grafos = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).flatMap(s => s['@graph'] ?? [s]);
    const pagina = grafos.find(s => s['@type'] === 'WebPage'), pessoa = grafos.find(s => s['@type'] === 'Person'), dados = grafos.find(s => s['@type'] === 'Dataset');
    assert.equal(pagina.mainEntity['@id'], pessoa['@id']);
    assert.equal(pagina.hasPart['@id'], dados['@id']);
    assert.equal(pessoa.name, parlamentar.pessoa.nome);
    assert(pessoa.sameAs.includes(perfilOficialParlamentar(parlamentar)));
    assert(visivel.replace(/<!--[\s\S]*?-->/g, '').includes(dados.name));
    assert.equal(grafos.find(s => s['@type'] === 'BreadcrumbList').itemListElement.at(-1).item, pagina.url);
    assert(!grafos.some(s => s['@type'] === 'ProfilePage'));
    const alias = await fetch(`${base}/congresso/${parlamentar.casa}/${parlamentar.pessoa.id}`, { redirect: 'manual' });
    assert.equal(alias.status, 308);
    assert.equal(new URL(alias.headers.get('location'), base).pathname, parlamentar.caminho);
  });
}
