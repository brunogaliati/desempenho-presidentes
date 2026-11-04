import type { Governos, Periodo, TrechoGoverno, TrechoPresidente } from "../_dados/tipos";
import logos from "../_dados/logos-partidos.json";
import { TERMO_2015 } from "../_dados/mandatoRecorte";

/**
 * Quem governava quando: o mapa pergunta por um período (trimestre, mês, ano)
 * e a resposta vem de trechos em `[inicio, fim)`.
 *
 * Um período vira o dia do meio dele. Troca de governador no meio de um
 * trimestre fica com quem estava no cargo nesse dia; o detalhe do dia está na
 * ficha do estado.
 */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function diaDoPeriodo(p: Periodo | undefined, hoje: string): string {
  const c = p?.codigo ?? "";
  if (/^\d{6}$/.test(c)) return `${c.slice(0, 4)}-${String(Number(c.slice(4)) * 3 - 1).padStart(2, "0")}-15`;
  if (/^\d{4}-\d{2}$/.test(c)) return `${c}-15`;
  if (/^\d{4}$/.test(c)) return `${c}-07-01`;
  return hoje;
}

/** O primeiro dia de um período: o começo de um mandato cai nele. */
export function inicioDoPeriodo(p: Periodo | undefined, hoje: string): string {
  const c = p?.codigo ?? "";
  if (/^\d{6}$/.test(c)) return `${c.slice(0, 4)}-${String(Number(c.slice(4)) * 3 - 2).padStart(2, "0")}-01`;
  if (/^\d{4}-\d{2}$/.test(c)) return `${c}-01`;
  if (/^\d{4}$/.test(c)) return `${c}-01-01`;
  return hoje;
}

const contem = (t: { inicio: string; fim: string | null }, dia: string) => t.inicio <= dia && (t.fim === null || dia < t.fim);

/** Um mandato de governador: os quatro anos, e quem passou pelo cargo neles. */
export interface TermoGoverno {
  /** O mesmo id do recorte da tela (ver `mandatoRecorte.ts`). */
  id: string;
  ano: number;
  inicio: string;
  fim: string;
  nomes: string[];
  trechos: TrechoGoverno[];
}

/**
 * Os mandatos de governador de uma UF, do mais antigo ao atual. Desde 1995 eles
 * começam com os do presidente; a exceção é 2015, em que Dilma não terminou.
 */
export function termosDoGoverno(g: Governos, uf: string, mandatos: { id: string; inicio: string }[]): TermoGoverno[] {
  return Array.from({ length: 8 }, (_, i) => 1995 + i * 4).flatMap((ano) => {
    const inicio = `${ano}-01-01`;
    const fim = `${ano + 4}-01-01`;
    const trechos = (g.ufs[uf] ?? []).filter((t) => t.inicio < fim && (t.fim === null || t.fim > inicio));
    const id = ano === 2015 ? TERMO_2015 : mandatos.find((m) => m.inicio.startsWith(String(ano)))?.id;
    if (!id || !trechos.length) return [];
    return [{ id, ano, inicio, fim, trechos, nomes: [...new Set(trechos.map((t) => t.nome))] }];
  });
}

export function governoEm(g: Governos, uf: string, dia: string): TrechoGoverno | null {
  return g.ufs[uf]?.find((t) => contem(t, dia)) ?? null;
}

export function presidenteEm(g: Governos, dia: string): TrechoPresidente | null {
  return g.presidentes.find((t) => contem(t, dia)) ?? null;
}

/** Chave para agrupar e destacar: a sigla, "SEM" ou "ND" (não confirmado). */
export const chavePartido = (sigla: string | null) => sigla ?? "ND";

/** A sigla da época escolhe a marca; a família de cor não define a logo. */
export function logoDoPartido(sigla: string | null): string | null {
  return sigla === null ? null : (logos as Record<string, string>)[sigla] ?? null;
}

/** A família de cor junta os nomes de um partido ao longo do tempo (PMDB e MDB). */
export function familiaDe(g: Governos, sigla: string | null): string {
  if (sigla === null) return "nd";
  if (sigla === "SEM") return "sem";
  return g.partidos[sigla]?.familia ?? "nd";
}

export const corDoPartido = (g: Governos, sigla: string | null) => `var(--partido-${familiaDe(g, sigla)})`;

/** O texto dentro da etiqueta do partido: branco ou escuro, o que contrastar mais. */
export const tintaDoPartido = (g: Governos, sigla: string | null) => `var(--partido-${familiaDe(g, sigla)}-texto)`;

/** Sem filiação e não confirmado não têm cor de partido: a etiqueta fica vazada. */
export const semCorDePartido = (sigla: string | null) => sigla === null || sigla === "SEM";

export function rotuloPartido(g: Governos, sigla: string | null, curto = false): string {
  if (sigla === null) return curto ? "a confirmar" : "partido não confirmado";
  if (sigla === "SEM") return curto ? "s/ partido" : "sem partido";
  const p = g.partidos[sigla];
  return p ? (curto ? p.curta : p.rotulo) : sigla;
}

export function nomePartido(g: Governos, sigla: string | null): string {
  if (sigla === null || sigla === "SEM") return rotuloPartido(g, sigla);
  return g.partidos[sigla]?.nome ?? sigla;
}

/** "jan/2023"; com `aproximado` a data só tem o mês, que é o que se mostra. */
export function mesAno(dia: string): string {
  return `${MESES[Number(dia.slice(5, 7)) - 1]}/${dia.slice(0, 4)}`;
}

export function comoEntrou(t: TrechoGoverno): string {
  switch (t.como) {
    case "eleito":
      return t.eleicao ? `eleito em ${t.eleicao}` : "eleito";
    case "reeleito":
      return t.eleicao ? `reeleito em ${t.eleicao}` : "reeleito";
    case "vice_assumiu":
      return "vice que assumiu";
    case "interino":
      return "interino";
    default:
      return t.nota && /retorno|volta/i.test(t.nota) ? "volta ao cargo" : "outra forma de posse";
  }
}

/**
 * O partido que governou a UF a maior parte do intervalo `[de, ate)`, para
 * atribuir a um partido o que mudou nesse tempo. `trocas` descreve a
 * sequência quando houve mais de um ("PSDB até mar/2025, depois PSD"), seja
 * troca de governador ou de filiação.
 */
export function partidoNoIntervalo(
  g: Governos,
  uf: string,
  de: string,
  ate: string,
): { partido: string | null; trocas: string | null } {
  if (ate <= de) return { partido: governoEm(g, uf, ate)?.partido ?? null, trocas: null };
  const dias = new Map<string, { partido: string | null; dias: number }>();
  const sequencia: { partido: string | null; inicio: string }[] = [];
  for (const t of g.ufs[uf] ?? []) {
    const a = t.inicio > de ? t.inicio : de;
    const b = t.fim === null || t.fim > ate ? ate : t.fim;
    if (b <= a) continue;
    const k = chavePartido(t.partido);
    const n = (Date.parse(b) - Date.parse(a)) / 864e5;
    dias.set(k, { partido: t.partido, dias: (dias.get(k)?.dias ?? 0) + n });
    if (sequencia.at(-1)?.partido !== t.partido) sequencia.push({ partido: t.partido, inicio: a });
  }
  const maior = [...dias.values()].sort((x, y) => y.dias - x.dias)[0];
  if (!maior) return { partido: null, trocas: null };
  const trocas =
    sequencia.length > 1
      ? sequencia
          .map((s, i) =>
            i + 1 < sequencia.length
              ? `${rotuloPartido(g, s.partido)} até ${mesAno(sequencia[i + 1].inicio)}`
              : `depois ${rotuloPartido(g, s.partido)}`,
          )
          .join(", ")
      : null;
  return { partido: maior.partido, trocas };
}

/** Desde quando a pessoa está no cargo sem interrupção, juntando trocas de partido e reeleições. */
export function inicioNoCargo(g: Governos, uf: string, t: TrechoGoverno): string {
  const lista = g.ufs[uf] ?? [];
  let i = lista.indexOf(t);
  while (i > 0 && lista[i - 1].nome === t.nome && lista[i - 1].fim === lista[i].inicio) i--;
  return lista[i]?.inicio ?? t.inicio;
}
