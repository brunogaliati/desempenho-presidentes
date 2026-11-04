import "server-only";
import { dataRevisao } from "./revisoesPublicadas";
import { cache } from "react";
import { sql } from "@/lib/db";
import { montarInflacao } from "@/app/prototipo/_dados/economiaModelo";

export const carregarInflacao = cache(async () => {
  const [linhas, atualizacao] = await Promise.all([
    sql`select to_char(data, 'YYYY-MM') as mes, valor::float8 as valor from observacao where serie_id = 'ipca' order by data`,
    sql`select to_char(atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em from serie where id = 'ipca'`,
  ]);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return {
    ...montarInflacao({ datas: linhas.map((r) => String(r.mes)), valores: linhas.map((r) => Number(r.valor)) }, hoje),
    revisadoEm: await dataRevisao("economia:inflacao"), atualizadoEm: String(atualizacao[0]?.atualizado_em),
  };
});
