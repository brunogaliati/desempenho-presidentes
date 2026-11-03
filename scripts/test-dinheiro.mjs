import test from 'node:test';
import assert from 'node:assert/strict';
import {
  abrirComAcoes,
  arranjarTreemap,
  baldesDoPeriodo,
  baseDoAno,
  conteudoDoBloco,
  descontarRefinanciamentoSemRotulo,
  gruposDeGovernadores,
  gruposDePresidentes,
  normalizarEnte,
  populacaoNoAno,
  reais,
  reguaDosEstados,
  sinal,
  tirarRepasseDaBase,
  squarify,
  variacaoReal,
} from '../src/app/prototipo/_dados/dinheiroModelo.ts';

const l = (nivel, conta, valor, funcao = null) => ({ nivel, conta, valor, funcao });

test('baldes tiram o refinanciamento do total e separam os encargos', () => {
  const b = baldesDoPeriodo([
    l('total', 'DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)', 1000),
    l('funcao', 'Saúde', 100, 'Saúde'),
    l('subfuncao', 'Atenção Básica', 60, 'Saúde'),
    l('subfuncao', 'FU10 - Demais Subfunções', 40, 'Saúde'),
    l('funcao', 'Encargos Especiais', 900, 'Encargos Especiais'),
    l('subfuncao', 'Refinanciamento da Dívida Interna', 500, 'Encargos Especiais'),
    l('subfuncao', 'Serviço da Dívida Interna', 200, 'Encargos Especiais'),
    l('subfuncao', 'Serviço da Dívida Externa', 50, 'Encargos Especiais'),
    l('subfuncao', 'Transferências', 80, 'Encargos Especiais'),
    l('subfuncao', 'Transferências para a Educação Básica', 20, 'Encargos Especiais'),
    l('subfuncao', 'Outros Encargos Especiais', 30, 'Encargos Especiais'),
    l('subfuncao', 'FU28 - Demais Subfunções', 20, 'Encargos Especiais'),
  ]);
  assert.equal(b.t, 500);
  assert.deepEqual(b.v, { saude: 100, divida: 250, transf: 80, edbasica: 20, outros: 50 });
  assert.deepEqual(b.abre.saude, [['Atenção Básica', 60], ['Demais', 40]]);
  assert.deepEqual(b.abre.divida, [['Serviço da Dívida Interna', 200], ['Serviço da Dívida Externa', 50]]);
  // Fecha com o total sem precisar de "Sem classificação".
  assert.equal(Object.values(b.v).reduce((s, x) => s + x, 0), b.t);
});

test('o que não casa com função vai para sem classificação, e sem total não há ponto', () => {
  const b = baldesDoPeriodo([l('total', 'x', 100), l('funcao', 'Saúde', 60, 'Saúde')]);
  assert.equal(b.v.naoclass, 40);
  assert.equal(baldesDoPeriodo([l('funcao', 'Saúde', 60, 'Saúde')]), null);
});

test('refinanciamento sem rótulo sai do total e da dívida, e só quando há rótulo', () => {
  const b = { t: 2689, v: { divida: 462.5, saude: 100 }, abre: {}, refinanciamento: 1411.8 };
  const d = descontarRefinanciamentoSemRotulo(b, 2675.8);
  assert.ok(Math.abs(d.t - 2675.8) < 1e-9);
  assert.ok(Math.abs(d.v.divida - 449.3) < 1e-9);
  assert.equal(d.v.saude, 100);
  assert.equal(descontarRefinanciamentoSemRotulo({ ...b, refinanciamento: 0 }, 2675.8).t, 2689);
  assert.equal(descontarRefinanciamentoSemRotulo(b, null).t, 2689);
  assert.equal(descontarRefinanciamentoSemRotulo(b, 2689.5).t, 2689);
});

const uniao2025 = { t: 3705, v: { outros: 346, divida: 593, previdencia: 1101, transf: 470 }, abre: {}, refinanciamento: 0 };
const acao = (subfuncao, acao, nome, realizado, funcao = '28') => ({ funcao, subfuncao, acao, nome, realizado });
const acoes2025 = [
  acao('846', '0669', 'COBERTURA DO RESULTADO NEGATIVO', 124),
  acao('846', '0179', 'PENSOES MILITARES DA UNIAO', 26),
  acao('846', '00XO', 'FINANCIAMENTOS A EXPORTADORAS', 85),
  acao('846', '0625', 'SENTENCAS JUDICIAIS', 3),
  acao('846', '0265', 'INDENIZACOES DO PROAGRO', 12),
  acao('845', '0045', 'Transferência ao Fundo de Participação dos Municípios - FPM (CF, art.159)', 192),
  acao('845', '0044', 'FUNDO DE PARTICIPACAO DOS ESTADOS (CF)', 159),
  acao('272', '0179', 'PENSOES MILITARES DA UNIAO', 900, '09'),
];

test('com a CGU, Banco Central vira bloco, pensões voltam e o resto abre', () => {
  const b = abrirComAcoes(uniao2025, { acoes: acoes2025, jurosEAmortizacao: 717 });
  assert.equal(b.v.bancocentral, 124);
  assert.equal(b.v.previdencia, 1127);
  assert.equal(b.v.outros, 196);
  assert.equal(Object.values(b.v).reduce((s, x) => s + x, 0), Object.values(uniao2025.v).reduce((s, x) => s + x, 0));
  assert.deepEqual(b.abre.outros, [['Precatórios e sentenças (por diferença)', 99], ['Financiamentos e fundos', 85], ['Demais encargos', 12]]);
  assert.deepEqual(b.abre.transf.map((x) => x[1]), [192, 159]);
  assert.equal(b.abre.transf[0][0], 'Transferência ao Fundo de Participação dos Municípios - FPM');
  assert.equal(b.abre.transf[1][0], 'Fundo de participacao dos estados');
});

test('sem a CGU, ou no ano aberto, o Banco Central é a diferença entre os anexos', () => {
  const b = abrirComAcoes({ ...uniao2025, v: { outros: 346e9, divida: 593e9, previdencia: 1101e9 } }, { jurosEAmortizacao: 717e9 });
  assert.equal(b.v.bancocentral, 124e9);
  assert.equal(b.v.outros, 222e9);
  assert.equal(b.v.previdencia, 1101e9);
  assert.equal(b.abre.outros, undefined);
});

test('o refinanciamento de 2022 não vira Banco Central, e diferença pequena ou negativa também não', () => {
  const com = abrirComAcoes({ ...uniao2025, refinanciamento: 1411e9, v: { outros: 139e9, divida: 449e9 } }, { jurosEAmortizacao: 454e9 });
  assert.equal(com.v.bancocentral, undefined);
  const igual = abrirComAcoes({ ...uniao2025, v: { outros: 139e9, divida: 454e9 } }, { jurosEAmortizacao: 454e9 });
  assert.equal(igual.v.bancocentral, undefined);
  assert.equal(igual.v.outros, 139e9);
});

test('se a conta não fecha, os encargos ficam como o Tesouro publicou', () => {
  const b = { ...uniao2025, v: { outros: 50, divida: 593 } };
  assert.equal(abrirComAcoes(b, { acoes: acoes2025 }), b);
});

test('nos estados as transferências saem da base e seguem visíveis', () => {
  const sp = tirarRepasseDaBase({ t: 355, v: { transf: 76, educacao: 69 }, abre: {}, refinanciamento: 0 });
  assert.equal(sp.t, 279);
  assert.equal(sp.fora, 76);
  assert.equal(sp.v.transf, undefined);
  assert.ok(Math.abs((100 * sp.v.educacao) / sp.t - 24.73) < 0.01);
  const mg = { t: 113, v: { educacao: 20 }, abre: {}, refinanciamento: 0 };
  assert.equal(tirarRepasseDaBase(mg), mg);
});

test('população usa o ano, interpola o buraco e nunca inventa sem série', () => {
  const serie = { 2021: 100, 2024: 130, 2026: 150 };
  assert.equal(populacaoNoAno(serie, 2024), 130);
  assert.equal(populacaoNoAno(serie, 2022), 110);
  assert.equal(populacaoNoAno(serie, 2023), 120);
  assert.equal(populacaoNoAno(serie, 2030), 150);
  assert.equal(populacaoNoAno(serie, 2015), 100);
  assert.equal(populacaoNoAno(undefined, 2024), null);
});

test('squarify preserva a área e não sai do retângulo', () => {
  const r = squarify([{ v: 50 }, { v: 25 }, { v: 15 }, { v: 7 }, { v: 3 }], { x: 10, y: 20, w: 300, h: 200 });
  assert.equal(r.length, 5);
  const area = r.reduce((s, b) => s + b.w * b.h, 0);
  assert.ok(Math.abs(area - 60000) < 0.01);
  for (const b of r) {
    assert.ok(Math.abs((b.w * b.h) / 60000 - b.v / 100) < 1e-9);
    assert.ok(b.x >= 10 - 1e-9 && b.y >= 20 - 1e-9 && b.x + b.w <= 310 + 1e-9 && b.y + b.h <= 220 + 1e-9);
  }
  assert.deepEqual(squarify([], { x: 0, y: 0, w: 10, h: 10 }), []);
});

const ponto = { t: 1000, p: 100, v: { previdencia: 400, divida: 200, saude: 150, educacao: 120, cultura: 5, saneamento: 3, defesa: 122 } };

test('treemap junta os pequenos e abre a família no zoom', () => {
  const b = arranjarTreemap(ponto, { w: 800, h: 500 }, null);
  assert.ok(b.some((x) => x.id === 'dobra-servicos' && x.dobra === 2 && x.v === 8));
  assert.ok(!b.some((x) => x.id === 'cultura'));
  // No celular dobra mais cedo.
  const celular = arranjarTreemap({ ...ponto, v: { ...ponto.v, agricultura: 20 }, t: 1020 }, { w: 335, h: 440 }, null, 335, 0.03);
  assert.ok(celular.some((x) => x.id === 'dobra-servicos' && x.dobra === 3));
  const z = arranjarTreemap(ponto, { w: 800, h: 500 }, 'servicos');
  assert.deepEqual(z.map((x) => x.id), ['saude', 'educacao', 'cultura', 'saneamento']);
});

test('abrir a barra só estreita: a ordem e a altura dos blocos não mudam', () => {
  const fechado = arranjarTreemap(ponto, { w: 800, h: 500 }, null, 800);
  const aberto = arranjarTreemap(ponto, { w: 696, h: 500 }, null, 800);
  assert.deepEqual(aberto.map((b) => b.id), fechado.map((b) => b.id));
  fechado.forEach((b, i) => {
    assert.ok(Math.abs(b.y - aberto[i].y) < 1e-6 && Math.abs(b.h - aberto[i].h) < 1e-6);
    assert.ok(aberto[i].x + aberto[i].w <= 696 + 1e-6);
  });
});

test('bloco estreito fala na vertical, e minúsculo fica sem texto', () => {
  assert.equal(conteudoDoBloco({ w: 300, h: 300 }, 'Previdência', 'R$ 29,73').tipo, 'cheio');
  assert.equal(conteudoDoBloco({ w: 50, h: 240 }, 'Repasse à educação básica', 'R$ 2,75').tipo, 'vertical');
  assert.equal(conteudoDoBloco({ w: 15, h: 15 }, 'Saneamento', 'R$ 0,01').tipo, 'vazio');
  // Palavra que não cabe na largura não sai cortada.
  assert.equal(conteudoDoBloco({ w: 67, h: 144 }, 'Agricultura', 'R$ 1,09').tipo, 'vertical');
  // Baixo e largo: letra menor em vez de ficar mudo.
  assert.equal(conteudoDoBloco({ w: 80, h: 60 }, 'Agricultura', 'R$ 1,09').tipo, 'compacto');
});

const anos = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const mandatos = [
  { id: 'dilma_2', nomeCurto: 'Dilma', mandato: 2, inicio: '2015-01-01' },
  { id: 'temer', nomeCurto: 'Temer', mandato: 1, inicio: '2016-08-31' },
  { id: 'bolsonaro', nomeCurto: 'Bolsonaro', mandato: 1, inicio: '2019-01-01' },
  { id: 'lula_3', nomeCurto: 'Lula', mandato: 3, inicio: '2023-01-01' },
];

test('quem governava em julho fica com o ano', () => {
  const g = gruposDePresidentes(anos, mandatos);
  assert.deepEqual(g.map((x) => [x.rotulo, x.anos[0], x.anos.at(-1)]), [['Dilma 2', 2015, 2016], ['Temer', 2017, 2018], ['Bolsonaro', 2019, 2022], ['Lula 3', 2023, 2026]]);
});

test('a base é o ano antes do governo, e sem base não vira zero', () => {
  const g = gruposDePresidentes(anos, mandatos);
  const painel = { anos, parcial: { ano: 2026, bim: 4, mes: 'ago' }, idx: { 2025: 1, 2022: 1.2, 2026: 1, '2022p': 1.2 } };
  assert.equal(baseDoAno(painel, 2015, g), null);
  assert.equal(baseDoAno(painel, 2017, g).ano, 2016);
  assert.equal(baseDoAno(painel, 2025, g).chave, '2022');
  assert.equal(baseDoAno(painel, 2026, g).chave, '2022p');
  const ente = { anos: { 2025: { t: 1000, p: 1, v: { saude: 240 } }, 2022: { t: 800, p: 1, v: { saude: 100 } } } };
  // 240 de hoje contra 100 × 1,2 = 120 de hoje: dobrou.
  assert.ok(Math.abs(variacaoReal(painel, ente, 2025, baseDoAno(painel, 2025, g), 'saude') - 100) < 1e-9);
  assert.equal(variacaoReal(painel, ente, 2025, null, 'saude'), null);
  assert.equal(variacaoReal(painel, ente, 2025, baseDoAno(painel, 2025, g), 'educacao'), null);
});

test('mandatos de governador cortam nos anos da base', () => {
  const g = gruposDeGovernadores(anos, [{ id: 'gov-2015', ano: 2015, nomes: ['A', 'B'] }, { id: 'bolsonaro', ano: 2019, nomes: ['C'] }, { id: 'lula_3', ano: 2023, nomes: ['D'] }, { id: 'velho', ano: 2011, nomes: ['E'] }]);
  assert.deepEqual(g.map((x) => x.rotulo), ['A +1', 'C', 'D']);
});

test('régua ignora quem tem menos de R$ 1 por habitante e empilha sem passar de cinco', () => {
  const entes = { BR: { nome: 'União', anos: {}, abre: {} } };
  for (let i = 0; i < 26; i++) entes[`U${i}`] = { nome: `Estado ${i}`, abre: {}, anos: { 2025: { t: 1000, p: 10, v: { saude: 1000 + i } } } };
  entes.DF = { nome: 'DF', abre: {}, anos: { 2025: { t: 1000, p: 1000, v: { saude: 5 } } } };
  const r = reguaDosEstados(entes, 'saude', 2025);
  assert.equal(r.pontos.length, 26);
  assert.ok(!r.pontos.some((p) => p.sigla === 'DF'));
  assert.ok(r.linhas <= 5);
  assert.equal(reguaDosEstados(entes, 'defesa', 2025), null);
});

test('formatos', () => {
  assert.equal(reais(3705e9), 'R$ 3,71 tri');
  assert.equal(reais(217e9), 'R$ 217 bi');
  assert.equal(reais(4.5e9), 'R$ 4,5 bi');
  assert.equal(sinal(-2.4), '−2%');
  assert.equal(normalizarEnte('MUNICIPIO DE SÃO THOMÉ DAS LETRAS'), 'SAO THOME DAS LETRAS');
});
