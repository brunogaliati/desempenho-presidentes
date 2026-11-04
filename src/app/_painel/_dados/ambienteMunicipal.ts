/**
 * O meio ambiente por município, no formato que o mapa da sala desenha.
 *
 * Só funções puras e `import type`, para os testes rodarem com `node --test`.
 * Vai numa rota à parte (`/api/painel/ambiente/municipios`), carregada
 * quando a aba abre, junto com os contornos dos 5.570 municípios: não pesa a
 * página das outras abas.
 *
 * Regras:
 * - Desmatamento: a área mapeada pelo PRODES em cada ano PRODES, somando os
 *   biomas que tocam o município. O ano só vale se todos esses biomas já
 *   publicaram; publicado e sem incremento mapeado no município, zero. Quem
 *   nunca aparece no PRODES conta pelo bioma predominante do IBGE.
 * - Alertas (DETER), autos e embargos (Ibama): dois números, os 12 meses de
 *   2022 (o recebido) e os 12 meses até o último mês inteiro. Município fora
 *   do DETER fica sem alerta (`null`), não com zero.
 * - Focos: o arquivo anual do satélite de referência; sem foco é zero.
 * - Área queimada: a classe de cicatriz do DETER, que só existe na Amazônia. Quem
 *   é da Amazônia e não tem registro teve zero; fora dela, sem medida.
 */

export interface LinhaDesmatamentoMunicipio {
  municipio: string;
  bioma: string;
  ano: number;
  area: number;
  preliminar: boolean;
}

export interface Janela12 {
  municipio: string;
  /** `null` quando a fonte ainda não cobria a janela. */
  recebido: number | null;
  atual: number;
}

export interface LinhaIbamaMunicipio {
  municipio: string;
  autosRecebido: number;
  autosAtual: number;
  floraRecebido: number;
  floraAtual: number;
  multasRecebido: number;
  multasAtual: number;
  embargosRecebido: number;
  embargosAtual: number;
}

/** Um município no mapa. Campos ausentes são falta de dado, nunca zero. */
export interface Municipal {
  /** Bioma predominante (IBGE). */
  b: string | null;
  /** Desmatamento por ano PRODES, alinhado a `anos`, em km². */
  d?: (number | null)[];
  /** Alertas DETER de desmatamento em 12 meses: [recebido, último], km². */
  a?: [number | null, number];
  /** Cicatriz de queimada do DETER em 12 meses: [recebido, último], km². */
  q?: [number | null, number];
  /** Focos por ano, alinhado a `focosAnos`. */
  f?: number[];
  /** Autos do Ibama não cancelados em 12 meses: [recebido, último, flora recebido, flora último]. */
  i?: [number, number, number, number];
  /** Valor das multas em 12 meses, em reais: [recebido, último]. */
  v?: [number, number];
  /** Embargos do Ibama em 12 meses: [recebido, último]. */
  e?: [number, number];
}

export interface MunicipiosAmbiente {
  anos: number[];
  preliminar: number | null;
  /** Último ano em que os seis biomas publicaram: o padrão do mapa. */
  anoCompleto: number | null;
  /** Os meses que fecham as janelas de 12 meses: o último antes da posse e o último do mandato. */
  janela: { recebido: string; atual: string | null };
  /** O ano que o governo recebeu, a base das colunas por ano. */
  anoRecebido: number;
  focosAnos: number[];
  m: Record<string, Municipal>;
  coletas: Record<string, string | null>;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function montarMunicipios(e: {
  codigos: string[];
  biomas: Record<string, string>;
  desmatamento: LinhaDesmatamentoMunicipio[];
  /** Anos anuais publicados por bioma (de `desmatamento_bioma_uf`). */
  publicados: Record<string, number[]>;
  alertas: Janela12[] | null;
  queimadas?: Janela12[] | null;
  ibama: LinhaIbamaMunicipio[] | null;
  focos: { anos: number[]; municipioAnual: Record<string, number[]> } | null;
  janelaAtual: string | null;
  /** O último mês antes da posse e o ano que ele fecha; por padrão, o mandato atual. */
  janelaRecebido?: string;
  anoRecebido?: number;
  coletas: Record<string, string | null>;
  desde?: number;
}): MunicipiosAmbiente {
  const desde = e.desde ?? 2017;
  const linhas = e.desmatamento.filter((r) => r.ano >= desde);
  const anoMax = linhas.reduce((m, r) => Math.max(m, r.ano), desde);
  const anos = linhas.length ? Array.from({ length: anoMax - desde + 1 }, (_, i) => desde + i) : [];
  const publicado = (b: string, ano: number) => e.publicados[b]?.includes(ano) ?? false;
  const completos = anos.filter((ano) => Object.keys(e.publicados).length > 0 && Object.keys(e.publicados).every((b) => publicado(b, ano)));

  // Biomas que tocam cada município e a área por (município, ano).
  const toca = new Map<string, Set<string>>();
  const area = new Map<string, number>();
  for (const r of linhas) {
    (toca.get(r.municipio) ?? toca.set(r.municipio, new Set()).get(r.municipio)!).add(r.bioma);
    const k = `${r.municipio}|${r.ano}`;
    area.set(k, (area.get(k) ?? 0) + r.area);
  }
  const preliminar = linhas.find((r) => r.preliminar)?.ano ?? null;

  const alertas = new Map((e.alertas ?? []).map((x) => [x.municipio, x]));
  const queimadas = new Map((e.queimadas ?? []).map((x) => [x.municipio, x]));
  const ibama = new Map((e.ibama ?? []).map((x) => [x.municipio, x]));
  const m: Record<string, Municipal> = {};
  for (const codigo of e.codigos) {
    const b = e.biomas[codigo] ?? null;
    const seus = toca.get(codigo) ?? (b ? new Set([b]) : new Set<string>());
    const x: Municipal = { b };
    if (seus.size) {
      x.d = anos.map((ano) => ([...seus].every((s) => publicado(s, ano)) ? r2(area.get(`${codigo}|${ano}`) ?? 0) : null));
    }
    const a = alertas.get(codigo);
    if (a) x.a = [a.recebido === null ? null : r2(a.recebido), r2(a.atual)];
    const q = queimadas.get(codigo);
    if (q) x.q = [q.recebido === null ? null : r2(q.recebido), r2(q.atual)];
    else if (e.queimadas && b === "amazonia") x.q = [0, 0];
    if (e.focos) x.f = e.focos.municipioAnual[codigo] ?? e.focos.anos.map(() => 0);
    const i = ibama.get(codigo);
    // Município sem nenhum auto ou embargo no arquivo do Ibama teve zero: é contagem.
    if (e.ibama) {
      x.i = i ? [i.autosRecebido, i.autosAtual, i.floraRecebido, i.floraAtual] : [0, 0, 0, 0];
      x.v = i ? [Math.round(i.multasRecebido), Math.round(i.multasAtual)] : [0, 0];
      x.e = i ? [i.embargosRecebido, i.embargosAtual] : [0, 0];
    }
    m[codigo] = x;
  }
  return {
    anos,
    preliminar,
    anoCompleto: completos.at(-1) ?? null,
    janela: { recebido: e.janelaRecebido ?? "2022-12", atual: e.janelaAtual },
    anoRecebido: e.anoRecebido ?? 2022,
    focosAnos: e.focos?.anos ?? [],
    m,
    coletas: e.coletas,
  };
}

/**
 * A variação contra 2022 em texto curto. Sobre base pequena o percentual estoura
 * a pílula e não diz nada ("+48.485%"): de mil por cento para cima, vira "×486".
 */
export function textoVariacao(agora: number, recebido: number): string {
  const p = Math.round(((agora - recebido) / recebido) * 100);
  if (p === 0) return "igual";
  if (p >= 1000) return `×${Math.round(agora / recebido)}`;
  return `${p > 0 ? "+" : ""}${String(p).replace("-", "-")}%`;
}

/** A janela de 12 meses que termina em `fim` (AAAA-MM): o primeiro e o último dia. */
export function janela12(fim: string): { de: string; ate: string } {
  const n = Number(fim.slice(0, 4)) * 12 + Number(fim.slice(5, 7)) - 1 - 11;
  return { de: `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-01`, ate: `${fim}-01` };
}

// ---------------------------------------------------------------------------
// As lentes: o que cada forma de ver pinta no mapa
// ---------------------------------------------------------------------------

export type Lente = "desmatamento" | "alertas" | "fogo" | "queimada" | "ti" | "uc" | "fiscalizacao" | "multas" | "embargos";
export type ModoMapa = "area" | "total" | "posse";

/**
 * Faixas fixas, medidas em 02/11/2026 sobre os municípios com dado: cada lente
 * guarda as duas classes mais escuras para perto de 10% dos municípios. Com a
 * régua automática, um único município enorme apagava o país inteiro.
 */
export const CORTES: Record<Lente, Record<"area" | "total", number[]>> = {
  desmatamento: { area: [0.5, 2, 5, 10], total: [1, 5, 20, 60] },
  alertas: { area: [0.5, 2, 5, 10], total: [1, 5, 20, 60] },
  fogo: { area: [10, 25, 50, 100], total: [10, 50, 200, 1000] },
  fiscalizacao: { area: [2, 5, 15, 50], total: [2, 5, 15, 50] },
  queimada: { area: [0.2, 1, 3, 10], total: [2, 10, 30, 100] },
  // Em R$ milhões: por 1.000 km², ou no total do município.
  multas: { area: [0.1, 0.5, 2, 10], total: [0.1, 0.5, 2, 10] },
  embargos: { area: [1, 3, 10, 30], total: [2, 5, 15, 50] },
  // Cada área pinta pelo que se desmatou nela: sem "por área", a régua é uma só.
  ti: { area: [0.1, 0.5, 2, 10], total: [0.1, 0.5, 2, 10] },
  uc: { area: [0.1, 0.5, 2, 10], total: [0.1, 0.5, 2, 10] },
};

/** Uma cor por tipo de medida, no mapa, nas listas e no placar. */
export const RAMPA_DA_LENTE: Record<Lente, "desmate" | "alerta" | "fogo" | "fiscal" | "protegidas"> = {
  desmatamento: "desmate",
  alertas: "alerta",
  fogo: "fogo",
  queimada: "fogo",
  ti: "protegidas",
  uc: "protegidas",
  fiscalizacao: "fiscal",
  multas: "fiscal",
  embargos: "fiscal",
};

/** Abaixo disto nos dois períodos, a diferença é ruído e o município não leva veredito. */
export const PISO_POSSE: Record<Lente, number> = { desmatamento: 1, alertas: 1, fogo: 10, queimada: 1, ti: 0.5, uc: 0.5, fiscalizacao: 0, multas: 0, embargos: 0 };
/** Poucos focos num município pequeno dão densidade alta sem haver incêndio relevante. */
const PISO_FOCOS_POR_AREA = 3;

/** Os dois números de um município numa lente: o do período e o de 2022. `null` é fora da cobertura. */
export function numerosDaLente(
  x: Municipal | undefined,
  lente: Lente,
  d: Pick<MunicipiosAmbiente, "anos" | "focosAnos"> & { anoRecebido?: number },
  ano: number | null,
): { agora: number | null; recebido: number | null } {
  if (!x) return { agora: null, recebido: null };
  const anoRecebido = d.anoRecebido ?? 2022;
  if (lente === "desmatamento") {
    const i = ano === null ? -1 : d.anos.indexOf(ano);
    const r = d.anos.indexOf(anoRecebido);
    return { agora: i < 0 ? null : (x.d?.[i] ?? null), recebido: r < 0 ? null : (x.d?.[r] ?? null) };
  }
  if (lente === "fogo") {
    const i = ano === null ? -1 : d.focosAnos.indexOf(ano);
    const r = d.focosAnos.indexOf(anoRecebido);
    return { agora: i < 0 ? null : (x.f?.[i] ?? null), recebido: r < 0 ? null : (x.f?.[r] ?? null) };
  }
  if (lente === "alertas") return { agora: x.a?.[1] ?? null, recebido: x.a?.[0] ?? null };
  if (lente === "queimada") return { agora: x.q?.[1] ?? null, recebido: x.q?.[0] ?? null };
  if (lente === "multas") return { agora: x.v?.[1] ?? null, recebido: x.v?.[0] ?? null };
  if (lente === "embargos") return { agora: x.e?.[1] ?? null, recebido: x.e?.[0] ?? null };
  return { agora: x.i?.[1] ?? null, recebido: x.i?.[0] ?? null };
}

/** 1 a 5, a classe da rampa de um valor nas faixas da lente. */
export const classeNasFaixas = (v: number, cortes: number[]) => cortes.filter((c) => v >= c).length + 1;

/**
 * A cor de um território numa lente:
 * - sem cobertura: o papel, para "não medido" não parecer "zero";
 * - zero: a grade;
 * - "por área" e "total": a rampa da lente;
 * - "desde a posse": melhorou ou piorou contra 2022, a língua do placar. Quem
 *   ficou abaixo do piso nos dois períodos sai estável: 0,1 km² virar 0,2 não é
 *   "dobrou".
 */
export function corDaLente(
  agora: number | null,
  recebido: number | null,
  lente: Lente,
  modo: ModoMapa,
  areaKm2: number,
): string {
  if (agora === null) return "var(--atlas-papel)";
  if (modo === "posse") {
    if (recebido === null) return "var(--atlas-papel)";
    if (Math.max(agora, recebido) < PISO_POSSE[lente] || agora === recebido) return "var(--mapa-estavel)";
    return agora < recebido ? "var(--mapa-melhor)" : "var(--mapa-pior)";
  }
  const rampa = RAMPA_DA_LENTE[lente];
  // Terra Indígena sem desmatamento é resultado e tem de aparecer: não some na grade.
  if (agora === 0) return rampa === "protegidas" ? "var(--protegidas-0)" : "var(--grade)";
  // As multas vêm em reais e as faixas estão em milhões.
  const valor = lente === "multas" ? agora / 1e6 : agora;
  if (modo === "area") {
    if (lente === "fogo" && agora < PISO_FOCOS_POR_AREA) return `var(--${rampa}-1)`;
    const v = areaKm2 > 0 ? (valor / areaKm2) * 1000 : 0;
    return `var(--${rampa}-${classeNasFaixas(v, CORTES[lente].area)})`;
  }
  return `var(--${rampa}-${classeNasFaixas(valor, CORTES[lente].total)})`;
}

/**
 * O cartão do "Brasil agora" a que uma série pertence. As do painel "Por bioma" são
 * pedaços das nacionais, com outro id: é isto que diz que falam da mesma coisa. A
 * Amazônia do bioma aponta para a taxa da Amazônia Legal, que é outra conta sobre o
 * mesmo desmatamento.
 */
export function cartaoDaSerie(id: string): string {
  const desmatamento = id.match(/^prodes_bioma_(.+)$/)?.[1];
  if (desmatamento) return desmatamento === "amazonia" ? "prodes_amazonia" : desmatamento === "cerrado" ? "prodes_cerrado" : "prodes_outros";
  if (id.startsWith("focos_bioma_")) return "focos_12m";
  if (id === "autos_bioma") return "autos_12m";
  if (id === "multas_bioma") return "multas_12m";
  if (id === "embargos_bioma") return "embargos_12m";
  return id;
}

/** Soma os municípios que passam num filtro. `null` se nenhum deles tem a medida: isso é falta de dado, não zero. */
function somar(d: MunicipiosAmbiente, entra: (codigo: string, x: Municipal) => boolean, campo: (x: Municipal) => readonly [number | null, number] | undefined) {
  let recebido: number | null = 0;
  let agora = 0;
  let viu = false;
  for (const [codigo, x] of Object.entries(d.m)) {
    if (!entra(codigo, x)) continue;
    const v = campo(x);
    if (!v) continue;
    // Um município sem o dado da posse deixa a soma sem base: não vale comparar com zero.
    recebido = recebido === null || v[0] === null ? null : recebido + v[0];
    agora += v[1];
    viu = true;
  }
  return viu ? { recebido, agora } : null;
}

/** Soma uma lente sobre os municípios de um bioma: a fiscalização não tem série por bioma. */
export const somaNoBioma = (d: MunicipiosAmbiente, bioma: string, campo: (x: Municipal) => readonly [number | null, number] | undefined) =>
  somar(d, (_, x) => x.b === bioma, campo);

/** O mesmo num estado: os dois primeiros dígitos do código do município são os da UF. */
export const somaNaUf = (d: MunicipiosAmbiente, codigoUf: string, campo: (x: Municipal) => readonly [number | null, number] | undefined) =>
  somar(d, (codigo) => codigo.startsWith(codigoUf), campo);

// ---------------------------------------------------------------------------
// As áreas protegidas no mapa
// ---------------------------------------------------------------------------

export interface LinhaAreaProtegida {
  recorte: string;
  bioma: string;
  nome: string;
  ano: number;
  area: number;
}

export interface ValoresDasAreas {
  /** Os anos que cada bioma publicou: num ano não publicado a área fica sem medida, não com zero. */
  publicados: Record<string, number[]>;
  /** Só os anos com desmatamento mapeado, em km². */
  areas: Record<string, Record<string, number>>;
}

/**
 * O nome casa o contorno com o número, e cada fonte escreve de um jeito ("MARíTIMA",
 * "MARÍTIMA"). O catálogo repete nomes num bioma, e os pedaços viram uma área só.
 */
export function chaveDaArea(recorte: string, bioma: string, nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return `${recorte}|${bioma}|${limpo}`;
}

export function montarAreas(linhas: LinhaAreaProtegida[], publicados: Record<string, number[]>): ValoresDasAreas {
  const areas: ValoresDasAreas["areas"] = {};
  for (const r of linhas) {
    const seu = (areas[chaveDaArea(r.recorte, r.bioma, r.nome)] ??= {});
    seu[r.ano] = r2((seu[r.ano] ?? 0) + r.area);
  }
  return { publicados, areas };
}

/** O ano e o que o governo recebeu numa área: sem registro num ano publicado é zero; ano não publicado é sem medida. */
export function numerosDaArea(v: ValoresDasAreas, chave: string, bioma: string, ano: number | null, anoRecebido = 2022): { agora: number | null; recebido: number | null } {
  const publicados = v.publicados[bioma] ?? [];
  const seu = v.areas[chave];
  return {
    agora: ano !== null && publicados.includes(ano) ? (seu?.[ano] ?? 0) : null,
    recebido: publicados.includes(anoRecebido) ? (seu?.[anoRecebido] ?? 0) : null,
  };
}
