import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afinarLeitura, focoDoMandato, mesDoPeriodo, recebidoNaLista, recebidoNoPainel, recortarAoMandato, recortarLeitura, recortarSerie, ritmoDesdeORecebido, ritmoNoMandato, TERMO_2015 } from '../src/app/prototipo/_dados/mandatoRecorte.ts';
import { focosDaCopia, gradeDeter, marcosDoMandato, mesesEntre, montarAmbiente, montarProtegidas, periodoProdes, soma12, somarBiomas, ultimoMesCompleto } from '../src/app/prototipo/_dados/ambienteModelo.ts';
import { cartaoDaSerie, chaveDaArea, corDaLente, montarAreas, montarMunicipios, numerosDaArea, numerosDaLente, somaNaUf, somaNoBioma } from '../src/app/prototipo/_dados/ambienteMunicipal.ts';

const ufs = [
  { codigo: '11', sigla: 'RO', regiaoCodigo: '1' },
  { codigo: '15', sigla: 'PA', regiaoCodigo: '1' },
  { codigo: '51', sigla: 'MT', regiaoCodigo: '5' },
  { codigo: '52', sigla: 'GO', regiaoCodigo: '5' },
  { codigo: '33', sigla: 'RJ', regiaoCodigo: '3' },
];
const regioes = [{ codigo: '1' }, { codigo: '3' }, { codigo: '5' }];
const vazia = { hoje: '2026-10-30', ufs, regioes, focos: null, deter: null, taxa: null, biomas: null, ibama: null };

test('janela de 12 meses soma só com os 12 presentes e quebra num buraco', () => {
  const v = Array.from({ length: 14 }, () => 1);
  assert.deepEqual(soma12(v).slice(10), [null, 12, 12, 12]);
  v[12] = null;
  assert.deepEqual(soma12(v).slice(11), [12, null, null]);
});

test('mês em andamento nunca entra; o último dia fecha o mês', () => {
  assert.equal(ultimoMesCompleto('2026-10-25'), '2026-09');
  assert.equal(ultimoMesCompleto('2026-09-30'), '2026-09');
  assert.equal(ultimoMesCompleto('2024-02-29'), '2024-02');
  assert.equal(ultimoMesCompleto('2026-01-10'), '2025-12');
});

test('posse e recebido: PRODES 2022 contra 2023 (código AAAA-07); 12 meses até dez/2022', () => {
  const prodes = [2021, 2022, 2023, 2024].map((a) => periodoProdes(a).codigo);
  assert.deepEqual(prodes, ['2021-07', '2022-07', '2023-07', '2024-07']);
  assert.deepEqual(marcosDoMandato(prodes), { indicePosse: 2, indiceRecebido: 1 });
  assert.deepEqual(marcosDoMandato(mesesEntre('2021-12', '2023-02')), { indicePosse: 13, indiceRecebido: 12 });
  assert.equal(periodoProdes(2026, true).extenso, 'ano PRODES 2026 (ago/2025 a jul/2026), estimativa preliminar');
});

test('DETER: mês publicado sem linha da UF é zero; UF fora do bioma fica de fora', () => {
  const linha = (uf, mes, desmatamento, emAndamento = false) => ({ bioma: 'cerrado', uf, mes, desmatamento, cicatriz: 0, emAndamento });
  const deter = { linhas: [linha('GO', '2023-01', 2), linha('MT', '2023-01', 1), linha('GO', '2023-02', 3), linha('GO', '2023-03', 9, true)], coletadoEm: null };
  const g = gradeDeter({ ...vazia, deter }, 'cerrado', 'desmatamento');
  assert.deepEqual(g.meses, ['2023-01', '2023-02']);
  assert.deepEqual(g.ufs['51'], [1, 0]);
  assert.deepEqual(g.ufs['52'], [2, 3]);
  assert.equal(g.ufs['33'], undefined);
  assert.deepEqual(g.total, [3, 3]);
});

test('biomas: só anos anuais; a UF precisa de todos os biomas que a tocam; Brasil, dos seis', () => {
  const l = (bioma, uf, ano, area, anos = 1) => ({ bioma, uf, ano, anos, area, preliminar: ano === 2026 });
  const linhas = [
    l('amazonia', 'PA', 2025, 100), l('cerrado', 'PA', 2025, 10), l('cerrado', 'GO', 2025, 30), l('mata_atlantica', 'RJ', 2025, 1),
    l('amazonia', 'PA', 2026, 80), l('cerrado', 'PA', 2026, 5), l('cerrado', 'GO', 2026, 20),
    l('mata_atlantica', 'RJ', 2026, 2, 2),
  ];
  const s = somarBiomas(linhas, ufs, 2017);
  assert.deepEqual(s.anos, [2025, 2026]);
  assert.deepEqual(s.porUf['15'], [110, 85]);
  assert.deepEqual(s.porUf['52'], [30, 20]);
  // RJ só tem bloco de dois anos em 2026: sem valor anual.
  assert.deepEqual(s.porUf['33'], [1, null]);
  assert.deepEqual(s.completos, [2025]);
  assert.deepEqual(s.brasil, [141, null]);
  assert.equal(s.porUf['11'], undefined);
});

test('montagem: leituras na ordem do passeio, recebido em 2022 e Ibama sem lado', () => {
  const meses = mesesEntre('2021-01', '2026-09');
  const focos = {
    linhas: ufs.flatMap((u) => meses.map((mes) => ({ uf: u.codigo, mes, focos: mes < '2023-01' ? 10 : 5, parcial: false }))),
    porBioma: [], dataLimite: '2026-10-25', coletadoEm: '2026-10-26T00:00:00Z',
  };
  const ibama = { linhas: [{ fonte: 'autos', uf: 'PA', mes: '2022-05', n: 7, valor: 1000 }], coletadoEm: '2026-10-27T00:00:00Z' };
  const { leituras, dados } = montarAmbiente({ ...vazia, focos, ibama });
  assert.deepEqual(leituras.map((x) => x.id), ['focos_12m']);
  const f = leituras[0];
  assert.equal(f.periodos[f.indiceRecebido].codigo, '2022-12');
  assert.equal(f.brasil[f.indiceRecebido], 5 * 12 * 10);
  assert.equal(f.brasil.at(-1), 5 * 12 * 5);
  assert.equal(f.rampa, 'fogo');
  assert.equal(f.regioes['3'][0], 120);
  const autos = dados.series.find((s) => s.id === 'autos_12m');
  assert.equal(autos.direcao, 'neutro');
  assert.equal(autos.valores[autos.datas.indexOf('2022-12')], 7);
  assert.ok(dados.fiscalizacao.every((l) => l.direcao === 'neutro'));
  assert.deepEqual(dados.indisponiveis.sort(), ['INPE, DETER', 'INPE, PRODES Amazônia Legal', 'INPE, PRODES por bioma']);
});

test('sem o banco, a cópia anual dos focos dá os mesmos índices', () => {
  const meses = mesesEntre('2022-01', '2025-12');
  const copia = { meses, ufMensal: { 15: meses.map(() => 3) }, coletadoEm: '2026-10-26' };
  const { leituras } = montarAmbiente({ ...vazia, focos: focosDaCopia(copia, ufs) });
  const f = leituras[0];
  assert.equal(f.periodos.at(-1).codigo, '2025-12');
  assert.equal(f.periodos[f.indiceRecebido].codigo, '2022-12');
  // UF ausente do arquivo anual teve zero focos, não falta de dado.
  assert.equal(f.ufs['52'].at(-1), 0);
  assert.equal(f.brasil.at(-1), 36);
});

test('taxa PRODES: o ano preliminar fica marcado e a soma exige as UFs de sempre', () => {
  const taxa = { linhas: [
    { uf: 'PA', ano: 2022, area: 4000, preliminar: false }, { uf: 'MT', ano: 2022, area: 2000, preliminar: false },
    { uf: 'PA', ano: 2026, area: 1000, preliminar: true },
  ], coletadoEm: null };
  const s = montarAmbiente({ ...vazia, taxa }).dados.series.find((x) => x.id === 'prodes_amazonia');
  // 2026 só tem uma das duas UFs: sai da série em vez de virar um total menor.
  assert.deepEqual(s.datas, ['2022-07']);
  assert.deepEqual(s.valores, [6000]);
  assert.deepEqual(s.preliminares, []);
});

test('municípios: área do bioma publicado sem linha é zero; bioma sem o ano é nulo', () => {
  const m = montarMunicipios({
    codigos: ['1', '2', '3'],
    biomas: { 1: 'amazonia', 2: 'caatinga', 3: 'caatinga' },
    desmatamento: [
      { municipio: '1', bioma: 'amazonia', ano: 2025, area: 5, preliminar: false },
      { municipio: '1', bioma: 'amazonia', ano: 2026, area: 2, preliminar: true },
      // Transição: toca dois biomas, e a caatinga não tem 2026.
      { municipio: '2', bioma: 'amazonia', ano: 2025, area: 1, preliminar: false },
      { municipio: '2', bioma: 'caatinga', ano: 2025, area: 3, preliminar: false },
    ],
    publicados: { amazonia: [2025, 2026], caatinga: [2025] },
    alertas: [{ municipio: '1', recebido: 9, atual: 4 }],
    ibama: [{ municipio: '1', autosRecebido: 1, autosAtual: 2, floraRecebido: 1, floraAtual: 1, multasRecebido: 10, multasAtual: 20, embargosRecebido: 0, embargosAtual: 1 }],
    focos: { anos: [2025], municipioAnual: { 1: [7] } },
    janelaAtual: '2026-09',
    coletas: {},
    desde: 2025,
  });
  assert.deepEqual(m.anos, [2025, 2026]);
  assert.equal(m.preliminar, 2026);
  assert.equal(m.anoCompleto, 2025);
  assert.deepEqual(m.m['1'].d, [5, 2]);
  assert.deepEqual(m.m['2'].d, [4, null]);
  // Nunca aparece no PRODES: conta pelo bioma predominante.
  assert.deepEqual(m.m['3'].d, [0, null]);
  assert.deepEqual(m.m['1'].a, [9, 4]);
  // Fora do DETER não é zero; sem auto no Ibama é.
  assert.equal(m.m['2'].a, undefined);
  assert.deepEqual(m.m['2'].i, [0, 0, 0, 0]);
  assert.deepEqual(m.m['2'].f, [0]);
});

test('lentes: sem cobertura é papel, zero é grade, piso evita veredito por ruído', () => {
  const d = { anos: [2022, 2025], focosAnos: [2022, 2025] };
  assert.deepEqual(numerosDaLente({ b: 'cerrado', d: [10, 4] }, 'desmatamento', d, 2025), { agora: 4, recebido: 10 });
  assert.deepEqual(numerosDaLente({ b: 'pampa' }, 'alertas', d, null), { agora: null, recebido: null });
  assert.equal(corDaLente(null, null, 'alertas', 'area', 100), 'var(--atlas-papel)');
  assert.equal(corDaLente(0, 3, 'desmatamento', 'total', 100), 'var(--grade)');
  assert.equal(corDaLente(70, 3, 'desmatamento', 'total', 100), 'var(--desmate-5)');
  assert.equal(corDaLente(70, 3, 'alertas', 'total', 100), 'var(--alerta-5)');
  assert.equal(corDaLente(60, 3, 'fiscalizacao', 'total', 100), 'var(--fiscal-5)');
  assert.equal(corDaLente(1, 0, 'desmatamento', 'area', 200), 'var(--desmate-4)');
  assert.equal(corDaLente(2, 1, 'fogo', 'area', 10), 'var(--fogo-1)');
  assert.equal(corDaLente(4, 10, 'desmatamento', 'posse', 100), 'var(--mapa-melhor)');
  assert.equal(corDaLente(10, 4, 'desmatamento', 'posse', 100), 'var(--mapa-pior)');
  assert.equal(corDaLente(0.2, 0.1, 'desmatamento', 'posse', 100), 'var(--mapa-estavel)');
});

test('áreas protegidas: a conta usa os biomas do último ano, em todos os anos', () => {
  const l = (recorte, bioma, codigo, ano, area, preliminar = false) => ({ recorte, bioma, codigo, nome: codigo, ano, area, preliminar });
  const linhas = [
    l('ti', 'amazonia', 'A', 2022, 10), l('ti', 'amazonia', 'A', 2025, 40), l('ti', 'amazonia', 'A', 2026, 3, true),
    l('ti', 'amazonia', 'B', 2025, 6),
    // A caatinga não tem 2026: fica fora da conta nacional, para 2026 comparar com 2022.
    l('ti', 'caatinga', 'C', 2022, 100), l('ti', 'caatinga', 'C', 2025, 100),
    l('uc', 'amazonia', 'D', 2022, 2),
  ];
  const p = montarProtegidas(linhas, { amazonia: [2022, 2025, 2026], caatinga: [2022, 2025] }, null);
  assert.equal(p.ano, 2026);
  assert.deepEqual(p.biomas, ['amazonia']);
  assert.deepEqual(p.anos, [2022, 2025, 2026]);
  assert.deepEqual(p.ti.valores, [10, 46, 3]);
  assert.deepEqual(p.ti.datas, ['2022-07', '2025-07', '2026-07']);
  assert.deepEqual(p.ti.preliminares, ['2026-07']);
  // Bioma publicado sem linha da área é zero.
  assert.deepEqual(p.uc.valores, [2, 0, 0]);
  assert.equal(p.ti.direcao, 'menor_melhor');
  assert.deepEqual(p.maisPorAno['2025'].map((x) => [x.nome, x.ultimo, x.recebido]), [['A', 40, 10], ['B', 6, 0]]);
  // O bioma sem o último ano segue até o último dele.
  assert.deepEqual(p.porBioma.caatinga.ti.valores, [100, 100]);
  assert.equal(p.porBioma.caatinga.ti.id, 'protegidas_ti_caatinga');
});

test('o seletor tem o desenho de todo bioma que o mapa enquadra, e pequeno', () => {
  const ler = (nome) => readFileSync(new URL(`../src/app/prototipo/_dados/${nome}`, import.meta.url), 'utf8');
  const texto = ler('biomas-silhuetas.json');
  const s = JSON.parse(texto);
  const { caixas } = JSON.parse(ler('biomas-municipios.json'));
  assert.deepEqual(Object.keys(s.biomas).sort(), Object.keys(caixas).sort());
  for (const d of [s.brasil, ...Object.values(s.biomas)]) assert.match(d, /^M-?\d+,-?\d+L.*Z$/);
  // Vai no pacote do navegador.
  assert.ok(texto.length < 15_000, `${texto.length} bytes`);
});

test('área queimada: zero só onde o INPE mede, e sem medida no resto', () => {
  const m = montarMunicipios({
    codigos: ['1500000', '1500001', '2900000'],
    biomas: { 1500000: 'amazonia', 1500001: 'amazonia', 2900000: 'caatinga' },
    desmatamento: [],
    publicados: {},
    alertas: null,
    queimadas: [{ municipio: '1500000', recebido: 8, atual: 2 }],
    ibama: null,
    focos: null,
    janelaAtual: '2026-09',
    coletas: {},
  });
  assert.deepEqual(m.m['1500000'].q, [8, 2]);
  assert.deepEqual(m.m['1500001'].q, [0, 0]);
  assert.equal(m.m['2900000'].q, undefined);
  assert.deepEqual(numerosDaLente(m.m['1500000'], 'queimada', m, null), { agora: 2, recebido: 8 });
  assert.deepEqual(numerosDaLente(m.m['2900000'], 'queimada', m, null), { agora: null, recebido: null });
  // Somar um estado sem a medida não dá zero: é falta de dado.
  assert.deepEqual(somaNaUf(m, '15', (x) => x.q), { recebido: 8, agora: 2 });
  assert.equal(somaNaUf(m, '29', (x) => x.q), null);
  assert.equal(somaNoBioma(m, 'caatinga', (x) => x.q), null);
});

test('multas e embargos pintam com o próprio número; as multas em milhões', () => {
  const x = { b: 'amazonia', v: [1_000_000, 3_000_000], e: [4, 12] };
  const d = { anos: [], focosAnos: [] };
  assert.deepEqual(numerosDaLente(x, 'multas', d, null), { agora: 3_000_000, recebido: 1_000_000 });
  assert.deepEqual(numerosDaLente(x, 'embargos', d, null), { agora: 12, recebido: 4 });
  // R$ 3 mi cai na faixa de 2 a 10 milhões.
  assert.equal(corDaLente(3_000_000, 1_000_000, 'multas', 'total', 100), 'var(--fiscal-4)');
  assert.equal(corDaLente(20, 4, 'embargos', 'total', 100), 'var(--fiscal-4)');
});

test('áreas protegidas: zero em ano publicado, sem medida em ano que o bioma não publicou', () => {
  const v = montarAreas(
    [
      { recorte: 'ti', bioma: 'caatinga', nome: 'Atikum', ano: 2022, area: 2 },
      { recorte: 'ti', bioma: 'caatinga', nome: 'ATIKUM', ano: 2022, area: 1 },
      { recorte: 'uc', bioma: 'pampa', nome: 'APA DA ORLA MARÍTIMA', ano: 2025, area: 4 },
    ],
    { caatinga: [2022, 2025], pampa: [2022, 2025] },
  );
  const ti = chaveDaArea('ti', 'caatinga', 'Atikum');
  // As duas grafias são a mesma área.
  assert.deepEqual(numerosDaArea(v, ti, 'caatinga', 2025), { agora: 0, recebido: 3 });
  assert.deepEqual(numerosDaArea(v, ti, 'caatinga', 2026), { agora: null, recebido: 3 });
  // O catálogo escreve o acento em minúscula; o nome casa do mesmo jeito.
  assert.deepEqual(numerosDaArea(v, chaveDaArea('uc', 'pampa', 'APA DA ORLA MARíTIMA'), 'pampa', 2025), { agora: 4, recebido: 0 });
  // Terra sem desmatamento aparece no mapa, e não some na grade.
  assert.equal(corDaLente(0, 3, 'ti', 'total', 0), 'var(--protegidas-0)');
  assert.equal(corDaLente(null, 3, 'ti', 'total', 0), 'var(--atlas-papel)');
  assert.equal(corDaLente(4, 0, 'uc', 'total', 0), 'var(--protegidas-4)');
});

test('o "Por bioma" e o "Brasil agora" falam das mesmas séries', () => {
  assert.equal(cartaoDaSerie('prodes_bioma_amazonia'), 'prodes_amazonia');
  assert.equal(cartaoDaSerie('prodes_bioma_cerrado'), 'prodes_cerrado');
  for (const b of ['caatinga', 'mata_atlantica', 'pampa', 'pantanal']) assert.equal(cartaoDaSerie(`prodes_bioma_${b}`), 'prodes_outros');
  assert.equal(cartaoDaSerie('focos_bioma_pampa'), 'focos_12m');
  assert.equal(cartaoDaSerie('multas_bioma'), 'multas_12m');
  // O que já é cartão aponta para si mesmo, e série sem cartão não vira outra.
  assert.equal(cartaoDaSerie('alertas_cerrado_12m'), 'alertas_cerrado_12m');
  assert.equal(cartaoDaSerie('protegidas_ti'), 'protegidas_ti');
});

test('o ritmo no mandato: % ao ano, do recebido ao último dado, contra os 24 meses antes', () => {
  // A taxa da Amazônia Legal, ano PRODES: 2022 é o recebido e 2026, o último.
  const datas = ['2020-07', '2021-07', '2022-07', '2023-07', '2024-07', '2025-07', '2026-07'];
  const r = ritmoNoMandato(datas, [10851, 13038, 11594, 9064, 6288, 5796, 3335]);
  assert.equal(r.v.toFixed(1), '-26.8');
  assert.equal(r.referencia.toFixed(1), '3.4');
  // Soma de 12 meses: conta os meses entre as datas, não as linhas.
  const m = ritmoNoMandato(['2020-12', '2022-12', '2026-10'], [100, 121, 121]);
  assert.equal(m.v, 0);
  assert.equal(m.referencia.toFixed(1), '10.0');
  // Sem o dado de 24 meses antes, só falta a referência; um buraco não engana a conta.
  assert.equal(ritmoNoMandato(['2021-07', '2022-07', '2023-07'], [5, 10, 5]).referencia, null);
  assert.equal(ritmoNoMandato(['2021-07', '2022-07', '2023-07'], [5, null, 5]).referencia, null);
  // Sem nada de onde partir não há ritmo.
  assert.equal(ritmoNoMandato(['2023-07', '2024-07'], [5, 5]), null);
  assert.equal(ritmoNoMandato(['2022-07', '2023-07'], [0, 5]), null);
});

const MANDATOS = [
  { id: 'dilma_2', inicio: '2015-01-01', fim: '2016-08-31', emCurso: false },
  { id: 'temer', inicio: '2016-08-31', fim: '2018-12-31', emCurso: false },
  { id: 'bolsonaro', inicio: '2019-01-01', fim: '2022-12-31', emCurso: false },
  { id: 'lula_3', inicio: '2023-01-01', fim: '2026-12-31', emCurso: true },
];

test('o mandato sabe o que recebeu: quem assume em agosto já recebeu o ano PRODES que fechou', () => {
  const b = focoDoMandato(MANDATOS, 'bolsonaro');
  assert.deepEqual([b.posse, b.ate, b.anoRecebido, b.anoFinal, b.emCurso], ['2019-01', '2023-01', 2018, 2022, false]);
  const t = focoDoMandato(MANDATOS, 'temer');
  assert.deepEqual([t.posse, t.ate, t.anoRecebido, t.anoFinal], ['2016-08', '2019-01', 2016, 2018]);
  // Dilma termina em agosto: o ano PRODES de 2016 ainda é dela, como em mandatosNaSerie.
  assert.equal(focoDoMandato(MANDATOS, 'dilma_2').anoFinal, 2016);
  const l = focoDoMandato(MANDATOS, 'lula_3');
  assert.deepEqual([l.ate, l.emCurso, l.anoFinal], [null, true, 9999]);
  // O governo estadual de 2015 a 2018 atravessa dois presidentes.
  const g = focoDoMandato(MANDATOS, TERMO_2015);
  assert.deepEqual([g.posse, g.ate, g.anoRecebido, g.fim], ['2015-01', '2019-01', 2014, '2018-12-31']);
  assert.equal(focoDoMandato(MANDATOS, 'nao_existe'), null);
});

test('o calendário dos períodos', () => {
  assert.equal(mesDoPeriodo('202602'), '2026-06');
  assert.equal(mesDoPeriodo('2026-09'), '2026-09');
  assert.equal(mesDoPeriodo('2023'), '2023-12');
  assert.equal(mesDoPeriodo('hoje'), null);
  assert.equal(mesDoPeriodo('2023-1'), null);
});

const leituraMensal = (id, meses) => ({
  id, periodos: meses.map((codigo) => ({ codigo })), indicePosse: null, indiceRecebido: null,
  brasil: meses.map((_, i) => i), regioes: { 1: meses.map((_, i) => i) }, ufs: { 15: meses.map((_, i) => i * 10) },
});
const meses = (de, ate) => mesesEntre(de, ate);

test('a leitura no mandato: termina nele e o recebido é o último antes da posse', () => {
  const l = leituraMensal('gasolina', meses('2016-01', '2026-09'));
  const b = recortarLeitura(l, focoDoMandato(MANDATOS, 'bolsonaro'));
  assert.equal(b.periodos[0].codigo, '2017-01');
  assert.equal(b.periodos.at(-1).codigo, '2022-12');
  assert.equal(b.periodos[b.indiceRecebido].codigo, '2018-12');
  assert.equal(b.periodos[b.indicePosse].codigo, '2019-01');
  assert.equal(b.brasil.length, b.periodos.length);
  assert.equal(b.ufs[15].length, b.periodos.length);
  assert.equal(b.regioes[1].length, b.periodos.length);
});

test('no mandato em curso o resultado é o de sempre: dois anos antes, e 13 meses na soma de 12', () => {
  const lula = focoDoMandato(MANDATOS, 'lula_3');
  const g = recortarLeitura(leituraMensal('gasolina', meses('2016-01', '2026-09')), lula);
  assert.equal(g.periodos[0].codigo, '2021-01');
  assert.equal(g.periodos[g.indiceRecebido].codigo, '2022-12');
  const f = recortarLeitura(leituraMensal('focos_12m', meses('2016-01', '2026-09')), lula);
  assert.equal(f.periodos[0].codigo, '2021-12');
  // A anual do PRODES fica inteira, para o seletor de ano.
  const anual = recortarLeitura(leituraMensal('desmatamento', ['2017-07', '2022-07', '2023-07', '2025-07']), lula);
  assert.equal(anual.periodos[0].codigo, '2017-07');
  assert.equal(anual.periodos[anual.indiceRecebido].codigo, '2022-07');
});

test('leitura sem dado no mandato sai, e período sem calendário não se mexe', () => {
  const b = focoDoMandato(MANDATOS, 'bolsonaro');
  assert.equal(recortarLeitura(leituraMensal('pib', ['2023']), b), null);
  assert.equal(recortarLeitura(leituraMensal('x', meses('2023-01', '2024-01')), b), null);
  const semCalendario = leituraMensal('representacao', ['hoje']);
  assert.equal(recortarLeitura(semCalendario, b), semCalendario);
  // Começa dentro do mandato: há dado, mas não há o que comparar.
  const nova = recortarLeitura(leituraMensal('x', meses('2021-01', '2024-01')), b);
  assert.equal(nova.indiceRecebido, null);
  assert.equal(nova.periodos.at(-1).codigo, '2022-12');
});

test('afinar guarda só os pontos em que um mandato começa ou termina', () => {
  const a = afinarLeitura(leituraMensal('focos_12m', meses('2015-11', '2021-02')));
  const c = a.periodos.map((p) => p.codigo);
  assert.deepEqual(c, ['2015-12', '2016-07', '2016-12', '2017-12', '2018-12', '2019-12', '2020-12', '2021-01', '2021-02']);
  assert.equal(a.brasil.length, c.length);
  assert.deepEqual(a.ufs[15].slice(0, 2), [10, 80]);
  // Depois de afinar, o recorte acha o mesmo recebido.
  const b = recortarLeitura(a, focoDoMandato(MANDATOS, 'temer'));
  assert.equal(b.periodos[b.indiceRecebido].codigo, '2016-07');
  // A anual e a trimestral ficam como estão.
  const anual = leituraMensal('desmatamento', ['2017-07', '2018-07']);
  assert.equal(afinarLeitura(anual), anual);
});

const serie = (datas, valores) => ({ id: 's', datas, valores, cobertura: { inicio: datas[0], fim: datas.at(-1), lacunas: 0 }, referencia: datas.at(-1), parcial: true, preliminares: ['2026-07'] });

test('a série no mandato termina nele e leva a posse; sem dado dentro dele, sai', () => {
  const s = serie(['2018-07', '2022-07', '2023-07', '2026-07'], [1, 2, 3, 4]);
  const b = recortarSerie(s, focoDoMandato(MANDATOS, 'bolsonaro'));
  assert.deepEqual(b.datas, ['2018-07', '2022-07']);
  assert.deepEqual([b.posse, b.referencia, b.parcial, b.cobertura.fim], ['2019-01', '2022-07', false, '2022-07']);
  assert.deepEqual(b.preliminares, []);
  // O último dado é de antes do mandato: não é dele.
  assert.equal(recortarSerie(serie(['2017-07', '2018-07'], [1, 2]), focoDoMandato(MANDATOS, 'bolsonaro')), null);
  assert.equal(recortarSerie(serie(['2023-07'], [1]), focoDoMandato(MANDATOS, 'bolsonaro')), null);
  // Null no fim não conta como dado.
  assert.equal(recortarSerie(serie(['2018-07', '2019-07'], [1, null]), focoDoMandato(MANDATOS, 'bolsonaro')), null);
});

test('o painel inteiro no mandato', () => {
  const s = serie(['2018-07', '2022-07', '2026-07'], [1, 2, 3]);
  const painel = {
    presidente: { id: 'lula_3' }, hoje: '2026-11-03T12:00:00.000Z', novidades: [{ serieId: 'x' }], regioes: [{ codigo: '1' }], ufs: [{ codigo: '15' }],
    queimadas: { anos: [2022, 2023, 2024, 2025], satelite: 'x' },
    leituras: { economia: [leituraMensal('pib', ['2023'])], ambiente: [], congresso: ['c'], dinheiro: ['d'] },
    economia: {
      mandatos: MANDATOS, series: [s], indicadores: [{ serieId: 'atual' }], benchmark: ['atual'],
      porMandato: { bolsonaro: [{ serieId: 'dele' }] }, benchmarkPorMandato: { bolsonaro: ['dele'] },
      complemento: { series: [s], expectativas: [{ indicador: 'IPCA' }], ibovespa: { datas: ['2018-12-28', '2022-12-29', '2023-01-02'], valores: [1, 2, 3] }, indisponiveis: [] },
    },
    ambiente: {
      series: [s], porBioma: [{ id: 'pampa', prodes: s, focos: null }], fiscalizacao: [], focosMensais: { meses: ['2022-12', '2023-01'], brasil: [1, 2] }, focosParcial: { mes: '2026-11' },
      desmatamentoLegal: leituraMensal('desmatamento', ['2018-07', '2022-07']),
      protegidas: {
        anos: [2018, 2022, 2026], biomas: ['amazonia'], ano: 2026, ti: s, uc: s,
        maisPorAno: { 2022: [{ nome: 'A', recebido: 9, porAno: { 2018: 7, 2022: 3 } }, { nome: 'B', recebido: 9, porAno: { 2022: 1 } }], 2026: [{ nome: 'C', recebido: 1, porAno: {} }] },
        porBioma: { pampa: { ti: s, uc: null } },
      },
    },
  };
  const b = recortarAoMandato(painel, 'bolsonaro');
  assert.equal(b.foco.id, 'bolsonaro');
  assert.equal(b.hoje, '2022-12-31T12:00:00.000Z');
  assert.deepEqual(b.novidades, []);
  assert.deepEqual(b.queimadas.anos, [2022]);
  assert.deepEqual(b.economia.indicadores, [{ serieId: 'dele' }]);
  assert.deepEqual(b.economia.benchmark, ['dele']);
  assert.deepEqual(b.economia.mandatos.filter((m) => m.emCurso).map((m) => m.id), ['bolsonaro']);
  assert.deepEqual(b.economia.complemento.expectativas, []);
  assert.deepEqual(b.economia.complemento.ibovespa.datas, ['2018-12-28', '2022-12-29']);
  assert.equal(b.economia.complemento.ibovespa.posse, '2019-01');
  // A economia nunca abre sem medida; o desmatamento cai na Amazônia Legal.
  assert.equal(b.leituras.economia[0].id, 'sem_dado_por_estado');
  assert.equal(b.leituras.ambiente[0].id, 'desmatamento');
  // As outras abas não têm história: ficam como estão.
  assert.deepEqual(b.leituras.congresso, ['c']);
  // O mês em andamento é de hoje, não do mandato.
  assert.equal(b.ambiente.focosParcial, null);
  assert.deepEqual(b.ambiente.focosMensais.meses, ['2022-12']);
  // Na lista das áreas, o recebido é o do mandato; sem registro em ano publicado, zero.
  const p = b.ambiente.protegidas;
  assert.deepEqual([p.ano, p.anos], [2022, [2018, 2022]]);
  assert.deepEqual(p.maisPorAno[2022].map((x) => x.recebido), [7, 0]);
  assert.equal(p.maisPorAno[2026], undefined);
  // O mandato em curso não corta nada das séries.
  const l = recortarAoMandato(painel, 'lula_3');
  assert.equal(l.economia.series[0], s);
  assert.equal(l.hoje, painel.hoje);
  // Id desconhecido cai no mandato em curso.
  assert.equal(recortarAoMandato(painel, 'x').foco.id, 'lula_3');
});

test('o município no mandato: o recebido é o dele, e sem ano nenhum não inventa um', () => {
  const base = { codigos: ['1'], biomas: { 1: 'amazonia' }, publicados: {}, alertas: null, ibama: null, focos: null, janelaAtual: '2018-12', coletas: {} };
  const vazio = montarMunicipios({ ...base, desmatamento: [], janelaRecebido: '1994-12', anoRecebido: 1994 });
  assert.deepEqual(vazio.anos, []);
  assert.equal(vazio.anoCompleto, null);
  assert.deepEqual(vazio.janela, { recebido: '1994-12', atual: '2018-12' });
  // Alerta sem base continua sem base; a soma não trata isso como zero.
  const m = montarMunicipios({
    ...base,
    codigos: ['1500000', '1500001'],
    biomas: { 1500000: 'amazonia', 1500001: 'amazonia' },
    desmatamento: [
      { municipio: '1500000', bioma: 'amazonia', ano: 2018, area: 7, preliminar: false },
      { municipio: '1500000', bioma: 'amazonia', ano: 2019, area: 9, preliminar: false },
    ],
    publicados: { amazonia: [2018, 2019] },
    alertas: [{ municipio: '1500000', recebido: null, atual: 4 }, { municipio: '1500001', recebido: 3, atual: 1 }],
    anoRecebido: 2018,
  });
  assert.deepEqual(m.m['1500000'].a, [null, 4]);
  assert.deepEqual(numerosDaLente(m.m['1500000'], 'alertas', m, null), { agora: 4, recebido: null });
  assert.deepEqual(numerosDaLente(m.m['1500000'], 'desmatamento', m, 2019), { agora: 9, recebido: 7 });
  assert.deepEqual(somaNaUf(m, '15', (x) => x.a), { recebido: null, agora: 5 });
  // No mapa, sem base fica sem veredito.
  assert.equal(corDaLente(4, null, 'alertas', 'posse', 100), 'var(--atlas-papel)');
});

test('o ritmo parte do recebido: o aumento de janeiro do salário mínimo é do mandato', () => {
  const datas = ['2016-12', '2018-12', '2019-01', '2022-12', '2023-01', '2026-10'];
  const salario = [1400, 1439.39, 1500.98, 1440.72, 1539.54, 1621];
  // Partindo do primeiro dado do mandato, Bolsonaro caía 1% ao ano; do recebido, ficou igual.
  const b = ritmoNoMandato(datas, salario, '2019-01', { ate: '2023-01' });
  assert.equal(b.v.toFixed(2), '0.02');
  assert.equal(b.referencia.toFixed(1), '1.4');
  // Lula conta o aumento de jan/2023: do recebido, 3,1% ao ano, e não 1,4%.
  assert.equal(ritmoNoMandato(datas, salario, '2023-01').v.toFixed(1), '3.1');
});

test('o ritmo em pontos por ano, para as taxas', () => {
  const datas = ['2020-12', '2022-12', '2026-09'];
  const r = ritmoNoMandato(datas, [4.5, 5.8, 4.6], '2023-01', { pontos: true });
  assert.equal(r.v.toFixed(2), '-0.32');
  assert.equal(r.referencia.toFixed(2), '0.65');
  // Taxa negativa ou zero tem ritmo em pontos, mas não em %.
  assert.equal(ritmoNoMandato(['2022-12', '2023-12'], [0, 2], '2023-01', { pontos: true }).v, 2);
  assert.equal(ritmoNoMandato(['2022-12', '2023-12'], [0, 2], '2023-01'), null);
  // O mandato termina antes de o dado acabar, e sem dado dentro dele não há ritmo.
  assert.equal(ritmoNoMandato(['2018-12', '2022-12', '2026-09'], [2, 4, 9], '2019-01', { pontos: true, ate: '2023-01' }).v, 0.5);
  assert.equal(ritmoNoMandato(['2018-12', '2023-01'], [2, 4], '2019-01', { pontos: true, ate: '2023-01' }), null);
});

test('o recebido sem série própria é o último dado do governo anterior', () => {
  const a = { valorFinal: 6.9, dataFim: '2018-01-01' };
  const b = { valorFinal: 4.9, dataFim: '2022-01-01' };
  const c = { valorFinal: 3.0, dataFim: '2025-01-01' };
  assert.deepEqual(recebidoNaLista([a, b, c], 2), { valor: 4.9, data: '2022-01-01' });
  assert.deepEqual(recebidoNaLista([a, b, c], 1), { valor: 6.9, data: '2018-01-01' });
  // Quem começa a série não recebeu nada; governo sem o dado é pulado, e não vira zero.
  assert.equal(recebidoNaLista([a, b, c], 0), null);
  assert.deepEqual(recebidoNaLista([a, null, c], 2), { valor: 6.9, data: '2018-01-01' });
  assert.deepEqual(recebidoNaLista([a, { valorFinal: null, dataFim: null }, c], 2), { valor: 6.9, data: '2018-01-01' });
  assert.equal(recebidoNaLista([null, null, c], 2), null);
});

test('o recebido no painel segue o mandato na tela', () => {
  const economia = {
    mandatos: [{ id: 'lula_3', inicio: '2023-01-01' }, { id: 'bolsonaro', inicio: '2019-01-01' }],
    porMandato: { bolsonaro: [{ serieId: 'pobreza', valorFinal: 4.9, dataFim: '2022-01-01' }], lula_3: [{ serieId: 'pobreza', valorFinal: 3, dataFim: '2025-01-01' }] },
  };
  assert.deepEqual(recebidoNoPainel({ economia, foco: { id: 'lula_3' } }, 'pobreza'), { valor: 4.9, data: '2022-01-01' });
  assert.equal(recebidoNoPainel({ economia, foco: { id: 'bolsonaro' } }, 'pobreza'), null);
  // O governo estadual de 2015 não é um presidente: sem recebido por aqui.
  assert.equal(recebidoNoPainel({ economia, foco: { id: 'gov-2015' } }, 'pobreza'), null);
});

test('o ritmo desde o recebido: pontos para níveis, composto para índices', () => {
  const r = { valor: 4.9, data: '2022-01-01' };
  const p = ritmoDesdeORecebido(r, { valorFinal: 3, dataFim: '2025-01-01', tipo: 'nivel_pct' });
  assert.deepEqual([p.v.toFixed(2), p.pontos], ['-0.63', true]);
  // PIB: do 4º tri de 2022 ao 2º de 2026, três anos e meio.
  const q = ritmoDesdeORecebido({ valor: 180.35, data: '2022-10-01' }, { valorFinal: 198.24, dataFim: '2026-04-01', tipo: 'indice' });
  assert.deepEqual([q.v.toFixed(1), q.pontos], ['2.7', false]);
  assert.equal(ritmoDesdeORecebido(null, { valorFinal: 3, dataFim: '2025-01-01', tipo: 'nivel_pct' }), null);
  assert.equal(ritmoDesdeORecebido(r, { valorFinal: null, dataFim: null, tipo: 'nivel_pct' }), null);
  assert.equal(ritmoDesdeORecebido(r, { valorFinal: 3, dataFim: '2022-01-01', tipo: 'nivel_pct' }), null);
  // Taxa do período não vira ritmo por níveis; valor zero não tem taxa composta.
  assert.equal(ritmoDesdeORecebido(r, { valorFinal: 3, dataFim: '2025-01-01', tipo: 'taxa_periodo' }), null);
  assert.equal(ritmoDesdeORecebido({ valor: 0, data: '2022-01-01' }, { valorFinal: 3, dataFim: '2025-01-01', tipo: 'indice' }), null);
});
