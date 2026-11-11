import type { DadosResumo, GraficoResumo, LinhaResumo } from "./resumoModelo";
import type { FocoMandato } from "./tipos";
import type { Sentido } from "@/lib/formatar";

export interface EleitosResumo {
  ano: number; uf: string; cargo: string; partido: string; n: number;
  dataSuplementar: string | null;
}

/** O TSE pode substituir o resultado cassado pelo da eleição suplementar.
 * Ela só completa a composição depois de realizada, nunca retroativamente. */
export function senadoresNaPosse<T extends EleitosResumo>(linhas: T[], geral: number, posse: string): T[] {
  return linhas.filter((e) => e.cargo === "senador" && [geral, geral - 4].includes(e.ano)
    && (!e.dataSuplementar || e.dataSuplementar < `${posse}-01`));
}

/** A régua do placar, sem importar `formatar`: o teste roda este arquivo direto no Node. */
const sentido = (v: number | null, maiorMelhor: boolean): Sentido => (v === null || v === 0 ? "neutro" : (v > 0) === maiorMelhor ? "bom" : "ruim");
const numero = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function marcasGraficoResumo(min: number, max: number, n = 3): number[] {
  const bruto = (max - min) / n || 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const lista: number[] = [];
  const teto = Math.ceil(max / passo) * passo;
  for (let v = Math.floor(min / passo) * passo; v <= teto + passo * 0.001; v += passo) lista.push(Math.round(v * 1e6) / 1e6);
  return lista;
}

export function linhasSaude(d: DadosResumo, foco: FocoMandato): LinhaResumo[] {
  const s = d.saude;
  const limite = foco.ate ?? foco.fim.slice(0, 7);
  const antes = s.meses.findLastIndex((m, i) => m < foco.posse && s.valores[i] !== null);
  const depois = s.meses.findLastIndex((m, i) => m >= foco.posse && (foco.ate ? m < limite : m <= limite) && s.valores[i] !== null);
  const de = antes >= 0 ? s.valores[antes] : null;
  const para = depois >= 0 ? s.valores[depois] : null;
  return [{
    id: "saude-mais-medicos", nome: "Mais Médicos", detalhe: "vagas ocupadas · provimento federal",
    de: de === null ? null : numero(de), para: para === null ? null : numero(para),
    mudanca: de !== null && para !== null ? `${para - de > 0 ? "+" : ""}${numero(para - de)} vagas` : null,
    sentido: sentido(de !== null && para !== null ? para - de : null, true), brasil: null, comparacao: null,
    periodo: depois >= 0 ? `${s.meses[depois]}${antes >= 0 ? ` contra ${s.meses[antes]}` : ""}` : "",
    falta: para === null ? "Sem dado válido neste mandato." : de === null ? "Sem dado válido antes da posse." : undefined,
    fonte: "Ministério da Saúde · DEMAS", urlFonte: "https://dadosabertos.saude.gov.br/dataset/provimento-federal-programa-mais-medicos",
    nota: "Estoque de vagas ocupadas na referência publicada, não médicos únicos. Não somamos meses. Registros com negativos, repetições ou divergências ficam sem valor. Mudanças nos perfis do programa limitam a comparação; a cor diz só se as vagas ocupadas subiram ou caíram; mais vagas não demonstram melhora do atendimento. Não mede hospitais, regulação ou filas do SUS.",
    grafico: { series: [{ rotulo: d.territorio, datas: s.meses, valores: s.valores, principal: true }], casas: 0, sufixo: "", titulo: "Vagas ocupadas por competência" },
  }];
}

export interface PeriodoFiscal { ano: number; quadrimestre: number }
export interface LinhaRGF {
  exercicio: number; periodo: number; periodicidade: string; cod_ibge: number; co_poder: string;
  anexo: string; cod_conta: string; coluna: string; valor: number | null;
}
export interface PontoFiscal extends PeriodoFiscal { pessoal: number | null; divida: number | null }
export interface DadosFiscais {
  recebido: PontoFiscal | null; atual: PontoFiscal | null; consultadoEm: string;
  /** Série do gráfico; null quando o Tesouro não respondeu (os números de/para seguem valendo). */
  serie?: PontoSerieFiscal[] | null;
}
/** Um ponto do gráfico: fim do quadrimestre ("2024-08"). A despesa com pessoal só vem no fim do ano e no último quadrimestre. */
export interface PontoSerieFiscal { mes: string; divida: number | null; pessoal: number | null }

/** Limites para o Executivo estadual: dívida (Resolução do Senado 40/2001) e pessoal (LRF, art. 20). */
const LIMITE_FISCAL = { divida: 200, pessoal: 49 } as const;

/**
 * A dívida de cada quadrimestre do ano, lida do relatório mais novo do ano (Anexo 02), e o
 * saldo do fim do ano anterior. Só valores únicos e numéricos, como em `normalizarRGF`.
 */
export function pontosDaDivida(linhas: LinhaRGF[], codigo: number, p: PeriodoFiscal): [string, number][] {
  const limpar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const da = linhas.filter((l) => l.cod_ibge === codigo && l.exercicio === p.ano && l.periodo === p.quadrimestre
    && l.periodicidade === "Q" && l.co_poder === "E" && l.anexo === "RGF-Anexo 02" && l.cod_conta === "PercentualDaDCLSobreARCL");
  const unico = (coluna: string) => {
    const xs = da.filter((l) => limpar(l.coluna) === coluna);
    return xs.length === 1 && typeof xs[0].valor === "number" && Number.isFinite(xs[0].valor) ? xs[0].valor : null;
  };
  const saida: [string, number][] = [];
  const anterior = unico("saldo do exercicio anterior");
  if (anterior !== null) saida.push([`${p.ano - 1}-12`, anterior]);
  for (let q = 1; q <= p.quadrimestre; q++) {
    const v = unico(`ate o ${q}º quadrimestre`);
    if (v !== null) saida.push([`${p.ano}-${String(q * 4).padStart(2, "0")}`, v]);
  }
  return saida;
}

/** Último quadrimestre inteiramente encerrado antes deste mês. */
export function quadrimestreAntes(mes: string): PeriodoFiscal {
  const ano = Number(mes.slice(0, 4)), q = Math.floor((Number(mes.slice(5, 7)) - 1) / 4);
  return q ? { ano, quadrimestre: q } : { ano: ano - 1, quadrimestre: 3 };
}

/** Seleção por código e coluna; não confunde reais, percentuais, limites e anos anteriores. */
export function normalizarRGF(linhas: LinhaRGF[], codigo: number, p: PeriodoFiscal): PontoFiscal {
  const base = linhas.filter((l) => l.cod_ibge === codigo && l.exercicio === p.ano
    && l.periodo === p.quadrimestre && l.periodicidade === "Q" && l.co_poder === "E");
  const unico = (anexo: string, conta: string, coluna: (c: string) => boolean) => {
    const xs = base.filter((l) => l.anexo === anexo && l.cod_conta === conta && coluna(l.coluna));
    return xs.length === 1 && typeof xs[0].valor === "number" && Number.isFinite(xs[0].valor) ? xs[0].valor : null;
  };
  const limpar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return { ...p,
    pessoal: unico("RGF-Anexo 01", "DespesaComPessoalTotal", (c) => /^% sobre a rcl( ajustada)?$/.test(limpar(c))),
    divida: unico("RGF-Anexo 02", "PercentualDaDCLSobreARCL", (c) => limpar(c) === `ate o ${p.quadrimestre}º quadrimestre`),
  };
}

export function linhasFiscais(d: DadosFiscais): LinhaResumo[] {
  const periodo = (p: PontoFiscal) => `${p.quadrimestre}º quadrimestre de ${p.ano}`;
  return (["divida", "pessoal"] as const).map((id) => {
    const de = d.recebido?.[id] ?? null, para = d.atual?.[id] ?? null;
    const mudanca = de !== null && para !== null ? Math.round((para - de) * 100) / 100 : null;
    return {
      id: `fiscal-${id}`, nome: id === "divida" ? "Dívida consolidada líquida" : "Despesa com pessoal do Executivo",
      detalhe: "% da receita corrente líquida ajustada",
      de: de === null ? null : `${numero(de, 2)}%`, para: para === null ? null : `${numero(para, 2)}%`,
      mudanca: mudanca === null ? null : `${mudanca > 0 ? "+" : ""}${numero(mudanca, 2)} p.p.`,
      // Subir é pior: mais perto do limite da lei. Fica fora da conta do topo do resumo.
      sentido: sentido(mudanca, false), brasil: null, comparacao: null,
      periodo: d.atual ? `${periodo(d.atual)}${d.recebido ? ` contra ${periodo(d.recebido)}` : ""}` : "",
      falta: para === null ? "Dado não publicado ou não disponível na consulta." : de === null ? "Sem base comparável antes da posse." : undefined,
      fonte: `Tesouro Nacional · Siconfi, RGF · consulta em ${d.consultadoEm.slice(0, 10)}`,
      urlFonte: "https://siconfi.tesouro.gov.br/siconfi/index.jsf",
      nota: id === "pessoal"
        ? "Despesa total com pessoal do Poder Executivo em 12 meses, conforme a LRF; não é apenas a folha mensal. A relação usa a receita ajustada do próprio relatório. A cor segue a régua (subir é pior, mais perto do limite), mas o número não entra na conta do topo: redução não prova melhora dos serviços."
        : "Estoque da dívida consolidada líquida em relação à receita ajustada do relatório, não despesa com juros ou soma dos quadrimestres. Pode ser negativo. A cor segue a régua (subir é pior, mais perto do limite), mas a relação não é, sozinha, um veredito sobre o governo e não entra na conta do topo.",
      grafico: graficoFiscal(d.serie, id),
    };
  });
}

function graficoFiscal(serie: PontoSerieFiscal[] | null | undefined, id: "divida" | "pessoal"): GraficoResumo | null {
  const pontos = (serie ?? []).filter((p) => p[id] !== null);
  if (pontos.length < 2) return null;
  const datas = pontos.map((p) => p.mes);
  return {
    series: [
      { rotulo: "Estado", datas, valores: pontos.map((p) => p[id]), principal: true },
      // O teto da lei, tracejado: diz quão longe o estado está dele.
      { rotulo: "Limite", datas, valores: datas.map(() => LIMITE_FISCAL[id]), principal: false },
    ],
    casas: id === "divida" ? 0 : 1,
    sufixo: "%",
    titulo: id === "divida"
      ? `% da receita corrente líquida no fim de cada quadrimestre · limite de ${LIMITE_FISCAL.divida}% (Senado)`
      : `% da receita corrente líquida em 12 meses, no fim de cada ano e no último relatório · limite de ${LIMITE_FISCAL.pessoal}% (LRF)`,
  };
}
