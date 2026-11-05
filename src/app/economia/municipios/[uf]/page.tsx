import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import { ufDe, ufEm } from "@/lib/catalogoEconomia";
import { FraseDaPagina } from "@/components/FraseDaPagina";
import { Trilha } from "@/app/economia/Trilha";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadataPagina,jsonLd,URL_SITE } from "@/lib/seo";
import { UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { paginasMunicipaisPublicaveis } from "@/lib/dadosIndicadoresMunicipais";
import { INDICADORES_MUNICIPAIS,rotaMunicipal } from "@/lib/indicadoresMunicipais";
import styles from "../../indicador.module.css";

export const revalidate=3600;
type Props={params:Promise<{uf:string}>;searchParams:Promise<{pagina?:string;q?:string}>};
const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
async function listar({params,searchParams}:Props) {
  const {uf:slug}=await params,s=await searchParams,uf=UFS_MUNICIPAIS.find(uf=>uf.slug===slug);
  if(!uf || (s.pagina && !/^[1-9]\d*$/.test(s.pagina)) || (s.q && (typeof s.q!=="string" || s.q.length>80))) notFound();
  const pagina=Number(s.pagina??1),q=s.q?.trim()??"";
  if(!Number.isSafeInteger(pagina))notFound();
  const grupos=new Map<string,Awaited<ReturnType<typeof paginasMunicipaisPublicaveis>>>();
  for(const p of await paginasMunicipaisPublicaveis())if(p.municipio.uf.codigo===uf.codigo && (!q || normal(p.municipio.nome).includes(normal(q)))){const g=grupos.get(p.municipio.codigo)??[];g.push(p);grupos.set(p.municipio.codigo,g);}
  const cidades=[...grupos.values()],paginas=Math.max(1,Math.ceil(cidades.length/100));
  if(pagina>paginas)notFound();
  return {uf,pagina,q,paginas,total:cidades.length,cidades:cidades.slice((pagina-1)*100,pagina*100)};
}
export async function generateMetadata(props:Props) {
  const d=await listar(props),path=`/economia/municipios/${d.uf.slug}`;
  return {...metadataPagina(`Indicadores municipais: ${d.uf.nome}${d.pagina>1?` · página ${d.pagina}`:""}`,`Encontre população, emprego e outros indicadores das cidades ${ufDe(d.uf)}, com dados oficiais e histórico.`,path+(!d.q && d.pagina>1?`?pagina=${d.pagina}`:"")),...(d.q?{robots:{index:false,follow:true}}:{})};
}
export default async function MunicipiosUf(props:Props) {
  const d=await listar(props),path=`/economia/municipios/${d.uf.slug}`;
  const urlPagina=(p:number)=>path+(d.q||p>1?`?${new URLSearchParams({...d.q?{q:d.q}:{},...p>1?{pagina:String(p)}:{}})}`:"");
  const schema={"@context":"https://schema.org","@type":"CollectionPage",name:`Indicadores municipais ${ufDe(d.uf)}`,url:URL_SITE+urlPagina(d.pagina),mainEntity:{"@type":"ItemList",itemListElement:d.cidades.flatMap(g=>g.map(p=>({"@type":"ListItem",name:`${p.municipio.nome} · ${INDICADORES_MUNICIPAIS[p.id].nome}`,url:URL_SITE+rotaMunicipal(p.id,p.municipio)}))).map((p,i)=>({...p,position:i+1}))}};
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><FraseDaPagina texto={`Encontre o seu município ${ufEm(d.uf)}: população, emprego formal e programas sociais, com fontes oficiais:`}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/><header><Trilha itens={[{nome:'Explorar dados',href:'/explorar'},{nome:'Municípios',href:'/economia/municipios'},{nome:d.uf.nome}]}/><h1>Indicadores dos municípios {ufDe(d.uf)}</h1><p className="my-5 text-lg leading-relaxed">Escolha uma cidade e um indicador. {d.total} {d.total===1?"localidade":"localidades"} {d.q?(d.total===1?"encontrada":"encontradas"):"com dados disponíveis"} · página {d.pagina} de {d.paginas}. A lista prioriza cidades de maior população.</p><form method="get" className={styles.busca}><label>Buscar cidade nesta UF<input type="search" name="q" defaultValue={d.q} maxLength={80}/></label><button>Buscar cidade</button>{d.q && <Link href={path}>Limpar busca</Link>}</form></header><section className="vidro" data-lustro="fixo"><TituloCompartilhavel>Cidades e indicadores</TituloCompartilhavel>{d.cidades.length===0?<p className="mt-4" role="status">Nenhuma cidade encontrada nesta UF. Tente outra grafia ou limpe a busca.</p>:<ul className="mt-2 divide-y divide-[var(--borda)]">{d.cidades.map(g=><li key={g[0].municipio.codigo} className={styles.linhaCidade}><h3>{g[0].municipio.nome} ({d.uf.sigla})</h3><ul>{g.map(p=><li key={p.id}><Link prefetch={false} href={rotaMunicipal(p.id,p.municipio)}>{INDICADORES_MUNICIPAIS[p.id].nome}</Link></li>)}</ul></li>)}</ul>}<nav aria-label="Paginação de municípios" className="mt-6 flex flex-wrap gap-5">{d.pagina>1 && <Link href={urlPagina(d.pagina-1)} rel="prev">Página anterior</Link>}{d.pagina<d.paginas && <Link href={urlPagina(d.pagina+1)} rel="next">Próxima página</Link>}</nav></section></main>;
}

