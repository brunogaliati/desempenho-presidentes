import { jsonLd, URL_SITE } from "@/lib/seo";
import { dataRevisao } from "@/lib/revisoesPublicadas";
import { TEMAS_PAINEL, type TemaPainel } from "@/lib/temasPainel";

/** Só o conteúdo específico da rota muda; o painel e o cabeçalho vivem no layout. */
export async function PainelPublico({tema}:{tema:TemaPainel}) {
  const {caminho,titulo,descricao}=TEMAS_PAINEL[tema];
  // "site:principal" é a revisão das séries da Economia, que foi a home; o Resumo na home usa a dele.
  const revisado=await dataRevisao(tema==='economia'?'site:principal':tema==='resumo'?'site:resumo':`site:${caminho.slice(1)}`);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'WebPage',url:URL_SITE+caminho,name:titulo,description:descricao,dateModified:revisado,inLanguage:'pt-BR',isPartOf:{'@id':URL_SITE+'/#site'}})}}/>;
}
