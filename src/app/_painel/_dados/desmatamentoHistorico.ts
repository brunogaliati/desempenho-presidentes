import type { DadosPainel } from "./tipos";

export const BIOMAS_DESMATAMENTO = ["amazonia", "cerrado", "caatinga", "mata_atlantica", "pampa", "pantanal", "todos"] as const;
export type EscopoDesmatamento = typeof BIOMAS_DESMATAMENTO[number];

/** A mesma série anual para as barras do painel e para a capa compartilhada. */
export function desmatamentoHistorico(dados: DadosPainel, escopo: string) {
  const serie = (id: string) => dados.ambiente.series.find((x) => x.id === id);
  if (escopo === "amazonia") return { s: serie("prodes_amazonia"), nome: "Amazônia Legal", nota: "Taxa modelada do INPE para a Amazônia Legal, de agosto a julho." };
  if (escopo === "cerrado") return { s: serie("prodes_cerrado"), nome: "Cerrado", nota: "Área mapeada no bioma; antes de 2013 o PRODES vinha em blocos de dois anos." };
  if (escopo !== "todos") {
    const b = dados.ambiente.porBioma.find((x) => x.id === escopo);
    // Os demais biomas só têm série anual desde 2017; não comparar blocos bienais.
    const i = b?.prodes ? b.prodes.datas.findIndex((d) => d >= "2017-07") : -1;
    return {
      s: b?.prodes && i >= 0 ? { ...b.prodes, datas: b.prodes.datas.slice(i), valores: b.prodes.valores.slice(i) } : undefined,
      nome: b?.rotulo ?? "",
      nota: "Área mapeada no bioma; antes de 2017 o PRODES vinha quase sempre em blocos de dois anos.",
    };
  }
  const base = serie("prodes_amazonia");
  const l = dados.leituras.ambiente.find((x) => x.id === "desmatamento");
  const datas = l?.periodos.map((p) => p.codigo) ?? [];
  return {
    s: base && { ...base, id: "desmatamento_todos", rotulo: "Desmatamento, seis biomas", datas, valores: l?.brasil ?? [], referencia: datas.at(-1) ?? null, preliminares: [] },
    nome: "Seis biomas",
    nota: "Área mapeada somando os seis biomas, que só têm dado anual desde 2017.",
  };
}
