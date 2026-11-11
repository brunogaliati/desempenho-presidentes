import { comSinal, numero, sentido as sentidoDe, type Sentido } from "@/lib/formatar";
import type { Direcao } from "@/types/dados";
import type { DadosRedeSaude } from "@/lib/redeSaudeModelo";

import { populacaoNoAno } from "./dinheiroModelo";
import type { DadosPainel, FocoMandato, Leitura } from "./tipos";

/**
 * O resumo de um governo: tudo o que o site tem dele numa tela, separando o que é
 * responsabilidade direta do governo do que só acontece no território dele.
 *
 * Toda linha usa a régua do placar: o último dado do mandato contra o que ele
 * recebeu (o último antes da posse). Num estado, cada linha traz também o Brasil
 * no mesmo período: se o estado anda junto com o país, a mudança dificilmente é
 * só do estado. Mudança durante um governo não prova que ele a causou.
 */

// --- O que vem da API -----------------------------------------------------------

export type EventoId = "homicidio" | "latrocinio" | "roubo_veiculo" | "letalidade" | "feminicidio";

/** Eventos do Sinesp, abrangência estadual: as polícias são do estado. */
export const EVENTOS: { id: EventoId; fonte: string; nome: string; medida: "vitima" | "ocorrencia"; unidade: string }[] = [
  { id: "homicidio", fonte: "Homicídio doloso", nome: "Homicídio doloso", medida: "vitima", unidade: "vítimas" },
  { id: "latrocinio", fonte: "Roubo seguido de morte (latrocínio)", nome: "Latrocínio", medida: "vitima", unidade: "vítimas" },
  { id: "roubo_veiculo", fonte: "Roubo de veículo", nome: "Roubo de veículo", medida: "ocorrencia", unidade: "ocorrências" },
  { id: "letalidade", fonte: "Morte por intervenção de Agente do Estado", nome: "Mortes por intervenção policial", medida: "vitima", unidade: "vítimas" },
  { id: "feminicidio", fonte: "Feminicídio", nome: "Feminicídio", medida: "vitima", unidade: "vítimas" },
];

export type EtapaId = "ensino_medio" | "anos_finais";
export const ETAPAS: { id: EtapaId; nome: string }[] = [
  { id: "ensino_medio", nome: "Ensino médio" },
  { id: "anos_finais", nome: "Anos finais do fundamental" },
];

export type CargoId = "estadual" | "federal" | "senador" | "prefeito";

export interface Eleicao {
  ano: number;
  cargo: CargoId;
  /** Sigla e quantos eleitos, do maior para o menor. */
  partidos: [string, number][];
  total: number;
}

export interface DadosResumo {
  /** "BR" ou a sigla da UF. */
  territorio: string;
  seguranca: {
    meses: string[];
    local: Record<EventoId, (number | null)[]>;
    brasil: Record<EventoId, (number | null)[]>;
    coletadoEm: string | null;
  };
  populacao: { local: Record<string, number>; brasil: Record<string, number> };
  ideb: {
    /** A rede do território: a estadual num estado, a pública no Brasil. */
    rede: string;
    anos: number[];
    etapas: { id: EtapaId; local: (number | null)[]; brasil: (number | null)[]; posicao: (number | null)[]; total: (number | null)[] }[];
    coletadoEm: string | null;
  };
  eleicoes: Eleicao[];
  senado: Eleicao | null;
  senadoSuplementares: string[];
  saude: { meses: string[]; valores: (number | null)[]; coletadoEm: string | null };
  rede: DadosRedeSaude;
  coletadoEm: string | null;
}

// --- Linhas --------------------------------------------------------------------

export type Comparacao = "melhor" | "igual" | "pior";

export interface SerieGrafico {
  rotulo: string;
  datas: string[];
  valores: (number | null)[];
  principal: boolean;
}

export interface GraficoResumo {
  series: SerieGrafico[];
  /** Casas decimais e sufixo do eixo. */
  casas: number;
  sufixo: string;
  titulo: string;
  /** Pontos soltos (Ideb a cada dois anos) em vez de linha contínua por mês. */
  pontos?: boolean;
}

export interface LinhaResumo {
  id: string;
  nome: string;
  detalhe: string;
  de: string | null;
  para: string | null;
  mudanca: string | null;
  sentido: Sentido;
  /** A mudança do Brasil no mesmo período, já escrita. */
  brasil: string | null;
  comparacao: Comparacao | null;
  periodo: string;
  fonte: string;
  urlFonte?: string;
  nota?: string;
  /** Por que não há comparação, quando não há. */
  falta?: string;
  grafico: GraficoResumo | null;
  /** Para onde levar quem quiser o histórico inteiro. */
  aba?: "economia" | "ambiente" | "dinheiro";
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const mesAno = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;

export function somarMeses(mes: string, n: number): string {
  const t = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Soma de 12 meses que terminam em `fim`; falta um mês, falta a soma. */
function soma12(meses: string[], valores: (number | null)[] | undefined, fim: string): number | null {
  const i = meses.indexOf(fim);
  if (!valores || i < 11) return null;
  let s = 0;
  for (let k = i - 11; k <= i; k++) {
    const v = valores[k];
    if (v === null || v === undefined) return null;
    s += v;
  }
  return s;
}

function ultimoComDado(meses: string[], valores: (number | null)[] | undefined): string | null {
  if (!valores) return null;
  for (let i = valores.length - 1; i >= 0; i--) if (valores[i] !== null && valores[i] !== undefined) return meses[i];
  return null;
}

/** "41,7 mil", "2.118", "95". */
export function contagem(v: number): string {
  if (Math.abs(v) >= 10000) return `${numero(v / 1000, 1)} mil`;
  return numero(v, 0);
}

const pct = (de: number, para: number) => Math.round(((para - de) / de) * 100);
const pctTexto = (p: number) => (p === 0 ? "0%" : `${comSinal(p, 0).replace("-", "−")}%`);
const ptsTexto = (p: number, casas = 1) => (p === 0 ? "igual" : `${comSinal(p, casas).replace("-", "−")} pts`);
const decTexto = (p: number) => (p === 0 ? "igual" : comSinal(p, 1).replace("-", "−"));

/**
 * O estado contra o Brasil, na mesma unidade. Diferença pequena (até `limiar`)
 * conta como igual; acima disso, o lado bom da medida decide.
 */
export function compararComBrasil(local: number, brasil: number, direcao: Direcao, limiar: number): Comparacao | null {
  if (direcao === "neutro") return null;
  const d = Math.round((local - brasil) * 100) / 100;
  if (Math.abs(d) <= limiar) return "igual";
  return sentidoDe(d, direcao) === "bom" ? "melhor" : "pior";
}

/** O último mês que conta para o mandato: o anterior à próxima posse, ou o último dado. */
const limiteDoMandato = (foco: FocoMandato) => (foco.ate ? somarMeses(foco.ate, -1) : "9999-12");

function janelaTexto(fim: string) {
  return fim.endsWith("-12") ? fim.slice(0, 4) : `12 meses até ${mesAno(fim)}`;
}

/**
 * Segurança: 12 meses do mandato contra os 12 meses antes da posse. A janela do
 * mandato precisa caber inteira nele: com menos de um ano de governo, ela ainda
 * mediria o anterior.
 */
export function linhasSeguranca(d: DadosResumo, foco: FocoMandato, comBrasil: boolean): LinhaResumo[] {
  const { meses } = d.seguranca;
  const fimRecebido = somarMeses(foco.posse, -1);
  const primeiroFim = somarMeses(foco.posse, 11);
  return EVENTOS.map((e) => {
    const local = d.seguranca.local[e.id];
    const br = d.seguranca.brasil[e.id];
    const ultimo = ultimoComDado(meses, local);
    const limite = limiteDoMandato(foco);
    const fim = ultimo && ultimo < limite ? ultimo : limite;
    const de = soma12(meses, local, fimRecebido);
    const para = fim >= primeiroFim ? soma12(meses, local, fim) : null;
    const base: LinhaResumo = {
      id: `seg-${e.id}`,
      nome: e.nome,
      detalhe: `${e.unidade} em 12 meses`,
      de: null,
      para: null,
      mudanca: null,
      sentido: "neutro",
      brasil: null,
      comparacao: null,
      periodo: "",
      fonte: "Sinesp, Ministério da Justiça · polícias estaduais",
      grafico: graficoSeguranca(d, e.id, comBrasil),
    };
    if (de === null || para === null || de === 0) {
      return {
        ...base,
        falta: de === null
          ? meses[0] && fimRecebido < somarMeses(meses[0], 11) ? `O Sinesp começa em ${mesAno(meses[0])}: não há os 12 meses antes da posse.` : "Falta mês na série antes da posse."
          : "Ainda não há 12 meses inteiros deste governo.",
        para: para !== null ? contagem(para) : null,
      };
    }
    const p = pct(de, para);
    const linha: LinhaResumo = {
      ...base,
      de: contagem(de),
      para: contagem(para),
      mudanca: pctTexto(p),
      sentido: sentidoDe(p, "menor_melhor"),
      periodo: `${janelaTexto(fim)} contra ${janelaTexto(fimRecebido)}`,
    };
    if (comBrasil) {
      const bDe = soma12(meses, br, fimRecebido);
      const bPara = soma12(meses, br, fim);
      if (bDe && bPara !== null) {
        const bp = pct(bDe, bPara);
        linha.brasil = `Brasil ${pctTexto(bp)}`;
        linha.comparacao = compararComBrasil(p, bp, "menor_melhor", 5);
      }
    }
    return linha;
  });
}

/** Taxa por 100 mil habitantes em 12 meses: estado e Brasil na mesma escala. */
function graficoSeguranca(d: DadosResumo, id: EventoId, comBrasil: boolean): GraficoResumo {
  const { meses } = d.seguranca;
  const taxa = (valores: (number | null)[] | undefined, pop: Record<string, number>) =>
    meses.map((m) => {
      const s = soma12(meses, valores, m);
      const p = populacaoNoAno(pop, Number(m.slice(0, 4)));
      return s === null || !p ? null : (s / p) * 1e5;
    });
  const series: SerieGrafico[] = [
    { rotulo: d.territorio === "BR" ? "Brasil" : d.territorio, datas: meses, valores: taxa(d.seguranca.local[id], d.populacao.local), principal: true },
  ];
  if (comBrasil) series.push({ rotulo: "Brasil", datas: meses, valores: taxa(d.seguranca.brasil[id], d.populacao.brasil), principal: false });
  const max = Math.max(...series.flatMap((s) => s.valores.filter((v): v is number => v !== null)), 0);
  return { series, casas: max < 10 ? 1 : 0, sufixo: "", titulo: "por 100 mil habitantes, em 12 meses" };
}

/** Ideb: a última edição antes da posse contra a última dentro do mandato. */
export function linhasIdeb(d: DadosResumo, foco: FocoMandato, comBrasil: boolean): LinhaResumo[] {
  const anoPosse = Number(foco.posse.slice(0, 4));
  const anoFim = Number(foco.fim.slice(0, 4));
  const { anos } = d.ideb;
  return ETAPAS.map((etapa) => {
    const e = d.ideb.etapas.find((x) => x.id === etapa.id);
    const base: LinhaResumo = {
      id: `ideb-${etapa.id}`,
      nome: etapa.nome,
      detalhe: comBrasil ? "Ideb · posição entre as 27 redes" : `Ideb · rede ${d.ideb.rede.toLowerCase()}`,
      de: null,
      para: null,
      mudanca: null,
      sentido: "neutro",
      brasil: null,
      comparacao: null,
      periodo: "",
      fonte: `Inep, Ideb · rede ${d.ideb.rede.toLowerCase()}`,
      grafico: null,
    };
    if (!e) return { ...base, falta: "Sem Ideb para esta etapa." };
    const iDe = anos.map((a, i) => (a < anoPosse && e.local[i] !== null ? i : -1)).filter((i) => i >= 0).at(-1);
    const iPara = anos.map((a, i) => (a >= anoPosse && a <= anoFim && e.local[i] !== null ? i : -1)).filter((i) => i >= 0).at(-1);
    const series: SerieGrafico[] = [{ rotulo: d.territorio === "BR" ? "Brasil" : d.territorio, datas: anos.map((a) => `${a}-11`), valores: e.local, principal: true }];
    if (comBrasil) series.push({ rotulo: "Brasil", datas: anos.map((a) => `${a}-11`), valores: e.brasil, principal: false });
    base.grafico = { series, casas: 1, sufixo: "", titulo: "Ideb, de 0 a 10", pontos: true };
    if (iDe === undefined || iPara === undefined) {
      return { ...base, falta: iPara === undefined ? "O Ideb sai a cada dois anos: ainda não há edição deste governo." : "Não há edição antes da posse." };
    }
    const de = e.local[iDe]!;
    const para = e.local[iPara]!;
    const posicao = (i: number) => (comBrasil && e.posicao[i] ? ` · ${e.posicao[i]}º` : "");
    const dif = Math.round((para - de) * 10) / 10;
    const linha: LinhaResumo = {
      ...base,
      de: `${numero(de, 1)}${posicao(iDe)}`,
      para: `${numero(para, 1)}${posicao(iPara)}`,
      mudanca: decTexto(dif),
      sentido: sentidoDe(dif, "maior_melhor"),
      periodo: `${anos[iPara]} contra ${anos[iDe]}`,
    };
    if (comBrasil) {
      const bDe = e.brasil[iDe];
      const bPara = e.brasil[iPara];
      if (bDe !== null && bPara !== null) {
        const bd = Math.round((bPara - bDe) * 10) / 10;
        linha.brasil = `Brasil ${decTexto(bd)}`;
        linha.comparacao = compararComBrasil(dif, bd, "maior_melhor", 0.1);
      }
    }
    return linha;
  });
}

/** Um código de período da leitura como mês, para o gráfico: trimestre no último mês dele. */
function mesDoPeriodo(codigo: string): string {
  if (/^\d{6}$/.test(codigo)) return `${codigo.slice(0, 4)}-${String(Number(codigo.slice(4)) * 3).padStart(2, "0")}`;
  if (/^\d{4}-\d{2}$/.test(codigo)) return codigo;
  if (/^\d{4}$/.test(codigo)) return `${codigo}-07`;
  return codigo;
}

const emPontos = (l: Leitura) => l.formato === "pct0" || l.formato === "pct1" || l.formato === "pct2";

/**
 * As medidas do mapa (economia e meio ambiente) no recorte do mandato: o
 * `recortarAoMandato` já deixou `indiceRecebido` e o fim da série no lugar.
 */
export function linhasDasLeituras(
  dados: DadosPainel,
  ids: { id: string; aba: "economia" | "ambiente"; nome?: string }[],
  codigoUf: string | null,
  formatar: (v: number, l: Leitura) => string,
  /** O nome do território no gráfico: a sigla da UF. */
  rotuloLocal = codigoUf ? "Estado" : "Brasil",
): LinhaResumo[] {
  return ids.flatMap(({ id, aba, nome }) => {
    const l = dados.leituras[aba]?.find((x) => x.id === id);
    if (!l) return [];
    const serie = codigoUf ? l.ufs[codigoUf] : l.brasil;
    const r = l.indiceRecebido;
    const direcao = l.direcao ?? "neutro";
    const datas = l.periodos.map((p) => mesDoPeriodo(p.codigo));
    const series: SerieGrafico[] = [{ rotulo: rotuloLocal, datas, valores: serie ?? [], principal: true }];
    if (codigoUf) series.push({ rotulo: "Brasil", datas, valores: l.brasil, principal: false });
    const pontos = emPontos(l);
    const base: LinhaResumo = {
      id: `${aba}-${l.id}`,
      nome: nome ?? l.titulo,
      detalhe: l.periodos.at(-1)?.extenso ?? "",
      de: null,
      para: null,
      mudanca: null,
      sentido: "neutro",
      brasil: null,
      comparacao: null,
      periodo: "",
      fonte: l.fonte,
      aba,
      // Taxas em % ficam na mesma escala do Brasil; contagens e áreas, não.
      grafico: { series: pontos ? series : series.slice(0, 1), casas: pontos ? 1 : 0, sufixo: pontos ? "%" : "", titulo: l.descricao },
    };
    let ult = -1;
    if (serie) for (let i = serie.length - 1; i >= 0; i--) if (serie[i] !== null && serie[i] !== undefined) { ult = i; break; }
    if (ult < 0) return [{ ...base, falta: "Sem dado neste período." }];
    const para = serie![ult]!;
    base.para = formatar(para, l);
    base.detalhe = l.periodos[ult].extenso;
    if (r === null || ult <= r || serie![r] === null || serie![r] === undefined) {
      return [{ ...base, falta: "Sem dado de antes da posse para comparar." }];
    }
    const de = serie![r]!;
    const mudanca = pontos ? Math.round((para - de) * 10) / 10 : de ? pct(de, para) : null;
    if (mudanca === null) return [{ ...base, falta: "Sem base para comparar." }];
    const linha: LinhaResumo = {
      ...base,
      de: formatar(de, l),
      mudanca: pontos ? ptsTexto(mudanca) : pctTexto(mudanca),
      sentido: sentidoDe(mudanca, direcao),
      periodo: `${l.periodos[ult].extenso} contra ${l.periodos[r].extenso}`,
    };
    if (codigoUf) {
      const bDe = l.brasil[r];
      const bPara = l.brasil[ult];
      if (bDe !== null && bDe !== undefined && bPara !== null && bPara !== undefined && (pontos || bDe)) {
        const bm = pontos ? Math.round((bPara - bDe) * 10) / 10 : pct(bDe, bPara);
        linha.brasil = `Brasil ${pontos ? ptsTexto(bm) : pctTexto(bm)}`;
        linha.comparacao = compararComBrasil(mudanca, bm, direcao, pontos ? 0.5 : 5);
      }
    }
    return [linha];
  });
}

/** Quantas melhoraram, pioraram e, no estado, como ficaram contra o Brasil. */
export function contarLinhas(linhas: Pick<LinhaResumo, "sentido" | "comparacao" | "mudanca">[]) {
  const julgadas = linhas.filter((l) => l.mudanca !== null);
  return {
    bons: julgadas.filter((l) => l.sentido === "bom").length,
    ruins: julgadas.filter((l) => l.sentido === "ruim").length,
    iguais: julgadas.filter((l) => l.sentido === "neutro").length,
    melhor: julgadas.filter((l) => l.comparacao === "melhor").length,
    igual: julgadas.filter((l) => l.comparacao === "igual").length,
    pior: julgadas.filter((l) => l.comparacao === "pior").length,
  };
}

// --- Política ------------------------------------------------------------------

/** A eleição geral que escolheu o Congresso e as assembleias em exercício na posse. */
export function eleicaoGeralAntes(posse: string): number {
  let ano = Number(posse.slice(0, 4));
  if (posse.slice(5, 7) <= "10") ano -= 1;
  while ((ano - 1994) % 4 !== 0) ano -= 1;
  return ano;
}

/** Eleições de outubro que caem dentro do mandato, gerais ou municipais. */
export function eleicoesNoMandato(foco: FocoMandato, municipal: boolean): number[] {
  const anos: number[] = [];
  // O mandato em curso termina no último dia dele, não no infinito: a eleição do fim dele ainda conta.
  const ate = foco.ate ?? foco.fim.slice(0, 7);
  for (let a = Number(foco.posse.slice(0, 4)); a <= Number(ate.slice(0, 4)); a++) {
    const resto = municipal ? (a - 1996) % 4 : (a - 1994) % 4;
    if (resto === 0 && `${a}-10` >= foco.posse && `${a}-10` < ate) anos.push(a);
  }
  return anos;
}

/** Cadeiras na Câmara por UF desde 1994; a assembleia segue a regra da Constituição (art. 27). */
const CAMARA: Record<string, number> = {
  SP: 70, MG: 53, RJ: 46, BA: 39, RS: 31, PR: 30, PE: 25, CE: 22, MA: 18, GO: 17, PA: 17, SC: 16, PB: 12, ES: 10, PI: 10, AL: 9,
  AC: 8, AM: 8, AP: 8, DF: 8, MS: 8, MT: 8, RN: 8, RO: 8, RR: 8, SE: 8, TO: 8,
};

export function cadeiras(cargo: CargoId, uf: string | null): number | null {
  if (cargo === "prefeito") return null;
  if (!uf) return cargo === "federal" ? 513 : cargo === "senador" ? 81 : null;
  const f = CAMARA[uf];
  if (!f) return null;
  if (cargo === "federal") return f;
  if (cargo === "senador") return 3;
  if (uf === "DF") return 24;
  return f <= 12 ? f * 3 : 36 + (f - 12);
}

/** Junta eleições (as duas do Senado) somando as cadeiras por partido. */
export function juntarEleicoes(lista: Eleicao[]): Eleicao | null {
  if (!lista.length) return null;
  const soma = new Map<string, number>();
  for (const e of lista) for (const [s, n] of e.partidos) soma.set(s, (soma.get(s) ?? 0) + n);
  return {
    ano: lista[0].ano,
    cargo: lista[0].cargo,
    partidos: [...soma.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    total: lista.reduce((s, e) => s + e.total, 0),
  };
}
