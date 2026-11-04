import { jsonLd, URL_SITE } from "@/lib/seo";
import { dataRevisao } from "@/lib/revisoesPublicadas";
import { TEMAS_PAINEL, type TemaPainel } from "@/lib/temasPainel";

/** Só o conteúdo específico da rota muda; o painel e o cabeçalho vivem no layout. */
export async function PainelPublico({tema}:{tema:TemaPainel}) {
  const {caminho,titulo,descricao}=TEMAS_PAINEL[tema];
  const revisado=await dataRevisao(caminho==='/'?'site:principal':`site:${caminho.slice(1)}`);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'WebPage',url:URL_SITE+caminho,name:titulo,description:descricao,dateModified:revisado,inLanguage:'pt-BR',isPartOf:{'@id':URL_SITE+'/#site'}})}}/>;
}
