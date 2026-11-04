import { DetalhesCompartilhaveis } from "@/components/DetalhesCompartilhaveis";
import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import Link from "next/link";
import { jsonLd, URL_SITE } from "@/lib/seo";
import { catalogoEconomia, PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";
import type { DadosPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { compararPontosPublicos, deslocarMes, rotuloPeriodoPublico } from "@/app/_painel/_dados/economiaModelo";
import { comSinal, numero, reais } from "@/lib/formatar";
import { HistoricoIndicador } from "./HistoricoIndicador";
import styles from "./indicador.module.css";
import { buscarPaginaMunicipal } from "@/lib/catalogoMunicipal";
import { idsMunicipais,INDICADORES_MUNICIPAIS,rotaMunicipal } from "@/lib/indicadoresMunicipais";

export function resumoIndicador(d: DadosPaginaEconomia): string {
  const referencia = rotuloPeriodoPublico(d.ultimo.mes,d.trimestral);
  const local = d.pagina.territorio?.localizacao ?? "em todo o Brasil";
  if (d.pagina.id === "gasolina") return `Em ${referencia}, o preço médio de revenda da gasolina comum ${local} foi de ${reais(d.ultimo.valor)} por litro. É a última média mensal disponível, em valores nominais.`;
  if (d.trimestral) return `No ${referencia}, a taxa de desocupação ${local} foi de ${numero(d.ultimo.valor,1)}%. A comparação entre estados usa esse mesmo trimestre civil da PNAD Contínua.`;
  return `A taxa de desemprego no Brasil foi de ${numero(d.ultimo.valor,1)}% no trimestre móvel encerrado em ${referencia}, último dado disponível da PNAD Contínua. A taxa mede a desocupação entre as pessoas na força de trabalho.`;
}

function TabelaHistorica({d,completa=false}:{d:DadosPaginaEconomia;completa?:boolean}) {
  const moeda = d.pagina.id === "gasolina";
  const pontos = completa ? d.principal.pontos : d.principal.pontos.slice(-24);
  return <div className={styles.tabelaRolagem} role="region" tabIndex={0} aria-label={completa ? "Histórico completo" : "Referências recentes"}><table>
    <caption>{completa ? "Série completa" : "Últimas 24 referências"} · {d.territorio} · {moeda ? "reais nominais por litro" : d.trimestral ? "trimestres civis, em %" : "trimestres móveis, em %"}</caption>
    <thead><tr><th scope="col">Referência</th><th scope="col">{moeda ? "Preço médio" : "Taxa de desocupação"}</th></tr></thead>
    <tbody>{[...pontos].reverse().map((p) => <tr key={p.mes}><th scope="row">{rotuloPeriodoPublico(p.mes,d.trimestral)}</th><td>{p.valor === null ? "Indisponível" : moeda ? reais(p.valor) : `${numero(p.valor,1)}%`}</td></tr>)}</tbody>
  </table></div>;
}

export function PaginaIndicador({dados:d}:{dados:DadosPaginaEconomia}) {
  const moeda = d.pagina.id === "gasolina", estados = d.trimestral;
  const referencia = rotuloPeriodoPublico(d.ultimo.mes,d.trimestral);
  const anteriores = compararPontosPublicos(d.principal.pontos,deslocarMes(d.ultimo.mes,-12),d.ultimo.mes,!moeda);
  const url = `${URL_SITE}${rotaEconomia(d.pagina)}`;
  const uf = d.pagina.territorio?.uf;
  const catalogo = catalogoEconomia();
  const pai = d.pagina.territorio ? PAGINAS_ECONOMIA.find((p) => p.id === d.pagina.id)! : null;
  const paginaUf = uf ? catalogo.find((p) => p.id === "gasolina" && p.territorio?.codigo === uf.codigo)! : null;
  const locais = catalogo.filter((p) => p.territorio && !p.territorio.uf && p.id === d.pagina.id);
  const municipios = moeda ? catalogo.filter((p) => p.territorio?.uf?.codigo === (uf?.codigo ?? d.pagina.territorio?.codigo) && p.territorio?.uf && p.slug !== d.pagina.slug) : [];
  const mesmoEstado = catalogo.filter((p) => p.territorio?.codigo === d.pagina.territorio?.codigo && p.territorio && p.id !== d.pagina.id);
  const estadoAtual = uf ? d.comparacao.find((r) => r.codigo === uf.codigo) : null;
  const localAtual = d.comparacao.find((r) => r.codigo === d.pagina.territorio?.codigo);
  const relacionados = PAGINAS_ECONOMIA.filter((p) => p.slug !== d.pagina.slug);
  const outrosMunicipais=uf?idsMunicipais.flatMap(id=>{const p=buscarPaginaMunicipal([id,uf.slug,d.pagina.slug.split('/').at(-1)!]);return p?[p]:[];}):[];
  const validos = d.comparacao.filter((r) => r.valor !== null);
  const schema = {"@context":"https://schema.org","@graph":[
    {"@type":"BreadcrumbList",itemListElement:[{name:"Início",item:URL_SITE},{name:"Explorar dados",item:URL_SITE+"/explorar"},...(pai ? [{name:pai.rotulo,item:`${URL_SITE}${rotaEconomia(pai)}`}] : []),...(paginaUf ? [{name:paginaUf.rotulo,item:`${URL_SITE}${rotaEconomia(paginaUf)}`}] : []),{name:d.pagina.rotulo,item:url}].map((item,i) => ({"@type":"ListItem",position:i+1,...item}))},
    {"@type":"WebPage","@id":`${url}#pagina`,url,name:d.pagina.titulo,inLanguage:"pt-BR",dateModified:d.revisadoEm,isPartOf:{"@id":`${URL_SITE}/#site`},mainEntity:{"@id":`${url}#dados`}},
    {"@type":"Dataset","@id":`${url}#dados`,url,name:d.pagina.titulo,description:resumoIndicador(d),inLanguage:"pt-BR",dateModified:d.revisadoEm,creator:{"@id":`${URL_SITE}/#organizacao`},isBasedOn:d.fonteUrl,spatialCoverage:d.pagina.territorio ? {"@type":uf ? "City" : "State",name:d.territorio,identifier:d.pagina.territorio.codigo,containedInPlace:uf ? {"@type":"State",name:uf.nome,identifier:uf.codigo,containedInPlace:{"@type":"Country",name:"Brasil"}} : {"@type":"Country",name:"Brasil"}} : d.territorio,temporalCoverage:`${d.principal.pontos[0].mes}-01/${d.ultimo.mes}-01`,variableMeasured:{"@type":"PropertyValue",name:moeda ? "Preço médio de revenda da gasolina comum" : "Taxa de desocupação",unitText:moeda ? "BRL/litro" : "%"}},
  ]};
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}} />
    <header>
      <nav aria-label="Navegação estrutural" className="flex flex-wrap gap-3 text-sm text-[var(--tinta-2)]"><Link href="/explorar">Explorar dados</Link><span aria-hidden="true">/</span>{pai && <><Link href={rotaEconomia(pai)}>{pai.rotulo}</Link><span aria-hidden="true">/</span></>}{paginaUf && <><Link href={rotaEconomia(paginaUf)}>{paginaUf.rotulo}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{d.pagina.rotulo}{uf ? ` (${uf.sigla})` : ""}</span></nav>
      <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{d.pagina.titulo}</h1>
      <p className="mb-5 mt-5 max-w-prose text-lg leading-relaxed">{resumoIndicador(d)}</p>
      {d.historicoPreservado && <p role="status" className="my-4 max-w-prose leading-relaxed"><strong>Histórico preservado.</strong> A fonte possui referências até {rotuloPeriodoPublico(d.referenciaFonte,d.trimestral)}. Este recorte mantém a última janela consistente, até {referencia}; ausência não foi convertida em zero.</p>}
      <p className="text-sm leading-relaxed text-[var(--tinta-2)]">Fonte: <a href={d.fonteUrl}>{d.fonte}</a> · {d.territorio} · {referencia}.</p>
      <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-2"><a href="#historico">Explorar o histórico</a>{d.comparacao.length>0 && <a href="#estados">Comparar estados</a>}{municipios.length>0 && <a href="#municipios">Explorar municípios</a>}<a href="#tabela">Tabela histórica</a><a href="#fontes">Fontes e metodologia</a></nav>
    </header>
    <section id="historico" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel className="font-semibold">{moeda ? "Como o preço da gasolina mudou?" : d.pagina.territorio ? `Como o desemprego evoluiu ${d.pagina.territorio.localizacao}?` : estados ? "Como o desemprego evoluiu em cada estado?" : "Como o desemprego evoluiu no Brasil?"}</TituloCompartilhavel>
      <p className="mt-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">Escolha o período{d.series.length>1 ? " e o território" : ""}. {moeda ? "Os preços são os pesquisados nos postos, sem descontar a inflação." : "As mudanças são apresentadas em pontos percentuais, sem confundir a taxa com o número de pessoas."}</p>
      <HistoricoIndicador series={d.series.filter((s) => s.pontos.some((p) => p.valor !== null))} principal={d.principal.codigo} trimestral={estados} moeda={moeda} />
    </section>
    <section className="vidro" data-lustro="fixo"><TituloCompartilhavel>Contexto da referência</TituloCompartilhavel><div className="mt-4">      {uf ? <p className="mb-4 max-w-prose leading-relaxed">Esta é a média pesquisada no município de {d.territorio} ({uf.sigla}). {estadoAtual?.valor !== null && estadoAtual?.valor !== undefined && <>Na mesma referência, a média da UF foi <strong>{reais(estadoAtual.valor)}/litro</strong>, uma diferença municipal de <strong>{reais(d.ultimo.valor-estadoAtual.valor)}/litro</strong>. </>}{d.brasil !== null && <>O Brasil registrou <strong>{reais(d.brasil)}/litro</strong>; a diferença do município para o país foi de <strong>{reais(d.ultimo.valor-d.brasil)}/litro</strong>.</>}</p> : d.pagina.territorio && <p className="mb-4 max-w-prose leading-relaxed">O recorte abrange toda a unidade da federação: {d.territorio}. {localAtual?.diferenca !== null && localAtual?.diferenca !== undefined && <>Na mesma referência, a diferença para o Brasil foi de <strong>{moeda ? `${reais(localAtual.diferenca)}/litro` : `${comSinal(localAtual.diferenca,1)} pontos percentuais`}</strong>; a média nacional foi <strong>{moeda ? `${reais(d.brasil!)}/litro` : `${numero(d.brasil!,1)}%`}</strong>. </>}{estados && localAtual?.cv !== null && localAtual?.cv !== undefined && <>O CV da estimativa estadual foi de {numero(localAtual.cv,1)}%; pequenas diferenças entre taxas não demonstram diferença estatisticamente significativa.</>}</p>}
      {d.amostra && <p className="mb-4 max-w-prose leading-relaxed">Número de postos pesquisados informado pela ANP: <strong>{numero(d.amostra.postos,0)}</strong>. {d.amostra.minimo !== null && d.amostra.maximo !== null && <>Os preços observados variaram de <strong>{reais(d.amostra.minimo)}</strong> a <strong>{reais(d.amostra.maximo)}</strong> por litro no mês. </>}Esses extremos são históricos e não identificam o posto mais barato hoje.</p>}
      {anteriores !== null && <p className="mb-4 leading-relaxed">Em relação à mesma referência do ano anterior, a mudança foi de <strong>{comSinal(anteriores,moeda ? 2 : 1)}{moeda ? "% no preço nominal" : " pontos percentuais"}</strong>.</p>}
</div></section>
    {d.comparacao.length>0 && <section id="estados" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel className="font-semibold">{moeda ? "Preço médio da gasolina por estado" : "Taxa de desemprego por estado"}</TituloCompartilhavel>
      <p className="my-3 max-w-prose leading-relaxed">Referência comum: <strong>{referencia}</strong>. Brasil: <strong>{d.brasil === null ? "indisponível" : moeda ? `${reais(d.brasil)}/litro` : `${numero(d.brasil,1)}%`}</strong>. {validos.length} das 27 UFs têm valor nessa referência. A tabela está ordenada do menor para o maior valor; estados sem dado permanecem identificados.</p>
      {estados && <p className="mb-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">A ordem é descritiva: pequenas diferenças não demonstram diferença estatisticamente significativa. O coeficiente de variação (CV) informa a precisão da estimativa; não é outra taxa de desemprego.</p>}
      <div className={styles.tabelaRolagem} role="region" tabIndex={0} aria-label="Comparação dos estados"><table>
        <caption>{moeda ? "Médias de revenda" : "PNAD Contínua trimestral"} · {referencia} · diferença em relação ao Brasil no mesmo período</caption>
        <thead><tr><th scope="col">Estado</th><th scope="col">{moeda ? "R$/litro" : "Desocupação"}</th><th scope="col">Diferença para o Brasil</th>{estados && <th scope="col">CV da estimativa</th>}</tr></thead>
        <tbody>{d.comparacao.map((r) => { const pagina = locais.find((p) => p.territorio?.codigo === r.codigo); return <tr key={r.codigo}><th scope="row">{pagina && pagina.slug !== d.pagina.slug ? <Link href={rotaEconomia(pagina)}>{r.nome}</Link> : r.nome}</th><td>{r.valor === null ? "Indisponível" : moeda ? reais(r.valor) : `${numero(r.valor,1)}%`}</td><td>{r.diferenca === null ? "Indisponível" : moeda ? `${reais(r.diferenca)}/litro` : `${comSinal(r.diferenca,1)} p.p.`}</td>{estados && <td>{r.cv === null ? "Indisponível" : `${numero(r.cv,1)}%`}</td>}</tr>; })}</tbody>
      </table></div>
    </section>}
    <section id="tabela" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel className="font-semibold">Histórico de {moeda ? "preços da gasolina" : "desocupação"} · {d.territorio}</TituloCompartilhavel>
      <TabelaHistorica d={d}/><DetalhesCompartilhaveis className="mt-4"><summary className="cursor-pointer py-2 font-medium">Ver a série completa desde {rotuloPeriodoPublico(d.principal.pontos[0].mes,estados)}</summary><TabelaHistorica d={d} completa /></DetalhesCompartilhaveis>
    </section>
    <section id="fontes" className="vidro" data-lustro="fixo">
      <TituloCompartilhavel className="font-semibold">Fontes e limites da comparação</TituloCompartilhavel>
      <div className="mt-4 max-w-prose space-y-4 leading-relaxed"><p className="text-sm leading-relaxed text-[var(--tinta-2)]">Fonte: {d.fonte}. Referência: {referencia}. Coleta consultada em <time dateTime={d.atualizadoEm}>{new Date(d.atualizadoEm).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}</time>. Revisão do conteúdo em <time dateTime={d.revisadoEm}>{new Date(d.revisadoEm).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}</time>.</p>
        <p>Fonte dos dados: <a href={d.fonteUrl}>{d.fonte}</a>. Cada número tem território, unidade e referência. Falta de dado não vira zero; datas futuras não são publicadas.</p>
        {moeda ? <>
          <p>Usamos a gasolina comum e o preço médio mensal de revenda. O agregado Brasil vem da própria ANP; não calculamos uma média simples dos estados. A metodologia de ponderação e a cobertura da pesquisa devem ser consultadas na fonte, pois mudaram ao longo da série.</p>
          <p>Os valores são nominais. Uma alta em reais não é automaticamente uma alta acima da inflação. Não mostramos preço de hoje nem identificamos o posto mais barato com essa base mensal.</p>
          {uf && <p>A média municipal é o agregado mensal publicado pela ANP para os postos pesquisados nessa cidade. A ANP informa média aritmética simples no nível municipal e metodologia ponderada nos agregados estaduais e nacionais. Os mínimos e máximos pertencem ao mês indicado, sem identificar disponibilidade atual. Mudanças na amostra podem afetar a comparação; cidades sem pesquisa suficiente não recebem página.</p>}
          <p>Petróleo, câmbio, tributos, etanol, distribuição e revenda podem afetar os preços. A série, sozinha, não determina a causa de uma mudança nem atribui responsabilidade ao governo.</p>
        </> : <>
          <p>A desocupação é a proporção de pessoas desocupadas na força de trabalho, conforme os critérios da PNAD Contínua para pessoas de 14 anos ou mais. Não é a proporção de desempregados em toda a população, nem o número de beneficiários do seguro-desemprego.</p>
          <p>{estados ? "Esta página usa a tabela 4099 do SIDRA, variável 4099, por trimestre civil. O Brasil e todas as UFs são comparados no mesmo trimestre. O CV vem da variável 4103." : "A série nacional vem do Banco Central (SGS 24369), com dados da PNAD Contínua. Cada referência é um trimestre móvel: setembro, por exemplo, corresponde a julho, agosto e setembro. Trimestres consecutivos se sobrepõem."}</p>
          <p>A página nacional por trimestre móvel e a comparação estadual por trimestre civil podem ter referências diferentes. Não misturamos as duas para ordenar estados. A PNAD Contínua começa em 2012; não emendamos pesquisas anteriores.</p>
          <p>Uma queda da taxa não descreve, sozinha, a qualidade do emprego, a informalidade ou a subutilização. Mudança durante um governo não comprova que ele a causou.</p>
        </>}
        <p><Link href="/metodologia">Leia a metodologia do observatório</Link>.</p>
      </div>
    </section>
    <section className="vidro" data-lustro="fixo">
      <TituloCompartilhavel className="font-semibold">Dúvidas frequentes</TituloCompartilhavel>
      <DetalhesCompartilhaveis className="mt-3"><summary className="cursor-pointer py-3 font-medium">{moeda ? "Esse é o preço da gasolina hoje?" : "Por que a taxa nacional pode diferir da comparação por estado?"}</summary><p className="max-w-prose pb-4 leading-relaxed">{moeda ? "Não. É a média mensal da pesquisa da ANP, na referência indicada. Um posto específico pode praticar outro preço." : "A divulgação nacional mensal usa trimestre móvel. A tabela por UF usa trimestre civil. A comparação só é válida quando a pesquisa, a medida e o período são os mesmos."}</p></DetalhesCompartilhaveis>
      <DetalhesCompartilhaveis><summary className="cursor-pointer py-3 font-medium">{moeda ? "A média dos estados é o preço médio do Brasil?" : "Cair de 10% para 8% significa queda de 2%?"}</summary><p className="max-w-prose pb-4 leading-relaxed">{moeda ? "Não necessariamente. Usamos o agregado Brasil publicado pela ANP, com sua metodologia, em vez de dar o mesmo peso a cada UF." : "A diferença é de 2 pontos percentuais. A variação relativa seria de 20%, mas não é a medida usada aqui para comparar as taxas."}</p></DetalhesCompartilhaveis>
    </section>
    {municipios.length>0 && <section id="municipios" className="vidro" data-lustro="fixo"><TituloCompartilhavel className="font-semibold">Gasolina nos municípios de {uf?.nome ?? d.territorio}</TituloCompartilhavel><p className="mt-3 max-w-prose leading-relaxed">Médias mensais municipais com histórico. Explore {uf ? "outras cidades da mesma UF" : "as cidades da UF"}.</p><ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{(uf ? municipios.slice(0,9) : municipios).map((p) => <li key={p.slug}><Link href={rotaEconomia(p)}>{p.rotulo}</Link></li>)}</ul>{paginaUf && <p className="mt-5"><Link href={`${rotaEconomia(paginaUf)}#municipios`}>Ver todos os municípios disponíveis na UF</Link></p>}</section>}
    {locais.some((p) => p.slug !== d.pagina.slug) && <section className="vidro" data-lustro="fixo"><TituloCompartilhavel className="font-semibold">Explore {moeda ? "a gasolina" : "o desemprego"} por estado</TituloCompartilhavel><ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{locais.filter((p) => p.slug !== d.pagina.slug).map((p) => <li key={p.slug}><Link href={rotaEconomia(p)}>{p.rotulo}</Link></li>)}</ul></section>}
    <section className="vidro" data-lustro="fixo"><TituloCompartilhavel className="font-semibold">Continue explorando</TituloCompartilhavel><ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">{outrosMunicipais.map(p=><li key={p.id}><Link href={rotaMunicipal(p.id,p.municipio)}>{INDICADORES_MUNICIPAIS[p.id].nome} · {p.municipio.nome}</Link></li>)}{[...mesmoEstado,...relacionados].map((p) => <li key={p.slug}><Link href={rotaEconomia(p)}>{p.territorio ? p.titulo : p.rotulo}</Link></li>)}</ul></section>
  </main>;
}
