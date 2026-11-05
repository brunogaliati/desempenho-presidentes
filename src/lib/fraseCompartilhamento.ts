/**
 * A frase que acompanha um recorte compartilhado, escrita com os números da página
 * (nunca com texto vindo da URL). A conta é uma só para qualquer governo e qualquer
 * direção: o verbo diz para onde o número foi, não quem o moveu nem se foi bom. O
 * leitor pode mudar a frase antes de enviar; o que sai pronto é o dado.
 *
 * O de/para não leva a diferença ao lado: o placar subtrai antes de arredondar e diz
 * +11,3 onde 82,9 − 71,7 dá 11,2. Cada número está certo no seu lugar; juntos, parecem erro.
 */

/** O nome na frase, onde o rótulo do painel não serve para abrir uma oração. */
const NOMES: Record<string, { nome: string; unidade?: string }> = {
  selic: { nome: "Selic" },
  divida_bruta_pib: { nome: "Dívida bruta", unidade: "do PIB" },
  ibovespa: { nome: "Ibovespa", unidade: "pontos" },
  pib: { nome: "PIB" },
  renda: { nome: "Massa de renda real" },
};

export const nomeNaFrase = (id: string, rotulo: string): { nome: string; unidade?: string } => NOMES[id] ?? { nome: rotulo };

/** "Juros reais subiram", "Dólar subiu". Os rótulos têm o substantivo na primeira palavra. */
const conjugar = (nome: string, um: string, varios: string) => (/s$/i.test(nome.split(" ")[0]) ? varios : um);

const noGoverno = (governo?: string | null, periodo?: string) =>
  `${governo ? ` no governo ${governo}` : ""}${periodo ? ` (${periodo})` : ""}`;

/** Junta as partes que existem: a posição entre os governos nem sempre vale dizer. */
export const juntar = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" ");

/** "Dívida bruta subiu de 71,7% para 82,9% do PIB no governo Lula (dez/2022 a set/2026)." */
export function fraseDeMudanca(m: {
  nome: string;
  unidade?: string;
  de: number;
  para: number;
  deTexto: string;
  paraTexto: string;
  governo?: string | null;
  periodo?: string;
}): string {
  const unidade = m.unidade ? ` ${m.unidade}` : "";
  // O que o leitor enxerga manda: 71,71 e 71,74 são "71,7%" nos dois lados.
  if (m.deTexto === m.paraTexto) {
    return `${m.nome} ${conjugar(m.nome, "ficou", "ficaram")} em ${m.paraTexto}${unidade}${noGoverno(m.governo, m.periodo)}.`;
  }
  const verbo = m.para > m.de ? conjugar(m.nome, "subiu", "subiram") : conjugar(m.nome, "caiu", "caíram");
  return `${m.nome} ${verbo} de ${m.deTexto} para ${m.paraTexto}${unidade}${noGoverno(m.governo, m.periodo)}.`;
}

/** PIB e renda já são variação: "PIB cresceu 9,1% no governo Lula (até 2º tri/2026)." */
export function fraseDeCrescimento(m: { nome: string; texto: string; governo?: string | null; ate?: string }): string {
  const periodo = m.ate ? `até ${m.ate}` : undefined;
  const numero = m.texto.replace(/^[+\-−]/, "");
  if (!/\d/.test(numero)) return `${m.nome} ${conjugar(m.nome, "ficou estável", "ficaram estáveis")}${noGoverno(m.governo, periodo)}.`;
  const verbo = /^[\-−]/.test(m.texto) ? conjugar(m.nome, "encolheu", "encolheram") : conjugar(m.nome, "cresceu", "cresceram");
  return `${m.nome} ${verbo} ${numero}${noGoverno(m.governo, periodo)}.`;
}

export interface PosicaoNoRitmo {
  ordem: number;
  lado: "alta" | "queda";
  total: number;
}

/**
 * A posição de um mandato entre os que subiram (ou caíram), pelo ritmo por ano: é o
 * que compara mandatos de durações diferentes, e é a conta da grade "Governo a governo".
 * Só o que se destaca vale dizer: no meio da fila, ou entre poucos, "3ª maior" não diz
 * nada, e "2ª maior" entre duas altas é a menor delas.
 */
export function posicaoDoRitmo(ritmos: (number | null)[], k: number): PosicaoNoRitmo | null {
  const v = ritmos[k];
  if (v === null || v === undefined || v === 0) return null;
  const comDado = ritmos.filter((x): x is number => x !== null);
  const mesmoLado = comDado.filter((x) => Math.sign(x) === Math.sign(v)).sort((a, b) => Math.abs(b) - Math.abs(a));
  const ordem = mesmoLado.indexOf(v) + 1;
  if (comDado.length < 4 || ordem > 2 || (ordem === 2 && mesmoLado.length < 3)) return null;
  return { ordem, lado: v > 0 ? "alta" : "queda", total: comDado.length };
}

/** A contagem que o placar mostra na tela: "de 12 indicadores, 8 melhoraram e 4 pioraram desde a posse". */
/** "8 melhoraram", "1 piorou", "nenhum piorou". */
export const contaDoPlacar = (n: number, um: string, varios: string) => (n === 0 ? `nenhum ${um}` : `${n} ${n === 1 ? um : varios}`);

/** "8 melhoraram e 4 pioraram", com a concordância certa. */
export function contagemDoPlacar(p: { bons: number; iguais: number; ruins: number }): string {
  const partes = [
    contaDoPlacar(p.bons, "melhorou", "melhoraram"),
    ...(p.iguais ? [contaDoPlacar(p.iguais, "ficou igual", "ficaram iguais")] : []),
    contaDoPlacar(p.ruins, "piorou", "pioraram"),
  ];
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

export function fraseDoPlacar(p: { governo: string; periodo: string; bons: number; iguais: number; ruins: number }): string {
  return `Economia no governo ${p.governo} (${p.periodo}): de ${p.bons + p.iguais + p.ruins} indicadores, ${contagemDoPlacar(p)} desde a posse. Confira um a um:`;
}

/** "2º maior ritmo de alta em 6 mandatos com dado." Curta: no celular a caixa da frase mostra cinco linhas. */
export const fraseDePosicao = (p: PosicaoNoRitmo, mandatos: number) =>
  `${p.ordem === 1 ? "Maior" : "2º maior"} ritmo de ${p.lado} em ${p.total} mandatos${p.total < mandatos ? " com dado" : ""}.`;
