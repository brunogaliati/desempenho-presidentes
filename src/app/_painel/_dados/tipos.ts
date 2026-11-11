import type { Benchmark, Direcao, Indicador, Presidente } from "@/types/dados";

/**
 * O que o painel recebe do servidor.
 *
 * Funções não atravessam a fronteira servidor → cliente, então cada leitura do
 * mapa diz como formatar seus números por uma chave (`formato`) e o cliente
 * escolhe o formatador.
 */

export type AbaId = "resumo" | "economia" | "congresso" | "dinheiro" | "ambiente";

/**
 * pp1 = pontos percentuais com sinal ("−2,0 pts"); pctsinal1 = variação em %
 * com sinal ("+2,1%"); reais2 = centavos ("R$ 5,17"). km2, contagem e
 * reaiscurto ("R$ 3,9 bi") são volumes: mudam em %, não em pontos.
 */
export type Formato =
  | "pct0"
  | "pct1"
  | "pct2"
  | "pctsinal1"
  | "pp1"
  | "reais0"
  | "reais2"
  | "inteiro"
  | "decimal1"
  | "km2"
  | "contagem"
  | "reaiscurto";

/** A rampa de cor do mapa: o azul do dado e, no meio ambiente, uma por tipo de medida. */
export type Rampa = "mapa" | "desmate" | "alerta" | "fogo" | "fiscal" | "protegidas";

export interface Parlamentar {
  nome: string;
  partido: string | null;
}

export interface UF {
  codigo: string;
  sigla: string;
  nome: string;
  /** "no Pará", "na Bahia", "em São Paulo". */
  emNome: string;
  /** "do Pará", "da Bahia", "de São Paulo". */
  deNome: string;
  regiao: string;
  regiaoCodigo: string;
  d: string;
  centro: [number, number];
  area: number;
  /** Área real aproximada pela malha simplificada, para medidas por área. */
  areaKm2: number;
  /** [x0, y0, x1, y1] no viewBox do mapa, para o zoom. */
  caixa: [number, number, number, number];
  populacao: number | null;
  deputados: Parlamentar[];
  senadores: Parlamentar[];
}

export interface Periodo {
  codigo: string;
  /** Rótulo curto para a régua: "2º tri 26", "set/24", "2025". */
  rotulo: string;
  /** Rótulo para frases: "2º trimestre de 2026". */
  extenso: string;
}

/** Uma medida por território ao longo do tempo. `null` é ausência, nunca zero. */
export interface Leitura {
  id: string;
  titulo: string;
  /** O nome na coluna da tabela de estados, quando o título não cabe. */
  tituloCurto?: string;
  /** A rampa do mapa; sem ela, o azul do dado. */
  rampa?: Rampa;
  /** Uma linha sobre o que a cor significa. */
  descricao: string;
  fonte: string;
  exemplo: boolean;
  formato: Formato;
  /** "log" para medidas muito assimétricas (por habitante, contagens). */
  escala: "linear" | "log";
  periodos: Periodo[];
  /** Índice do período em que o governo começou, para a marca na régua. */
  indicePosse: number | null;
  /** Período que representa "o que o governo recebeu", para a variação. */
  indiceRecebido: number | null;
  brasil: (number | null)[];
  regioes: Record<string, (number | null)[]>;
  ufs: Record<string, (number | null)[]>;
  /** Em que sentido o número melhora, para as setas e o "melhor/pior". */
  direcao?: Direcao;
  /** Como o número foi calculado a partir da fonte, quando foi. */
  calculo?: string;
  fonteUrl?: string;
  /** Quando o dado entrou no banco (ou a data da cópia salva). */
  coletadoEm?: string | null;
  /** Círculos sobre o mapa: um total por território, como o PIB. */
  tamanho?: {
    titulo: string;
    brasil: number | null;
    ufs: Record<string, number | null>;
  };
}

export interface Marco {
  id: string;
  /** Data do evento identificado por `etapa`, não necessariamente da vigência. */
  data: string;
  dataPublicacao: string | null;
  rotulo: string;
  etapa: string;
  responsavel: string;
  documento: string;
  contexto: string;
  fonte: string;
  fonteUrl: string;
}

export interface ItemFeed {
  quando: string;
  aba: AbaId;
  origem: string;
  texto: string;
  uf?: string;
  exemplo: true;
}

/**
 * Uma série nacional da economia, já no formato que o leitor entende:
 * inflação em 12 meses em vez do IPCA mensal, crescimento do PIB em vez do
 * índice de volume. Preserva o histórico e explicita as lacunas.
 */
export interface SerieEconomia {
  id: string;
  /** A série do banco de onde vem; liga esta aos indicadores de cada mandato. */
  origem: string;
  rotulo: string;
  pergunta: string;
  formato: Formato;
  direcao: Direcao;
  /** AAAA-MM; séries trimestrais usam o último mês do trimestre. */
  datas: string[];
  valores: (number | null)[];
  fonte: string;
  fonteUrl: string;
  unidade: string;
  frequencia: string;
  mesesReferencia: number;
  referencia: string | null;
  coletadoEm: string | null;
  parcial: boolean;
  cobertura: { inicio: string | null; fim: string | null; lacunas: number };
  instituicoes: {
    mede: string;
    atua: string;
    contexto: string;
    links: { nome: string; url: string }[];
  };
  /** Como o número foi derivado da série do banco, quando foi. */
  calculo: string | null;
  /** Datas de estimativa preliminar (a taxa PRODES do ano corrente), marcadas com *. */
  preliminares?: string[];
  /** A posse de quem esta série está medindo (AAAA-MM), quando não é o governo atual. */
  posse?: string;
}

/** Um dado que entrou no banco na última coleta. */
export interface Novidade {
  serieId: string;
  texto: string;
  /** AAAA-MM-DD do período a que o dado se refere. */
  data: string;
  /** Instante em que a coleta registrou o dado. */
  registradoEm: string;
}

/** Um partido como o mapa o mostra; a cor vem de `--partido-<familia>`. */
export interface PartidoInfo {
  nome: string;
  familia: string;
  rotulo: string;
  /** Para escrever sobre o estado: "Rep.", "SD". */
  curta: string;
}

/**
 * Quem esteve no governo de uma UF, em `[inicio, fim)`. Um mandato se divide
 * quando o partido muda. `partido` é a sigla da época; "SEM" é sem filiação,
 * com fonte; `null` é não confirmado.
 */
export interface TrechoGoverno {
  inicio: string;
  fim: string | null;
  nome: string;
  como: "eleito" | "reeleito" | "vice_assumiu" | "interino" | "outro";
  eleicao: number | null;
  /** Fonte do exercício no cargo. */
  fonte: string;
  partido: string | null;
  origem: "oficial" | "secundaria" | "complemento" | "desconhecido";
  fontePartido: string | null;
  /** Partido da candidatura, quando difere do partido no período. */
  eleitoPor: string | null;
  /** A troca de partido que abre o trecho só tem o mês. */
  aproximado?: boolean;
  nota: string | null;
}

export interface TrechoPresidente {
  inicio: string;
  fim: string | null;
  nome: string;
  curto: string;
  partido: string | null;
  nota?: string;
  fonte?: string;
}

/** `_dados/governos.json`, gerado por `scripts/gerar-governos.mjs`. */
export interface Governos {
  fonte: string;
  referencia: string;
  partidos: Record<string, PartidoInfo>;
  presidentes: TrechoPresidente[];
  ufs: Record<string, TrechoGoverno[]>;
  /** Eleitos em 2026, com posse prevista; ainda não governam. */
  previstos: Record<string, { nome: string; partido: string | null; como: string; posse: string; fonte: string }>;
}

/** O mandato que a tela está mostrando (ver `mandatoRecorte.ts`). */
export interface FocoMandato {
  id: string;
  /** O primeiro mês dele, AAAA-MM. */
  posse: string;
  /** O mês em que o seguinte começa; `null` no mandato em curso. */
  ate: string | null;
  emCurso: boolean;
  /** O último ano antes da posse, o que ele recebeu: 2022 para quem assumiu em 2023. */
  anoRecebido: number;
  /** O último ano PRODES dele; 9999 no mandato em curso. */
  anoFinal: number;
  /** O último dia, AAAA-MM-DD. */
  fim: string;
}

export interface DadosPainel {
  /** O mandato na tela. */
  foco: FocoMandato;
  hoje: string;
  governos: Governos;
  presidente: { id: string; nome: string; mandato: number; partido: string | null; inicio: string };
  posse: string;
  marcosPorMandato: Record<string, Marco[]>;
  mapa: { largura: number; altura: number; fonte: string };
  ufs: UF[];
  regioes: { codigo: string; nome: string }[];
  leituras: Record<AbaId, Leitura[]>;
  economia: {
    complemento: import("./panoramaModelo").ComplementoEconomia;
    indicadores: Indicador[];
    series: SerieEconomia[];
    benchmark: Benchmark[];
    mandatos: MandatoVisual[];
    /** Os indicadores de cada mandato, pelo id dele: a grade governo a governo. */
    porMandato: Record<string, IndicadorMandato[]>;
    /** Brasil e o mundo em cada mandato, pelo id dele. */
    benchmarkPorMandato: Record<string, Benchmark[]>;
  };
  novidades: Novidade[];
  congresso: {
    deputados: number;
    senadores: number;
    partidosNaCamara: number;
    legislatura: { numero: number; inicio: string; proxima: string };
    senadoRenovadas: number;
  };
  ambiente: import("./ambienteModelo").DadosAmbiente;
  /** Os anos do mapa municipal de focos (arquivo anual do satélite de referência). */
  queimadas: {
    anos: number[];
    satelite: string;
  };
  feed: ItemFeed[];
  fontes: {
    coletadoEm: string;
    camara: string;
    senado: string;
    sidra: string;
    malha: string;
    queimadas: string;
  };
}

/** Só o que a comparação entre mandatos usa, para não mandar o indicador inteiro ao cliente. */
export type IndicadorMandato = Pick<Indicador,
  | "serieId" | "unidade" | "tipo" | "direcao" | "cobertura" | "fracaoMandatoCoberta"
  | "valorInicial" | "valorFinal" | "variacaoAnualizada" | "unidadeAnualizada"
  | "tendenciaPrevia" | "ressalva" | "dataInicio" | "dataFim"
  | "herdadoValor" | "fonteNome" | "fonteUrl"
>;

export type MandatoVisual = Pick<Presidente,
  "id" | "pessoaId" | "nome" | "nomeCurto" | "mandato" | "inicio" | "fim" | "partido" | "emCurso"
>;

/** Um município, como o painel recebe ao entrar num estado. */
export interface Municipio {
  codigo: string;
  nome: string;
  populacao: number | null;
  /** Focos de queimada por ano, alinhado a `queimadas.anos`. */
  focos: number[];
}

export interface FormaMunicipio {
  codigo: string;
  d: string;
  centro: [number, number];
}

/** Município no mapa nacional de queimadas (`public/painel/municipios-brasil.json`). */
export interface MunicipioNacional {
  codigo: string;
  nome: string;
  uf: string;
  areaKm2: number;
  d: string;
}
