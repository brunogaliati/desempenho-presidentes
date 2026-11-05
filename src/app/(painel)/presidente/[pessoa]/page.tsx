import { notFound } from "next/navigation";
import { carregarPainel } from "@/app/_painel/_dados/carregar";
import { metadataComRecorte, type Busca } from "@/app/_painel/_dados/metadataRecorte";
import { metaDoPerfil } from "@/lib/perfisPainel";
import { metadataPagina, jsonLd, URL_SITE } from "@/lib/seo";

export const revalidate=3600;
async function buscar(pessoa:string) {
  const {painel}=await carregarPainel();
  return painel.economia.mandatos.filter(m=>m.pessoaId===pessoa).sort((a,b)=>a.inicio.localeCompare(b.inicio));
}
export async function generateStaticParams() {
  const {painel}=await carregarPainel();
  return [...new Set(painel.economia.mandatos.map(m=>m.pessoaId))].map(pessoa=>({pessoa}));
}
export async function generateMetadata({params,searchParams}:{params:Promise<{pessoa:string}>;searchParams:Promise<Busca>}) {
  const {pessoa}=await params,mandatos=await buscar(pessoa);
  if(!mandatos.length)return {};
  const {titulo,descricao}=metaDoPerfil(mandatos),caminho=`/presidente/${pessoa}`;
  return metadataComRecorte(metadataPagina(titulo,descricao,caminho),caminho,await searchParams);
}
export default async function PaginaPessoa({params}:{params:Promise<{pessoa:string}>}) {
  const {pessoa}=await params,mandatos=await buscar(pessoa);
  if(!mandatos.length)notFound();
  const nome=mandatos[0].nome,url=`${URL_SITE}/presidente/${pessoa}`;
  // O visível é o painel do layout: a trilha no topo e o contexto abaixo dos dados.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@graph':[{'@type':'WebPage',url,name:`Indicadores dos governos de ${nome}`,inLanguage:'pt-BR',isPartOf:{'@id':URL_SITE+'/#site'},about:{'@type':'Person',name:nome}},{'@type':'BreadcrumbList',itemListElement:[{name:'Início',item:URL_SITE},{name:'Explorar dados',item:URL_SITE+'/explorar'},{name:nome,item:url}].map((c,i)=>({'@type':'ListItem',position:i+1,...c}))}]})}}/>;
}
