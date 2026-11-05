import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import Link from "next/link";
import { carregarPainel } from "@/app/_painel/_dados/carregar";
import { Retrato } from "@/components/Retrato";
import { metadataPagina, jsonLd, URL_SITE } from "@/lib/seo";
import { PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";
import { idsMunicipais, INDICADORES_MUNICIPAIS, type IndicadorMunicipal } from "@/lib/indicadoresMunicipais";
import { dataRevisao } from "@/lib/revisoesPublicadas";
import styles from "../economia/indicador.module.css";

export const revalidate=3600;
export const metadata=metadataPagina('Explorar dados: presidentes, indicadores e municípios','Consulte salário mínimo, inflação, desemprego, gasolina, população e emprego formal, com fontes oficiais, histórico e recortes territoriais.','/explorar');

/** A linha diz o que há do outro lado; a cobertura é o que muda a escolha. */
const RESUMO_MUNICIPAL:Record<IndicadorMunicipal,string>={
  populacao:'Estimativa anual do IBGE, com cobertura nacional',
  'emprego-formal':'Vínculos formais do Novo Caged, com cobertura nacional',
  cadunico:'Famílias e pessoas cadastradas, só no estado de São Paulo',
  bpc:'Pessoas beneficiárias, só no estado de São Paulo',
};
const maiuscula=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);

function Linha({href,titulo,resumo,icone}:{href:string;titulo:string;resumo:string;icone?:React.ReactNode}) {
  return <li><Link href={href}>{icone}<span className={styles.linhaTexto}><strong>{titulo}</strong><span>{resumo}</span></span></Link></li>;
}

export default async function Explorar(){
  const [revisado,{painel}]=await Promise.all([dataRevisao('site:explorar'),carregarPainel()]);
  const mandatos=[...painel.economia.mandatos].sort((a,b)=>a.inicio.localeCompare(b.inicio));
  const pessoas=[...new Set(mandatos.map(m=>m.pessoaId))].map(id=>mandatos.filter(m=>m.pessoaId===id));
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd({'@context':'https://schema.org','@type':'CollectionPage',url:URL_SITE+'/explorar',name:'Explorar dados',dateModified:revisado,inLanguage:'pt-BR'})}}/>
    <header><h1>Explorar dados</h1><p>Encontre o indicador e o território que você quer entender. Cada número vem acompanhado de referência, fonte, histórico e limites da comparação.</p></header>
    <section id="presidentes" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel>Presidentes</TituloCompartilhavel>
      <p className={styles.notaSecao}>Cada nome abre o painel de Economia no mandato mais recente da pessoa. De lá, você troca de mandato, de tema ou de estado.</p>
      <ul className={`${styles.listaExplorar} ${styles.tres}`}>
        {pessoas.map(proprios=>{
          const ultimo=proprios[proprios.length-1];
          return <Linha key={ultimo.pessoaId} href={`/presidente/${ultimo.pessoaId}`} titulo={ultimo.nome} resumo={proprios.map(m=>`${m.inicio.slice(0,4)}–${m.emCurso?'hoje':m.fim.slice(0,4)}`).join(' · ')} icone={<Retrato presidente={ultimo} tamanho="m"/>}/>;
        })}
        <Linha href="/#governo-a-governo" titulo="Governo a governo" resumo="Todos os mandatos lado a lado, na tabela do painel" icone={<span className={styles.iconeLinha} aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16M9 4v16M15 4v16"/></svg></span>}/>
      </ul>
    </section>
    <section id="indicadores" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel>Indicadores</TituloCompartilhavel>
      <p className={styles.notaSecao}>Uma página para cada indicador, com histórico, tabela e fontes.</p>
      <ul className={`${styles.listaExplorar} ${styles.tres}`}>{PAGINAS_ECONOMIA.map(p=><Linha key={p.slug} href={rotaEconomia(p)} titulo={p.rotulo} resumo={maiuscula(p.titulo.split(': ')[1]??p.titulo)}/>)}</ul>
    </section>
    <section id="territorios" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel>Estados e municípios</TituloCompartilhavel>
      <p className={styles.notaSecao}>Dados de cada cidade. A cobertura muda de um indicador para outro.</p>
      <ul className={`${styles.listaExplorar} ${styles.tres}`}>
        <Linha href="/economia/municipios" titulo="Encontrar um município" resumo="Escolha o estado e busque a cidade pelo nome"/>
        {idsMunicipais.map(id=><Linha key={id} href={`/economia/${id}`} titulo={INDICADORES_MUNICIPAIS[id].nome} resumo={RESUMO_MUNICIPAL[id]}/>)}
      </ul>
    </section>
    <section className="vidro" data-lustro="fixo">
      <TituloCompartilhavel>Como ler os dados</TituloCompartilhavel>
      <p className="mt-3 max-w-prose leading-relaxed">Uma mudança durante um governo não demonstra, sozinha, que ele a causou. Pesquisas, períodos e unidades precisam ser compatíveis.</p>
      <p className="mt-4"><Link href="/metodologia">Metodologia</Link> · <Link href="/sobre">Sobre o projeto</Link> · <Link href="/correcoes">Relatar um erro</Link></p>
    </section>
  </main>;
}
