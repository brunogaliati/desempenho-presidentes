import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { podeIndexar, URL_SITE } from "@/lib/seo";
import { rotaEconomia } from "@/lib/catalogoEconomia";
import { paginasEconomiaPublicaveis } from "@/lib/dadosEconomiaPublica";
import { paginasMunicipaisPublicaveis } from "@/lib/dadosIndicadoresMunicipais";
import { rotaMunicipal } from "@/lib/indicadoresMunicipais";
import { hubsEconomia } from "@/lib/hubsEconomia";
import { revisoesPublicadas } from "@/lib/revisoesPublicadas";
import { caminhoResumoMunicipal } from "@/lib/resumoMunicipalModelo";

export async function sitemapPublico(): Promise<MetadataRoute.Sitemap> {
  if (!podeIndexar()) return [];
  const revisoes=new Map((await revisoesPublicadas()).map(r=>[r.chave,r.modificado]));
  const [pessoas,paginas,municipais] = await Promise.all([sql`select distinct pessoa_id from presidente where pessoa_id is not null order by pessoa_id`,paginasEconomiaPublicaveis(),paginasMunicipaisPublicaveis()]);
  const ufs=new Map<string,Set<string>>();
  for(const p of municipais){const cidades=ufs.get(p.municipio.uf.slug)??new Set<string>();cidades.add(p.municipio.codigo);ufs.set(p.municipio.uf.slug,cidades);}
  const diretorios=["/economia/municipios",...[...ufs].flatMap(([uf,cidades])=>Array.from({length:Math.ceil(cidades.size/100)},(_,i)=>`/economia/municipios/${uf}${i?`?pagina=${i+1}`:""}`))];
  const datas=new Map<string,string>();
  const ultimas=new Map<string,string>();
  const registrar=(chave:string,data:string)=>{if(data>(ultimas.get(chave)??''))ultimas.set(chave,data);};
  for(const p of paginas)datas.set(rotaEconomia(p),revisoes.get(`economia:${p.slug}`)!);
  for(const p of municipais){
    const data=revisoes.get(`${p.id}:${p.municipio.codigo}`)!;
    datas.set(rotaMunicipal(p.id,p.municipio),data);
    for(const chave of ['municipios',`municipios:${p.municipio.uf.slug}`,p.id,`${p.id}:${p.municipio.uf.codigo}`])registrar(chave,data);
  }
  const hubs=await hubsEconomia();
  for(const h of hubs)datas.set(`/economia/${h.slug}`,ultimas.get(h.uf?`${h.id}:${h.uf.codigo}`:h.id)!);
  for(const caminho of diretorios){const uf=new URL(caminho,URL_SITE).pathname.split('/')[3];datas.set(caminho,ultimas.get(uf?`municipios:${uf}`:'municipios')!);}
  const institucionais=['metodologia','sobre','correcoes','explorar'];
  for(const nome of institucionais)datas.set('/'+nome,revisoes.get('site:'+nome)!);
  datas.set('/',revisoes.get('site:resumo')!);
  datas.set('/economia',revisoes.get('site:principal')!);
  const resumos=[...new Map(municipais.map(p=>[p.municipio.codigo,p.municipio])).values()].map(caminhoResumoMunicipal);
  return ["/",'/economia',...institucionais.map(n=>'/'+n),'/meio-ambiente','/dinheiro','/resumo/municipios',...[...ufs.keys()].map(uf=>`/resumo/municipios/${uf}`),...resumos, ...paginas.map(rotaEconomia),...hubs.map(h=>`/economia/${h.slug}`),...municipais.map(p=>rotaMunicipal(p.id,p.municipio)),...diretorios, ...pessoas.map((p) => `/presidente/${encodeURIComponent(String(p.pessoa_id))}`)]
    .map((caminho) => ({ url: `${URL_SITE}${caminho}`, ...(datas.get(caminho)?{lastModified:datas.get(caminho)}:{}) }));
}
