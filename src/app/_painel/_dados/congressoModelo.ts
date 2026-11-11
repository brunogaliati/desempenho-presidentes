/**
 * Cota parlamentar e crachá: tipos dos arquivos de `scripts/coletar-cota.mjs` e as contas
 * que a aba Congresso faz em cima deles. Sem React e sem alias de import, para rodar nos testes.
 */

export type CasaCongresso = "deputados" | "senadores";

/** `public/painel/congresso/cota-{casa}.json`: o total de cada pessoa em cada ano. */
export type IndiceCota = {
  casa: CasaCongresso;
  coletadoEm: string;
  anos: number[];
  ultimoMes: Record<string, number>;
  fontes: { dados: string; explicacao: string };
  media: Record<string, { pessoas: number; total: number; media: number; mediana: number }>;
  /** Por id, na ordem de `anos`; null = nenhuma nota naquele ano. */
  totais: Record<string, (number | null)[]>;
};

/** t: total · n: notas · m: 12 meses · c: [categoria, valor] · f: [fornecedor, valor, notas]. */
export type GastoNoAno = { t: number; n: number; m: number[]; c: [number, number][]; f: [string, number, number][] };

/** Um ano, ou a legislatura inteira (de fevereiro de 2023 em diante, 48 meses). */
export const LEGISLATURA = "legislatura" as const;
export type PeriodoCota = number | typeof LEGISLATURA;

/** `public/painel/congresso/cota-{casa}-{ano}.json` ou `cota-{casa}-legislatura.json`. */
export type CotaDoAno = {
  casa: CasaCongresso;
  ano: PeriodoCota;
  /** Primeiro mês da legislatura, "2023-02"; os anos começam em janeiro. */
  inicio?: string;
  coletadoEm: string;
  ultimoMes: number;
  categorias: string[];
  /** Média por mês entre quem apresentou nota no período: 12 num ano, 48 na legislatura. */
  mediaMes: number[];
  /** Quem mais recebeu da casa inteira, sem pessoas físicas: [nome, valor, notas, parlamentares]. */
  fornecedores?: [string, number, number, number][];
  pessoas: Record<string, GastoNoAno>;
};

/** Resposta de `/api/painel/congresso`: o que o backend já coletou da pessoa. */
export type PerfilParlamentar = {
  nomeCivil: string | null;
  nascimento: string | null;
  naturalidade: string | null;
  escolaridade: string | null;
  /** Legislaturas na Câmara ou mandatos no Senado. */
  trajetoria: { periodos: number; desde: number | null; ate: number | null } | null;
  /** Emendas Pix desta legislatura, pelo nome parlamentar registrado no Transferegov. */
  emendas: { nome: string; anos: { ano: number; valor: number; planos: number }[] } | null;
};

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_POR_EXTENSO = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** A Câmara avisa que as notas entram com até três meses de atraso. */
export const MESES_DE_ATRASO = 3;

export type Posicao = { posicao: number; de: number };

/** "87º que mais gastou entre 512": quem gastou mais conta, quem empatou não. */
export function posicaoNoAno(indice: IndiceCota, id: number, ano: number): Posicao | null {
  const i = indice.anos.indexOf(ano);
  const meu = i < 0 ? null : indice.totais[id]?.[i] ?? null;
  if (meu === null) return null;
  let acima = 0, de = 0;
  for (const totais of Object.values(indice.totais)) {
    const v = totais[i];
    if (v === null || v === undefined) continue;
    de++;
    if (v > meu) acima++;
  }
  return { posicao: acima + 1, de };
}

export type ResumoRecorte = {
  total: number;
  /** Quem apresentou ao menos uma nota no ano. */
  pessoas: number;
  notas: number;
  media: number;
  meses: number[];
  categorias: { nome: string; valor: number }[];
  maiores: { id: number; valor: number }[];
};

/** Soma o ano de um grupo de parlamentares (estado, partido, busca ou a casa inteira). */
export function resumirRecorte(cota: CotaDoAno, ids: Iterable<number>): ResumoRecorte {
  const meses = Array<number>(cota.mediaMes.length || 12).fill(0);
  const categorias = new Map<number, number>();
  const maiores: { id: number; valor: number }[] = [];
  let total = 0, notas = 0;
  for (const id of ids) {
    const g = cota.pessoas[id];
    if (!g) continue;
    total += g.t;
    notas += g.n;
    g.m.forEach((v, i) => { meses[i] += v; });
    for (const [c, v] of g.c) categorias.set(c, (categorias.get(c) ?? 0) + v);
    maiores.push({ id, valor: g.t });
  }
  maiores.sort((a, b) => b.valor - a.valor || a.id - b.id);
  return {
    total,
    pessoas: maiores.length,
    notas,
    media: maiores.length ? total / maiores.length : 0,
    meses,
    categorias: [...categorias].map(([c, valor]) => ({ nome: cota.categorias[c] ?? "Outras", valor })).filter(c => c.valor > 0).sort((a, b) => b.valor - a.valor),
    maiores,
  };
}

export type Grupo = { chave: string; total: number; media: number; comNotas: number; membros: number };

/**
 * Soma por partido, por estado ou outra chave. `media` divide pelo número de quem
 * apresentou nota no ano; `membros` conta todos do grupo, com nota ou não.
 */
export function agruparPor<P extends { id: number }>(cota: CotaDoAno, pessoas: P[], chave: (p: P) => string): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const p of pessoas) {
    const k = chave(p);
    const g = grupos.get(k) ?? { chave: k, total: 0, media: 0, comNotas: 0, membros: 0 };
    g.membros++;
    const gasto = cota.pessoas[p.id];
    if (gasto) { g.total += gasto.t; g.comNotas++; }
    grupos.set(k, g);
  }
  for (const g of grupos.values()) g.media = g.comNotas ? g.total / g.comNotas : 0;
  return [...grupos.values()].sort((a, b) => b.media - a.media || a.chave.localeCompare(b.chave, "pt-BR"));
}

/** Posição de alguém num grupo (bancada do estado, do partido), do maior gasto para o menor. */
export function posicaoEntre(cota: CotaDoAno, ids: number[], id: number): Posicao | null {
  const meu = cota.pessoas[id]?.t;
  if (meu === undefined) return null;
  let acima = 0, de = 0;
  for (const outro of ids) {
    const v = cota.pessoas[outro]?.t;
    if (v === undefined) continue;
    de++;
    if (v > meu) acima++;
  }
  return { posicao: acima + 1, de };
}

/** "adilson-barroso": sem acento, minúsculo, hífen no lugar do resto. */
export const slugNome = (nome: string) => nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
/** A página de cada parlamentar: o id no fim mantém o endereço se o nome mudar. */
export const caminhoParlamentar = (casa: CasaCongresso, p: { id: number; nome: string }) => `/congresso/${casa}/${slugNome(p.nome)}-${p.id}`;
export function rotaParlamentar(caminho: string): { casa: CasaCongresso; id: number } | null {
  const m = /^\/congresso\/(deputados|senadores)\/(?:[a-z0-9-]*-)?(\d{1,9})\/?$/.exec(caminho);
  return m ? { casa: m[1] as CasaCongresso, id: Number(m[2]) } : null;
}

export const NOME_UF: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

/**
 * Situação de cada mês do ano em relação à coleta: "futuro" ainda não chegou;
 * "parcial" está dentro da janela em que as notas ainda entram.
 */
export type SituacaoMes = "completo" | "parcial" | "futuro";
function situacaoDoMes(ano: number, mes: number, coletadoEm: string): SituacaoMes {
  const coleta = new Date(coletadoEm);
  const distancia = coleta.getUTCFullYear() * 12 + coleta.getUTCMonth() - (ano * 12 + mes);
  return distancia < 0 ? "futuro" : distancia < MESES_DE_ATRASO ? "parcial" : "completo";
}
export function situacaoDosMeses(ano: number, coletadoEm: string): SituacaoMes[] {
  return MESES.map((_, m) => situacaoDoMes(ano, m, coletadoEm));
}

/** Mês do calendário de cada posição de `m` e de `mediaMes` (mes de 0 a 11). */
export type MesDaCota = { ano: number; mes: number };
export function mesesDaCota(cota: Pick<CotaDoAno, "ano" | "inicio" | "mediaMes">): MesDaCota[] {
  const [ano0, mes0] = cota.ano === LEGISLATURA ? (cota.inicio ?? "2023-02").split("-").map(Number) : [cota.ano, 1];
  return cota.mediaMes.map((_, i) => { const k = ano0 * 12 + mes0 - 1 + i; return { ano: Math.floor(k / 12), mes: k % 12 }; });
}
export function situacaoDaCota(cota: Pick<CotaDoAno, "ano" | "inicio" | "mediaMes" | "coletadoEm">): SituacaoMes[] {
  return mesesDaCota(cota).map(m => situacaoDoMes(m.ano, m.mes, cota.coletadoEm));
}

/** "em 2024" ou "na legislatura". */
export const noPeriodo = (p: PeriodoCota) => (p === LEGISLATURA ? "na legislatura" : `em ${p}`);

/** ", de fevereiro de 2023 a novembro de 2026"; num ano em curso, ", de janeiro a novembro"; num ano fechado, nada. */
export function intervaloDaCota(cota: Pick<CotaDoAno, "ano" | "inicio" | "mediaMes" | "coletadoEm">): string {
  const meses = mesesDaCota(cota), situacao = situacaoDaCota(cota);
  const ultimo = situacao.findLastIndex(s => s !== "futuro");
  if (ultimo < 0) return "";
  const [inicio, fim] = [meses[0], meses[ultimo]];
  if (cota.ano === LEGISLATURA) return `, de ${MESES_POR_EXTENSO[inicio.mes]} de ${inicio.ano} a ${MESES_POR_EXTENSO[fim.mes]} de ${fim.ano}`;
  return situacao.includes("parcial") ? `, de janeiro a ${MESES_POR_EXTENSO[fim.mes]}` : "";
}

/** Primeiro mês com nota de alguém: quem assumiu depois do começo do período soma menos meses. */
export function primeiroMesComNota(cota: Pick<CotaDoAno, "ano" | "inicio" | "mediaMes">, gasto: GastoNoAno): MesDaCota | null {
  const i = gasto.m.findIndex(v => v !== 0);
  return i < 0 ? null : mesesDaCota(cota)[i];
}

/** Posição no período inteiro, entre todos com nota. */
export function posicaoNaCota(cota: CotaDoAno, id: number): Posicao | null {
  return posicaoEntre(cota, Object.keys(cota.pessoas).map(Number), id);
}

/** Idade completa na data de referência; null se a data não for válida. */
export function idade(nascimento: string | null, hoje = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(nascimento ?? "");
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anos = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) anos--;
  return anos >= 18 && anos < 120 ? anos : null;
}

const formatadores = new Map<number, Intl.NumberFormat>();
/** Até `casas` decimais, sem zero sobrando: 25 e não 25,0; 1,25 e 144,6. */
function fmt(v: number, casas: number) {
  let f = formatadores.get(casas);
  if (!f) formatadores.set(casas, f = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas }));
  return f.format(v);
}

/** "R$ 338.790". */
export const reaisInteiros = (v: number) => `${v < 0 ? "−" : ""}R$ ${fmt(Math.abs(Math.round(v)), 0)}`;

/** "R$ 950", "R$ 38,7 mil", "R$ 338,8 mil", "R$ 1,25 mi", "R$ 144,6 mi". */
export function reaisCompactos(v: number): string {
  const a = Math.abs(v), sinal = v < 0 ? "−" : "";
  if (a >= 1e9) return `${sinal}R$ ${fmt(a / 1e9, a >= 1e10 ? 1 : 2)} bi`;
  if (a >= 1e6) return `${sinal}R$ ${fmt(a / 1e6, a >= 1e7 ? 1 : 2)} mi`;
  if (a >= 1e3) return `${sinal}R$ ${fmt(a / 1e3, a >= 1e5 ? 0 : 1)} mil`;
  return `${sinal}R$ ${fmt(a, 0)}`;
}

export const inteiro = (v: number) => fmt(Math.round(v), 0);
export const percentual = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
/** "86%", e "<1%" para uma parte pequena que arredondaria para zero. */
export function textoPercentual(parte: number, todo: number): string {
  if (!(todo > 0)) return "—";
  const p = (parte / todo) * 100;
  return p > 0 && p < .5 ? "<1%" : `${Math.round(p)}%`;
}

/** "20% acima da média", "3% abaixo da média", "na média". */
export function comparadoAMedia(valor: number, media: number): { texto: string; diferenca: number } | null {
  if (!(media > 0)) return null;
  const diferenca = Math.round(((valor - media) / media) * 100);
  if (diferenca === 0) return { texto: "na média", diferenca };
  return { texto: `${Math.abs(diferenca)}% ${diferenca > 0 ? "acima" : "abaixo"} da média`, diferenca };
}

/** "1ª", "2º": ordinal curto em português. */
export const ordinal = (n: number, feminino = false) => `${n}${feminino ? "ª" : "º"}`;

/**
 * Por pessoa e período, em `plenario-{casa}.json`: s = [presente, sessões deliberativas] (só Câmara),
 * v = [votou, votações nominais], g = [votou como o governo orientou, votos comparáveis],
 * j = ausências justificadas e n = faltas sem justificativa (só Senado).
 */
export type LinhaPlenario = { s?: [number, number]; v: [number, number]; g: [number, number]; j?: number; n?: number };
export type VotacaoPlenario = {
  id: string; data: string; titulo?: string; ementa?: string; descricao: string;
  aprovada: boolean; sim: number; nao: number; governo: "Sim" | "Não" | null;
};
/** `public/painel/congresso/plenario-{casa}.json`, gravado por `scripts/coletar-plenario.mjs`. */
export type Plenario = {
  casa: CasaCongresso;
  coletadoEm: string;
  anos: number[];
  fontes: { dados: string; explicacao: string };
  /** Por período: quantas sessões e votações houve e a mediana de cada taxa na casa. */
  totais: Record<string, { sessoes?: number; votacoes: number; governo: number; mediana: { s: number | null; v: number | null; g: number | null } }>;
  pessoas: Record<string, Record<string, LinhaPlenario>>;
  /** As últimas votações de mérito, da mais recente para a mais antiga. */
  votacoes: VotacaoPlenario[];
  /** Uma letra por votação, na ordem de `votacoes` (ver `VOTO_POR_LETRA`). */
  votos: Record<string, string>;
};
export const VOTO_POR_LETRA: Record<string, string> = {
  S: "Sim", N: "Não", A: "Abstenção", O: "Obstrução", P: "Presidiu", V: "Votou", J: "Ausência justificada", F: "Faltou", "-": "Não votou", " ": "Fora do cargo",
};
/** Fração de [parte, total]; null sem base. */
export const taxa = ([parte, total]: [number, number]) => (total > 0 ? parte / total : null);
export const porcento = (t: number | null | undefined) => (t === null || t === undefined ? "—" : `${Math.round(t * 100)}%`);
