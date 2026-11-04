import "server-only";
import registro from "./municipiosIndicadores.json";
import { idsMunicipais, type IndicadorMunicipal, type MunicipioIndicadores } from "./indicadoresMunicipais";

export const MUNICIPIOS_INDICADORES:MunicipioIndicadores[]=registro;
const porCaminho=new Map(MUNICIPIOS_INDICADORES.map(m=>[`${m.uf.slug}/${m.slug}`,m]));
const porCodigo=new Map(MUNICIPIOS_INDICADORES.map(m=>[m.codigo,m]));
export const buscarMunicipioCodigo=(codigo:string)=>porCodigo.get(codigo)??null;
export function buscarPaginaMunicipal(partes:string[]) {
  if(partes.length!==3 || !idsMunicipais.includes(partes[0] as IndicadorMunicipal)) return null;
  const id=partes[0] as IndicadorMunicipal,m=porCaminho.get(partes.slice(1).join("/"));
  return m?.indicadores.includes(id)?{id,municipio:m}:null;
}
export const UFS_MUNICIPAIS=[...new Map(MUNICIPIOS_INDICADORES.map(m=>[m.uf.codigo,m.uf])).values()].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
