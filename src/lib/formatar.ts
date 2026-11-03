import type { Direcao, Indicador } from "@/types/dados";

/**
 * Formatação de números em português.
 *
 * Existe porque cada componente da versão anterior formatava à mão, com
 * `toFixed(2)` e ponto decimal — errado para o Brasil, onde o separador é
 * vírgula.
 */

/**
 * Formatadores por número de casas decimais.
 *
 * A versão anterior só tinha dois formatadores fixos (0 e 2 casas) e qualquer
 * outro valor caía silenciosamente em 2 — pedir uma casa devolvia "14,90%" em
 * vez de "14,9%". Um cache por quantidade de casas resolve e evita recriar
 * objetos `Intl` a cada chamada.
 */
const FORMATADORES = new Map<number, Intl.NumberFormat>();

function formatador(casas: number): Intl.NumberFormat {
  let f = FORMATADORES.get(casas);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
    FORMATADORES.set(casas, f);
  }
  return f;
}

const NUM = formatador(2);

/** Sinal explícito. Um "+3,2" comunica direção melhor que "3,2". */
export function comSinal(v: number, casas = 2): string {
  return `${v > 0 ? "+" : ""}${formatador(casas).format(v)}`;
}

export function numero(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return formatador(casas).format(v);
}

export function reais(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `R$ ${NUM.format(v)}`;
}

/**
 * O número comparável entre mandatos, já com unidade.
 *
 * `% a.a.` para séries de nível e índice; `p.p./ano` para séries que já são
 * porcentagem. A distinção importa: desemprego caindo de 12% para 8% caiu 4
 * pontos percentuais, e dizer "caiu 33%" é verdade aritmética e mentira
 * comunicativa.
 */
export function anualizado(ind: Indicador): string {
  if (ind.variacaoAnualizada === null) return "—";
  const v = comSinal(ind.variacaoAnualizada);
  // "ao ano" em vez de "a.a." por dois motivos. É mais legível para quem não
  // lê relatório de banco, e, sobretudo, "a.a." termina em ponto: qualquer
  // frase que continuasse depois virava "+8,89% a.a.. É o ritmo...". O bug
  // apareceu duas vezes antes de eu tratar a causa em vez do sintoma.
  return ind.unidadeAnualizada === "p.p./ano"
    ? `${v} pontos por ano`
    : `${v}% ao ano`;
}

/** Valor bruto de nível, com o símbolo da série (R$, %, índice). */
export function nivel(
  v: number | null | undefined,
  unidade: string,
  simbolo?: string,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (simbolo === "R$") return reais(v);
  if (unidade.includes("%")) return `${NUM.format(v)}%`;
  return NUM.format(v);
}

/**
 * Se o movimento foi na direção boa, ruim, ou se não dá para dizer.
 *
 * `neutro` não é indecisão: dólar alto é bom para quem exporta e ruim para
 * quem viaja, e afirmar uma direção seria opinião disfarçada de dado.
 */
export type Sentido = "bom" | "ruim" | "neutro";

export function sentido(valor: number | null, direcao: Direcao): Sentido {
  if (valor === null || direcao === "neutro" || valor === 0) return "neutro";
  const subiu = valor > 0;
  if (direcao === "maior_melhor") return subiu ? "bom" : "ruim";
  return subiu ? "ruim" : "bom";
}

/** Cor territorial da mudança, com a mesma precisão exibida pelas setas. */
export function corDaMudanca(valor: number | null, direcao: Direcao): string {
  if (valor === null || !Number.isFinite(valor)) return "var(--grade)";
  const s = sentido(Math.round(valor * 10) / 10, direcao);
  return s === "bom" ? "var(--mapa-melhor)" : s === "ruim" ? "var(--mapa-pior)" : "var(--mapa-estavel)";
}

/** `AAAA-MM` → "jul/1994". Entrada é sempre string, nunca Date. */
export function mesLegivel(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const idx = Number(m) - 1;
  return `${nomes[idx] ?? m}/${ano}`;
}

/** "2023-01-01" → "2023". */
export function ano(data: string | null): string {
  return data ? data.slice(0, 4) : "—";
}

/** `AAAA-MM` → "setembro de 2020", para uso dentro de frases. */
export function mesPorExtenso(mes: string): string {
  const [a, m] = mes.split("-");
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[Number(m) - 1] ?? m} de ${a}`;
}

/**
 * Rótulo curto de mandato: "Lula 1", "Lula 2", "Temer".
 *
 * O número só aparece para quem teve mais de um mandato — numerar "Temer 1"
 * sugeriria um segundo que não existe, e mostrar "FHC" ao lado de "FHC 2"
 * fazia o primeiro mandato parecer o presidente inteiro.
 */
export function rotuloMandato(
  presidentes: { nomeCurto: string }[],
  p: { nomeCurto: string; mandato: number },
): string {
  const varios = presidentes.filter((x) => x.nomeCurto === p.nomeCurto).length > 1;
  return varios ? `${p.nomeCurto} ${p.mandato}` : p.nomeCurto;
}
