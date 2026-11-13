import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agruparPor, caminhoParlamentar, comparadoAMedia, idade, intervaloDaCota, mesesDaCota, posicaoEntre, posicaoNaCota, posicaoNoAno, primeiroMesComNota, reaisCompactos, reaisInteiros, resumirRecorte, rotaParlamentar, situacaoDaCota, situacaoDosMeses, textoPercentual } from '../src/app/_painel/_dados/congressoModelo.ts';

const indice = {
  casa: 'deputados', coletadoEm: '2026-11-10T12:00:00Z', anos: [2025, 2026], ultimoMes: {}, fontes: { dados: '', explicacao: '' }, media: {},
  totais: { 1: [100, 300], 2: [200, 300], 3: [null, 100], 4: [50, null] },
};

test('posição conta só quem gastou mais e ignora quem não tem nota no ano', () => {
  assert.deepEqual(posicaoNoAno(indice, 1, 2026), { posicao: 1, de: 3 });
  assert.deepEqual(posicaoNoAno(indice, 2, 2026), { posicao: 1, de: 3 }, 'empate divide a posição');
  assert.deepEqual(posicaoNoAno(indice, 3, 2026), { posicao: 3, de: 3 });
  assert.equal(posicaoNoAno(indice, 4, 2026), null);
  assert.equal(posicaoNoAno(indice, 1, 2019), null);
  assert.deepEqual(posicaoNoAno(indice, 4, 2025), { posicao: 3, de: 3 });
});

test('recorte soma meses, categorias e ordena quem mais gastou', () => {
  const m = v => Array.from({ length: 12 }, (_, i) => (i === 0 ? v : 0));
  const cota = {
    casa: 'deputados', ano: 2026, coletadoEm: '', ultimoMes: 1, categorias: ['Passagens', 'Divulgação'], mediaMes: [],
    pessoas: { 1: { t: 300, n: 3, m: m(300), c: [[0, 200], [1, 100]], f: [] }, 2: { t: 500, n: 1, m: m(500), c: [[1, 500]], f: [] } },
  };
  const r = resumirRecorte(cota, [1, 2, 99]);
  assert.equal(r.total, 800);
  assert.equal(r.pessoas, 2, 'quem não tem nota não entra na média');
  assert.equal(r.notas, 4);
  assert.equal(r.media, 400);
  assert.equal(r.meses[0], 800);
  assert.deepEqual(r.categorias, [{ nome: 'Divulgação', valor: 600 }, { nome: 'Passagens', valor: 200 }]);
  assert.deepEqual(r.maiores.map(p => p.id), [2, 1]);
  assert.equal(resumirRecorte(cota, []).media, 0);
});

test('grupos dividem pelo número de quem tem nota e contam todos os membros', () => {
  const cota = { casa: 'deputados', ano: 2026, coletadoEm: '', ultimoMes: 1, categorias: [], mediaMes: [],
    pessoas: { 1: { t: 300, n: 1, m: [], c: [], f: [] }, 2: { t: 100, n: 1, m: [], c: [], f: [] }, 3: { t: 900, n: 1, m: [], c: [], f: [] } } };
  const pessoas = [{ id: 1, partido: 'A' }, { id: 2, partido: 'A' }, { id: 4, partido: 'A' }, { id: 3, partido: 'B' }];
  const grupos = agruparPor(cota, pessoas, p => p.partido);
  assert.deepEqual(grupos.map(g => [g.chave, g.total, g.media, g.comNotas, g.membros]), [['B', 900, 900, 1, 1], ['A', 400, 200, 2, 3]]);
  assert.deepEqual(posicaoEntre(cota, [1, 2, 3, 4], 1), { posicao: 2, de: 3 });
  assert.equal(posicaoEntre(cota, [1, 2], 4), null);
});

test('endereço da página do parlamentar', () => {
  assert.equal(caminhoParlamentar('deputados', { id: 74646, nome: 'Aécio Neves' }), '/congresso/deputados/aecio-neves-74646');
  assert.equal(caminhoParlamentar('senadores', { id: 5894, nome: "Flávio Bolsonaro" }), '/congresso/senadores/flavio-bolsonaro-5894');
  assert.equal(caminhoParlamentar('deputados', { id: 1, nome: 'Dr. Zé (Filho)' }), '/congresso/deputados/dr-ze-filho-1');
  assert.deepEqual(rotaParlamentar('/congresso/deputados/aecio-neves-74646'), { casa: 'deputados', id: 74646 });
  assert.deepEqual(rotaParlamentar('/congresso/senadores/5894'), { casa: 'senadores', id: 5894 }, 'só o id também abre');
  assert.equal(rotaParlamentar('/congresso'), null);
  assert.equal(rotaParlamentar('/congresso/vereadores/fulano-1'), null);
  assert.equal(rotaParlamentar('/congresso/deputados/fulano'), null);
});

test('meses recentes ficam parciais e os seguintes, futuros', () => {
  const s = situacaoDosMeses(2026, '2026-11-10T12:00:00Z');
  assert.deepEqual(s.slice(7), ['completo', 'parcial', 'parcial', 'parcial', 'futuro']);
  assert.ok(situacaoDosMeses(2025, '2026-11-10T12:00:00Z').every(m => m === 'completo'));
  assert.deepEqual(situacaoDosMeses(2025, '2026-01-15T00:00:00Z').slice(9), ['completo', 'parcial', 'parcial']);
});

test('idade completa e datas inválidas', () => {
  assert.equal(idade('1964-06-14', new Date(2026, 10, 10)), 62);
  assert.equal(idade('1964-11-11', new Date(2026, 10, 10)), 61, 'aniversário amanhã');
  assert.equal(idade('1964-11-10', new Date(2026, 10, 10)), 62, 'aniversário hoje');
  assert.equal(idade(null), null);
  assert.equal(idade('sem data'), null);
});

test('reais curtos e inteiros', () => {
  assert.equal(reaisCompactos(950.4), 'R$ 950');
  assert.equal(reaisCompactos(38_712), 'R$ 38,7 mil');
  assert.equal(reaisCompactos(338_790), 'R$ 339 mil');
  assert.equal(reaisCompactos(1_254_000), 'R$ 1,25 mi');
  assert.equal(reaisCompactos(144_569_287), 'R$ 144,6 mi');
  assert.equal(reaisCompactos(-1200), '−R$ 1,2 mil');
  assert.equal(reaisInteiros(338_790.4), 'R$ 338.790');
  assert.equal(reaisCompactos(25_000_000), 'R$ 25 mi', 'sem ",0" sobrando');
  assert.equal(reaisCompactos(78_000), 'R$ 78 mil');
  assert.equal(reaisCompactos(1_500_000), 'R$ 1,5 mi');
});

test('parte do total', () => {
  assert.equal(textoPercentual(497, 580), '86%');
  assert.equal(textoPercentual(930, 579_582), '<1%');
  assert.equal(textoPercentual(0, 100), '0%');
  assert.equal(textoPercentual(1, 0), '—');
});

test('comparação com a média', () => {
  assert.deepEqual(comparadoAMedia(338_790, 282_362), { texto: '20% acima da média', diferenca: 20 });
  assert.deepEqual(comparadoAMedia(90, 100), { texto: '10% abaixo da média', diferenca: -10 });
  assert.equal(comparadoAMedia(100, 100).texto, 'na média');
  assert.equal(comparadoAMedia(100, 0), null);
});

test("a legislatura começa em fevereiro de 2023 e tem 48 meses", () => {
  const leg = { ano: "legislatura", inicio: "2023-02", mediaMes: Array(48).fill(0), coletadoEm: "2026-11-11T00:00:00Z" };
  const meses = mesesDaCota(leg);
  assert.deepEqual(meses[0], { ano: 2023, mes: 1 });
  assert.deepEqual(meses[11], { ano: 2024, mes: 0 }, "a virada do ano cai na 12ª coluna");
  assert.deepEqual(meses.at(-1), { ano: 2027, mes: 0 });
  const situacao = situacaoDaCota(leg);
  assert.equal(situacao[44], "parcial", "outubro de 2026, ainda chegando");
  assert.equal(situacao[46], "futuro", "dezembro de 2026");
  assert.equal(intervaloDaCota(leg), ", de fevereiro de 2023 a novembro de 2026");
  const ano = { ano: 2026, mediaMes: Array(12).fill(0), coletadoEm: "2026-11-11T00:00:00Z" };
  assert.deepEqual(mesesDaCota(ano)[0], { ano: 2026, mes: 0 });
  assert.equal(intervaloDaCota(ano), ", de janeiro a novembro");
  assert.equal(intervaloDaCota({ ...ano, ano: 2024 }), "", "ano fechado não precisa de intervalo");
});

test("primeira nota e posição no período inteiro", () => {
  const cota = { ano: "legislatura", inicio: "2023-02", mediaMes: Array(48).fill(0), pessoas: {
    1: { t: 300, n: 3, m: [0, 0, 0, 0, 0, 100, ...Array(42).fill(0)], c: [], f: [] },
    2: { t: 500, n: 5, m: [500, ...Array(47).fill(0)], c: [], f: [] },
  } };
  assert.deepEqual(primeiroMesComNota(cota, cota.pessoas[1]), { ano: 2023, mes: 6 }, "julho de 2023");
  assert.deepEqual(posicaoNaCota(cota, 1), { posicao: 2, de: 2 });
  assert.equal(posicaoNaCota(cota, 9), null);
});

test('a cota histórica soma todos os anos sem sobrepor a legislatura nem perder meses', () => {
  const ler = nome => JSON.parse(readFileSync(new URL(`../public/painel/congresso/${nome}.json`, import.meta.url), 'utf8'));
  for (const casa of ['deputados','senadores']) {
    const indice = ler(`cota-${casa}`), historico = ler(`cota-${casa}-historico`);
    const anuais = indice.anos.map(a => ler(`cota-${casa}-${a}`));
    assert.equal(indice.anos[0], 2008); assert.ok(indice.anos.length > 4);
    assert.equal(mesesDaCota(historico)[0].ano, 2008);
    assert.equal(historico.mediaMes.length, indice.anos.length * 12);
    for (const [id,gasto] of Object.entries(historico.pessoas)) {
      const soma = anuais.reduce((s,a) => s + (a.pessoas[id]?.t ?? 0), 0);
      assert.ok(Math.abs(gasto.t - soma) <= indice.anos.length / 2, `${casa}/${id}: total histórico duplicado`);
      assert.equal(gasto.n, anuais.reduce((s,a) => s + (a.pessoas[id]?.n ?? 0), 0));
      assert.deepEqual(gasto.m, anuais.flatMap(a => a.pessoas[id]?.m ?? Array(12).fill(0)));
    }
  }
});
