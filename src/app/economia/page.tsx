import Link from "next/link";
import { metadataPagina, jsonLd, URL_SITE } from "@/lib/seo";
import { PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";
import { idsMunicipais, INDICADORES_MUNICIPAIS } from "@/lib/indicadoresMunicipais";
import { dataRevisao } from "@/lib/revisoesPublicadas";
import styles from "./indicador.module.css";

export const revalidate=3600;
export const metadata=metadataPagina('Economia: indicadores do Brasil, estados e municípios','Consulte salário mínimo, inflação, desemprego, gasolina, população e emprego formal, com fontes oficiais, histórico e recortes territoriais.','/economia');
export default async function Economia(){
  const revisado=await dataRevisao('site:economia');
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'CollectionPage',url:URL_SITE+'/economia',name:'Indicadores de economia',dateModified:revisado,inLanguage:'pt-BR'})}}/><header><Link href="/">Início</Link><h1>Economia do Brasil, dos estados e dos municípios</h1><p className="my-5 text-lg leading-relaxed">Encontre o indicador e o território que você quer entender. Cada número vem acompanhado de referência, fonte, histórico e limites da comparação.</p></header><section className="vidro" data-lustro="fixo"><h2>Preços, renda e mercado de trabalho</h2><ul className="mt-5 space-y-4">{PAGINAS_ECONOMIA.map(p=><li key={p.slug}><Link href={rotaEconomia(p)}>{p.titulo}</Link></li>)}</ul></section><section className="vidro" data-lustro="fixo"><h2>Indicadores por município</h2><ul className="mt-5 space-y-5">{idsMunicipais.map(id=><li key={id}><Link href={`/economia/${id}`}>{INDICADORES_MUNICIPAIS[id].nome} por estado e município</Link><p className="mt-2 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">{INDICADORES_MUNICIPAIS[id].limites[0]}</p></li>)}</ul><p className="mt-6"><Link href="/economia/municipios">Pesquisar municípios e todos os indicadores disponíveis</Link></p></section><section className="vidro" data-lustro="fixo"><h2>Como ler os dados</h2><p className="mt-4 max-w-prose leading-relaxed">Uma mudança durante um governo não demonstra, sozinha, que ele a causou. Pesquisas, períodos e unidades precisam ser compatíveis.</p><p className="mt-4"><Link href="/metodologia">Metodologia</Link> · <Link href="/sobre">Sobre o projeto</Link> · <Link href="/correcoes">Relatar um erro</Link></p></section></main>;
}
