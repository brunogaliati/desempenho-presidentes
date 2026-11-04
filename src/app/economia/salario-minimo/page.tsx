import { DetalhesCompartilhaveis } from "@/components/DetalhesCompartilhaveis";
import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import type { Metadata } from "next";
import Link from "next/link";
import { carregarSalarioMinimo } from "@/lib/salarioMinimo";
import { mesPorExtenso, numero, reais } from "@/lib/formatar";
import { jsonLd, metadataPagina, NOME_SITE, URL_SITE } from "@/lib/seo";
import { ROTA_SALARIO } from "@/lib/catalogoEconomia";
import { HistoricoSalario } from "./HistoricoSalario";
import styles from "../indicador.module.css";

export const revalidate = 3600;

const DECRETO = "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/d12797.htm";
const SERIE = "https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?method=consultarValores&codigoSeries=1619";
const IPCA = "https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html";

export async function generateMetadata(): Promise<Metadata> {
  const { ultimo } = await carregarSalarioMinimo();
  return metadataPagina(`Salário mínimo ${ultimo.mes.slice(0, 4)}: valor, reajuste e poder de compra`,
    `Salário mínimo de ${reais(ultimo.nominal)} em ${mesPorExtenso(ultimo.mes)}. Consulte os reajustes, a tabela histórica desde 1995 e o poder de compra corrigido pelo IPCA.`, ROTA_SALARIO);
}

export default async function SalarioMinimo() {
  const dados = await carregarSalarioMinimo();
  const { ultimo, reajuste, anterior, referenciaReal, historico, anuais, reajustes, atualizadoEm, revisadoEm } = dados;
  const aumento = anterior ? reajuste.nominal - anterior.nominal : null;
  const percentual = anterior ? (reajuste.nominal / anterior.nominal - 1) * 100 : null;
  const url = `${URL_SITE}${ROTA_SALARIO}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: URL_SITE },
        { "@type": "ListItem", position: 2, name: "Salário mínimo", item: url },
      ] },
      { "@type": "WebPage", "@id": `${url}#pagina`, url, name: "Salário mínimo: valor, reajuste e poder de compra", inLanguage: "pt-BR", dateModified: revisadoEm,
        isPartOf: { "@id": `${URL_SITE}/#site` }, mainEntity: { "@id": `${url}#dados` } },
      { "@type": "Dataset", "@id": `${url}#dados`, name: "Histórico do salário mínimo nacional e poder de compra",
        description: `Série mensal do salário mínimo nominal e real desde 1995. Valores reais corrigidos pelo IPCA para ${mesPorExtenso(referenciaReal)}.`,
        url, inLanguage: "pt-BR", temporalCoverage: `${historico[0].mes}-01/${ultimo.mes}-01`, dateModified: revisadoEm,
        creator: { "@id": `${URL_SITE}/#organizacao` }, isBasedOn: [SERIE, IPCA], spatialCoverage: "Brasil",
        variableMeasured: [
          { "@type": "PropertyValue", name: "Salário mínimo nominal", unitText: "BRL" },
          { "@type": "PropertyValue", name: "Salário mínimo corrigido pelo IPCA", unitText: `BRL de ${referenciaReal}` },
        ],
      },
    ],
  };
  return (
    <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
      <header className="border-b border-[var(--borda)] py-5">
        <nav aria-label="Navegação estrutural" className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--tinta-2)]">
          <Link href="/">{NOME_SITE}</Link><span aria-hidden="true">/</span><span aria-current="page">Salário mínimo</span>
        </nav>
        <h1 className="mt-10 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Salário mínimo: valor, reajuste e poder de compra</h1>
        <p className="mb-5 mt-5 max-w-prose text-lg leading-relaxed">
          O salário mínimo nacional registrado em <strong>{mesPorExtenso(ultimo.mes)}</strong> é de <strong>{reais(ultimo.nominal)} por mês</strong>.
          {anterior && <> O último reajuste identificado na série, em {mesPorExtenso(reajuste.mes)}, foi de {reais(aumento)} ({numero(percentual)}%), sobre {reais(anterior.nominal)}.</>}
        </p>
        <p className="text-sm leading-relaxed text-[var(--tinta-2)]">Último mês nominal disponível: {mesPorExtenso(ultimo.mes)}. Poder de compra calculado até {mesPorExtenso(referenciaReal)}. Coleta das séries em <time dateTime={atualizadoEm}>{new Date(atualizadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>. Revisão do conteúdo em <time dateTime={revisadoEm}>{new Date(revisadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>.</p>
        <nav aria-label="Nesta página" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="#historico">Explorar o histórico</a><a href="#tabela">Tabela por ano</a><a href="#reajustes">Todos os reajustes</a><a href="#fontes">Fontes e cálculo</a>
        </nav>
      </header>

      <section id="historico" className="vidro py-9" data-lustro="fixo">
        <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">O mínimo compra mais ou menos?</TituloCompartilhavel>
        <p className="mt-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">O valor no papel e o poder de compra contam histórias diferentes. Compare duas datas: a linha corrigida desconta a inflação e coloca os salários na mesma moeda.</p>
        <HistoricoSalario historico={historico} referenciaReal={referenciaReal} />
        <p className="mt-5 max-w-prose leading-relaxed">Entre reajustes, o valor nominal pode ficar igual enquanto o poder de compra muda com os preços. A correção usa o IPCA geral; ela não representa a cesta de consumo de cada família.</p>
      </section>

      <section id="tabela" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
        <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Salário mínimo por ano, desde 1995</TituloCompartilhavel>
        <p className="my-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">Último mês de cada ano com valor nominal e real disponíveis. O ano em andamento é parcial. Um reajuste no meio do ano aparece no histórico mensal e na lista completa abaixo.</p>
        <div className={styles.tabelaRolagem} tabIndex={0} role="region" aria-label="Tabela histórica do salário mínimo">
          <table>
            <caption>Valores da época e em reais de {mesPorExtenso(referenciaReal)}</caption>
            <thead><tr><th scope="col">Referência</th><th scope="col">Valor da época</th><th scope="col">Poder de compra</th></tr></thead>
            <tbody>{anuais.map((r) => <tr key={r.mes}><th scope="row">{mesPorExtenso(r.mes)}</th><td>{reais(r.nominal)}</td><td>{reais(r.real)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section id="reajustes" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
        <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Quando o salário mínimo mudou?</TituloCompartilhavel>
        <p className="my-3 max-w-prose leading-relaxed text-[var(--tinta-2)]">A série mensal preserva mudanças fora de janeiro, como as de janeiro e maio de 2023. O primeiro registro é o início do recorte; as demais linhas indicam mudanças do valor nominal.</p>
        <DetalhesCompartilhaveis><summary className="cursor-pointer py-2 font-medium">Ver todos os registros de mudança desde 1995</summary>
          <div className={styles.tabelaRolagem} tabIndex={0} role="region" aria-label="Reajustes do salário mínimo">
            <table><caption>Mês de registro na série do Banco Central</caption><thead><tr><th scope="col">Mês</th><th scope="col">Salário mínimo</th></tr></thead>
              <tbody>{[...reajustes].reverse().map((r) => <tr key={r.mes}><th scope="row">{mesPorExtenso(r.mes)}</th><td>{reais(r.nominal)}</td></tr>)}</tbody>
            </table>
          </div>
        </DetalhesCompartilhaveis>
      </section>

      <section id="fontes" className="vidro border-t border-[var(--borda)] py-9" data-lustro="fixo">
        <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Fontes e como fazemos a conta</TituloCompartilhavel>
        <div className="mt-4 max-w-prose space-y-4 leading-relaxed">
          <p>O valor nominal vem da <a href={SERIE}>série 1619 do Banco Central</a>. O <a href={DECRETO}>Decreto nº 12.797/2025</a> fixou R$ 1.621,00 a partir de 1º de janeiro de 2026. A tabela mostra o piso nacional, sem incluir pisos estaduais, de categorias ou descontos.</p>
          <p>O poder de compra é calculado com o <a href={IPCA}>IPCA do IBGE</a>, distribuído também pela série 433 do Banco Central. Multiplicamos o salário de cada mês pela razão entre o índice de preços do mês-base e o índice daquele mês. As taxas mensais são compostas, nunca somadas.</p>
          <p>O mês-base é {mesPorExtenso(referenciaReal)}, último IPCA disponível. Por isso, o valor nominal mais recente pode ter uma referência posterior à série real. Datas futuras não entram na página.</p>
          <p>O histórico começa em janeiro de 1995 para evitar a troca de moeda e os valores não comparáveis de 1994. O reajuste legal do piso e nossa correção pelo IPCA são cálculos diferentes. Mudança durante um governo não demonstra, por si só, sua causa.</p>
          <p><Link href="/economia/inflacao">Consulte o IPCA e a inflação acumulada</Link>, <Link href="/metodologia">leia a metodologia do observatório</Link> ou <Link href="/">compare os indicadores por governo</Link>.</p>
        </div>
      </section>
      <section className="vidro border-t border-[var(--borda)] pt-9" data-lustro="fixo">
        <TituloCompartilhavel className="text-2xl font-semibold tracking-tight">Dúvidas sobre o salário mínimo</TituloCompartilhavel>
        <DetalhesCompartilhaveis className="mt-4"><summary className="cursor-pointer py-3 font-medium">O que é salário mínimo real?</summary><p className="max-w-prose pb-4 leading-relaxed">É o valor nominal corrigido pela inflação para um mesmo mês-base. Ajuda a comparar poder de compra entre épocas; não é outro piso legal nem o salário mínimo necessário calculado pelo DIEESE.</p></DetalhesCompartilhaveis>
        <DetalhesCompartilhaveis><summary className="cursor-pointer py-3 font-medium">O aumento nominal é igual ao ganho real?</summary><p className="max-w-prose pb-4 leading-relaxed">Não. O aumento nominal compara os valores em reais de cada época. O ganho real desconta a mudança dos preços no período. Use a comparação de datas acima para ver a diferença.</p></DetalhesCompartilhaveis>
        <DetalhesCompartilhaveis><summary className="cursor-pointer py-3 font-medium">Por que o salário pode subir e comprar menos?</summary><p className="max-w-prose pb-4 leading-relaxed">Se os preços subirem mais do que o salário entre duas datas, o valor nominal aumenta, mas o poder de compra cai. O resultado depende do período e do índice de inflação escolhido.</p></DetalhesCompartilhaveis>
      </section>
    </main>
  );
}
