import { comSinal, numero, sentido, type Sentido } from "@/lib/formatar";
import type { Direcao, Indicador } from "@/types/dados";

import { recortar } from "../_dados/economiaModelo";
import type { Expectativa } from "../_dados/panoramaModelo";
import { doisAnosAntes, recebidoNoPainel, ritmoDesdeORecebido, type Recebido } from "../_dados/mandatoRecorte";
import type { DadosPainel, Leitura, SerieEconomia } from "../_dados/tipos";
import { emPercentual, formatar, naReferencia, recebido, ultimoDado } from "./formatos";

/**
 * As contas do placar, sem interface: o cartão de compartilhar, gerado no servidor,
 * pinta com o mesmo veredito da tela. Como ler o placar está em `Placar.tsx`.
 */

/** Um indicador no placar, já com o veredito. */
export interface ItemPlacar {
  /** O id do indicador no banco (`Indicador.serieId`) quando há um; liga ao ritmo do terminal. */
  id: string;
  rotulo: string;
  /** O que mudou desde a posse, no idioma da medida: "-2,6 pts", "+12,5%". */
  mudanca: string;
  /** Onde a medida está agora: "5,3%", "2,5%/ano". */
  agora: string;
  /** A comparação por escrito, para o detalhe. */
  leitura: string;
  sentido: Sentido;
  /** Série para o gráfico do detalhe. */
  serie?: SerieEconomia;
  /** Série diária para o gráfico do detalhe (a bolsa). */
  diaria?: { datas: string[]; valores: (number | null)[] };
  /** O lado bom, para pintar o gráfico do detalhe como o bloco. */
  direcao?: Direcao;
  /** O valor recebido, referência do gráfico diário. */
  recebido?: number;
  /** Hoje dividido pelo recebido, para desenhar a mudança numa escala comum. */
  proporcao?: number;
  /** A série existe no terminal de baixo, que sabe mostrar o histórico dela. */
  nacional: boolean;
  fonte: string;
  fonteUrl: string;
}

export interface GrupoPlacar {
  titulo: string;
  itens: ItemPlacar[];
  /** A cor do tipo de medida, onde o placar a usa (meio ambiente). */
  cor?: string;
  /** Do que é o número: "12 meses", "ano PRODES". */
  detalhe?: string;
}

/** Uma fileira de células embaixo dos grupos: não entra na contagem. */
export interface FileiraPlacar {
  titulo: string;
  detalhe: string;
  itens: ItemPlacar[];
  /** A frase de cada célula para leitor de tela. */
  rotular: (x: ItemPlacar) => string;
  cor?: string;
}

export const POSSE = "2023-01";

/** De `de` para `para`, arredondado como aparece: pontos para taxas, % para valores. */
function variacao(de: number, para: number, emPct: boolean): number {
  return Math.round((emPct ? ((para - de) / de) * 100 : para - de) * 10) / 10;
}

const textoVariacao = (v: number, emPct: boolean) => (v === 0 ? "igual" : `${comSinal(v, 1)}${emPct ? "%" : " pts"}`);
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Uma série nacional: o último dado contra o último antes da posse. */
export function itemDaSerie(
  id: string,
  rotulo: string,
  s: SerieEconomia | undefined,
  nacional: boolean,
  direcao?: Direcao,
): ItemPlacar | null {
  const agora = s ? ultimoDado(s) : null;
  const antes = s ? recebido(s) : null;
  if (!s || !agora || !antes) return null;
  const emPct = emPercentual(s.formato);
  const v = variacao(antes.valor, agora.valor, emPct);
  return {
    id,
    rotulo,
    mudanca: textoVariacao(v, emPct),
    agora: formatar(agora.valor, s.formato),
    leitura: `Recebeu ${formatar(antes.valor, s.formato)} ${naReferencia(s, antes.data)}. ${maiuscula(naReferencia(s, agora.data))}, ${formatar(agora.valor, s.formato)}.`,
    sentido: sentido(v, direcao ?? s.direcao),
    serie: s,
    direcao: direcao ?? s.direcao,
    proporcao: antes.valor ? agora.valor / antes.valor : undefined,
    nacional,
    fonte: s.fonte,
    fonteUrl: s.fonteUrl,
  };
}

/** Uma medida do mapa, no agregado do Brasil: o período recebido contra o último. */
function daLeitura(rotulo: string, l: Leitura | undefined): ItemPlacar | null {
  if (!l || l.indiceRecebido === null) return null;
  const r = l.indiceRecebido;
  const p = l.brasil.findLastIndex((v) => v !== null);
  const de = l.brasil[r];
  const para = l.brasil[p];
  if (de == null || para == null || p <= r) return null;
  const v = variacao(de, para, false);
  return {
    id: l.id,
    rotulo,
    mudanca: textoVariacao(v, false),
    agora: formatar(para, l.formato),
    leitura: `Recebeu ${formatar(de, l.formato)} no ${l.periodos[r].extenso}. No ${l.periodos[p].extenso}, ${formatar(para, l.formato)}.`,
    sentido: sentido(v, l.direcao ?? "neutro"),
    nacional: false,
    fonte: l.fonte,
    fonteUrl: l.fonteUrl ?? "",
  };
}

/** Quando o indicador do mandato termina: "2024", "set/2026", "2º tri/2026". */
function quando(d: string, passo: "ano" | "mes" | "tri"): string {
  if (passo === "ano") return d.slice(0, 4);
  const m = Number(d.slice(5, 7));
  if (passo === "tri") return `${Math.ceil(m / 3)}º tri/${d.slice(0, 4)}`;
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][m - 1]}/${d.slice(0, 4)}`;
}

/** Um nível do mandato (pobreza, Gini, dívida líquida): o último dado do governo anterior contra o último deste. */
function doNivel(
  ind: Indicador | undefined,
  rotulo: string,
  casas: number,
  sufixo: string,
  passo: "ano" | "mes",
  recebeu: Recebido | null,
): ItemPlacar | null {
  // Medida que começa neste governo parte do primeiro dado dele, e o texto diz isso.
  const de = recebeu?.valor ?? ind?.herdadoValor ?? null;
  if (!ind || de === null || ind.valorFinal === null) return null;
  const v = variacao(de, ind.valorFinal, false);
  const valor = (x: number) => `${numero(x, casas)}${sufixo}`;
  return {
    id: ind.serieId,
    rotulo,
    mudanca: textoVariacao(v, false),
    agora: valor(ind.valorFinal),
    leitura: `${recebeu ? `Recebeu ${valor(de)} em ${quando(recebeu.data, passo)}` : `No primeiro dado do mandato, ${valor(de)}`}. Em ${quando(ind.dataFim ?? "", passo)}, ${valor(ind.valorFinal)}.`,
    sentido: sentido(v, ind.direcao),
    nacional: false,
    fonte: ind.fonteNome,
    fonteUrl: ind.fonteUrl,
  };
}

/**
 * PIB e renda: quanto cresceram desde a posse. A taxa do trimestre contra a
 * de dezembro de 2022 diria só se cresceram mais ou menos depressa, e "-7,9
 * pts" se lia como "a renda caiu".
 */
function doCrescimento(
  ind: Indicador | undefined,
  rotulo: string,
  passo: "mes" | "tri",
  serie: SerieEconomia | undefined,
  recebeu: Recebido | null,
): ItemPlacar | null {
  const de = recebeu?.valor ?? ind?.herdadoValor ?? null;
  const ritmo = ind ? (ritmoDesdeORecebido(recebeu, ind)?.v ?? ind.variacaoAnualizada) : null;
  if (!ind || de === null || ind.valorFinal === null || ritmo === null) return null;
  const v = variacao(de, ind.valorFinal, true);
  const porAno = `${numero(ritmo, 1)}%/ano`;
  const antes = ind.tendenciaPrevia === null ? "" : ` Nos dois anos antes da posse, ${numero(ind.tendenciaPrevia, 1)}% ao ano.`;
  return {
    id: ind.serieId,
    rotulo,
    mudanca: textoVariacao(v, true),
    agora: porAno,
    leitura: `${v >= 0 ? "Cresceu" : "Encolheu"} ${numero(Math.abs(v), 1)}% ${recebeu ? "da posse" : "do primeiro dado do mandato"} até ${quando(ind.dataFim ?? "", passo)}, ${numero(ritmo, 1)}% ao ano.${antes}`,
    sentido: sentido(v, ind.direcao),
    serie: serie && ultimoDado(serie) ? serie : undefined,
    direcao: ind.direcao,
    nacional: Boolean(serie && ultimoDado(serie)),
    fonte: ind.fonteNome,
    fonteUrl: ind.fonteUrl,
  };
}

/** O Ibovespa no último pregão contra o último antes da posse. */
function daBolsa(dados: DadosPainel): ItemPlacar | null {
  const b = dados.economia.complemento.ibovespa;
  if (!b) return null;
  const posse = b.posse ?? POSSE;
  const p = b.valores.findLastIndex((v) => v !== null);
  let r = -1;
  for (let i = b.datas.length - 1; i >= 0; i--) {
    if (b.datas[i] < `${posse}-01` && b.valores[i] !== null) {
      r = i;
      break;
    }
  }
  if (p < 0 || r < 0) return null;
  const de = b.valores[r]!;
  const para = b.valores[p]!;
  const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  return {
    id: "ibovespa",
    rotulo: "Ibovespa",
    mudanca: textoVariacao(variacao(de, para, true), true),
    agora: `${numero(para / 1000, 0)} mil`,
    leitura: `Fechou ${numero(de, 0)} pontos em ${dia(b.datas[r])}. Em ${dia(b.datas[p])}, ${numero(para, 0)}. Em pontos, sem descontar a inflação do período.`,
    sentido: sentido(variacao(de, para, true), "maior_melhor"),
    diaria: recortar(b, `${doisAnosAntes(posse)}-01`, b.datas[p]),
    // A série mensal do terminal: tocar no bloco põe a bolsa no gráfico de baixo.
    serie: dados.economia.series.find((x) => x.id === "ibovespa"),
    direcao: "maior_melhor",
    recebido: de,
    nacional: dados.economia.series.some((x) => x.id === "ibovespa"),
    fonte: "B3",
    fonteUrl: "https://sistemaswebb3-listados.b3.com.br/indexStatisticsPage/average/IBOVESPA?language=pt-br",
  };
}

/** As perguntas do Focus que o site mostra, com o lado bom de cada uma. Também usadas no terminal. */
export const FOCUS: { indicador: string; rotulo: string; direcao: Direcao; reais: boolean; o: string }[] = [
  { indicador: "PIB Total", rotulo: "PIB", direcao: "maior_melhor", reais: false, o: "crescimento do PIB no ano" },
  { indicador: "IPCA", rotulo: "Inflação", direcao: "menor_melhor", reais: false, o: "inflação no ano" },
  { indicador: "Selic", rotulo: "Selic", direcao: "neutro", reais: false, o: "meta Selic no fim do ano" },
  { indicador: "Câmbio", rotulo: "Dólar", direcao: "menor_melhor", reais: true, o: "dólar, média de dezembro" },
];

/** A revisão de uma mediana do Focus contra a pesquisa de uma semana antes, com a cor do lado bom. */
export function revisaoFocus(p: Expectativa, direcao: Direcao): { texto: string; sentido: Sentido } {
  if (p.anterior === null) return { texto: "—", sentido: "neutro" };
  const r = Math.round((p.mediana - p.anterior) * 100) / 100;
  return { texto: r === 0 ? "igual" : comSinal(r, 2), sentido: sentido(r, direcao) };
}

/**
 * O que o mercado espera para o ano corrente, o último do mandato: a mediana
 * da pesquisa Focus e a revisão contra a pesquisa de pelo menos sete dias
 * antes. Projeção não entra na contagem do placar: não aconteceu.
 */
function expectativas(dados: DadosPainel): { ano: string; itens: ItemPlacar[] } {
  const lista = dados.economia.complemento.expectativas;
  const ano = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date(dados.hoje));
  const dia = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const itens = FOCUS.flatMap((f): ItemPlacar[] => {
    const p = lista.find((x) => x.indicador === f.indicador && x.ano === ano);
    if (!p) return [];
    const valor = (v: number) => (f.reais ? `R$ ${numero(v, 2)}` : `${numero(v, 2)}%`);
    const revisao = revisaoFocus(p, f.direcao);
    const seguintes = lista
      .filter((x) => x.indicador === f.indicador && x.ano > ano)
      .sort((a, b) => a.ano.localeCompare(b.ano))
      .map((x) => `para ${x.ano}, ${valor(x.mediana)}`);
    return [
      {
        id: `focus-${f.indicador}`,
        rotulo: f.rotulo,
        mudanca: revisao.texto,
        agora: valor(p.mediana),
        leitura:
          `Na pesquisa Focus do Banco Central, que ouve bancos e consultorias toda semana, a mediana de ${dia(p.data)} para ${f.o} de ${ano} é ${valor(p.mediana)}.` +
          (p.anterior !== null && p.dataAnterior ? ` Na pesquisa de ${dia(p.dataAnterior)}, ${valor(p.anterior)}.` : "") +
          (seguintes.length ? ` ${maiuscula(seguintes.join("; "))}.` : "") +
          " São projeções dos participantes, sujeitas a revisão.",
        sentido: revisao.sentido,
        nacional: false,
        fonte: "BCB · Focus",
        fonteUrl: "https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado",
      },
    ];
  });
  return { ano, itens };
}

const daSerie = itemDaSerie;

/** O placar inteiro, na ordem da tela. Medida sem dado sai da linha, não vira zero. */
export function placarDoMandato(dados: DadosPainel): {
  grupos: GrupoPlacar[];
  mercado: ItemPlacar[];
  focus: { ano: string; itens: ItemPlacar[] };
} {
  const { series, indicadores, complemento } = dados.economia;
  const serie = (id: string) => series.find((s) => s.id === id);
  const outra = (id: string) => complemento.series.find((s) => s.id === id);
  const ind = (id: string) => indicadores.find((i) => i.serieId === id);
  const recebeu = (id: string) => recebidoNoPainel(dados, id);
  const leitura = (id: string) => dados.leituras.economia.find((l) => l.id === id);

  const grupos: GrupoPlacar[] = [
    {
      titulo: "Bolso",
      itens: [
        daSerie("ipca", "Inflação", serie("inflacao12m"), true),
        daSerie("salario_minimo_real", "Salário mínimo", serie("salario_minimo_real"), true),
      ],
    },
    {
      titulo: "Emprego",
      itens: [daSerie("desemprego", "Desemprego", serie("desemprego"), true), daLeitura("Subutilização", leitura("subutilizacao"))],
    },
    {
      titulo: "Crescimento",
      itens: [
        doCrescimento(ind("pib_volume"), "PIB", "tri", serie("pib"), recebeu("pib_volume")),
        doCrescimento(ind("massa_renda_real"), "Renda do trabalho", "mes", serie("renda"), recebeu("massa_renda_real")),
      ],
    },
    {
      titulo: "Pobreza",
      itens: [doNivel(ind("pobreza"), "Pobreza extrema", 1, "%", "ano", recebeu("pobreza")), doNivel(ind("gini"), "Desigualdade", 1, "", "ano", recebeu("gini"))],
    },
    {
      titulo: "Contas públicas",
      itens: [
        daSerie("divida_bruta_pib", "Dívida bruta", serie("divida_bruta_pib"), true),
        doNivel(ind("divida_liquida_pib"), "Dívida líquida", 1, "%", "mes", recebeu("divida_liquida_pib")),
      ],
    },
    {
      titulo: "Inadimplência",
      itens: [
        daSerie("inadimplencia_familias", "Famílias", outra("credito_pf_inadimplencia"), false, "menor_melhor"),
        daSerie("inadimplencia_empresas", "Empresas", outra("credito_pj_inadimplencia"), false, "menor_melhor"),
      ],
    },
  ]
    .map((g) => ({ titulo: g.titulo, itens: g.itens.filter((x): x is ItemPlacar => x !== null) }))
    .filter((g) => g.itens.length > 0);

  const mercado = [
    daBolsa(dados),
    daSerie("cambio", "Dólar", serie("cambio"), true),
    daSerie("selic", "Selic", serie("selic"), true, "neutro"),
    daSerie("juros_real", "Juros reais", serie("juros_real"), true, "neutro"),
  ].filter((x): x is ItemPlacar => x !== null);

  return { grupos, mercado, focus: expectativas(dados) };
}

export const VEREDITO: Record<Sentido, string> = { bom: "melhor que na posse", ruim: "pior que na posse", neutro: "igual à posse" };

/** Os grupos e as fileiras do mercado e do Focus, para o `Placar` da sala da economia. */
export function placarDaEconomia(dados: DadosPainel): { grupos: GrupoPlacar[]; fileiras: FileiraPlacar[] } {
  const { grupos, mercado, focus } = placarDoMandato(dados);
  return {
    grupos,
    fileiras: [
      {
        titulo: "Mercado",
        detalhe: "desde a posse",
        itens: mercado,
        rotular: (x) => `${x.rotulo}: ${x.agora}, ${x.mudanca} desde a posse${x.sentido !== "neutro" ? `, ${VEREDITO[x.sentido]}` : ""}.`,
      },
      {
        titulo: `O mercado espera para ${focus.ano}`,
        detalhe: "mudança na semana",
        itens: focus.itens,
        rotular: (x) =>
          `${x.rotulo}: o mercado espera ${x.agora} para ${focus.ano}; mudança na semana ${x.mudanca}${x.sentido !== "neutro" ? `, ${x.sentido === "bom" ? "para melhor" : "para pior"}` : ""}.`,
      },
    ],
  };
}
