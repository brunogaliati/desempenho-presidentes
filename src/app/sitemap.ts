import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { podeIndexar, URL_SITE } from "@/lib/seo";
import { rotaEconomia } from "@/lib/catalogoEconomia";
import { paginasEconomiaPublicaveis } from "@/lib/dadosEconomiaPublica";
import { paginasMunicipaisPublicaveis } from "@/lib/dadosIndicadoresMunicipais";
import { rotaMunicipal } from "@/lib/indicadoresMunicipais";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!podeIndexar()) return [];
  const [pessoas,paginas,municipais] = await Promise.all([sql`select distinct pessoa_id from presidente where pessoa_id is not null order by pessoa_id`,paginasEconomiaPublicaveis(),paginasMunicipaisPublicaveis()]);
  const ufs=new Map<string,Set<string>>();
  for(const p of municipais){const cidades=ufs.get(p.municipio.uf.slug)??new Set<string>();cidades.add(p.municipio.codigo);ufs.set(p.municipio.uf.slug,cidades);}
  const diretorios=["/economia/municipios",...[...ufs].flatMap(([uf,cidades])=>Array.from({length:Math.ceil(cidades.size/100)},(_,i)=>`/economia/municipios/${uf}${i?`?pagina=${i+1}`:""}`))];
  return ["/", "/metodologia", ...paginas.map(rotaEconomia),...municipais.map(p=>rotaMunicipal(p.id,p.municipio)),...diretorios, ...pessoas.map((p) => `/presidente/${encodeURIComponent(String(p.pessoa_id))}`)]
    .map((caminho) => ({ url: `${URL_SITE}${caminho}` }));
}
