/**
 * Como cada série aparece para o leitor.
 *
 * O backend guarda o nome técnico ("Salário mínimo real", "Massa de renda
 * real"); aqui mora a tradução para a pergunta que a pessoa realmente faz.
 * Pesquisa Quaest 2026: 67% dos brasileiros dizem ter menos poder de compra
 * que um ano atrás e 69% viram comida subir no último mês — o vocabulário do
 * site precisa encontrar essa pessoa, não o economista.
 *
 * Substitui os arrays de 4 indicadores que ficavam hardcoded dentro de
 * ComparePresidents, DashboardInterativo e RadarChart.
 */

export type Categoria =
  | "poder_de_compra"
  | "precos"
  | "trabalho"
  | "crescimento"
  | "contas"
  | "desigualdade";

export interface SerieUI {
  id: string;
  /** Rótulo curto, em português de gente. */
  rotulo: string;
  /** A pergunta que este indicador responde, em primeira pessoa. */
  pergunta: string;
  categoria: Categoria;
  /** Ordem de aparição na narrativa. Menor = mais cedo. */
  ordem: number;
  /** Prefixo/sufixo de exibição além da unidade anualizada. */
  simbolo?: string;
  /**
   * Fora do gráfico de radar/comparação de "quem foi melhor".
   * Câmbio e Selic não têm direção boa ou ruim — dólar alto é bom para quem
   * exporta e ruim para quem viaja. Incluí-los num ranking seria afirmar uma
   * direção que não existe.
   */
  semDirecao?: boolean;
}

export const CATEGORIAS: Record<Categoria, string> = {
  poder_de_compra: "Poder de compra",
  precos: "Preços e juros",
  trabalho: "Trabalho e renda",
  crescimento: "Crescimento",
  contas: "Contas públicas",
  desigualdade: "Desigualdade",
};

export const SERIES_UI: SerieUI[] = [
  {
    id: "salario_minimo_real",
    rotulo: "Salário mínimo real",
    pergunta: "O que o salário mínimo comprava?",
    categoria: "poder_de_compra",
    ordem: 1,
    simbolo: "R$",
  },
  {
    id: "salario_minimo",
    rotulo: "Salário mínimo nominal",
    pergunta: "Quanto era o salário mínimo?",
    categoria: "poder_de_compra",
    ordem: 2,
    simbolo: "R$",
    // Sem direção: subir em reais não é ganho por si só. Sob FHC 1 o mínimo
    // nominal cresceu 17% ao ano com inflação de 9% — marcar isso como "bom"
    // enquanto o poder de compra real subiu 7% duplicaria o mesmo mérito e
    // premiaria o efeito da inflação. Quem responde essa pergunta é a série
    // real, logo acima.
    semDirecao: true,
  },
  {
    id: "ipca",
    rotulo: "Inflação",
    pergunta: "Os preços subiram quanto?",
    categoria: "precos",
    ordem: 3,
  },
  {
    id: "selic",
    rotulo: "Juros (Selic)",
    pergunta: "Quanto custava pegar dinheiro emprestado?",
    categoria: "precos",
    ordem: 4,
    semDirecao: true,
  },
  {
    id: "juros_real",
    rotulo: "Juros reais",
    pergunta: "O juro pesou quanto, já descontada a inflação?",
    categoria: "precos",
    ordem: 5,
    semDirecao: true,
  },
  {
    id: "cambio",
    rotulo: "Dólar",
    pergunta: "Quanto custava um dólar?",
    categoria: "precos",
    ordem: 6,
    simbolo: "R$",
    semDirecao: true,
  },
  {
    id: "desemprego",
    rotulo: "Desemprego",
    pergunta: "Quantos estavam sem trabalho?",
    categoria: "trabalho",
    ordem: 7,
  },
  {
    id: "massa_renda_real",
    rotulo: "Massa de renda",
    pergunta: "Quanto dinheiro de trabalho circulava no país?",
    categoria: "trabalho",
    ordem: 8,
  },
  {
    id: "pib_volume",
    rotulo: "PIB",
    pergunta: "A economia cresceu quanto?",
    categoria: "crescimento",
    ordem: 9,
  },
  {
    id: "pib_per_capita",
    rotulo: "PIB por pessoa",
    pergunta: "O país ficou mais rico por habitante?",
    categoria: "crescimento",
    ordem: 10,
  },
  {
    id: "divida_bruta_pib",
    rotulo: "Dívida bruta",
    pergunta: "O governo se endividou quanto?",
    categoria: "contas",
    ordem: 11,
  },
  {
    id: "divida_liquida_pib",
    rotulo: "Dívida líquida",
    pergunta: "E descontando o que o governo tem a receber?",
    categoria: "contas",
    ordem: 12,
  },
  {
    id: "pobreza",
    rotulo: "Pobreza extrema",
    pergunta: "Quantos viviam abaixo da linha da pobreza?",
    categoria: "desigualdade",
    ordem: 13,
  },
  {
    id: "gini",
    rotulo: "Desigualdade (Gini)",
    pergunta: "A distância entre ricos e pobres aumentou?",
    categoria: "desigualdade",
    ordem: 14,
  },
];

export const SERIES_UI_POR_ID: Record<string, SerieUI> = Object.fromEntries(
  SERIES_UI.map((s) => [s.id, s]),
);

/** A série que abre a narrativa. Ver `SERIES_UI` para o porquê. */
export const SERIE_ABERTURA = "salario_minimo_real";

export function seriesOrdenadas(): SerieUI[] {
  return [...SERIES_UI].sort((a, b) => a.ordem - b.ordem);
}

export function seriesPorCategoria(): [Categoria, SerieUI[]][] {
  const ordem: Categoria[] = [
    "poder_de_compra",
    "precos",
    "trabalho",
    "crescimento",
    "contas",
    "desigualdade",
  ];
  return ordem.map((c) => [
    c,
    seriesOrdenadas().filter((s) => s.categoria === c),
  ]);
}
