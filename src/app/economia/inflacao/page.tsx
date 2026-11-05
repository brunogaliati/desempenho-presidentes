import { DetalhesCompartilhaveis } from "@/components/DetalhesCompartilhaveis";
import { Trilha } from "@/app/economia/Trilha";
import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import { FraseDaPagina } from "@/components/FraseDaPagina";
import type { Metadata } from "next";
import Link from "next/link";
import { carregarInflacao } from "@/lib/inflacao";
import { mesPorExtenso, numero } from "@/lib/formatar";
import { jsonLd, metadataPagina, URL_SITE } from "@/lib/seo";
import { ROTA_INFLACAO, ROTA_SALARIO } from "@/lib/catalogoEconomia";
import { HistoricoInflacao } from "./HistoricoInflacao";
import styles from "../indicador.module.css";

export const revalidate = 3600;
const IPCA = "https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html";
const SGS = "https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarValores&codigoSeries=433";
const pct = (v: number | null) => v === null ? "Indisponível" : `${numero(v)}%`;

export async function generateMetadata(): Promise<Metadata> {
  const { ultimo } = await carregarInflacao();
  return metadataPagina("IPCA acumulado: inflação em 12 meses, no ano e mês a mês",
    `IPCA de ${pct(ultimo.mensal)} em ${mesPorExtenso(ultimo.mes)}${ultimo.dozeMeses !== null ? ` e ${pct(ultimo.dozeMeses)} em 12 meses` : ""}. Consulte a inflação no ano, o histórico e compare períodos com dados do IBGE.`, ROTA_INFLACAO);
}

export default async function Inflacao() {
  const { historico, anuais, ultimo, atualizadoEm, revisadoEm } = await carregarInflacao();
  const url = `${URL_SITE}${ROTA_INFLACAO}`;
  const schema = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: URL_SITE },
        { "@type": "ListItem", position: 2, name: "Inflação (IPCA)", item: url },
      ] },
      { "@type": "WebPage", "@id": `${url}#pagina`, url, name: "IPCA acumulado: inflação em 12 meses, no ano e mês a mês", inLanguage: "pt-BR", dateModified: revisadoEm, isPartOf: { "@id": `${URL_SITE}/#site` }, mainEntity: { "@id": `${url}#dados` } },
      { "@type": "Dataset", "@id": `${url}#dados`, name: "IPCA mensal e acumulado no Brasil desde o Plano Real",
        description: "IPCA geral mensal do IBGE, via SGS 433, com acumulados compostos no ano e em 12 meses. O recorte começa em julho de 1994; os acumulados exigem todos os meses do período.",
        url, inLanguage: "pt-BR", temporalCoverage: `${historico[0].mes}-01/${ultimo.mes}-01`, dateModified: revisadoEm,
        creator: { "@id": `${URL_SITE}/#organizacao` }, isBasedOn: [IPCA, SGS], spatialCoverage: "Brasil",
        variableMeasured: ["IPCA mensal", "IPCA acumulado no ano", "IPCA acumulado em 12 meses"].map((name) => ({ "@type": "PropertyValue", name, unitText: "%" })),
      },
    ],
  };
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><FraseDaPagina texto={`IPCA de ${pct(ultimo.mensal)} em ${mesPorExtenso(ultimo.mes)}${ultimo.dozeMeses!==null?` e ${pct(ultimo.dozeMeses)} em 12 meses`:""}. Veja quanto os preços mudaram no período que quiser:`}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
    <header className="border-b border-[var(--borda)] py-5">
      <Trilha itens={[{nome:'Explorar dados',href:'/explorar'},{nome:'Inflação'}]}/>
      <h1 className="mt-10 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Inflação: IPCA mensal e acumulado</h1>
      <p className="mb-5 mt-5 max-w-prose text-lg leading-relaxed">Em <strong>{mesPorExtenso(ultimo.mes)}</strong>, último mês disponível, o IPCA variou <strong>{pct(ultimo.mensal)}</strong>.
        {ultimo.dozeMeses !== null ? <> Nos 12 meses encerrados nessa referência, a inflação acumulou <strong>{pct(ultimo.dozeMeses)}</strong>.</> : " O acumulado em 12 meses ainda não tem cobertura completa."}
        {ultimo.ano !== null ? <> De janeiro até esse mês, o acumulado foi de <strong>{pct(ultimo.ano)}</strong>.</> : " O acumulado no ano não tem cobertura completa."}
      </p>
      <p className="text-sm leading-relaxed text-[var(--tinta-2)]">Fonte: IBGE · Banco Central. Brasil · {mesPorExtenso(ultimo.mes)}.</p>
      <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"><a href="#historico">Explorar o histórico</a><a href="#mensal">Tabela mês a mês</a><a href="#anual">Inflação por ano</a><a href="#fontes">Fontes e cálculo</a></nav>
    </header>

    <section id="historico" className="vidro py-9" data-lustro="fixo">
      <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Quanto os preços mudaram no período?</TituloCompartilhavel>
      <p className="mt-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">Escolha as datas e veja o acumulado. No gráfico, alterne entre a variação mensal, o acumulado no ano e a inflação em 12 meses.</p>
      <HistoricoInflacao historico={historico} />
      <p className="mt-5 max-w-prose leading-relaxed">Inflação mais baixa significa que os preços subiram menos, quando a taxa continua positiva. Não significa que voltaram ao patamar anterior. Uma variação negativa indica queda do índice no período.</p>
    </section>

    <section id="mensal" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
      <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">IPCA mês a mês e acumulado</TituloCompartilhavel>
      <p className="my-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">As referências mais recentes, com três medidas diferentes. O acumulado no ano começa em janeiro; o de 12 meses pode atravessar dois anos.</p>
      <div className={styles.tabelaRolagem} tabIndex={0} role="region" aria-label="IPCA mensal e acumulado">
        <table><caption>Últimos 24 meses da série, em porcentagem</caption><thead><tr><th scope="col">Referência</th><th scope="col">No mês</th><th scope="col">No ano</th><th scope="col">Em 12 meses</th></tr></thead>
          <tbody>{historico.slice(-24).reverse().map((r) => <tr key={r.mes}><th scope="row">{mesPorExtenso(r.mes)}</th><td>{pct(r.mensal)}</td><td>{pct(r.ano)}</td><td>{pct(r.dozeMeses)}</td></tr>)}</tbody>
        </table>
      </div>
      <DetalhesCompartilhaveis variante="acao" className="mt-5"><summary>Ver todos os meses desde {mesPorExtenso(historico[0].mes)}</summary>
        <div className={styles.tabelaRolagem} tabIndex={0} role="region" aria-label="Histórico mensal completo do IPCA"><table>
          <caption>Série mensal completa do recorte, em porcentagem; indisponível indica falta de cobertura</caption><thead><tr><th scope="col">Referência</th><th scope="col">No mês</th><th scope="col">No ano</th><th scope="col">Em 12 meses</th></tr></thead>
          <tbody>{[...historico].reverse().map((r) => <tr key={r.mes}><th scope="row">{mesPorExtenso(r.mes)}</th><td>{pct(r.mensal)}</td><td>{pct(r.ano)}</td><td>{pct(r.dozeMeses)}</td></tr>)}</tbody>
        </table></div>
      </DetalhesCompartilhaveis>
    </section>

    <section id="anual" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
      <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Inflação por ano, desde 1995</TituloCompartilhavel>
      <p className="my-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">Acumulado de janeiro até o mês indicado. Somente a linha encerrada em dezembro representa um ano completo; as outras são parciais. Anos com lacunas não recebem acumulado.</p>
      <div className={styles.tabelaRolagem} tabIndex={0} role="region" aria-label="Inflação acumulada por ano"><table>
        <caption>Acumulado no ano até a referência, em porcentagem</caption><thead><tr><th scope="col">Referência</th><th scope="col">IPCA no ano</th><th scope="col">Cobertura</th></tr></thead>
        <tbody>{anuais.map((r) => <tr key={r.mes}><th scope="row">{mesPorExtenso(r.mes)}</th><td>{pct(r.ano)}</td><td>{r.ano === null ? "Incompleta" : r.mes.endsWith("-12") ? "Ano completo" : "Ano parcial"}</td></tr>)}</tbody>
      </table></div>
    </section>

    <section id="fontes" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
      <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Fontes e como calculamos a inflação</TituloCompartilhavel>
      <div className="mt-4 max-w-prose space-y-4 leading-relaxed"><p className="text-sm leading-relaxed text-[var(--tinta-2)]">Fonte: IBGE, IPCA geral, via Banco Central (SGS 433). Referência dos dados: {mesPorExtenso(ultimo.mes)}. Coleta da série em <time dateTime={atualizadoEm}>{new Date(atualizadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>. Revisão do conteúdo em <time dateTime={revisadoEm}>{new Date(revisadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>.</p>
        <p>O <a href={IPCA}>IPCA é produzido pelo IBGE</a>. Usamos a variação mensal do índice geral nacional, distribuída pela <a href={SGS}>série 433 do Banco Central</a>. O número não representa a inflação específica dos alimentos nem o custo de vida individual de cada família.</p>
        <p>Para acumular, multiplicamos os fatores mensais: (1 + taxa do mês ÷ 100). Depois subtraímos 1 e multiplicamos por 100. Por exemplo, doze meses de 1% resultam em 12,68%, e não em 12%. Não arredondamos os fatores antes de multiplicá-los; exibimos o resultado com duas casas decimais.</p>
        <p>O acumulado no ano usa janeiro até a referência. O acumulado em 12 meses usa a referência e os onze meses anteriores. A comparação de datas inclui as variações de todos os meses escolhidos, inclusive o primeiro e o último; um único mês retorna a taxa daquele mês.</p>
        <p>O recorte começa em julho de 1994, após o Plano Real. Por isso, o acumulado de 1994 não é apresentado como ano completo, e o primeiro acumulado de 12 meses do recorte só pode aparecer em junho de 1995. Meses ausentes permanecem sem valor e impedem o acumulado correspondente. Datas futuras não entram.</p>
        <p><Link href={ROTA_SALARIO}>Veja o efeito da inflação no poder de compra do salário mínimo</Link>, <Link href="/metodologia">leia a metodologia</Link> ou <Link href="/">compare os indicadores por governo</Link>.</p>
      </div>
    </section>
    <section className="vidro border-t border-[var(--borda)] pt-9" data-lustro="fixo">
      <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Dúvidas sobre inflação e IPCA</TituloCompartilhavel>
      <DetalhesCompartilhaveis className="mt-4"><summary className="cursor-pointer py-3 font-medium">Qual é a diferença entre IPCA mensal, no ano e em 12 meses?</summary><p className="max-w-prose pb-4 leading-relaxed">O mensal mede a variação de um mês. O acumulado no ano considera de janeiro até a referência. O de 12 meses considera os doze meses encerrados na referência, mesmo quando atravessam dois anos.</p></DetalhesCompartilhaveis>
      <DetalhesCompartilhaveis><summary className="cursor-pointer py-3 font-medium">Por que os preços continuam altos quando a inflação cai?</summary><p className="max-w-prose pb-4 leading-relaxed">Uma taxa positiva menor ainda significa aumento de preços, em ritmo mais lento. A queda do nível de preços no período exige uma variação negativa do índice.</p></DetalhesCompartilhaveis>
      <DetalhesCompartilhaveis><summary className="cursor-pointer py-3 font-medium">O IPCA é igual ao INPC ou ao IPCA-15?</summary><p className="max-w-prose pb-4 leading-relaxed">Não. São índices com diferenças de população de referência, abrangência ou período de coleta. Esta página apresenta somente o IPCA geral nacional; não substitui uma série pela outra.</p></DetalhesCompartilhaveis>
    </section>
  </main>;
}
