import "server-only";

import { sql } from "@/lib/db";
import { organizarMarcos, type LinhaMarco } from "./marcosModelo";
import type { MandatoVisual } from "./tipos";

/** A visão publica somente destaques validados com evidência oficial. */
export async function carregarMarcos(mandatos: Pick<MandatoVisual, "id">[], hoje: string) {
  const linhas = await sql`
    select mandato_id, evento_id, data::text, data_publicacao::text,
           rotulo, etapa, responsavel, documento, contexto, fonte, fonte_url
      from mart.marco_timeline
     where mandato_id = any(${mandatos.map((m) => m.id)})
     order by mandato_id, data, ordem, evento_id
  `;
  return organizarMarcos(linhas as LinhaMarco[], mandatos, hoje);
}
