import "server-only";
import { dataRevisao } from "./revisoesPublicadas";
import { cache } from "react";
import { sql } from "@/lib/db";
import { montarSalarioMinimo, type ObservacaoSalario } from "@/lib/salarioMinimoModelo";

export const carregarSalarioMinimo = cache(async () => {
  const [linhas, atualizacao] = await Promise.all([
    sql`select serie_id, to_char(data, 'YYYY-MM') as mes, valor::float8 as valor
        from observacao where serie_id in ('salario_minimo', 'salario_minimo_real', 'ipca') order by data`,
    sql`select to_char(max(atualizado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
        from serie where id in ('salario_minimo', 'salario_minimo_real', 'ipca')`,
  ]);
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return { ...montarSalarioMinimo(linhas as ObservacaoSalario[], hoje), revisadoEm: await dataRevisao("economia:salario-minimo"), atualizadoEm: String(atualizacao[0].atualizado_em) };
});
