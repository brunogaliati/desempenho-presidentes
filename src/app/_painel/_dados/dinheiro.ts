import "server-only";

import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";

import {
  abrirComAcoes,
  baldesDoPeriodo,
  descontarRefinanciamentoSemRotulo,
  MES_DO_BIMESTRE,
  normalizarEnte,
  populacaoNoAno,
  tirarRepasseDaBase,
  type AcaoDaUniao,
  type EmendasDoAno,
  type EnteDinheiro,
  type LinhaFuncao,
  type PainelDinheiro,
  type ReceitaDinheiro,
} from "./dinheiroModelo";

/**
 * A aba Dinheiro carrega à parte do painel: nem toda visita abre esta aba, e o
 * orçamento de 28 entes por 12 anos pesaria na página de todas as outras.
 */

const NOME_UF: Record<string, string> = {
  RO: "Rondônia", AC: "Acre", AM: "Amazonas", RR: "Roraima", PA: "Pará", AP: "Amapá", TO: "Tocantins", MA: "Maranhão", PI: "Piauí",
  CE: "Ceará", RN: "Rio Grande do Norte", PB: "Paraíba", PE: "Pernambuco", AL: "Alagoas", SE: "Sergipe", BA: "Bahia", MG: "Minas Gerais",
  ES: "Espírito Santo", RJ: "Rio de Janeiro", SP: "São Paulo", PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul",
  MS: "Mato Grosso do Sul", MT: "Mato Grosso", GO: "Goiás", DF: "Distrito Federal",
};

const COD_UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE",
  "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/**
 * A população é a do IBGE: a informada ao Siconfi muda de base em 2024 e deixa Roraima
 * 14% abaixo. O IBGE não tem estimativa de 2022 e 2023 na base; esses anos são interpolados.
 */
async function lerPopulacao() {
  const linhas = (await sql`select nivel, codigo_ibge, ano::int as ano, populacao::float8 as populacao
    from mart.populacao_estimada where nivel in ('N1', 'N3') and ano >= 2014`) as { nivel: string; codigo_ibge: string; ano: number; populacao: number }[];
  const series: Record<string, Record<string, number>> = {};
  for (const l of linhas) {
    const sigla = l.nivel === "N1" ? "BR" : COD_UF[String(l.codigo_ibge)];
    if (sigla) (series[sigla] ??= {})[l.ano] = l.populacao;
  }
  return series;
}

/** Do Anexo 01 da União: o total, já sem refinanciamento nenhum, e juros mais amortização. */
async function lerTotaisDaUniao() {
  const linhas = (await sql`select exercicio::int as ano, bimestre::int as bim, conta_codigo as conta, valor::float8 as valor from mart.rreo_federal
    where (rotulo = 'Padrão' or rotulo is null) and exercicio >= 2015
      and conta_codigo = any(${["DespesasExcetoIntraOrcamentarias", "JurosEEncargosDaDivida", "AmortizacaoDaDivida"]}::text[])
      and coluna = any(${["DESPESAS LIQUIDADAS ATÉ O BIMESTRE (h)", "Até o Bimestre (h)"]}::text[])`) as { ano: number; bim: number; conta: string; valor: number }[];
  const totais = new Map<string, { total: number | null; juros: number | null }>();
  for (const l of linhas) {
    const chave = `${l.ano}|${l.bim}`;
    const t = totais.get(chave) ?? { total: null, juros: null };
    if (l.conta === "DespesasExcetoIntraOrcamentarias") t.total = l.valor;
    else t.juros = (t.juros ?? 0) + l.valor;
    totais.set(chave, t);
  }
  return totais;
}

/** Os encargos por ação, da CGU, com o título do cadastro do SIOP. Sem a tabela, a aba segue sem essa abertura. */
async function lerAcoes(): Promise<Map<number, AcaoDaUniao[]>> {
  let linhas: { ano: number; funcao: string; subfuncao: string; acao: string; nome: string; realizado: number }[];
  try {
    linhas = (await sql`select o.exercicio::int as ano, o.funcao, o.subfuncao, o.acao, coalesce(s.titulo, o.nome) as nome, o.realizado::float8 as realizado
      from mart.orcamento_acao o
      left join (select distinct on (exercicio, acao) exercicio, acao, titulo from mart.siop_acao where funcao = '28' order by exercicio, acao) s
        on s.exercicio = o.exercicio and s.acao = o.acao
      where o.funcao = '28' and o.realizado is not null`) as typeof linhas;
  } catch (e) {
    if ((e as { code?: string })?.code === "42P01") return new Map();
    throw e;
  }
  const porAno = new Map<number, AcaoDaUniao[]>();
  for (const { ano, ...a } of linhas) {
    const lista = porAno.get(ano);
    if (lista) lista.push(a);
    else porAno.set(ano, [a]);
  }
  return porAno;
}

/** O orçamento por função vem do banco; ausência de dados é uma falha, não zero. */
async function lerFuncoesDoBanco(): Promise<{ entes: Record<string, EnteDinheiro>; parcial: { ano: number; bim: number } | null; coletadoEm: string | null; abertura: boolean }> {
  const [linhas, populacao, totaisDaUniao, acoes] = (await Promise.all([
    sql`select uf, exercicio, bimestre, nivel, funcao, conta, valor::float8 as valor,
        to_char(coletado_em, 'YYYY-MM-DD') as coletado_em
      from mart.rreo_funcao
      order by uf, exercicio, bimestre, ordem`,
    lerPopulacao(),
    lerTotaisDaUniao(),
    lerAcoes(),
  ])) as [Record<string, unknown>[], Record<string, Record<string, number>>, Awaited<ReturnType<typeof lerTotaisDaUniao>>, Map<number, AcaoDaUniao[]>];
  if (!linhas.length) throw new Error("Orçamento por função sem dados");

  const periodos = new Map<string, { uf: string; ano: number; bim: number; linhas: LinhaFuncao[] }>();
  let coletadoEm: string | null = null;
  for (const l of linhas) {
    const uf = String(l.uf ?? "BR");
    const ano = Number(l.exercicio);
    const bim = Number(l.bimestre);
    const chave = `${uf}|${ano}|${bim}`;
    let p = periodos.get(chave);
    if (!p) {
      p = { uf, ano, bim, linhas: [] };
      periodos.set(chave, p);
    }
    p.linhas.push({ nivel: l.nivel as LinhaFuncao["nivel"], funcao: l.funcao as string | null, conta: String(l.conta), valor: l.valor as number | null });
    const c = l.coletado_em as string | null;
    if (c && (!coletadoEm || c > coletadoEm)) coletadoEm = c;
  }

  // O ano aberto é o último da União sem sexto bimestre; vale o bimestre mais novo dela.
  const daUniao = [...periodos.values()].filter((p) => p.uf === "BR");
  if (!daUniao.length) throw new Error("Orçamento da União sem dados");
  const ultimoAno = Math.max(...daUniao.map((p) => p.ano));
  const doUltimo = daUniao.filter((p) => p.ano === ultimoAno).map((p) => p.bim);
  const parcial = doUltimo.includes(6) ? null : { ano: ultimoAno, bim: Math.max(...doUltimo) };

  const entes: Record<string, EnteDinheiro> = {};
  for (const p of periodos.values()) {
    const chave = p.bim === 6 ? String(p.ano) : parcial && p.bim === parcial.bim ? (p.ano === parcial.ano ? String(p.ano) : `${p.ano}p`) : null;
    if (!chave) continue;
    const lidos = baldesDoPeriodo(p.linhas);
    if (!lidos) continue;
    const daUniao = totaisDaUniao.get(`${p.ano}|${p.bim}`);
    const b: ReturnType<typeof tirarRepasseDaBase> =
      p.uf === "BR"
        ? abrirComAcoes(descontarRefinanciamentoSemRotulo(lidos, daUniao?.total), { acoes: p.bim === 6 ? acoes.get(p.ano) : undefined, jurosEAmortizacao: daUniao?.juros })
        : tirarRepasseDaBase(lidos);
    const e = (entes[p.uf] ??= { nome: p.uf === "BR" ? "União" : (NOME_UF[p.uf] ?? p.uf), anos: {}, abre: {} });
    e.anos[chave] = { t: b.t, p: populacaoNoAno(populacao[p.uf], p.ano), v: Object.fromEntries(Object.entries(b.v).map(([k, x]) => [k, Math.round(x)])), ...(b.fora ? { fora: b.fora } : {}) };
    // A abertura pesa: a União em todos os anos, os estados só nos dois mais recentes.
    if (!chave.endsWith("p") && (p.uf === "BR" || p.ano >= ultimoAno - 1)) e.abre[chave] = b.abre;
  }

  return { entes, parcial, coletadoEm, abertura: acoes.size > 0 };
}

/** Multiplicadores que levam cada período ao último mês com IPCA. */
async function lerDeflatores(chaves: string[], parcial: { ano: number; bim: number } | null) {
  const linhas = (await sql`select to_char(data, 'YYYY-MM') as mes, valor::float8 as valor
    from observacao where serie_id = 'ipca' and data >= '2015-01-01' order by data`) as { mes: string; valor: number }[];
  let acumulado = 1;
  const indice = new Map<string, number>();
  for (const l of linhas) {
    acumulado *= 1 + l.valor / 100;
    indice.set(l.mes, acumulado);
  }
  const ultimo = linhas.at(-1)?.mes ?? "";
  const nivel = indice.get(ultimo) ?? 1;
  const media = (ano: number, ateMes: number) => {
    const q: number[] = [];
    for (let m = 1; m <= ateMes; m++) {
      const v = indice.get(`${ano}-${String(m).padStart(2, "0")}`);
      if (v) q.push(v);
    }
    return q.length ? q.reduce((s, x) => s + x, 0) / q.length : null;
  };
  const idx: Record<string, number> = {};
  for (const k of chaves) {
    const trecho = k.endsWith("p");
    const ano = Number(k.replace("p", ""));
    const ateMes = (trecho || ano === parcial?.ano) && parcial ? parcial.bim * 2 : 12;
    const m = media(ano, ateMes);
    if (m) idx[k] = nivel / m;
  }
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return { idx, baseReal: `${MESES[Number(ultimo.slice(5, 7)) - 1]}/${ultimo.slice(0, 4)}` };
}

/** "Arrecadado" é só a receita corrente; empréstimo novo é dívida, não arrecadação. */
async function lerReceita(anos: number[], parcial: { ano: number; bim: number } | null) {
  const linhas = (await sql`select exercicio, bimestre, conta_codigo, valor::float8 as valor from mart.rreo_federal
    where (rotulo = 'Padrão' or rotulo is null) and coluna = 'Até o Bimestre (c)' and exercicio >= 2015
      and bimestre = any(${parcial ? [6, parcial.bim] : [6]}::int[])
      and conta_codigo = any(${["ReceitasExcetoIntraOrcamentarias", "ReceitasCorrentes", "ReceitaTributaria", "ReceitaDeContribuicoes", "ReceitasDeOperacoesDeCredito", "ReceitasDeCapital"]}::text[])`) as { exercicio: number; bimestre: number; conta_codigo: string; valor: number }[];
  const receita: Record<string, ReceitaDinheiro> = {};
  for (const ano of anos) {
    const bim = ano === parcial?.ano ? parcial.bim : 6;
    const c = Object.fromEntries(linhas.filter((l) => l.exercicio === ano && l.bimestre === bim).map((l) => [l.conta_codigo, l.valor]));
    const t = c.ReceitasExcetoIntraOrcamentarias;
    if (!t || c.ReceitasCorrentes == null || c.ReceitasDeCapital == null) continue;
    const emp = c.ReceitasDeOperacoesDeCredito ?? 0;
    const imp = c.ReceitaTributaria ?? 0;
    const con = c.ReceitaDeContribuicoes ?? 0;
    receita[ano] = { t, imp, con, out: c.ReceitasCorrentes - imp - con, emp, cap: c.ReceitasDeCapital - emp };
  }
  return receita;
}

async function carregarSemCache(): Promise<PainelDinheiro> {
  const doBanco = await lerFuncoesDoBanco();
  const fonte = doBanco;
  const entes = fonte.entes;
  const uniao = entes.BR;
  if (!uniao || !Object.keys(uniao.anos).length) throw new Error("Orçamento da União sem períodos válidos");
  const anos = Object.keys(uniao.anos).filter((k) => !k.endsWith("p")).map(Number).sort((a, b) => a - b);
  const [{ idx, baseReal }, receita] = await Promise.all([lerDeflatores(Object.keys(uniao.anos), fonte.parcial), lerReceita(anos, fonte.parcial)]);
  return {
    anos,
    parcial: fonte.parcial ? { ...fonte.parcial, mes: MES_DO_BIMESTRE[fonte.parcial.bim] } : null,
    baseReal,
    idx,
    entes,
    receita,
    abertura: fonte.abertura,
    coletadoEm: fonte.coletadoEm,
  };
}

export const carregarDinheiro = unstable_cache(carregarSemCache, ["painel-dinheiro-v7"], { revalidate: 3600, tags: ["painel-economia"] });

/** CNPJ e população dos municípios informados ao Siconfi. */
async function lerEntes(): Promise<[string, string, string, number | null][]> {
  const linhas = (await sql`select cnpj, ente, uf, populacao::float8 as populacao from mart.siconfi_ente where esfera = 'M'`) as { cnpj: string | null; ente: string; uf: string; populacao: number | null }[];
  if (!linhas.length) throw new Error("Cadastro de municípios sem dados");
  return linhas.map((l) => [l.cnpj ?? "", l.ente, l.uf, l.populacao]);
}

async function emendasSemCache(ano: number): Promise<EmendasDoAno> {
  const [beneficiarios, parlamentares, entes] = await Promise.all([
    sql`select cnpj_beneficiario_plano_acao as cnpj, nome_beneficiario_plano_acao as nome, uf_beneficiario_plano_acao as uf,
        sum(coalesce(valor_custeio_plano_acao, 0) + coalesce(valor_investimento_plano_acao, 0))::float8 as v, count(*)::int as q
      from mart.transferegov_plano_acao_especial where ano_plano_acao = ${ano} group by 1, 2, 3`,
    sql`select nome_parlamentar_emenda_plano_acao as nome, uf_beneficiario_plano_acao as uf,
        sum(coalesce(valor_custeio_plano_acao, 0) + coalesce(valor_investimento_plano_acao, 0))::float8 as v, count(*)::int as q
      from mart.transferegov_plano_acao_especial where ano_plano_acao = ${ano} group by 1, 2`,
    lerEntes(),
  ]);
  const porCnpj = new Map(entes.map((e) => [e[0], e]));
  const porNome = new Map(entes.map((e) => [`${normalizarEnte(e[1])}|${e[2]}`, e]));
  const agregados = new Map<string, { n: string; uf: string; v: number; q: number; p: number; c: string }>();
  const porUf: EmendasDoAno["porUf"] = {};
  const total = { v: 0, q: 0 };
  for (const b of beneficiarios as { cnpj: string | null; nome: string | null; uf: string | null; v: number; q: number }[]) {
    total.v += b.v;
    total.q += b.q;
    const uf = b.uf ?? "";
    (porUf[uf] ??= { v: 0, q: 0 }).v += b.v;
    porUf[uf].q += b.q;
    const nome = normalizarEnte(b.nome);
    if (/^(ESTADO D|GOVERNO D|DISTRITO FEDERAL)/.test(nome)) continue;
    const cnpj = (b.cnpj ?? "").replace(/\D/g, "").padStart(14, "0");
    const e = porCnpj.get(cnpj) ?? porNome.get(`${nome}|${uf}`);
    if (!e || !e[3]) continue;
    const a = agregados.get(e[0]) ?? { n: e[1], uf: e[2], v: 0, q: 0, p: e[3], c: cnpj };
    a.v += b.v;
    a.q += b.q;
    agregados.set(e[0], a);
  }
  return {
    ano,
    total,
    porUf,
    municipios: [...agregados.values()].map((a) => [a.n, a.uf, Math.round(a.v), a.q, Math.round(a.p), a.c]),
    parlamentares: (parlamentares as { nome: string | null; uf: string | null; v: number; q: number }[])
      .filter((p) => p.nome)
      .map((p) => [p.nome!, p.uf ?? "", Math.round(p.v), p.q]),
  };
}

export const carregarEmendas = unstable_cache(emendasSemCache, ["emendas-dinheiro-v2"], { revalidate: 3600, tags: ["painel-economia"] });
