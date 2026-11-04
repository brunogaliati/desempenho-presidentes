import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { sql } from "@/lib/db";

import { montarAreas, type LinhaAreaProtegida } from "@/app/_painel/_dados/ambienteMunicipal";

/**
 * O desmatamento dentro de cada Terra Indígena e Unidade de Conservação, por ano
 * PRODES, para pintar os contornos de `public/painel/areas-protegidas.json`.
 * Rota à parte: só é pedida quando alguém vê essas áreas no mapa.
 *
 */

async function montar() {
  const [linhas, publicados] = await Promise.all([
    sql`select recorte, bioma, nome, ano_prodes as ano, area_km2::float8 as area
          from mart.desmatamento_recorte
         where recorte in ('ti', 'uc') and anos = 1 and ano_prodes >= 2017 and area_km2 > 0`,
    sql`select bioma, array_agg(distinct ano_prodes order by ano_prodes) as anos
          from mart.desmatamento_bioma_uf where anos = 1 group by bioma`,
  ]);
  return montarAreas(
    linhas as LinhaAreaProtegida[],
    Object.fromEntries((publicados as { bioma: string; anos: number[] }[]).map((p) => [p.bioma, p.anos])),
  );
}

const montarDoCache = unstable_cache(montar, ["ambiente-protegidas-v1"], { revalidate: 3600, tags: ["painel-economia"] });

export async function GET() {
  return NextResponse.json(await montarDoCache());
}
