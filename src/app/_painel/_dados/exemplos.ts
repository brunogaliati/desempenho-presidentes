import type { ItemFeed } from "./tipos";

/**
 * Números ILUSTRATIVOS, para a tela poder ser discutida antes de as fontes
 * estarem carregadas.
 *
 * Nada aqui é dado. Votações, emendas e decisões ainda não existem no Neon. A
 * tela marca com selo tudo o que sai deste arquivo: em semana de eleição, um
 * "a bancada do Pará votou 71% com o governo" sem marca circularia como fato.
 *
 * Os valores são determinísticos (derivados do código), para a tela não mudar
 * a cada render e as conversas sobre ela poderem citar o mesmo número. Os
 * identificadores de lei e projeto usam zeros de propósito.
 */

/** Número entre 0 e 1, estável para o mesmo texto e o mesmo sal. */
export function semente(texto: string, sal: number): number {
  let h = sal;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h / 9973;
}

export const SEMESTRES = ["2023-1", "2023-2", "2024-1", "2024-2", "2025-1", "2025-2", "2026-1", "2026-2"];
export const ANOS_EMENDAS = [2023, 2024, 2025, 2026];

/** % de votos da bancada alinhados à orientação do governo, por semestre. */
export function alinhamentoExemplo(sigla: string): number[] {
  const base = 44 + semente(sigla, 7) * 34;
  return SEMESTRES.map((_, i) =>
    Math.round(Math.min(92, Math.max(30, base + (semente(sigla, 20 + i) - 0.5) * 14))),
  );
}

/**
 * Emendas pagas por habitante, acumuladas desde 2023, em R$.
 *
 * Proporcional ao número de parlamentares e inverso à população, que é a forma
 * do dado real: toda bancada tem no mínimo 8 deputados e 3 senadores, então
 * estado pouco populoso recebe mais por habitante. A escala é inventada.
 */
export function emendasAcumuladasExemplo(
  sigla: string,
  parlamentares: number,
  populacao: number,
): number[] {
  let acumulado = 0;
  return ANOS_EMENDAS.map((_, i) => {
    const noAno = 22_000_000 * parlamentares * (0.7 + semente(sigla, 40 + i) * 0.6);
    // 2026 parcial: ano eleitoral, pagamentos concentrados no 1º semestre.
    acumulado += i === 3 ? noAno * 0.7 : noAno;
    return Math.round(acumulado / populacao);
  });
}

/** Emendas por habitante num município, acumuladas até o ano `i`. Ilustrativo. */
export function emendasMunicipioExemplo(codigo: string, populacao: number | null, i: number) {
  if (!populacao) return null;
  // Município pequeno recebe mais por habitante: a emenda mínima que vale a
  // pena indicar tem um piso, e dividida por poucos habitantes pesa mais.
  const escala = 900 / Math.sqrt(populacao / 1000 + 1);
  let total = 0;
  for (let k = 0; k <= i; k++) total += escala * (0.3 + semente(codigo, 60 + k) * 1.4);
  return Math.round(total);
}

export const TIPOS_EMENDA = [
  { rotulo: "Individuais", parcela: 0.58 },
  { rotulo: "De bancada", parcela: 0.24 },
  { rotulo: "De comissão", parcela: 0.18 },
] as const;

export const DECISOES_EXEMPLO = {
  mps: { editadas: 124, convertidas: 61, perderamValidade: 48, emTramitacao: 15 },
  leisSancionadas: 910,
  vetosTotais: 18,
  vetosParciais: 57,
  votacoesNominais: { camara: 1180, senado: 420 },
};

export const FEED_EXEMPLO: ItemFeed[] = [
  { quando: "hoje 09:00", aba: "economia", origem: "IBGE", texto: "Desocupação do 3º trimestre por estado: queda em 21 das 27 UFs.", exemplo: true },
  { quando: "hoje 08:30", aba: "ambiente", origem: "INPE", texto: "Focos de queimada em outubro 40% abaixo do mesmo mês de 2024.", exemplo: true },
  { quando: "ontem 21:40", aba: "congresso", origem: "Câmara", texto: "Aprovou o PL 0000/2026 por 312 votos a 140. Segue para o Senado.", exemplo: true },
  { quando: "ontem 18:05", aba: "dinheiro", origem: "Transferegov", texto: "R$ 000 milhões em emendas pagas a municípios do Pará.", uf: "PA", exemplo: true },
  { quando: "24/10 16:20", aba: "congresso", origem: "Planalto", texto: "Sancionou a Lei 00.000/2026 com 3 vetos parciais.", exemplo: true },
  { quando: "23/10 11:00", aba: "economia", origem: "BCB", texto: "Copom mantém a Selic; próxima reunião em dezembro.", exemplo: true },
  { quando: "22/10 19:30", aba: "congresso", origem: "Senado", texto: "A MP 0.000/2026 perdeu a validade sem ser votada.", exemplo: true },
];
