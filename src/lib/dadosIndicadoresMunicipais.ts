import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { sql } from "./db";
import { MUNICIPIOS_INDICADORES } from "./catalogoMunicipal";
import { prepararLinhasMunicipais, serieMunicipalPublicavel, type IndicadorMunicipal, type LinhaMunicipal, type MunicipioIndicadores } from "./indicadoresMunicipais";

const opcoes={revalidate:3600,tags:["painel-economia"]};
// No máximo 100 códigos municipais por prefixo: mantém os blocos abaixo do teto de 2 MB do cache.
const blocoMunicipal=unstable_cache(async(id:IndicadorMunicipal,prefixo:string)=>{
  if(id==="populacao") return await sql`select codigo_ibge codigo,ano::text||'-07' referencia,populacao::float8 valor,
    array[]::float8[] extras,to_char(coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') atualizado
    from mart.populacao_estimada where nivel='N6' and codigo_ibge like ${prefixo+'%'} order by ano` as (LinhaMunicipal&{codigo:string})[];
  if(id==="emprego-formal") return await sql`select m.codigo_ibge codigo,to_char(g.mes,'YYYY-MM') referencia,g.estoque::float8 valor,
    array[g.admissoes::float8,g.desligamentos::float8,g.saldo::float8] extras,
    to_char(g.coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') atualizado
    from mart.caged_emprego_mensal g join mart.municipio m on left(m.codigo_ibge,6)=g.codigo and m.uf=g.uf_sigla
    where g.nivel='municipio' and g.ajuste='com_ajustes' and g.codigo like ${prefixo+'%'} order by g.mes` as (LinhaMunicipal&{codigo:string})[];
  return await sql`select codigo,to_char(mes,'YYYY-MM') referencia,
    case when recurso='bpc' then valores[array_position(variaveis,'Bem_BPC')] else valores[array_position(variaveis,'Fam_Cad')] end::float8 valor,
    case when recurso='bpc' then array[valores[array_position(variaveis,'Ido_BPC')]::float8,valores[array_position(variaveis,'PCD_BPC')]::float8]
    else array[valores[array_position(variaveis,'Pes_Cad')]::float8] end extras,
    to_char(coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') atualizado
    from mart.transferencia_renda where nivel='municipio' and recurso=${id==='bpc'?'bpc':'cad_pbf'}
      and codigo like ${prefixo+'%'} order by mes` as (LinhaMunicipal&{codigo:string})[];
},["indicadores-municipais-bloco-v1"],opcoes);

export const coberturaMunicipal=unstable_cache(async()=>await sql`select indicador,codigo_ibge codigo,to_char(referencia,'YYYY-MM') referencia from mart.publicacao_indicador_municipal` as {indicador:IndicadorMunicipal;codigo:string;referencia:string}[],["cobertura-indicadores-municipais-v1"],opcoes);
export const paginasMunicipaisPublicaveis=cache(async()=>{
  const cobertura=new Map((await coberturaMunicipal()).map(r=>[`${r.indicador}:${r.codigo}`,r.referencia]));
  return MUNICIPIOS_INDICADORES.flatMap(m=>m.indicadores.flatMap(id=>{
    const referencia=cobertura.get(`${id}:${m.codigo}`);
    return referencia?[{id:id as IndicadorMunicipal,municipio:m,referencia}]:[];
  }));
});

export const carregarIndicadorMunicipal=cache(async(id:IndicadorMunicipal,m:MunicipioIndicadores)=>{
  const referencia=(await coberturaMunicipal()).find(r=>r.indicador===id && r.codigo===m.codigo)?.referencia;
  if(!referencia || !m.indicadores.includes(id)) return null;
  const pontos=prepararLinhasMunicipais(id,(await blocoMunicipal(id,m.codigo.slice(0,4))).filter(r=>r.codigo===m.codigo));
  if(!serieMunicipalPublicavel(id,pontos,referencia)) return null;
  const ultimo=pontos.at(-1)!;
  const atualizado=pontos.map(p=>p.atualizado).filter(Boolean).sort().at(-1)!;
  if(!Number.isFinite(new Date(atualizado).getTime())) throw new Error("Data de atualização municipal inválida.");
  return {id,municipio:m,pontos,ultimo,atualizado};
});
export type DadosIndicadorMunicipal=NonNullable<Awaited<ReturnType<typeof carregarIndicadorMunicipal>>>;
