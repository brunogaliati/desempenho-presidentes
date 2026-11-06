import type { Benchmark, Direcao } from "@/types/dados";
import { CATEGORIAS, SERIES_UI_POR_ID, type Categoria } from "@/lib/registroSeries";
import { comSinal, numero, sentido, type Sentido } from "@/lib/formatar";
import { recebidoNaLista, ritmoDesdeORecebido, type Recebido } from "../_dados/mandatoRecorte";
import type { IndicadorMandato, MandatoVisual, SerieEconomia } from "../_dados/tipos";
import { LADO_BOM, mandatosNaSerie, mudanca, formatar } from "./formatos";
import { ritmoNaRegua } from "./frases";
import type { ItemPlacar } from "./placarModelo";

function nivelDe(v: number, unidade: string, simbolo?: string): string {
  if (simbolo === "R$") return `R$ ${numero(v, v >= 100 ? 0 : 2)}`;
  if (unidade.startsWith("US$")) return `US$ ${numero(v, 0)}`;
  if (unidade.includes("%")) return `${numero(v, 1)}%`;
  return numero(v, 1);
}

/** O que a grade compara, na ordem da narrativa do site. O mínimo nominal fica fora (ver `registroSeries`). */
const LINHAS_GRADE = [
  "salario_minimo_real",
  "ipca",
  "selic",
  "juros_real",
  "cambio",
  "desemprego",
  "massa_renda_real",
  "pib_volume",
  "pib_per_capita",
  "divida_bruta_pib",
  "divida_liquida_pib",
  "pobreza",
  "gini",
];

/** O World Bank mede igual para todos os países: é o que permite pôr o Brasil contra o mundo em cada mandato. */
export const MUNDO: { id: string; rotulo: string; direcao: Direcao }[] = [
  { id: "NY.GDP.MKTP.KD.ZG", rotulo: "Crescimento do PIB", direcao: "maior_melhor" },
  { id: "FP.CPI.TOTL.ZG", rotulo: "Inflação", direcao: "menor_melhor" },
  { id: "SL.UEM.TOTL.ZS", rotulo: "Desemprego (OIT)", direcao: "menor_melhor" },
];
export const REGIOES: [string, string][] = [
  ["BRA", "Brasil"],
  ["LCN", "América Latina e Caribe"],
  ["MIC", "Países de renda média"],
  ["WLD", "Mundo"],
];

export interface Celula {
  /** O que mudou desde a posse, no idioma da medida: "−1,2 pts", "+12,5%". */
  texto: string | null;
  sentido: Sentido;
  /** A comparação por escrito, para o balão. */
  leitura: string | null;
  /** O ritmo por ano, que vai no balão com a posição entre os governos. */
  ritmo: number | null;
  parcial: boolean;
  detalhe: React.ReactNode;
}
export interface LinhaGrade {
  id: string;
  grupo: string;
  rotulo: string;
  /** O que a célula mede: "pts", "%", "% no mandato". */
  unidade: string;
  /** A unidade do ritmo do balão: "% ao ano", "pontos por ano". */
  unidadeRitmo: string;
  direcao: Direcao;
  /** A série do banco, quando há uma série nacional para abrir no gráfico. */
  origem?: string;
  celulas: Celula[];
  /** A posição de cada mandato no ritmo (0 é o melhor) e quantos têm o dado. */
  posicao: (number | null)[];
  n: number;
}

/**
 * A posição de cada mandato entre os que têm o dado, do melhor (0) ao pior.
 * Vai só no balão: a cor da grade é a régua do placar, não o ranking.
 */
function posicoes(valores: (number | null)[], direcao: Direcao): (number | null)[] {
  if (direcao === "neutro") return valores.map(() => null);
  const ordem = valores
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null)
    .sort((a, b) => (direcao === "maior_melhor" ? b.v - a.v : a.v - b.v));
  const saida: (number | null)[] = valores.map(() => null);
  ordem.forEach((x, k) => (saida[x.i] = k));
  return saida;
}

type TrechoSerie = ReturnType<typeof mandatosNaSerie>[number];

/**
 * Uma célula com a régua do placar e do gráfico: o último dado do mandato
 * contra o que ele recebeu na posse.
 *
 * - Mandato em curso: o número do placar, igual em toda a aba.
 * - Com série nacional: a mesma conta que pinta o gráfico (`mandatosNaSerie`).
 *   PIB e renda já são variação: a célula diz quanto cresceram no mandato e a
 *   cor é a do gráfico, a média contra o zero.
 * - Sem série (pobreza, Gini, dívida líquida, PIB per capita): o primeiro e o
 *   último dado do mandato no banco, como o placar faz com eles.
 */
function celulaDaRegua(
  i: IndicadorMandato | null,
  s: SerieEconomia | undefined,
  t: TrechoSerie | undefined,
  item: ItemPlacar | undefined,
  direcao: Direcao,
  recebeu: Recebido | null,
): Pick<Celula, "texto" | "sentido" | "leitura"> {
  const vazia = { texto: null, sentido: "neutro" as const, leitura: null };
  if (item) return { texto: item.mudanca, sentido: item.sentido, leitura: item.leitura };
  const pelosNiveis = (pts: boolean) => {
    // O recebido, como no placar; quem não tem governo anterior com o dado parte do primeiro dele.
    const de = recebeu?.valor ?? i?.valorInicial ?? null;
    if (!i || de === null || i.valorFinal === null || i.cobertura === "indisponivel" || de === 0) return null;
    const v = Math.round((pts ? i.valorFinal - de : (i.valorFinal / de - 1) * 100) * 10) / 10;
    return { v, texto: v === 0 ? "igual" : `${comSinal(v, 1)}${pts ? " pts" : "%"}` };
  };
  if (s) {
    if (!t) return vazia;
    if (s.formato === "pctsinal1") {
      const n = pelosNiveis(false);
      return n ? { texto: n.texto, sentido: t.sentido, leitura: `${n.v >= 0 ? "Cresceu" : "Encolheu"} ${numero(Math.abs(n.v), 1)}% no mandato.` } : vazia;
    }
    const d = mudanca(s, t.recebeu, t.ultimo);
    return {
      texto: d?.texto ?? null,
      sentido: direcao === "neutro" ? "neutro" : t.sentido,
      leitura: `Recebeu ${formatar(t.recebeu, s.formato)}; ${t.emCurso ? "está em" : "terminou em"} ${formatar(t.ultimo, s.formato)}.`,
    };
  }
  if (!i || !["nivel_pct", "nivel_moeda", "indice"].includes(i.tipo)) return vazia;
  const n = pelosNiveis(i.tipo === "nivel_pct");
  return n ? { texto: n.texto, sentido: sentido(n.v, direcao), leitura: null } : vazia;
}

/** As linhas da grade: as séries do banco e, no fim, o Brasil contra o mundo. */
export function linhasDaGrade(
  ordem: MandatoVisual[],
  porMandato: Record<string, IndicadorMandato[]>,
  benchmark: Record<string, Benchmark[]>,
  origens: Set<string>,
  series: SerieEconomia[],
  doPlacar: Map<string, ItemPlacar>,
): LinhaGrade[] {
  const comPosicao = (ln: Omit<LinhaGrade, "posicao" | "n">): LinhaGrade => {
    const ritmos = ln.celulas.map((c) => c.ritmo);
    return { ...ln, posicao: posicoes(ritmos, ln.direcao), n: ln.celulas.filter((c) => c.texto !== null).length };
  };
  const daSerie = LINHAS_GRADE.flatMap((id): LinhaGrade[] => {
    const ui = SERIES_UI_POR_ID[id];
    const inds = ordem.map((m) => porMandato[m.id]?.find((i) => i.serieId === id) ?? null);
    // A unidade vem de um mandato com o dado: os sem dado não a têm.
    const exemplo = inds.find((i) => i?.unidadeAnualizada) ?? inds.find((i) => i !== null);
    if (!ui || !exemplo || inds.every((i) => i?.variacaoAnualizada == null)) return [];
    const direcao = LADO_BOM[id] ?? (ui.semDirecao ? "neutro" : exemplo.direcao);
    const s = series.find((x) => x.origem === id);
    const trechos = new Map((s ? mandatosNaSerie(s, ordem) : []).map((t) => [t.id, t] as const));
    const crescimento = s ? s.formato === "pctsinal1" : exemplo.tipo === "indice" || id === "pib_per_capita";
    const emPts = s ? !crescimento && s.formato !== "reais0" && s.formato !== "reais2" : exemplo.tipo === "nivel_pct";
    const nivelVisivel = exemplo.tipo === "nivel_pct" || exemplo.tipo === "nivel_moeda";
    return [
      comPosicao({
        id,
        grupo: CATEGORIAS[ui.categoria as Categoria],
        rotulo: ui.rotulo,
        unidade: crescimento ? "% no mandato" : emPts ? "pts" : "%",
        unidadeRitmo: (s && !crescimento ? emPts : exemplo.unidadeAnualizada === "p.p./ano") ? "pontos por ano" : "% ao ano",
        direcao,
        origem: origens.has(id) ? id : undefined,
        celulas: inds.map((i, k) => ({
          ...celulaDaRegua(i, s, trechos.get(ordem[k].id), ordem[k].emCurso ? doPlacar.get(id) : undefined, direcao, recebidoNaLista(inds, k)),
          // A régua do ritmo é uma só na linha: sem base nesse governo fica sem número, e não
          // entra na posição com outra unidade.
          ritmo:
            s && !crescimento
              ? ((t) => (t ? (ritmoNaRegua(s, t.desde, t.ate)?.v ?? null) : null))(trechos.get(ordem[k].id))
              : i
                ? (ritmoDesdeORecebido(recebidoNaLista(inds, k), i)?.v ?? i.variacaoAnualizada)
                : null,
          parcial: i?.cobertura === "parcial",
          detalhe: i ? (
            <>
              {!s && nivelVisivel && (recebidoNaLista(inds, k)?.valor ?? i.valorInicial) !== null && i.valorFinal !== null && (
                <span className="block">
                  De {nivelDe(recebidoNaLista(inds, k)?.valor ?? i.valorInicial!, i.unidade, ui.simbolo)} a {nivelDe(i.valorFinal, i.unidade, ui.simbolo)}
                </span>
              )}
              {i.cobertura === "parcial" && i.fracaoMandatoCoberta !== null && (
                <span className="block">Dado cobre {Math.round(i.fracaoMandatoCoberta * 100)}% do mandato</span>
              )}
              {i.cobertura === "indisponivel" && <span className="block">{i.ressalva ?? "Sem dado nesta série para o mandato"}</span>}
            </>
          ) : (
            "Sem dado nesta série para o mandato"
          ),
        })),
      }),
    ];
  });
  // Contra o mundo não há "o que recebeu": verde é o Brasil melhor que a
  // média mundial no mandato, vermelho, pior.
  const doMundo = MUNDO.map((ind) =>
    comPosicao({
      id: ind.id,
      grupo: "Contra o mundo (World Bank)",
      rotulo: `${ind.rotulo}: Brasil − mundo`,
      unidade: "pts",
      unidadeRitmo: "pontos, média anual",
      direcao: ind.direcao,
      celulas: ordem.map((m) => {
        const b = benchmark[m.id]?.filter((x) => x.indicadorWb === ind.id) ?? [];
        const media = (r: string) => b.find((x) => x.regiao === r)?.mediaPeriodo ?? null;
        const brasil = media("BRA");
        const mundo = media("WLD");
        const anos = b[0]?.nAnos ?? 0;
        const v = brasil !== null && mundo !== null ? Math.round((brasil - mundo) * 10) / 10 : null;
        return {
          texto: v === null ? null : v === 0 ? "igual" : `${comSinal(v, 1)} pts`,
          sentido: v === null ? "neutro" : sentido(v, ind.direcao),
          leitura: v === null ? null : `${v === 0 ? "Igual à" : sentido(v, ind.direcao) === "bom" ? "Melhor que a" : "Pior que a"} média mundial no mandato.`,
          ritmo: v,
          parcial: m.emCurso,
          detalhe: (
            <>
              {REGIOES.map(([r, nome]) => (
                <span key={r} className="flex justify-between gap-3">
                  <span>{nome}</span>
                  <span className="tabular font-semibold">{media(r) === null ? "—" : `${numero(media(r), 1)}%`}</span>
                </span>
              ))}
              <span className="mt-1 block">
                Média de {anos} {anos === 1 ? "ano" : "anos"}
              </span>
            </>
          ),
        };
      }),
    }),
  );
  return [...daSerie, ...doMundo];
}

