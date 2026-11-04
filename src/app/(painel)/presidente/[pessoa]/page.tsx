import Link from "next/link";
import { notFound } from "next/navigation";
import { carregarPainel } from "@/app/_painel/_dados/carregar";
import { metadataPagina, jsonLd, URL_SITE } from "@/lib/seo";
import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import styles from "@/app/economia/indicador.module.css";

export const revalidate=3600;
async function buscar(pessoa:string) {
  const {painel}=await carregarPainel();
  return painel.economia.mandatos.filter(m=>m.pessoaId===pessoa).sort((a,b)=>a.inicio.localeCompare(b.inicio));
}
export async function generateStaticParams() {
  const {painel}=await carregarPainel();
  return [...new Set(painel.economia.mandatos.map(m=>m.pessoaId))].map(pessoa=>({pessoa}));
}
export async function generateMetadata({params}:{params:Promise<{pessoa:string}>}) {
  const {pessoa}=await params,mandatos=await buscar(pessoa);
  if(!mandatos.length)return {};
  const nome=mandatos[0].nome;
  return metadataPagina(`Governo ${nome}: economia e indicadores por mandato`,`Explore os ${mandatos.length} mandato${mandatos.length>1?'s':''} de ${nome}, com indicadores oficiais, histórico e comparações entre governos.`,`/presidente/${pessoa}`);
}
export default async function PaginaPessoa({params}:{params:Promise<{pessoa:string}>}) {
  const {pessoa}=await params,mandatos=await buscar(pessoa);
  if(!mandatos.length)notFound();
  const nome=mandatos[0].nome,url=`${URL_SITE}/presidente/${pessoa}`;
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@graph':[{'@type':'WebPage',url,name:`Indicadores dos governos de ${nome}`,inLanguage:'pt-BR',isPartOf:{'@id':URL_SITE+'/#site'},about:{'@type':'Person',name:nome}},{'@type':'BreadcrumbList',itemListElement:[{name:'Início',item:URL_SITE},{name:'Explorar dados',item:URL_SITE+'/explorar'},{name:nome,item:url}].map((c,i)=>({'@type':'ListItem',position:i+1,...c}))}]})}}/>
    <div className={`${styles.pagina} mx-auto max-w-6xl pb-8`}>
      <section id="contexto-presidente" className="vidro" data-lustro="fixo">
        <TituloCompartilhavel>Como ler os mandatos de {nome}</TituloCompartilhavel>
        <p className="mt-4 max-w-prose text-sm leading-relaxed">Este é o mesmo painel de indicadores do Brasil. O perfil abre no mandato mais recente; o seletor junto à linha do tempo permite visitar os demais. A comparação governo a governo usa as mesmas séries e fórmulas do painel, com os mandatos desta pessoa destacados.</p>
        <ul className="mt-4 flex flex-wrap gap-3 text-sm">{mandatos.map(m=><li key={m.id}><Link href={`/presidente/${pessoa}?mandato=${m.id}`}>{m.mandato}º mandato · {m.inicio.slice(0,4)}–{m.fim.slice(0,4)}{m.emCurso?' (em curso)':''}</Link></li>)}</ul>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">Mandatos encerrados antes do prazo não equivalem a quatro anos completos. O mandato em curso usa somente os dados já publicados. Mandatos separados por um intervalo fora do cargo são comparados individualmente; não somamos esse intervalo ao governo.</p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">As fontes e referências aparecem junto de cada indicador. Cobertura e frequência podem variar entre séries; ausência permanece sem dado. Mudança durante um governo não demonstra, sozinha, que ele a causou.</p>
        <nav aria-label="Continuar explorando" className="mt-5 flex flex-wrap gap-5 text-sm"><a href="#governo-a-governo">Comparar os governos</a><a href="#fontes">Fontes dos indicadores</a><Link href="/metodologia">Metodologia</Link><Link href="/explorar#presidentes">Outros presidentes</Link></nav>
      </section>
    </div>
  </>;
}
