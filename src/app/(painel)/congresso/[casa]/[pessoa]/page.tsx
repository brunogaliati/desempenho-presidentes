import { notFound, permanentRedirect } from "next/navigation";

import { fotoParlamentar } from "@/app/_painel/_dados/fotoParlamentar";
import { acharParlamentar, historicoDaCota, metaParlamentar, nomeDaCasa, perfilOficialParlamentar } from "@/app/_painel/_dados/paginaParlamentar";
import { jsonLd, metadataPagina, URL_SITE } from "@/lib/seo";

export const revalidate = 3600;
type Parametros = { params: Promise<{ casa: string; pessoa: string }> };

export async function generateMetadata({ params }: Parametros) {
  const { casa, pessoa } = await params;
  const achado = acharParlamentar(casa, pessoa);
  if (!achado) return {};
  const { titulo, descricao } = metaParlamentar(achado);
  return metadataPagina(titulo, descricao, achado.caminho);
}

export default async function PaginaParlamentar({ params }: Parametros) {
  const { casa, pessoa } = await params;
  const achado = acharParlamentar(casa, pessoa);
  if (!achado) notFound();
  // Nome mudou ou o link veio só com o id: um endereço só por pessoa.
  if (`/congresso/${casa}/${pessoa}` !== achado.caminho) permanentRedirect(achado.caminho);
  const { pessoa: p } = achado;
  const url = `${URL_SITE}${achado.caminho}`;
  const perfilOficial = perfilOficialParlamentar(achado);
  const historico = historicoDaCota(achado);
  const meta = metaParlamentar(achado);
  const tituloDados = `Cota parlamentar de ${p.nome}, em reais da época`;
  const descricaoDados = `Totais anuais da cota parlamentar de ${p.nome} e média ${achado.casa === "deputados" ? "da" : "do"} ${nomeDaCasa(achado.casa)} entre quem apresentou notas. O ano em curso é parcial; ausência de registro não significa zero.`;
  // O visível é a aba Congresso do layout, que lê o endereço e abre a página da pessoa.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      // É uma página editorial sobre a pessoa, sem vínculo dela com o site.
      { "@type": "WebPage", "@id": `${url}#pagina`, url, name: meta.titulo, description: meta.descricao, inLanguage: "pt-BR", isPartOf: { "@id": `${URL_SITE}/#site` },
        mainEntity: { "@id": `${url}#pessoa` }, hasPart: { "@id": `${url}#cota` }, citation: [perfilOficial, historico.fontes.dados] },
      { "@type": "Person", "@id": `${url}#pessoa`, name: p.nome, identifier: `${achado.casa}:${p.id}`, url, image: fotoParlamentar(achado.casa, p.id) ?? undefined, sameAs: [perfilOficial],
          memberOf: { "@type": "GovernmentOrganization", name: nomeDaCasa(achado.casa) },
          ...(p.partido && p.partido !== "S/Partido" ? { affiliation: { "@type": "Organization", name: p.partido } } : {}) },
      { "@type": "Dataset", "@id": `${url}#cota`, url: `${url}#contexto-parlamentar`, name: tituloDados, description: descricaoDados,
        inLanguage: "pt-BR", about: { "@id": `${url}#pessoa` }, creator: { "@id": `${URL_SITE}/#organizacao` },
        isBasedOn: historico.fontes.dados, citation: historico.fontes.explicacao,
        variableMeasured: [{ "@type": "PropertyValue", name: "Gasto anual da cota parlamentar", unitText: "BRL" }, { "@type": "PropertyValue", name: "Média anual da casa entre quem apresentou notas", unitText: "BRL" }] },
      { "@type": "BreadcrumbList", itemListElement: [{ name: "Início", item: URL_SITE }, { name: "Congresso", item: `${URL_SITE}/congresso` }, { name: p.nome, item: url }].map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })) },
    ],
  }) }} />;
}
