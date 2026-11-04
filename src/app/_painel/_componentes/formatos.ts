import { comSinal, mesLegivel, numero, sentido, type Sentido } from "@/lib/formatar";

import type { Veredito } from "@/components/GraficoTempo";
import type { Direcao } from "@/types/dados";

import type { Formato, Leitura, Rampa, SerieEconomia } from "../_dados/tipos";

/**
 * "RESERVA EXTRATIVISTA X" → "Reserva Extrativista X": o catálogo do INPE escreve
 * as UCs em caixa alta, às vezes com o acento em minúscula ("PROTEçãO"), então
 * só nome com letra minúscula sem acento já está escrito direito.
 */
export function titulo(nome: string): string {
  if (/[a-z]/.test(nome)) return nome;
  const pequenas = new Set(["de", "da", "do", "das", "dos", "e"]);
  return nome
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && pequenas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ")
    .replace(/\/(\p{L})/gu, (_, letra: string) => `/${letra.toUpperCase()}`);
}

/** Número de uma leitura do mapa, no formato que ela declara. */
export function formatar(v: number | null | undefined, formato: Formato): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "sem dado";
  switch (formato) {
    case "pct0":
      return `${numero(v, 0)}%`;
    case "pct1":
      return `${numero(v, 1)}%`;
    case "pct2":
      return `${numero(v, 2)}%`;
    case "pctsinal1":
      return `${comSinal(v, 1)}%`;
    case "pp1":
      return `${comSinal(v, 1)} pts`;
    case "reais0":
      return `R$ ${numero(v, 0)}`;
    case "reais2":
      return `R$ ${numero(v, 2)}`;
    case "inteiro":
      return numero(v, 0);
    case "decimal1":
      return numero(v, 1);
    case "km2":
      return `${numero(v, Math.abs(v) < 10 ? 1 : 0)} km²`;
    case "contagem":
      return numero(v, 0);
    case "reaiscurto":
      return reaisCurto(v);
  }
}

/** Volumes (reais, área, contagens) mudam em %; taxas mudam em pontos. */
export const emPercentual = (f: Formato) =>
  f === "reais0" || f === "reais2" || f === "km2" || f === "contagem" || f === "reaiscurto";

/** "R$ 3,1 tri", "R$ 1,2 bi", "R$ 340 mi", "R$ 820 mil". */
export function reaisCurto(v: number): string {
  if (v >= 1e12) return `R$ ${numero(v / 1e12, 1)} tri`;
  if (v >= 1e9) return `R$ ${numero(v / 1e9, v >= 1e11 ? 0 : 1)} bi`;
  return v >= 1e6 ? `R$ ${numero(v / 1e6, 0)} mi` : `R$ ${numero(v / 1e3, 0)} mil`;
}

/** "8,8 mi", "712 mil". */
export function pessoas(v: number | null): string {
  if (v === null) return "—";
  return v >= 1e6 ? `${numero(v / 1e6, 1)} mi` : `${numero(v / 1e3, 0)} mil`;
}

export const CLASSES = 5;

/**
 * Régua de cor de uma leitura: cinco classes de mesmo tamanho entre o menor e
 * o maior valor de TODOS os períodos, não só do período na tela.
 *
 * Com a régua recalculada a cada período, a cor de um estado mudaria ao
 * arrastar o tempo mesmo sem o número mudar, e rever o mandato viraria um
 * pisca-pisca. Fixa no período inteiro, escurecer significa piorar de verdade.
 *
 * Em escala log a régua é log(1 + v), que aceita zero (mês sem foco).
 *
 * `rampa` escolhe os tokens: o azul do site (`--mapa-1…5`) ou o tipo de medida
 * (`--desmate-1…5`, `--fogo-1…5`...), que só existem na aba de meio ambiente. Com `zeroAparte`, zero não entra na rampa
 * e sai em cinza: município sem foco não é "pouco fogo".
 */
export function reguaDeCor(
  valores: (number | null)[],
  escala: Leitura["escala"],
  rampa: Rampa = "mapa",
  zeroAparte = false,
) {
  const presentes = valores.filter(
    (v): v is number => v !== null && Number.isFinite(v) && !(zeroAparte && v === 0),
  );
  const t = (v: number) => (escala === "log" ? Math.log1p(Math.max(0, v)) : v);
  const min = presentes.length ? Math.min(...presentes) : 0;
  const max = presentes.length ? Math.max(...presentes) : 0;
  const a = t(min);
  const b = t(max);

  const classe = (v: number | null): number | null => {
    if (v === null || !Number.isFinite(v) || (zeroAparte && v === 0)) return null;
    if (b === a) return Math.floor(CLASSES / 2);
    return Math.min(CLASSES - 1, Math.max(0, Math.floor(((t(v) - a) / (b - a)) * CLASSES)));
  };
  const cor = (v: number | null) => {
    const c = classe(v);
    return c === null ? "var(--grade)" : `var(--${rampa}-${c + 1})`;
  };
  return { min, max, classe, cor, rampa };
}

export type Regua = ReturnType<typeof reguaDeCor>;

/** Mesma convenção de `anualizado`, para um valor solto. */
export function ritmo(v: number, unidade: string | null): string {
  return unidade === "p.p./ano" ? `${comSinal(v)} pontos por ano` : `${comSinal(v)}% ao ano`;
}

/**
 * O ritmo no mandato contra o ritmo dos 24 meses antes da posse.
 *
 * Regra provisória, a declarar na metodologia antes de publicar: sinais
 * opostos = inverteu; mesmo sinal com ritmo 25% maior ou menor = acelerou ou
 * desacelerou; abaixo de 0,05 por ano conta como parado.
 */
export function tendencia(mandato: number, antes: number): string {
  const PARADO = 0.05;
  const parado = (v: number) => Math.abs(v) < PARADO;
  if (parado(mandato) && parado(antes)) return "segue parado";
  if (parado(antes)) return mandato > 0 ? "estava parado, passou a subir" : "estava parado, passou a cair";
  if (parado(mandato)) return antes > 0 ? "subia, parou" : "caía, parou";
  if (Math.sign(mandato) !== Math.sign(antes)) {
    return antes > 0 ? "subia, passou a cair" : "caía, passou a subir";
  }
  const verbo = mandato > 0 ? "seguiu subindo" : "seguiu caindo";
  const razao = Math.abs(mandato) / Math.abs(antes);
  if (razao > 1.25) return `${verbo}, mais rápido`;
  if (razao < 0.75) return `${verbo}, mais devagar`;
  return `${verbo} no mesmo ritmo`;
}

// ---------------------------------------------------------------------------
// Séries nacionais da economia
// ---------------------------------------------------------------------------

const POSSE = "2023-01";

/**
 * O período de um dado no jeito da pesquisa: "2º tri/2026" para o PIB,
 * "trimestre até ago/2026" para a PNAD mensal, "set/2026" para o resto.
 *
 * Desemprego de 5,3% (trimestre móvel) e desocupação de 5,4% (trimestre
 * fechado, no mapa) são a mesma pesquisa em recortes diferentes; sem o
 * período escrito, o leitor acha que um dos dois está errado.
 */
export function referencia(s: SerieEconomia, data: string): string {
  if (s.frequencia === "trimestral") return `${Math.ceil(Number(data.slice(5, 7)) / 3)}º tri/${data.slice(0, 4)}`;
  // O ano PRODES vai de agosto a julho e leva o ano em que termina.
  if (s.frequencia === "ano-prodes") return `PRODES ${data.slice(0, 4)}${s.preliminares?.includes(data) ? "*" : ""}`;
  if (s.mesesReferencia === 3) return `trimestre até ${mesLegivel(data)}`;
  if (s.mesesReferencia === 12) return `12 meses até ${mesLegivel(data)}`;
  return mesLegivel(data);
}

/** A mesma referência dentro de frase: "em set/2026", "no 2º tri/2026", "nos 12 meses até set/2026". */
export function naReferencia(s: SerieEconomia, data: string): string {
  if (s.frequencia === "ano-prodes") return `no ${referencia(s, data)}`;
  if (s.mesesReferencia === 12) return `nos ${referencia(s, data)}`;
  return `${s.frequencia === "trimestral" || s.mesesReferencia === 3 ? "no" : "em"} ${referencia(s, data)}`;
}

/** A data num eixo ou balão de gráfico: o ano PRODES no lugar do mês de julho. */
export function rotuloDataDaSerie(s: Pick<SerieEconomia, "frequencia">): ((mes: string) => string) | undefined {
  return s.frequencia === "ano-prodes" ? (mes) => `PRODES ${mes.slice(0, 4)}` : undefined;
}

/** O último dado observado. `null` só para série vazia. */
export function ultimoDado(s: SerieEconomia): { data: string; valor: number } | null {
  const i = s.referencia ? s.datas.indexOf(s.referencia) : -1;
  const v = i >= 0 ? s.valores[i] : null;
  return s.referencia && v !== null ? { data: s.referencia, valor: v } : null;
}

/** O último dado antes de `mes`: o que quem tomou posse ali recebeu. */
function antesDe(s: SerieEconomia, mes: string): { data: string; valor: number } | null {
  for (let i = s.datas.length - 1; i >= 0; i--) {
    const v = s.valores[i];
    if (s.datas[i] < mes && v !== null) return { data: s.datas[i], valor: v };
  }
  return null;
}

/** O último dado antes da posse: o que o governo recebeu. */
export const recebido = (s: SerieEconomia) => antesDe(s, s.posse ?? POSSE);

/**
 * O lado bom no protótipo, onde ele difere do banco do site. Dólar caindo é
 * verde: barateia o que vem de fora e alivia a inflação (quem exporta recebe
 * menos reais, e o detalhe diz isso). Selic e juros reais seguem sem lado:
 * quem os decide é o Copom, não a Presidência.
 */
export const LADO_BOM: Record<string, Direcao> = { cambio: "menor_melhor" };

/**
 * Diferença no idioma da medida: pontos para taxas, % para reais. O sentido
 * vai por escrito ("melhor", "pior") ao lado da cor, porque verde e vermelho
 * não se distinguem na forma mais comum de daltonismo.
 *
 * `null` para séries que já são crescimento (renda, PIB): "−7,9 pts (pior)"
 * entre duas taxas de crescimento se lia como "a renda caiu", quando ela só
 * cresceu menos. Ali basta mostrar a taxa de antes.
 */
export function mudanca(s: SerieEconomia, de: number, para: number): { texto: string; sentido: Sentido } | null {
  if (s.formato === "pctsinal1") return null;
  const emPct = emPercentual(s.formato);
  const v = Math.round((emPct ? ((para - de) / de) * 100 : para - de) * 10) / 10;
  if (v === 0) return { texto: "igual", sentido: "neutro" };
  return { texto: emPct ? `${comSinal(v, 1)}%` : `${comSinal(v, 1)} pts`, sentido: sentido(v, s.direcao) };
}

/**
 * O veredito de um mandato numa série, com o arredondamento do placar: o
 * último dado dele contra o que recebeu. Séries que já são variação (PIB,
 * renda) ou saldo (Caged) vão pela média do mandato contra o zero: um mês
 * ruim não pinta de vermelho um mandato que cresceu.
 */
function sentidoNoMandato(
  s: SerieEconomia,
  direcao: Direcao,
  zero: boolean,
  de: number,
  desde: string,
  ate: string | null,
): Sentido {
  const valores = s.datas.flatMap((d, i) => (d >= desde && (!ate || d < ate) && s.valores[i] !== null ? [s.valores[i]!] : []));
  if (!valores.length) return "neutro";
  if (zero) return sentido(Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10, direcao);
  const para = valores[valores.length - 1];
  return sentido(Math.round((emPercentual(s.formato) ? ((para - de) / de) * 100 : para - de) * 10) / 10, direcao);
}

/**
 * O gráfico de uma série com a régua do placar: desde a posse, o mandato
 * numa cor só, verde se está melhor do que recebeu e vermelho se pior. Séries
 * que já são crescimento (PIB, renda) e saldos medem contra o zero. Sem lado
 * bom (Selic, juros reais), `null`. `sentido` força a cor (a do placar).
 */
export function vereditoDaSerie(
  s: SerieEconomia,
  opcoes: { direcao?: Direcao; zero?: boolean; sentido?: Sentido } = {},
): Veredito | null {
  const direcao = opcoes.direcao ?? s.direcao;
  if (direcao === "neutro") return null;
  const zero = Boolean(opcoes.zero) || s.formato === "pctsinal1";
  const r = zero ? { valor: 0 } : recebido(s);
  if (!r) return null;
  return {
    referencia: r.valor,
    direcao,
    desde: s.posse ?? POSSE,
    rotulo: zero ? null : `recebido: ${formatar(r.valor, s.formato)}`,
    sentido: opcoes.sentido ?? sentidoNoMandato(s, direcao, zero, r.valor, s.posse ?? POSSE, null),
  };
}

/**
 * A mesma régua para cada governo do gráfico: cada mandato contra o que ele
 * recebeu, o último dado antes da posse dele. Séries de crescimento medem
 * contra o zero, igual para todos. Mandato sem dado antes da posse fica cinza.
 *
 * `rotular` dá o nome da referência só aos trechos que devem tê-lo ("recebido:",
 * "Lula 2 recebeu"): com nove governos, nove rótulos virariam ruído.
 * `sentidoAtual` é o veredito do placar para o mandato em curso, para o
 * gráfico e o placar nunca discordarem.
 */
export function vereditosPorMandato(
  s: SerieEconomia,
  mandatos: { id: string; inicio: string; emCurso?: boolean }[],
  rotular: (id: string) => string | null,
  sentidoAtual?: Sentido,
): Veredito[] {
  const direcao = s.direcao;
  if (direcao === "neutro") return [];
  const zero = s.formato === "pctsinal1";
  return mandatosNaSerie(s, mandatos).map((t) => {
    const r = zero ? 0 : t.recebeu;
    const nome = zero ? null : rotular(t.id);
    return {
      referencia: r,
      direcao,
      desde: t.desde,
      ate: t.ate,
      rotulo: nome ? `${nome} ${formatar(r, s.formato)}` : null,
      sentido: (t.emCurso && sentidoAtual) || t.sentido,
    };
  });
}

/**
 * Cada mandato numa série, com a régua do gráfico: o que recebeu (o último
 * dado antes da posse), o último dado dele e o veredito. É a conta que pinta
 * o gráfico e a grade "Governo a governo", para os dois nunca discordarem.
 *
 * Sem dado antes da posse o mandato está pela metade na série e fica de fora,
 * também nas de crescimento, que não precisam do recebido.
 */
export function mandatosNaSerie(
  s: SerieEconomia,
  mandatos: { id: string; inicio: string; emCurso?: boolean }[],
): { id: string; emCurso: boolean; desde: string; ate: string | null; recebeu: number; ultimo: number; sentido: Sentido }[] {
  const zero = s.formato === "pctsinal1";
  const ordem = [...mandatos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  return ordem.flatMap((m, k) => {
    const desde = m.inicio.slice(0, 7);
    const ate = ordem[k + 1]?.inicio.slice(0, 7) ?? null;
    const antes = antesDe(s, desde);
    const ultimo = ate ? antesDe(s, ate) : ultimoDado(s);
    if (!antes || !ultimo || ultimo.data < desde) return [];
    return [
      {
        id: m.id,
        emCurso: Boolean(m.emCurso),
        desde,
        ate,
        recebeu: antes.valor,
        ultimo: ultimo.valor,
        sentido: s.direcao === "neutro" ? "neutro" : sentidoNoMandato(s, s.direcao, zero, zero ? 0 : antes.valor, desde, ate),
      },
    ];
  });
}

export const corDoSentido = (s: Sentido) =>
  s === "bom" ? "var(--bom)" : s === "ruim" ? "var(--ruim)" : undefined;
