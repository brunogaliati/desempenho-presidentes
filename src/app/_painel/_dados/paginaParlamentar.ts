import indiceDeputados from "../../../../public/painel/congresso/cota-deputados.json";
import indiceSenadores from "../../../../public/painel/congresso/cota-senadores.json";
import {
  type CasaCongresso, type IndiceCota, MESES_POR_EXTENSO, NOME_UF,
  caminhoParlamentar, comparadoAMedia, posicaoNoAno, reaisInteiros, rotaParlamentar,
} from "./congressoModelo";
import fotografia from "./fotografia.json";

/** Título, descrição e capa da página de cada parlamentar, no servidor, com o índice pequeno da cota. */
const INDICES: Record<CasaCongresso, IndiceCota> = {
  deputados: indiceDeputados as unknown as IndiceCota,
  senadores: indiceSenadores as unknown as IndiceCota,
};
/** Código IBGE da UF, para o mapa da capa. */
export const CODIGO_UF: Record<string, string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

export type ParlamentarDaPagina = { casa: CasaCongresso; pessoa: { id: number; nome: string; partido: string | null; uf: string }; caminho: string };

export function paginasParlamentares(): ParlamentarDaPagina[] {
  return (["deputados", "senadores"] as const).flatMap(casa => fotografia[casa].map(pessoa => ({ casa, pessoa, caminho: caminhoParlamentar(casa, pessoa) })));
}

export function acharParlamentar(casa: string, pessoa: string): ParlamentarDaPagina | null {
  const rota = rotaParlamentar(`/congresso/${casa}/${pessoa}`);
  if (!rota) return null;
  const achada = fotografia[rota.casa].find(p => p.id === rota.id);
  return achada ? { casa: rota.casa, pessoa: achada, caminho: caminhoParlamentar(rota.casa, achada) } : null;
}

export const siglaParlamentar = (p: ParlamentarDaPagina["pessoa"]) => `${!p.partido || p.partido === "S/Partido" ? "sem partido" : p.partido}-${p.uf}`;
export const nomeDaCasa = (casa: CasaCongresso) => (casa === "deputados" ? "Câmara dos Deputados" : "Senado Federal");
export const perfilOficialParlamentar = ({ casa, pessoa }: ParlamentarDaPagina) => casa === "deputados"
  ? `https://www.camara.leg.br/deputados/${pessoa.id}`
  : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${pessoa.id}`;

/** A mesma referência e os mesmos totais usados pelo painel; ausência de nota não vira zero. */
export function historicoDaCota({ casa, pessoa }: ParlamentarDaPagina) {
  const indice = INDICES[casa];
  return {
    coletadoEm: indice.coletadoEm,
    fontes: indice.fontes,
    anos: indice.anos.map((ano, i) => ({
      ano,
      total: indice.totais[pessoa.id]?.[i] ?? null,
      media: indice.media[ano]?.media ?? null,
      mes: indice.ultimoMes[ano] ?? null,
      parcial: ano >= new Date(indice.coletadoEm).getUTCFullYear(),
    })),
  };
}

/** O último ano da cota: total, até que mês, comparação com a média e posição. */
export function resumoDaCota({ casa, pessoa }: ParlamentarDaPagina) {
  const indice = INDICES[casa];
  const ano = indice.anos.at(-1);
  if (ano === undefined) return null;
  const total = indice.totais[pessoa.id]?.[indice.anos.indexOf(ano)];
  const media = indice.media[ano]?.media;
  if (total === null || total === undefined || !media) return null;
  const mes = indice.ultimoMes[ano];
  return {
    ano,
    total,
    ate: mes && ano >= new Date(indice.coletadoEm).getUTCFullYear() ? MESES_POR_EXTENSO[mes - 1] : null,
    comparacao: comparadoAMedia(total, media),
    posicao: posicaoNoAno(indice, pessoa.id, ano),
  };
}

export function metaParlamentar(achado: ParlamentarDaPagina) {
  const { casa, pessoa } = achado;
  const r = resumoDaCota(achado);
  const lugar = `${nomeDaCasa(casa)}, ${NOME_UF[pessoa.uf] ?? pessoa.uf}`;
  return {
    titulo: `${pessoa.nome} (${siglaParlamentar(pessoa)}): cota e votações`,
    descricao: r
      ? `${lugar}. Cota parlamentar de ${r.ano}${r.ate ? ` até ${r.ate}` : ""}: ${reaisInteiros(r.total)}. Consulte gastos, fornecedores, votações e emendas, com fontes oficiais.`
      : `${lugar}. Consulte o perfil, os gastos da cota parlamentar, as votações e as emendas, com fontes oficiais.`,
  };
}
