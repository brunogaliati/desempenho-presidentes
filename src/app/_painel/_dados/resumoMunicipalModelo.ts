import type { Eleicao, LinhaResumo } from "./resumoModelo";
import type { FocoMandato } from "./tipos";

/**
 * O resumo de uma prefeitura dentro do painel, no mesmo molde do resumo do
 * governo federal e dos estados. As páginas em /resumo/municipios continuam
 * sendo a versão estática, para busca; esta é a de navegar.
 *
 * Só tipos e funções puras: o cliente importa daqui.
 */

/** As gestões municipais começam em janeiro do ano seguinte à eleição: 2013, 2017, 2021, 2025… */
export const PRIMEIRA_GESTAO = 2013;

export function gestaoEmCurso(hoje = new Date()): number {
  const ano = hoje.getUTCFullYear();
  return ano - (((ano - PRIMEIRA_GESTAO) % 4) + 4) % 4;
}

export function gestoesMunicipais(hoje = new Date()): number[] {
  const atual = gestaoEmCurso(hoje);
  return Array.from({ length: (atual - PRIMEIRA_GESTAO) / 4 + 1 }, (_, i) => PRIMEIRA_GESTAO + i * 4);
}

export const gestaoValida = (ano: number, hoje = new Date()) => gestoesMunicipais(hoje).includes(ano);

/** O recorte da gestão na mesma forma do mandato federal, para os gráficos e as linhas do resumo. */
export function focoDaGestao(ano: number, hoje = new Date()): FocoMandato {
  const emCurso = ano === gestaoEmCurso(hoje);
  return {
    id: `gestao-${ano}`,
    posse: `${ano}-01`,
    ate: emCurso ? null : `${ano + 4}-01`,
    emCurso,
    anoRecebido: ano - 1,
    anoFinal: emCurso ? 9999 : ano + 3,
    fim: `${ano + 3}-12-31`,
  };
}

export interface EleitoMunicipal {
  nome: string;
  partido: string | null;
  /** AAAA-MM-DD da eleição que o elegeu. */
  data: string;
  suplementar: boolean;
  /** Miniatura da foto de candidatura no TSE, quando coletada (por ora, os eleitos em 2024). */
  foto: string | null;
}

export interface GestaoMunicipal {
  ano: number;
  prefeito: EleitoMunicipal | null;
  vice: EleitoMunicipal | null;
}

export interface MunicipioResumo {
  codigo: string;
  nome: string;
  slug: string;
  uf: { codigo: string; nome: string; sigla: string; slug: string };
}

export interface DadosResumoMunicipal {
  municipio: MunicipioResumo;
  /** A página estática do município, a de busca. */
  caminho: string;
  ano: number;
  gestoes: GestaoMunicipal[];
  /** Por que não há prefeito: DF, Fernando de Noronha, ou o TSE não bateu com o cadastro. */
  semPrefeitura: string | null;
  erroEleicao: boolean;
  /** A Câmara eleita junto com o prefeito da gestão. */
  camara: Eleicao | null;
  /** População, emprego formal, CadÚnico e BPC: o território, não só a prefeitura. */
  indicadores: LinhaResumo[];
  /** Links para a página de cada indicador do município. */
  paginasIndicadores: { nome: string; caminho: string }[];
  rede: LinhaResumo[] | null;
  /** O último número de cada indicador, para o cabeçalho. */
  retrato: { rotulo: string; valor: string; quando: string }[];
}

export interface OpcaoMunicipio {
  codigo: string;
  nome: string;
  uf: string;
}
