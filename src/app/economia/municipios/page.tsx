import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import { Trilha } from "@/app/economia/Trilha";
import Link from "next/link";
import { metadataPagina,jsonLd,URL_SITE } from "@/lib/seo";
import { FraseDaPagina } from "@/components/FraseDaPagina";
import { paginasMunicipaisPublicaveis } from "@/lib/dadosIndicadoresMunicipais";
import { UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { INDICADORES_MUNICIPAIS,idsMunicipais } from "@/lib/indicadoresMunicipais";
import { numero } from "@/lib/formatar";
import styles from "../indicador.module.css";
export const revalidate=3600;
export const metadata=metadataPagina("Indicadores por município: população, emprego, CadÚnico e BPC","Explore dados municipais com histórico, fontes e referências. Escolha uma UF para encontrar população, emprego formal e programas sociais.","/economia/municipios");
export default async function Municipios() {
  const paginas=await paginasMunicipaisPublicaveis(),cidades=new Set(paginas.map(p=>p.municipio.codigo));
  const schema={"@context":"https://schema.org","@type":"CollectionPage",name:"Indicadores por município",url:URL_SITE+"/economia/municipios",inLanguage:"pt-BR",mainEntity:{"@type":"ItemList",itemListElement:UFS_MUNICIPAIS.map((uf,i)=>({"@type":"ListItem",position:i+1,name:uf.nome,url:`${URL_SITE}/economia/municipios/${uf.slug}`}))}};
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><FraseDaPagina texto={"Encontre o seu município: população, emprego formal e programas sociais, com fontes oficiais:"}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/><header><Trilha itens={[{nome:'Explorar dados',href:'/explorar'},{nome:'Municípios'}]}/><h1>Indicadores por município</h1><p className="my-5 text-lg leading-relaxed">População, emprego formal e programas sociais com dados do próprio município, histórico e fontes. Explore {numero(cidades.size,0)} localidades com ao menos um indicador disponível.</p><p className="max-w-prose leading-relaxed text-[var(--tinta-2)]">População e emprego têm cobertura nacional neste catálogo. CadÚnico e BPC usam a base municipal paulista da Fundação Seade. Escolha uma UF para ver quais indicadores estão disponíveis em cada cidade.</p></header><section className="vidro" data-lustro="fixo"><TituloCompartilhavel>Escolha uma unidade da federação</TituloCompartilhavel><ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{UFS_MUNICIPAIS.map(uf=><li key={uf.codigo}><Link href={`/economia/municipios/${uf.slug}`}>{uf.nome}</Link></li>)}</ul></section><section className="vidro" data-lustro="fixo"><TituloCompartilhavel>Indicadores disponíveis</TituloCompartilhavel><ul className="mt-4 space-y-3">{idsMunicipais.map(id=><li key={id}><strong>{INDICADORES_MUNICIPAIS[id].nome}</strong>: {numero(paginas.filter(p=>p.id===id).length,0)} páginas municipais · {INDICADORES_MUNICIPAIS[id].fonte}.</li>)}</ul><p className="mt-5 max-w-prose leading-relaxed">Famílias cadastradas não são o mesmo que famílias beneficiárias. Vínculos formais não são uma taxa de desemprego. Cada página explica a unidade e os limites da sua fonte.</p></section></main>;
}
