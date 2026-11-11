import { linhaMunicipalValida, type IndicadorMunicipal, type LinhaMunicipal } from "./indicadoresMunicipais.ts";

export const normalizarNomeMunicipal = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const caminhoResumoMunicipal = (m: {slug:string;uf:{slug:string}}) => `/resumo/municipios/${m.uf.slug}/${m.slug}`;
export function recorteMunicipal(id: IndicadorMunicipal, pontos: LinhaMunicipal[], ano: number) {
  const posse = `${ano}-01`, fim = `${ano + 4}-01`;
  const validos = pontos.filter((p) => linhaMunicipalValida(id, p)).sort((a, b) => a.referencia.localeCompare(b.referencia));
  return {
    base: validos.findLast((p) => p.referencia < posse) ?? null,
    atual: validos.findLast((p) => p.referencia >= posse && p.referencia < fim) ?? null,
  };
}
