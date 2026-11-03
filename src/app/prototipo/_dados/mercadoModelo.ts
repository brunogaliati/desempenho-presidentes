import type { SerieEconomia } from "./tipos";

export interface SerieDiaria {
  datas: string[];
  valores: (number | null)[];
  coletadoEm: string | null;
  anosAusentes: number[];
  defasada: boolean;
  /** A posse de quem está sendo medido (AAAA-MM), quando não é o governo atual. */
  posse?: string;
}

export function montarIbovespa(anos: number[], resultados: PromiseSettledResult<{ pontos: { data: string; valor: number }[]; coletadoEm: string }>[], hoje: string, agora: number): SerieDiaria {
  const anosAusentes = anos.filter((_, i) => resultados[i].status === "rejected");
  const pontos: { data: string; valor: number | null }[] = resultados.flatMap((r) => r.status === "fulfilled" ? r.value.pontos : []);
  // Uma ausência anual interrompe a linha; não liga dois anos através de uma lacuna.
  pontos.push(...anosAusentes.map((ano) => ({ data: `${ano}-01-01`, valor: null })));
  const dados = pontos.filter((p) => p.data <= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const corrente = resultados.at(-1);
  const coletadoEm = corrente?.status === "fulfilled" ? corrente.value.coletadoEm : null;
  return { datas: dados.map((p) => p.data), valores: dados.map((p) => p.valor), coletadoEm, anosAusentes,
    defasada: !coletadoEm || agora - new Date(coletadoEm).getTime() > 7200000 };
}

export function normalizarIbovespa(json: unknown, ano: number, hoje: string) {
  if (!json || typeof json !== "object" || !("results" in json) || !Array.isArray(json.results)) throw new Error("Histórico B3 inválido.");
  const pontos = new Map<string, number>();
  for (const linha of json.results) {
    if (!linha || !Number.isInteger(linha.day) || linha.day < 1 || linha.day > 31) throw new Error("Dia B3 inválido.");
    for (let mes = 1; mes <= 12; mes++) {
      const raw = linha[`rateValue${mes}`];
      if (raw == null || raw === "") continue;
      const data = `${ano}-${String(mes).padStart(2, "0")}-${String(linha.day).padStart(2, "0")}`;
      if (new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) !== data || data > hoje) continue;
      if (typeof raw !== "string" || !/^\d+(?:\.\d{3})*(?:,\d+)?$/.test(raw)) throw new Error("Valor B3 inválido.");
      const valor = Number(raw.replaceAll(".", "").replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0) throw new Error("Fechamento B3 inválido.");
      if (pontos.has(data) && pontos.get(data) !== valor) throw new Error("Fechamentos B3 conflitantes.");
      pontos.set(data, valor);
    }
  }
  return [...pontos].sort(([a], [b]) => a.localeCompare(b)).map(([data, valor]) => ({ data, valor }));
}

const B3 = "https://sistemaswebb3-listados.b3.com.br/indexStatisticsPage/average/IBOVESPA?language=pt-br";

/**
 * O Ibovespa como uma série do terminal: o fechamento do último pregão de
 * cada mês. Assim a bolsa entra no mesmo gráfico, com o mesmo "Mandato" e a
 * mesma cor das outras séries, em vez de num painel à parte. O mês corrente
 * vale até o último pregão e sai marcado como parcial.
 */
export function serieDaBolsa(b: SerieDiaria | undefined, hoje: string): SerieEconomia | null {
  if (!b) return null;
  const porMes = new Map<string, number>();
  b.datas.forEach((d, i) => {
    const v = b.valores[i];
    if (v !== null && Number.isFinite(v)) porMes.set(d.slice(0, 7), v);
  });
  const datas = [...porMes.keys()].sort();
  if (datas.length < 2) return null;
  const fim = datas[datas.length - 1];
  return {
    id: "ibovespa",
    origem: "ibovespa",
    rotulo: "Bolsa (Ibovespa)",
    pergunta: "Quanto valem as maiores empresas da bolsa?",
    formato: "inteiro",
    direcao: "maior_melhor",
    datas,
    valores: datas.map((d) => porMes.get(d)!),
    fonte: "B3",
    fonteUrl: B3,
    unidade: "pontos, fechamento do mês",
    frequencia: "mensal",
    mesesReferencia: 1,
    referencia: fim,
    coletadoEm: b.coletadoEm,
    parcial: fim === hoje.slice(0, 7),
    cobertura: { inicio: datas[0], fim, lacunas: b.anosAusentes.length },
    instituicoes: {
      mede: "A B3 calcula o Ibovespa, a carteira das ações mais negociadas; aqui, o fechamento do último pregão de cada mês.",
      atua: "Empresas e investidores formam os preços. O governo pesa pelas expectativas de juros, contas públicas e regras, mas não decide.",
      contexto: "Em pontos, sem descontar a inflação. Juros, lucros das empresas e o cenário de fora movem a bolsa.",
      links: [{ nome: "B3 · histórico oficial", url: B3 }],
    },
    calculo: "fechamento do último pregão do mês",
  };
}

/** "mandato" começa na posse e mede contra o último pregão antes dela. */
export type PeriodoMercado = "mandato" | "1a" | "3a" | "2021";
export function janelaMercado(datas: string[], valores: (number | null)[], periodo: PeriodoMercado, hoje: string, emTaxa: boolean) {
  const ano = Number(hoje.slice(0, 4)) - (periodo === "3a" ? 3 : 1);
  const inicio = periodo === "mandato" ? "2023-01-01" : periodo === "2021" ? "2021-01-01" : `${ano}${hoje.slice(4, 10)}`;
  const pontos = datas.map((data, i) => ({ data, valor: valores[i] ?? null }))
    .filter((p) => p.data <= hoje).sort((a, b) => a.data.localeCompare(b.data));
  const validos = pontos.filter((p): p is { data: string; valor: number } => p.valor !== null && Number.isFinite(p.valor));
  const base = validos.filter((p) => p.data < inicio).at(-1) ?? null;
  const visiveis = pontos.filter((p) => p.data >= inicio);
  const ultimo = validos.filter((p) => p.data >= inicio).at(-1) ?? null;
  const variacao = base && ultimo ? emTaxa ? ultimo.valor - base.valor : base.valor !== 0 ? (ultimo.valor / base.valor - 1) * 100 : null : null;
  return { inicio, base, ultimo, variacao, pontos: visiveis };
}

