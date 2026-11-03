/**
 * Tipos espelhando as estruturas do backend (`desempenho/periodos.py`,
 * `registro.py`, `metricas.py`).
 *
 * Fonte única de verdade de shape no frontend — nenhum componente deve
 * inventar sua própria interface para os mesmos dados.
 */

/** Como cada tipo de série vira número comparável entre mandatos. */
export type TipoSerie = "taxa_periodo" | "indice" | "nivel_pct" | "nivel_moeda";

/** Se subir é bom, ruim, ou não dá para dizer. O site não dá nota, mas colore setas. */
export type Direcao = "maior_melhor" | "menor_melhor" | "neutro";

/**
 * Quanto do mandato os dados cobrem.
 *
 * `indisponivel` é resultado legítimo, não erro: a PNAD Contínua começa em
 * 2012, então FHC, Lula 1/2 e Dilma 1 não têm desemprego nesta metodologia.
 * A versão anterior do site gravava 0 nesses casos e exibia "variação de 0%".
 */
export type Cobertura = "completa" | "parcial" | "indisponivel";

export interface Indicador {
  serieId: string;
  serieNome: string;
  serieDescricao: string;
  unidade: string;
  tipo: TipoSerie;
  direcao: Direcao;

  /** Como o identificador da série foi confirmado contra a fonte oficial. */
  verificacao: string;
  fonteNome: string;
  fonteUrl: string;
  fonteRef: string;

  cobertura: Cobertura;
  dataInicio: string | null;
  dataFim: string | null;
  anosCobertos: number | null;
  fracaoMandatoCoberta: number | null;

  valorInicial: number | null;
  valorFinal: number | null;
  valorMinimo: number | null;
  valorMaximo: number | null;
  mediaPeriodo: number | null;

  /** Variação bruta do período. NÃO comparar entre mandatos de durações diferentes. */
  variacaoTotal: number | null;
  /** O número comparável. Unidade em `unidadeAnualizada`. */
  variacaoAnualizada: number | null;
  unidadeAnualizada: string | null;

  /** Nível recebido ao assumir. */
  herdadoValor: number | null;
  /** A mesma métrica anualizada nos 24 meses anteriores à posse. */
  tendenciaPrevia: number | null;
  /** Quanto o mandato divergiu da trajetória que já vinha. */
  deltaVsTendencia: number | null;

  /** Explicação quando o número não existe ou vem com ressalva. Nunca silencioso. */
  ressalva: string | null;
}

export interface Benchmark {
  indicadorWb: string;
  indicadorNome: string;
  regiao: string;
  regiaoNome: string;
  mediaPeriodo: number | null;
  valorInicial: number | null;
  valorFinal: number | null;
  nAnos: number;
}

export interface Presidente {
  id: string;
  /** Quem exerceu. FHC 1 e FHC 2 são mandatos distintos da mesma pessoa. */
  pessoaId: string;
  nome: string;
  nomeCurto: string;
  mandato: number;
  inicio: string;
  fim: string;
  /** Data de fronteira alternativa defensável (Dilma 2: afastamento em 12/05/2016). */
  fimAlternativo: string | null;
  partido: string | null;
  emCurso: boolean;
  fotoUrl: string | null;
  observacao: string | null;
  indicadores: Indicador[];
  benchmark: Benchmark[];
}

/** Série histórica em arrays paralelos — datas no formato `AAAA-MM`. */
export interface Serie {
  id: string;
  nome: string;
  unidade: string;
  frequencia: string;
  /** Preenchido quando a série exibida é agregação de uma mais granular. */
  agregacao: string | null;
  datas: string[];
  valores: number[];
}

/**
 * Uma sequência ininterrupta de mandatos da mesma pessoa.
 *
 * Responde "como foi o governo FHC" sem fingir que os oito anos foram um
 * mandato só. Lula tem dois períodos, porque doze anos separam 2010 de 2023.
 */
export interface PeriodoContinuo {
  id: string;
  pessoaId: string;
  nome: string;
  nomeCurto: string;
  inicio: string;
  fim: string;
  nMandatos: number;
  /** Ids dos mandatos que compõem o período, em ordem. */
  mandatos: string[];
  emCurso: boolean;
  indicadores: Indicador[];
}

export interface DadosSite {
  geradoEm: string;
  presidentes: Presidente[];
  periodos: PeriodoContinuo[];
  series: Record<string, Serie>;
}
