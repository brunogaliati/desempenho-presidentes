import "server-only";

import { sql } from "@/lib/db";

import type { EntradaAmbiente, LinhaBioma, LinhaDeter, LinhaFoco, LinhaFocoBioma, LinhaIbama, LinhaProtegida, LinhaTaxa } from "./ambienteModelo";

/**
 * O meio ambiente como está no Neon, já agregado por UF e mês (ou ano PRODES).
 * Cada carga falha sozinha: quem chama troca a falha por `null` e a medida sai
 * da tela, nunca vira zero. As contas ficam em `ambienteModelo.ts`.
 */

const ultima = (linhas: { coletado_em: string | null }[]) =>
  linhas.map((r) => r.coletado_em).filter((c): c is string => c !== null).sort().at(-1) ?? null;

/** Focos do satélite de referência por UF e mês, e por bioma, com a data-limite da fonte. */
export async function carregarFocos(): Promise<NonNullable<EntradaAmbiente["focos"]>> {
  const [porUf, porBioma, meta] = await Promise.all([
    sql`select uf_codigo as uf, to_char(mes, 'YYYY-MM') as mes, sum(focos)::int as focos, bool_or(parcial) as parcial
          from mart.foco_queimada_mensal
         group by 1, 2
         order by 2, 1`,
    sql`select bioma_nome as bioma, to_char(mes, 'YYYY-MM') as mes, sum(focos)::int as focos
          from mart.foco_queimada_mensal
         where bioma_nome is not null
         group by 1, 2`,
    sql`select max(data_limite_fonte) as data_limite,
               to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
          from mart.foco_queimada_mensal`,
  ]);
  const m = (meta as { data_limite: string | null; coletado_em: string | null }[])[0];
  return {
    linhas: porUf as LinhaFoco[],
    porBioma: porBioma as LinhaFocoBioma[],
    dataLimite: m?.data_limite ?? null,
    coletadoEm: m?.coletado_em ?? null,
  };
}

/** Alertas DETER (Amazônia e Cerrado) por bioma, UF e mês: o desmatamento e a cicatriz de queimada. */
export async function carregarDeter(): Promise<NonNullable<EntradaAmbiente["deter"]>> {
  const linhas = (await sql`select bioma, uf, to_char(mes, 'YYYY-MM') as mes,
      coalesce(sum(area_km2) filter (where classe in ('DESMATAMENTO_CR', 'DESMATAMENTO_VEG', 'MINERACAO')), 0)::float8 as desmatamento,
      coalesce(sum(area_km2) filter (where classe = 'CICATRIZ_DE_QUEIMADA'), 0)::float8 as cicatriz,
      bool_or(mes_em_andamento) as "emAndamento",
      to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.alerta_ambiental_mensal
    group by 1, 2, 3
    order by 3, 1, 2`) as (LinhaDeter & { coletado_em: string | null })[];
  return { linhas, coletadoEm: ultima(linhas) };
}

/** A taxa anual PRODES da Amazônia Legal por UF, com o ano preliminar marcado. */
export async function carregarTaxaProdes(): Promise<NonNullable<EntradaAmbiente["taxa"]>> {
  const linhas = (await sql`select uf, ano_prodes as ano, area_km2::float8 as area,
      situacao = 'preliminar' as preliminar,
      to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.desmatamento_taxa
    order by ano, uf`) as (LinhaTaxa & { coletado_em: string | null })[];
  return { linhas, coletadoEm: ultima(linhas) };
}

/** Os incrementos PRODES de cada bioma por UF (`backend/desempenho/prodes_biomas.py`). */
export async function carregarProdesBiomas(): Promise<NonNullable<EntradaAmbiente["biomas"]>> {
  const linhas = (await sql`select bioma, uf, ano_prodes as ano, anos, area_km2::float8 as area,
      situacao = 'preliminar' as preliminar,
      to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.desmatamento_bioma_uf
    order by ano, bioma, uf`) as (LinhaBioma & { coletado_em: string | null })[];
  return { linhas, coletadoEm: ultima(linhas) };
}

/** O desmatamento dentro de Terras Indígenas e Unidades de Conservação, por ano, desde 2017. */
export async function carregarProtegidas(): Promise<NonNullable<EntradaAmbiente["protegidas"]>> {
  const linhas = (await sql`select recorte, bioma, codigo, nome, ano_prodes as ano, area_km2::float8 as area,
      situacao = 'preliminar' as preliminar,
      to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.desmatamento_recorte
    where recorte in ('ti', 'uc') and anos = 1 and ano_prodes >= 2017`) as (LinhaProtegida & { coletado_em: string | null })[];
  return { linhas, coletadoEm: ultima(linhas) };
}

/**
 * Autos de infração (sem os cancelados, com a soma dos valores informados) e
 * termos de embargo do Ibama, por UF e mês. Só datas válidas; desde 1999, para
 * a primeira janela de 12 meses fechar em dez/1999.
 */
export async function carregarIbama(): Promise<NonNullable<EntradaAmbiente["ibama"]>> {
  const linhas = (await sql`select case fonte_id when 'ibama_autos' then 'autos' else 'embargos' end as fonte,
      uf_sigla as uf, to_char(mes, 'YYYY-MM') as mes,
      sum(linhas_origem)::int as n,
      sum(soma_valor_inicial_informado)::float8 as valor,
      to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.ibama_situacao_uf
    where qualidade_data = 'valida' and mes >= '1999-01-01'
      and ((fonte_id = 'ibama_autos' and cancelado = 'N') or fonte_id = 'ibama_embargos')
    group by 1, 2, 3
    order by 3, 2`) as (LinhaIbama & { coletado_em: string | null })[];
  return { linhas, coletadoEm: ultima(linhas) };
}
