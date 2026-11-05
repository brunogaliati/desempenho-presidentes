import "server-only";
import { cache } from "react";
import { paginasMunicipaisPublicaveis } from "./dadosIndicadoresMunicipais";
import { UFS_MUNICIPAIS } from "./catalogoMunicipal";
import { idsMunicipais, INDICADORES_MUNICIPAIS, type IndicadorMunicipal } from "./indicadoresMunicipais";
import { revisoesPublicadas } from "./revisoesPublicadas";
import { ufDe, ufEm } from "./catalogoEconomia";

export const hubsEconomia=cache(async()=>{
  const paginas=await paginasMunicipaisPublicaveis();
  return idsMunicipais.flatMap(id=>[undefined,...UFS_MUNICIPAIS.filter(uf=>paginas.some(p=>p.id===id && p.municipio.uf.codigo===uf.codigo))].map(uf=>({id,uf,slug:`${id}${uf?`/${uf.slug}`:''}`})));
});
export const buscarHubEconomia=cache(async(slug:string)=>(await hubsEconomia()).find(h=>h.slug===slug)??null);
export const tituloHub=(h:{id:IndicadorMunicipal;uf?:{nome:string;slug:string}})=>`${INDICADORES_MUNICIPAIS[h.id].nome}${h.uf?` ${ufEm(h.uf)}`:' por estado e município'}: dados e histórico`;
export const resumoHub=(h:{id:IndicadorMunicipal;uf?:{nome:string;slug:string}})=>`Consulte ${INDICADORES_MUNICIPAIS[h.id].medidas[0].toLowerCase()}${h.uf?` nos municípios ${ufDe(h.uf)}`:' nos municípios com cobertura disponível'}, com referência, fonte oficial, histórico e limites da comparação.`;
export async function revisaoHub(id:IndicadorMunicipal,uf?:string){
  const revisoes=new Map((await revisoesPublicadas()).map(r=>[r.chave,r.modificado]));
  return (await paginasMunicipaisPublicaveis()).filter(p=>p.id===id && (!uf || p.municipio.uf.codigo===uf)).map(p=>revisoes.get(`${id}:${p.municipio.codigo}`)!).sort().at(-1)!;
}
