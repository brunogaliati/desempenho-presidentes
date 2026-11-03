import { notFound } from "next/navigation";
import { cache } from "react";
import { buscarPaginaEconomia, rotaEconomia } from "@/lib/catalogoEconomia";
import { carregarPaginaEconomia, paginasEconomiaPublicaveis } from "@/lib/dadosEconomiaPublica";
import { metadataPagina } from "@/lib/seo";
import { PaginaIndicador, resumoIndicador } from "../PaginaIndicador";

export const revalidate = 3600;

const buscar = cache(async (slug: string) => {
  const pagina = buscarPaginaEconomia(slug.split("/"));
  if (!pagina || pagina.propria) notFound();
  const dados = await carregarPaginaEconomia(pagina);
  if (!dados) notFound();
  return dados;
});

export async function generateStaticParams() {
  return (await paginasEconomiaPublicaveis()).filter((p) => !p.propria).map((p) => ({pagina:p.slug.split("/")}));
}

export async function generateMetadata({params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  const d = await buscar(pagina.join("/"));
  return metadataPagina(d.pagina.titulo,resumoIndicador(d),rotaEconomia(d.pagina),`/economia/imagens/${d.pagina.slug}`);
}

export default async function PaginaPublica({params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  return <PaginaIndicador dados={await buscar(pagina.join("/"))} />;
}
