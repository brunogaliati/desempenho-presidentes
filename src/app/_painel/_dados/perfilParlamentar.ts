import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";

import type { CasaCongresso, PerfilParlamentar } from "./congressoModelo";
import fotografia from "./fotografia.json";

/** Ano em que começa a legislatura (a 57ª começou em 2023). */
const inicioDaLegislatura = (l: number) => 1795 + 4 * l;

async function perfilSemCache(casa: CasaCongresso, id: number): Promise<PerfilParlamentar | null> {
  const pessoa = fotografia[casa].find(p => p.id === id);
  if (!pessoa) return null;
  const casaBanco = casa === "deputados" ? "camara" : "senado";
  const [cadastros, periodos, emendas] = await Promise.all([
    sql`select nome_civil, to_char(nascimento, 'YYYY-MM-DD') as nascimento, naturalidade_municipio, naturalidade_uf, escolaridade
      from mart.parlamentar_cadastro where casa = ${casaBanco} and parlamentar_id = ${id} limit 1`,
    casa === "deputados"
      ? sql`select legislatura::int as inicio, legislatura::int as fim from mart.deputado_federal_intervalo where deputado_id = ${id} group by legislatura order by legislatura`
      : sql`select extract(year from inicio_previsto)::int as inicio, extract(year from fim_previsto)::int as fim
          from mart.parlamentar_mandato where casa = 'senado' and parlamentar_id = ${id} order by inicio_previsto`,
    sql`select ano_emenda::int as ano,sum(valor_previsto)::float8 as valor,count(distinct instrumento_id)::int as planos
      from mart.emendas_planos where casa=${casaBanco} and parlamentar_id=${id}
        and fonte in ('transferegov_executor','cgu_plano_especial') and valor_previsto is not null group by ano_emenda order by ano_emenda`,
  ]);
  const c = cadastros[0] as { nome_civil: string | null; nascimento: string | null; naturalidade_municipio: string | null; naturalidade_uf: string | null; escolaridade: string | null } | undefined;
  const p = periodos as { inicio: number; fim: number }[];
  const trajetoria = p.length ? casa === "deputados"
    ? { periodos: p.length, desde: inicioDaLegislatura(p[0].inicio), ate: inicioDaLegislatura(p[p.length - 1].fim) + 4 }
    : { periodos: p.length, desde: p[0].inicio, ate: p[p.length - 1].fim }
    : null;
  return {
    nomeCivil: c?.nome_civil ?? null,
    nascimento: c?.nascimento ?? null,
    naturalidade: c?.naturalidade_municipio ? `${c.naturalidade_municipio}${c.naturalidade_uf ? ` (${c.naturalidade_uf})` : ""}` : null,
    escolaridade: c?.escolaridade ?? null,
    trajetoria,
    emendas: emendas.length ? { nome: pessoa.nome, anos: emendas.map(r => ({ ano: Number(r.ano), valor: Number(r.valor), planos: Number(r.planos) })) } : null,
  };
}

export const carregarPerfilParlamentar = unstable_cache(perfilSemCache, ["congresso-perfil-v3"], { revalidate: 3600, tags: ["painel-congresso"] });
