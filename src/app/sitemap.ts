import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { podeIndexar, URL_SITE } from "@/lib/seo";
import { rotaEconomia } from "@/lib/catalogoEconomia";
import { paginasEconomiaPublicaveis } from "@/lib/dadosEconomiaPublica";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!podeIndexar()) return [];
  const [pessoas,paginas] = await Promise.all([sql`select distinct pessoa_id from presidente where pessoa_id is not null order by pessoa_id`,paginasEconomiaPublicaveis()]);
  return ["/", "/metodologia", ...paginas.map(rotaEconomia), ...pessoas.map((p) => `/presidente/${encodeURIComponent(String(p.pessoa_id))}`)]
    .map((caminho) => ({ url: `${URL_SITE}${caminho}` }));
}
