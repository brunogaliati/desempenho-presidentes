import Link from "next/link";
import { numero,comSinal } from "@/lib/formatar";
import { jsonLd,URL_SITE } from "@/lib/seo";
import { buscarPaginaEconomia,rotaEconomia } from "@/lib/catalogoEconomia";
import { INDICADORES_MUNICIPAIS, idsMunicipais, rotaMunicipal,tituloMunicipal,rotuloReferenciaMunicipal } from "@/lib/indicadoresMunicipais";
import type { DadosIndicadorMunicipal } from "@/lib/dadosIndicadoresMunicipais";
import { HistoricoMunicipal } from "./HistoricoMunicipal";
import styles from "./indicador.module.css";

export function resumoMunicipal(d:DadosIndicadorMunicipal) {
  const m=d.municipio,l=d.ultimo,onde=`${m.nome} (${m.uf.sigla})`,n=(v:number|null)=>numero(v,0),ref=rotuloReferenciaMunicipal(l.referencia,INDICADORES_MUNICIPAIS[d.id].anual);
  if(d.id==="populacao") return `A população estimada de ${onde} é de ${n(l.valor)} habitantes, segundo o IBGE, com referência em 1º de julho de ${ref}. É a última estimativa anual disponível nesta base.`;
  if(d.id==="emprego-formal") return `Em ${ref}, ${onde} registrou estoque de ${n(l.valor)} vínculos formais no Novo Caged, com ajustes. Foram ${n(l.extras[0])} admissões e ${n(l.extras[1])} desligamentos, com saldo de ${comSinal(l.extras[2]!,0)} empregos no mês.`;
  if(d.id==="cadunico") return `Em ${ref}, ${onde} tinha ${n(l.valor)} famílias e ${n(l.extras[0])} pessoas inscritas no CadÚnico, conforme a série municipal publicada pela Fundação Seade com dados do MDS/Sagicad.`;
  return `Em ${ref}, ${onde} tinha ${n(l.valor)} pessoas beneficiárias do BPC: ${n(l.extras[0])} pessoas idosas e ${n(l.extras[1])} pessoas com deficiência, conforme a série municipal da Fundação Seade com dados do MDS/Sagicad.`;
}

export function PaginaMunicipal({dados:d}:{dados:DadosIndicadorMunicipal}) {
  const m=d.municipio,cfg=INDICADORES_MUNICIPAIS[d.id],url=URL_SITE+rotaMunicipal(d.id,m),titulo=tituloMunicipal(d.id,m);
  const antes=d.pontos.find(p=>p.referencia===`${Number(d.ultimo.referencia.slice(0,4))-1}${d.ultimo.referencia.slice(4)}`)?.valor;
  const gasolina=buscarPaginaEconomia(["gasolina",m.uf.slug,m.slug]);
  const crumbs=[{name:"Início",item:URL_SITE},{name:"Municípios",item:URL_SITE+"/economia/municipios"},{name:m.uf.nome,item:`${URL_SITE}/economia/municipios/${m.uf.slug}`},{name:`${cfg.nome} · ${m.nome}`,item:url}];
  const schema={"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList",itemListElement:crumbs.map((c,i)=>({"@type":"ListItem",position:i+1,...c}))},{"@type":"WebPage","@id":url+"#pagina",url,name:titulo,description:resumoMunicipal(d),inLanguage:"pt-BR",dateModified:d.atualizado,mainEntity:{"@id":url+"#dados"},isPartOf:{"@id":URL_SITE+"/#site"}},{"@type":"Dataset","@id":url+"#dados",name:titulo,description:resumoMunicipal(d),url,inLanguage:"pt-BR",dateModified:d.atualizado,isBasedOn:cfg.url,creator:{"@id":URL_SITE+"/#organizacao"},spatialCoverage:{"@type":"City",name:m.nome,identifier:m.codigo,containedInPlace:{"@type":"State",name:m.uf.nome,identifier:m.uf.codigo,containedInPlace:{"@type":"Country",name:"Brasil"}}},temporalCoverage:`${d.pontos[0].referencia}-01/${d.ultimo.referencia}-01`,variableMeasured:cfg.medidas.map((nome,i)=>({"@type":"PropertyValue",name:nome,unitText:d.id==="cadunico" && i===1?"pessoas":d.id==="emprego-formal" && i>0?"movimentações":cfg.unidade}))}]};
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/>
    <header>
      <nav aria-label="Navegação estrutural" className="flex flex-wrap gap-3 text-sm text-[var(--tinta-2)]"><Link href="/">Início</Link><span>/</span><Link href="/economia/municipios">Municípios</Link><span>/</span><Link href={`/economia/municipios/${m.uf.slug}`}>{m.uf.nome}</Link><span>/</span><span aria-current="page">{m.nome} ({m.uf.sigla})</span></nav>
      <h1>{titulo}</h1>
      <p className="my-5 text-lg leading-relaxed">{resumoMunicipal(d)}</p>
      {antes!==null && antes!==undefined && <p className="mb-4 leading-relaxed">Em relação à mesma referência do ano anterior, a diferença em {cfg.medidas[0].toLowerCase()} foi de <strong>{comSinal(d.ultimo.valor!-antes,0)} {cfg.unidade}</strong>{antes>0?` (${comSinal((d.ultimo.valor!/antes-1)*100,2)}%)`:""}.</p>}
      <p className="text-sm leading-relaxed text-[var(--tinta-2)]">Fonte: <a href={cfg.url}>{cfg.fonte}</a>. Referência: {rotuloReferenciaMunicipal(d.ultimo.referencia,cfg.anual)}. Dados coletados/atualizados em <time dateTime={d.atualizado}>{new Date(d.atualizado).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}</time>. Código IBGE: {m.codigo}.</p>
      <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-2"><a href="#historico">Explorar o histórico</a><a href="#tabela">Tabela de dados</a><a href="#fontes">Fontes e metodologia</a><a href="#relacionados">Outros indicadores da cidade</a></nav>
    </header>
    <section id="historico" className="vidro" data-lustro="fixo"><h2>Como o indicador evoluiu em {m.nome}?</h2><p className="mt-3 max-w-prose leading-relaxed">Escolha as referências{cfg.medidas.length>1?" e a medida":""} para comparar os dados do município.</p><HistoricoMunicipal id={d.id} nome={`${m.nome} (${m.uf.sigla})`} pontos={d.pontos}/></section>
    <section id="tabela" className="vidro" data-lustro="fixo"><h2>Histórico de {cfg.nome.toLowerCase()} · {m.nome} ({m.uf.sigla})</h2><div className={styles.tabelaRolagem} role="region" tabIndex={0} aria-label="Histórico municipal"><table><caption>{cfg.fonte} · {cfg.anual?"referências anuais":"referências mensais"}</caption><thead><tr><th scope="col">Referência</th>{cfg.medidas.map(n=><th key={n} scope="col">{n}</th>)}</tr></thead><tbody>{[...d.pontos].reverse().map(p=><tr key={p.referencia}><th scope="row">{rotuloReferenciaMunicipal(p.referencia,cfg.anual)}</th>{[p.valor,...p.extras].map((v,i)=><td key={i}>{v===null?"Indisponível":numero(v,0)}</td>)}</tr>)}</tbody></table></div></section>
    <section id="fontes" className="vidro" data-lustro="fixo"><h2>Fontes e limites da leitura</h2><div className="mt-4 max-w-prose space-y-4 leading-relaxed"><p>Fonte: <a href={cfg.url}>{cfg.fonte}</a>. Referência e unidade acompanham cada número. Ausência permanece indisponível, e zero só aparece quando é um valor publicado.</p>{cfg.limites.map(p=><p key={p}>{p}</p>)}<p>A evolução durante um governo não demonstra, sozinha, que ele causou a mudança. <Link href="/metodologia">Conheça a metodologia do observatório</Link>.</p></div></section>
    <section className="vidro" data-lustro="fixo"><h2>Dúvidas frequentes</h2><details className="mt-3"><summary className="cursor-pointer py-3 font-medium">{cfg.pergunta}</summary><p className="max-w-prose pb-4 leading-relaxed">{cfg.resposta}</p></details><details><summary className="cursor-pointer py-3 font-medium">Por que pode haver um ano ou mês sem número?</summary><p className="max-w-prose pb-4 leading-relaxed">A fonte pode não ter publicado a referência ou o valor pode estar ausente. Mantemos essa lacuna e interrompemos a linha do gráfico, sem estimar números para completá-la.</p></details></section>
    <section id="relacionados" className="vidro" data-lustro="fixo"><h2>Outros indicadores de {m.nome}</h2><ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{idsMunicipais.filter(id=>id!==d.id && m.indicadores.includes(id)).map(id=><li key={id}><Link href={rotaMunicipal(id,m)}>{INDICADORES_MUNICIPAIS[id].nome}</Link></li>)}{gasolina && <li><Link href={rotaEconomia(gasolina)}>Gasolina</Link></li>}<li><Link href={`/economia/municipios/${m.uf.slug}`}>Explorar os municípios de {m.uf.nome}</Link></li></ul></section>
  </main>;
}

