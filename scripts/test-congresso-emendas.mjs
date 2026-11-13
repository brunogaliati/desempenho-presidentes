import { registerHooks, createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

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
    if (url.endsWith('.css')) return { format: 'commonjs', shortCircuit: true, source: 'module.exports = {};' };
    if (url.startsWith('file:') && /\.(ts|tsx)$/.test(url)) return { format: 'commonjs', shortCircuit: true, source: ts.transpileModule(fs.readFileSync(fileURLToPath(url), 'utf8'), { fileName: fileURLToPath(url), compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText };
    return next(url, ctx);
  },
});
const { anosDasEmendas, municipiosDasEmendas, planosDasEmendas, municipiosPrevistosDosPlanos } = require('../src/app/_painel/_dados/emendasParlamentarModelo.ts');
const { TabelaEmendas } = require('../src/app/_painel/_componentes/EmendasMunicipiosParlamentar.tsx');
const { PlanosEmendasParlamentar } = require('../src/app/_painel/_componentes/PlanosEmendasParlamentar.tsx');
const { renderToStaticMarkup } = require('react-dom/server');
const CarregandoPainel = require('../src/app/_painel/_componentes/CarregandoPainel.tsx').default;
test('perfil tem skeleton de identidade e painéis, enquanto o diretório mantém o plenário', () => {
  const React = require('react');
  const perfil = renderToStaticMarkup(React.createElement(CarregandoPainel, { aba: 'congresso', perfilParlamentar: true, embutido: true }));
  const congresso = renderToStaticMarkup(React.createElement(CarregandoPainel, { aba: 'congresso', embutido: true }));
  assert.match(perfil, /data-skeleton="parlamentar"/); assert.match(perfil, /aria-busy="true"/);
  assert.match(perfil, /Carregando perfil parlamentar/); assert.doesNotMatch(perfil, /<circle|<svg|<img/);
  assert.match(congresso, /data-skeleton="congresso"/); assert.match(congresso, /<circle/);
});
const dados = {
  uf: 'MG', desde: 2023, ate: 2026, coletadoEm: '2026-11-13T14:00:00Z',
  cobertura: { destinadoTotal: 2000, destinadoNoEstado: 1200, destinadoSemMunicipio: 800, destinadoForaEstado: 0, pagoSemMunicipio: 100, emendasPendentes: 1 },
  aplicacao: [
    { codigo: '1', nome: 'São João', destinado: 1234.56, pago: 0 },
    { codigo: '2', nome: 'Belo Horizonte', destinado: null, pago: null },
    { codigo: '3', nome: 'Uberlândia', destinado: -10, pago: 500 },
  ],
  prefeituras: [{ codigo: '4', nome: 'Outra cidade', destinado: null, pago: 999 }],
  planos: [], coletadoEmPlanos: '2026-11-13T14:00:00Z',
};

test('o período usa o ano da emenda e mantém a legislatura do perfil', () => {
  assert.deepEqual(anosDasEmendas('legislatura', new Date('2026-11-13T12:00:00Z')), { desde: 2023, ate: 2026 });
  assert.deepEqual(anosDasEmendas(2025), { desde: 2025, ate: 2025 });
});
test('busca sem acento e ordenação preservam ausência, zero e estorno', () => {
  assert.deepEqual(municipiosDasEmendas(dados.aplicacao, 'sao', 'nome').map(m => m.codigo), ['1']);
  assert.deepEqual(municipiosDasEmendas(dados.aplicacao, '', 'destinado').map(m => m.codigo), ['1', '3', '2']);
  assert.deepEqual(municipiosDasEmendas(dados.aplicacao, '', 'pago').map(m => m.codigo), ['3', '1', '2']);
  assert.equal(dados.aplicacao[1].destinado, null, 'não altera dados nem converte ausência em zero');
});
test('tabela real exibe centavos, contexto, fonte e ausências, sem somar geografias', () => {
  const html = renderToStaticMarkup(require('react').createElement(TabelaEmendas, { dados }));
  assert.match(html, /Empenhado/); assert.match(html, /Pago/); assert.match(html, /2023–2026/);
  assert.match(html, /1\.234,56/); assert.match(html, /R\$ 0,00/);
  assert.match(html, /Valor destinado não informado/); assert.match(html, /Valor pago não informado/);
  assert.match(html, /800,00.*ainda sem município definido/);
  assert.match(html, /1 emenda ainda usa/); assert.match(html, /Como identificamos os municípios/);
  assert.match(html, /restos a pagar/); assert.match(html, /não entrega da obra ou serviço/); assert.match(html, /não significa R\$ 0/);
  assert.match(html, /Portal da Transparência/); assert.match(html, /scope="row"/);
  assert.doesNotMatch(html, /Outra cidade|999,00/, 'recebimento não entra na tabela de aplicação');
});
test('sem dados oferece a visão por prefeituras sem afirmar valor zero', () => {
  const html = renderToStaticMarkup(require('react').createElement(TabelaEmendas, { dados: { ...dados, aplicacao: [] } }));
  assert.match(html, /Não há municípios de aplicação identificados/);
  assert.match(html, /Consulte também Prefeituras e fundos/);
  assert.doesNotMatch(html, /R\$ 0,00/);
});

test('planejamento mantém parcela prevista, total do instrumento e empenho do plano separados', () => {
  const planos = [{ emenda: '202543980005', fonte: 'transferegov_executor', instrumento: '86640', executor: '49676',
    objeto: 'Prêmio literário em Teresina - PI', situacao: 'Plano aprovado', codigoMunicipio: '2211001', municipio: 'Teresina', uf: 'PI',
    metodoLocalizacao: 'municipio_citado_no_objeto', previsto: 198000, totalInstrumento: 1089000, beneficiario: 'Secretaria das Mulheres',
    empenhoPlano: 1089000, documentos: ['170860000012025NE009559'], conciliacao: 'empenho_do_plano_conciliado',
    fonteUrl: 'https://api-publica.transferegov.gestao.gov.br/especiais/executores-especiais?id_executor=49676' },
    { emenda: '202512340001', fonte: 'cgu_parceria', instrumento: '123', executor: 'parceria', objeto: 'Custeio', situacao: 'Aprovada',
      municipio: 'Outra cidade', metodoLocalizacao: 'endereco_do_beneficiario', previsto: null, totalInstrumento: 500000,
      empenhoPlano: null, documentos: [], conciliacao: 'sem_documento_vinculado', fonteUrl: 'https://portaldatransparencia.gov.br/' }];
  const html = renderToStaticMarkup(require('react').createElement(PlanosEmendasParlamentar, { planos, busca: '', coletadoEm: dados.coletadoEmPlanos }));
  assert.match(html, /198\.000,00/); assert.match(html, /1\.089\.000,00/);
  assert.match(html, /plano inteiro/); assert.match(html, /não deve ser somado entre linhas/);
  assert.match(html, /parcela da emenda não informada/); assert.match(html, /Endereço do beneficiário; aplicação não confirmada/);
  assert.match(html, /Realização da obra ou serviço não verificada/); assert.match(html, /Sem empenho conciliado nesta coleta/);
  assert.doesNotMatch(html, /1\.287\.000|<th scope="col">Pago/);
  assert.equal(planosDasEmendas(planos, 'premio')[0].municipio, 'Teresina');
  assert.equal(planosDasEmendas(planos, 'inexistente').length, 0);
  const teresina = planos[0];
  const mapa = municipiosPrevistosDosPlanos([
    teresina, teresina,
    { ...teresina, executor: 'endereco', metodoLocalizacao: 'endereco_do_beneficiario', previsto: 900000 },
    { ...teresina, executor: 'rascunho', situacao: 'Plano em análise ou elaboração', previsto: 900000 },
    { ...teresina, executor: 'total', previsto: null, totalInstrumento: 900000 },
    { ...teresina, executor: 'multiplo', metodoLocalizacao: 'objeto_com_varios_municipios', previsto: 900000 },
    { ...teresina, executor: 'fora', uf: 'RJ', previsto: 900000 },
  ], 'PI');
  assert.deepEqual(mapa, [{ codigo: '2211001', nome: 'Teresina', previsto: 198000, destinado: null, pago: null }]);
  assert.equal(municipiosPrevistosDosPlanos([{ ...teresina, executor: 'a', previsto: .1 }, { ...teresina, executor: 'b', previsto: .2 }], 'PI')[0].previsto, .3);
  assert.deepEqual(municipiosPrevistosDosPlanos([], 'PI'), []);
});

// Integração opcional com o servidor único: EMENDAS_BASE_URL=http://localhost:3000
// node --env-file=.env.local --test scripts/test-congresso-emendas.mjs
if (process.env.EMENDAS_BASE_URL) {
  const base = process.env.EMENDAS_BASE_URL + '/api/painel/congresso/emendas';
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  for (const [casa, id, uf] of [['deputados', 74646, 'MG'], ['senadores', 5012, 'AP']]) {
    test(`API e banco: ${casa}/${id}, UF, autoria, período e totais`, async () => {
      const r = await fetch(`${base}?casa=${casa}&id=${id}&ano=2025`);
      assert.equal(r.status, 200);
      const d = await r.json();
      assert.equal(d.uf, uf); assert.equal(d.desde, 2025); assert.equal(d.ate, 2025);
      assert.ok(d.coletadoEm);
      assert.ok(d.coletadoEmPlanos); assert.ok(Array.isArray(d.planos));
      const casaBanco = casa === 'deputados' ? 'camara' : 'senado';
      const [esperado] = await sql`select sum(valor) filter(where fase='Empenho')::float8 as destinado,sum(valor) filter(where fase='Pagamento')::float8 as pago
        from mart.emendas_municipios where casa=${casaBanco} and parlamentar_id=${id}
        and uf=${uf} and ano_emenda=2025 and codigo_municipio is not null`;
      for (const k of ['destinado', 'pago']) assert.ok(Math.abs(d.aplicacao.reduce((s, m) => s + (m[k] ?? 0), 0) - (esperado[k] ?? 0)) < .005);
      const [total] = await sql`select sum(valor) filter(where fase='Empenho')::float8 as destinado
        from mart.emendas_municipios where casa=${casaBanco} and parlamentar_id=${id} and ano_emenda=2025`;
      assert.ok(Math.abs(d.cobertura.destinadoTotal - (total.destinado ?? 0)) < .005);
      assert.ok(Math.abs(d.cobertura.destinadoTotal - d.cobertura.destinadoNoEstado - d.cobertura.destinadoSemMunicipio - d.cobertura.destinadoForaEstado) < .005);
      const [recebido] = await sql`select sum(valor_pago)::float8 as pago from mart.emendas_parlamentar_municipio_recebido
        where casa=${casaBanco} and parlamentar_id=${id} and uf=${uf} and ano_emenda=2025
        and codigo_municipio is not null and tipo_destinatario='administracao_municipal'`;
      assert.ok(Math.abs(d.prefeituras.reduce((s, m) => s + (m.pago ?? 0), 0) - (recebido.pago ?? 0)) < .005);
      assert.ok(d.prefeituras.every(m => m.destinado === null));
      const [planejamento] = await sql`select count(*)::int as registros from mart.emendas_planos
        where casa=${casaBanco} and parlamentar_id=${id} and ano_emenda=2025 and (uf=${uf} or uf is null)`;
      assert.equal(d.planos.length, planejamento.registros);
      assert.equal(new Set(d.aplicacao.map(m => m.codigo)).size, d.aplicacao.length);
      assert.ok([...d.aplicacao, ...d.prefeituras].every(m => m.codigo.startsWith(uf === 'MG' ? '31' : '16')));
      const legislatura = await (await fetch(`${base}?casa=${casa}&id=${id}`)).json();
      assert.equal(legislatura.desde, 2023); assert.equal(legislatura.ate, 2026);
    });
  }
  test('API rejeita casa, id e ano inválidos e não inventa parlamentar', async () => {
    for (const query of ['casa=prefeitos&id=1', 'casa=deputados&id=-1', 'casa=senadores&id=5012&ano=2013', 'casa=senadores&id=5012&ano=banana']) {
      assert.equal((await fetch(`${base}?${query}`)).status, 400);
    }
    assert.equal((await fetch(`${base}?casa=deputados&id=999999999`)).status, 404);
  });
}
