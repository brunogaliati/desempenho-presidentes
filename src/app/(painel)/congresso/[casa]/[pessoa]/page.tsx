import { notFound, permanentRedirect } from "next/navigation";

import { fotoParlamentar } from "@/app/_painel/_dados/fotoParlamentar";
import { acharParlamentar, metaParlamentar, nomeDaCasa } from "@/app/_painel/_dados/paginaParlamentar";
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
  const perfilOficial = achado.casa === "deputados" ? `https://www.camara.leg.br/deputados/${p.id}` : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${p.id}`;
  // O visível é a aba Congresso do layout, que lê o endereço e abre a página da pessoa.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "ProfilePage", url, name: metaParlamentar(achado).titulo, inLanguage: "pt-BR", isPartOf: { "@id": `${URL_SITE}/#site` },
        mainEntity: { "@type": "Person", name: p.nome, image: fotoParlamentar(achado.casa, p.id) ?? undefined, sameAs: [perfilOficial],
          memberOf: { "@type": "GovernmentOrganization", name: nomeDaCasa(achado.casa) },
          ...(p.partido && p.partido !== "S/Partido" ? { affiliation: { "@type": "Organization", name: p.partido } } : {}) } },
      { "@type": "BreadcrumbList", itemListElement: [{ name: "Início", item: URL_SITE }, { name: "Congresso", item: `${URL_SITE}/congresso` }, { name: p.nome, item: url }].map((c, i) => ({ "@type": "ListItem", position: i + 1, ...c })) },
    ],
  }) }} />;
}
