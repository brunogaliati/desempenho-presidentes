import { notFound } from "next/navigation";
import { cache } from "react";
import { buscarPaginaEconomia, rotaEconomia } from "@/lib/catalogoEconomia";
import { carregarPaginaEconomia, paginasEconomiaPublicaveis } from "@/lib/dadosEconomiaPublica";
import { metadataPagina } from "@/lib/seo";
import { PaginaIndicador, resumoIndicador } from "../PaginaIndicador";
import { buscarPaginaMunicipal } from "@/lib/catalogoMunicipal";
import { carregarIndicadorMunicipal,paginasMunicipaisPublicaveis } from "@/lib/dadosIndicadoresMunicipais";
import { idsMunicipais,rotaMunicipal,tituloMunicipal } from "@/lib/indicadoresMunicipais";
import { PaginaMunicipal,resumoMunicipal } from "../PaginaMunicipal";

import { buscarHubEconomia,hubsEconomia,tituloHub,resumoHub } from "@/lib/hubsEconomia";
import { revisoesPublicadas } from "@/lib/revisoesPublicadas";
import { HubIndicador } from "../HubIndicador";

export const revalidate = 3600;
export const dynamicParams = true;
const buscarMunicipal=cache(async(slug:string)=>{
  const p=buscarPaginaMunicipal(slug.split("/"));
  if(!p)return null;
  const d=await carregarIndicadorMunicipal(p.id,p.municipio);
  if(!d)notFound();
  return d;
});

const buscar = cache(async (slug: string) => {
  const pagina = buscarPaginaEconomia(slug.split("/"));
  if (!pagina || pagina.propria) notFound();
  const dados = await carregarPaginaEconomia(pagina);
  if (!dados) notFound();
  return dados;
});

export async function generateStaticParams() {
  await revisoesPublicadas();
  const novas=await paginasMunicipaisPublicaveis();
  // As demais URLs são renderizadas no primeiro acesso e revalidadas pelo ISR.
  return [...(await hubsEconomia()).map(h=>({pagina:h.slug.split("/")})),...(await paginasEconomiaPublicaveis()).filter((p) => !p.propria).map((p) => ({pagina:p.slug.split("/")})),...idsMunicipais.flatMap(id=>novas.filter(p=>p.id===id).slice(0,4).map(p=>({pagina:rotaMunicipal(p.id,p.municipio).replace('/economia/','').split('/')})))];
}

export async function generateMetadata({params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  const hub=await buscarHubEconomia(pagina.join("/"));
  if(hub)return metadataPagina(tituloHub(hub),resumoHub(hub),`/economia/${hub.slug}`);
  const municipal=await buscarMunicipal(pagina.join("/"));
  if(municipal)return metadataPagina(tituloMunicipal(municipal.id,municipal.municipio),resumoMunicipal(municipal),rotaMunicipal(municipal.id,municipal.municipio),`/economia/imagens/${pagina.join('/')}`);
  const d = await buscar(pagina.join("/"));
  return metadataPagina(d.pagina.titulo,resumoIndicador(d),rotaEconomia(d.pagina),`/economia/imagens/${d.pagina.slug}`);
}

export default async function PaginaPublica({params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  const hub=await buscarHubEconomia(pagina.join("/"));
  if(hub)return <HubIndicador hub={hub}/>;
  const municipal=await buscarMunicipal(pagina.join("/"));
  if(municipal)return <PaginaMunicipal dados={municipal}/>;
  return <PaginaIndicador dados={await buscar(pagina.join("/"))} />;
}
