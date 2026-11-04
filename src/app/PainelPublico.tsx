import { Geist, Geist_Mono } from "next/font/google";
import { Retrato } from "@/components/Retrato";
import { carregarPainel } from "./_painel/_dados/carregar";
import { Painel } from "./_painel/_componentes/Painel";
import { jsonLd,URL_SITE } from "@/lib/seo";
import { dataRevisao } from "@/lib/revisoesPublicadas";

const sans=Geist({subsets:['latin'],variable:'--fonte-sans'});
const mono=Geist_Mono({subsets:['latin'],variable:'--fonte-mono'});
export type ParametrosPainel = {uf?:string|string[];mandato?:string|string[]};
export async function PainelPublico({aba,titulo,descricao,caminho,searchParams}:{aba:'economia'|'ambiente'|'dinheiro';titulo:string;descricao:string;caminho:string;searchParams:Promise<ParametrosPainel>}){
  const [{painel,presidente},params,revisado]=await Promise.all([carregarPainel(),searchParams,dataRevisao(caminho==='/'?'site:principal':`site:${caminho.slice(1)}`)]);
  const sigla=[params.uf].flat()[0]?.toUpperCase();
  return <div className={`${sans.variable} ${mono.variable} ${sans.className}`}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'WebPage',url:URL_SITE+caminho,name:titulo,description:descricao,dateModified:revisado,inLanguage:'pt-BR',isPartOf:{'@id':URL_SITE+'/#site'}})}}/><Painel publico dados={painel} abaInicial={aba} ufInicial={painel.ufs.find(u=>u.sigla===sigla)?.sigla??null} mandatoInicial={[params.mandato].flat()[0]??null} retrato={<Retrato key="retrato" presidente={presidente} tamanho="p" prioridade/>} descricao={descricao}/></div>;
}
