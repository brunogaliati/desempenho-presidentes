import { ritmoNoMandato } from "../_dados/mandatoRecorte";
import { cartaoDaSerie } from "../_dados/ambienteMunicipal";
import type { ItemPlacar } from "./placarModelo";
import { SERIES_UI_POR_ID } from "@/lib/registroSeries";
import { comSinal, sentido, type Sentido } from "@/lib/formatar";
import type { Indicador } from "@/types/dados";
import { ritmoDesdeORecebido, type Recebido } from "../_dados/mandatoRecorte";
import type { Leitura, SerieEconomia, UF } from "../_dados/tipos";
import { ritmoNaRegua } from "./frases";
import { tendencia } from "./formatos";
const CURTO: Record<string, string> = {
  "Subutilização da força de trabalho": "Subutilização",
  "Inadimplência das famílias": "Inadimplência",
  "PIB por habitante": "PIB por hab.",
};
export const curto = (l: Leitura) => l.tituloCurto ?? CURTO[l.titulo] ?? l.titulo;
export const emPontos = (l: Leitura) => l.formato.startsWith("pct") || l.formato === "pp1";

const ordemSerie = (id: string) => SERIES_UI_POR_ID[id]?.ordem ?? 99;
const POSSE_ATUAL = "2023-01";

/** Nome, barra, no mandato, referência: as mesmas colunas em todas as linhas, para o zero ficar num fio só. */

/** Uma linha do ritmo: a média por ano no mandato e a referência tracejada. */
export interface Ritmo {
  id: string;
  rotulo: string;
  /** O grupo da linha, quando não é a unidade: todos dividem a mesma escala. */
  grupo?: string;
  v: number;
  /** No país, o ritmo nos 24 meses antes da posse; num estado, o do Brasil na mesma medida. */
  referencia: number | null;
  /** Pontos por ano; senão, % ao ano. */
  pontos: boolean;
  sentido: Sentido;
  /** A leitura por escrito, para o balão. */
  leitura: string | null;
  ativa: boolean;
  aoEscolher?: () => void;
}

/**
 * Parte do recebido, como o placar: pela série, onde há, e sem ela (ou em PIB e renda,
 * que já são crescimento) pelo último dado do governo anterior. Medida que começa neste
 * governo fica no indicador dele. A cor de cada barra é o veredito do placar, não o sinal
 * do ritmo: a Selic sem lado bom fica em cinza.
 */
export function ritmosDoPais(
  indicadores: Indicador[],
  series: SerieEconomia[],
  recebidoDe: (serieId: string) => Recebido | null,
  vereditos: Map<string, Sentido>,
  ativa: string | null,
  aoEscolher: (origem: string) => void,
  temSerie: (origem: string) => boolean,
): Ritmo[] {
  return indicadores
    .filter((i) => SERIES_UI_POR_ID[i.serieId] && i.serieId !== "salario_minimo")
    .sort((a, b) => ordemSerie(a.serieId) - ordemSerie(b.serieId))
    .flatMap((i) => {
      const ui = SERIES_UI_POR_ID[i.serieId];
      const s = series.find((x) => x.origem === i.serieId);
      const r = s ? ritmoNaRegua(s, s.posse ?? POSSE_ATUAL) : null;
      const doIndicador = r ? null : ritmoDesdeORecebido(recebidoDe(i.serieId), i);
      const v = r?.v ?? doIndicador?.v ?? i.variacaoAnualizada;
      if (v === null) return [];
      // Os 24 meses antes da posse já não tocam o mandato: o indicador serve.
      const referencia = r ? r.referencia : i.tendenciaPrevia;
      return [
        {
          id: i.serieId,
          rotulo: ui.rotulo,
          v,
          referencia,
          pontos: r?.pontos ?? doIndicador?.pontos ?? i.unidadeAnualizada === "p.p./ano",
          sentido: vereditos.get(i.serieId) ?? (ui.semDirecao ? "neutro" : sentido(v, i.direcao)),
          leitura: referencia !== null ? tendencia(v, referencia) : null,
          ativa: i.serieId === ativa,
          aoEscolher: temSerie(i.serieId) ? () => aoEscolher(i.serieId) : undefined,
        },
      ];
    });
}

/** Quantos períodos a medida tem por ano: trimestre, mês ou ano. */
function periodosPorAno(l: Leitura): number {
  const c = l.periodos[0]?.codigo ?? "";
  return /^\d{6}$/.test(c) ? 4 : /^\d{4}-\d{2}$/.test(c) ? 12 : 1;
}

/** De `a` para `b` por ano: taxas em pontos divididos pelos anos; preços e valores em % composto. */
function porAno(a: number, b: number, anos: number, pontos: boolean): number | null {
  if (anos <= 0) return null;
  if (pontos) return (b - a) / anos;
  return a > 0 ? ((b / a) ** (1 / anos) - 1) * 100 : null;
}

/**
 * O ritmo com os números do estado, do que o governo recebeu (fim de 2022) ao
 * último dado. A referência é o Brasil na mesma medida, e não o "antes da
 * posse": as séries por UF começam em 2021, e esse trecho mediria a volta da
 * pandemia, não o rumo que o estado já levava.
 */
export function ritmosDoEstado(leituras: Leitura[], uf: UF, ativa: string | null, aoEscolher: (id: string) => void): Ritmo[] {
  return leituras.flatMap((l): Ritmo[] => {
    const r = l.indiceRecebido;
    const p = l.periodos.length - 1;
    if (r === null || p <= r) return [];
    const pontos = emPontos(l);
    const anos = (p - r) / periodosPorAno(l);
    const ritmo = (s: (number | null)[] | undefined) => {
      const a = s?.[r];
      const b = s?.[p];
      return a == null || b == null ? null : porAno(a, b, anos, pontos);
    };
    const v = ritmo(l.ufs[uf.codigo]);
    if (v === null) return [];
    const brasil = ritmo(l.brasil);
    const pts = (x: number) => `${comSinal(x, 1)}${pontos ? " pts" : "%"} por ano`;
    return [
      {
        id: l.id,
        rotulo: curto(l),
        v,
        referencia: brasil,
        pontos,
        sentido: sentido(Math.round(v * 10) / 10, l.direcao ?? "neutro"),
        leitura: brasil === null ? null : `${uf.sigla} ${pts(v)}; Brasil ${pts(brasil)}`,
        ativa: l.id === ativa,
        aoEscolher: () => aoEscolher(l.id),
      },
    ];
  });
}

/**
 * O ritmo por ano de cada indicador no mandato, desenhado como as barras por
 * partido da sala: barra grossa saindo de um zero comum, ponta arredondada, o
 * valor à direita. A referência é o traço tracejado, como a linha do Brasil lá
 * em cima.
 */

const RITMO_DA_SERIE: Record<string, { grupo: string; rotulo: string }> = {
  prodes_amazonia: { grupo: "Desmatamento", rotulo: "Amazônia" },
  prodes_cerrado: { grupo: "Desmatamento", rotulo: "Cerrado" },
  prodes_outros: { grupo: "Desmatamento", rotulo: "Outros biomas" },
  alertas_amazonia_12m: { grupo: "Alertas", rotulo: "Amazônia" },
  alertas_cerrado_12m: { grupo: "Alertas", rotulo: "Cerrado" },
  focos_12m: { grupo: "Fogo", rotulo: "Focos" },
  cicatriz_12m: { grupo: "Fogo", rotulo: "Área queimada" },
  autos_12m: { grupo: "Fiscalização", rotulo: "Autos" },
  multas_12m: { grupo: "Fiscalização", rotulo: "Multas" },
  embargos_12m: { grupo: "Fiscalização", rotulo: "Embargos" },
};

/**
 * As mesmas séries do "Brasil agora", no painel do ritmo da economia: a seleção é uma
 * só. A cor é o veredito do placar, não o sinal do ritmo, para nunca discordar dele.
 */
export function ritmosDoAmbiente(series: SerieEconomia[], porId: Map<string, ItemPlacar>, foco: string, aoEscolher: (id: string) => void): Ritmo[] {
  const cartao = cartaoDaSerie(foco);
  return series.flatMap((s) => {
    const ui = RITMO_DA_SERIE[s.id];
    const r = ui ? ritmoNoMandato(s.datas, s.valores, s.posse) : null;
    if (!ui || !r) return [];
    return [
      {
        id: s.id,
        grupo: ui.grupo,
        rotulo: ui.rotulo,
        v: r.v,
        referencia: r.referencia,
        pontos: false,
        sentido: porId.get(s.id)?.sentido ?? "neutro",
        leitura: r.referencia === null ? null : tendencia(r.v, r.referencia),
        ativa: s.id === cartao,
        aoEscolher: () => aoEscolher(s.id),
      },
    ];
  });
}

