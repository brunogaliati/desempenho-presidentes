import type { Formato, SerieEconomia } from "./tipos";

export interface Expectativa {
  indicador: string;
  ano: string;
  data: string;
  mediana: number;
  anterior: number | null;
  dataAnterior: string | null;
  respondentes: number | null;
}
export interface ComplementoEconomia {
  ibovespa?: import("./mercadoModelo").SerieDiaria;
  series: SerieEconomia[];
  expectativas: Expectativa[];
  indisponiveis: string[];
}

export function urlExpectativas(hoje: string): string {
  const ano = Number(hoje.slice(0, 4));
  const desde = new Date(`${hoje}T12:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 45);
  const parametros = new URLSearchParams({
    "$format": "json", "$top": "3000", "$orderby": "Data desc",
    "$filter": `baseCalculo eq 0 and Data ge '${desde.toISOString().slice(0, 10)}' and Data le '${hoje}' and (Indicador eq 'IPCA' or Indicador eq 'PIB Total' or Indicador eq 'Selic' or Indicador eq 'Câmbio') and (DataReferencia eq '${ano}' or DataReferencia eq '${ano + 1}' or DataReferencia eq '${ano + 2}')`,
  });
  // O Olinda interpreta '+' como operador, em vez de espaço, nos filtros OData.
  return `https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?${parametros.toString().replaceAll("+", "%20")}`;
}

/** Apenas o agregado nacional completo; não transforma UFs ausentes em zero. */
export function inadimplenciaNacional(ativa: number | null, vencida: number | null, ufs: number): number | null {
  return ufs === 27 && ativa !== null && vencida !== null && Number.isFinite(ativa) && Number.isFinite(vencida)
    && ativa > 0 && vencida >= 0 && vencida <= ativa ? vencida / ativa * 100 : null;
}

/** A fotografia é coerente: todos os anos usam a mesma data de pesquisa. */
export function organizarExpectativas(linhas: unknown, hoje: string): Expectativa[] {
  if (!Array.isArray(linhas)) throw new Error("Resposta inválida do BCB.");
  const indicadores = ["IPCA", "PIB Total", "Selic", "Câmbio"];
  const ano = Number(hoje.slice(0, 4));
  const validas = linhas.filter((r) => r && typeof r === "object"
    && indicadores.includes(r.Indicador) && r.baseCalculo === 0 && r.IndicadorDetalhe == null
    && /^\d{4}-\d{2}-\d{2}$/.test(r.Data) && r.Data <= hoje
    && /^\d{4}$/.test(r.DataReferencia) && Number(r.DataReferencia) >= ano && Number(r.DataReferencia) <= ano + 2
    && typeof r.Mediana === "number" && Number.isFinite(r.Mediana));
  const ultima = validas.map((r) => r.Data as string).sort().at(-1);
  if (!ultima) return [];
  const semanaAnterior = new Date(`${ultima}T12:00:00Z`);
  semanaAnterior.setUTCDate(semanaAnterior.getUTCDate() - 7);
  const limite = semanaAnterior.toISOString().slice(0, 10);
  return validas.filter((r) => r.Data === ultima).map((r) => {
    const anteriores = validas.filter((p) => p.Indicador === r.Indicador && p.DataReferencia === r.DataReferencia && p.Data <= limite)
      .sort((a, b) => b.Data.localeCompare(a.Data));
    return {
      indicador: r.Indicador, ano: r.DataReferencia, data: r.Data, mediana: r.Mediana,
      anterior: anteriores[0]?.Mediana ?? null, dataAnterior: anteriores[0]?.Data ?? null,
      respondentes: Number.isInteger(r.numeroRespondentes) ? r.numeroRespondentes : null,
    };
  }).sort((a, b) => indicadores.indexOf(a.indicador) - indicadores.indexOf(b.indicador) || a.ano.localeCompare(b.ano));
}

export function serieComplementar(
  id: string, rotulo: string, pergunta: string, formato: Formato, unidade: string,
  fonte: string, fonteUrl: string, calculo: string,
  linhas: { mes: string; valor: number | null; coletado_em: string | null }[],
): SerieEconomia {
  const dados = [...linhas].sort((a, b) => a.mes.localeCompare(b.mes));
  const validos = dados.filter((r) => r.valor !== null && Number.isFinite(r.valor));
  return {
    id, origem: id, rotulo, pergunta, formato, unidade, fonte, fonteUrl, calculo, direcao: "neutro",
    datas: dados.map((r) => r.mes), valores: dados.map((r) => r.valor !== null && Number.isFinite(r.valor) ? r.valor : null),
    frequencia: "mensal", mesesReferencia: 1, referencia: validos.at(-1)?.mes ?? null,
    coletadoEm: dados.map((r) => r.coletado_em).filter((d): d is string => d !== null).sort().at(-1) ?? null,
    parcial: false, cobertura: { inicio: validos[0]?.mes ?? null, fim: validos.at(-1)?.mes ?? null, lacunas: dados.length - validos.length },
    instituicoes: { mede: calculo, atua: "", contexto: "", links: [{ nome: fonte, url: fonteUrl }] },
  };
}
