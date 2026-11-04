import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { linhaMunicipalValida,type IndicadorMunicipal } from "./indicadoresMunicipais";

export interface LinhaContextoMunicipal {codigo:string;nome:string;uf:string;valor:number;extras:(number|null)[]}
export const resumoTerritorialMunicipal=unstable_cache(async(id:IndicadorMunicipal,referencia:string)=>{
  let linhas:LinhaContextoMunicipal[];
  let agregados:{codigo:string;valor:number}[]=[];
  if(id==='populacao'){
    linhas=await sql`select m.codigo_ibge codigo,m.nome,m.codigo_uf uf,p.populacao::float8 valor,array[]::float8[] extras
      from mart.populacao_estimada p join mart.municipio m on m.codigo_ibge=p.codigo_ibge
      where p.nivel='N6' and p.ano=${Number(referencia.slice(0,4))}` as LinhaContextoMunicipal[];
    agregados=await sql`select case when nivel='N1' then 'BR' else codigo_ibge end codigo,populacao::float8 valor
      from mart.populacao_estimada where nivel in ('N1','N3') and ano=${Number(referencia.slice(0,4))}` as {codigo:string;valor:number}[];
  } else if(id==='emprego-formal'){
    linhas=await sql`select m.codigo_ibge codigo,m.nome,m.codigo_uf uf,g.estoque::float8 valor,
      array[g.admissoes::float8,g.desligamentos::float8,g.saldo::float8] extras
      from mart.caged_emprego_mensal g join mart.municipio m on left(m.codigo_ibge,6)=g.codigo and m.uf=g.uf_sigla
      where g.nivel='municipio' and g.ajuste='com_ajustes' and g.mes=${referencia+'-01'}::date` as LinhaContextoMunicipal[];
    agregados=await sql`select case when nivel='brasil' then 'BR' else codigo end codigo,estoque::float8 valor
      from mart.caged_emprego_mensal where nivel in ('brasil','uf') and ajuste='com_ajustes' and mes=${referencia+'-01'}::date` as {codigo:string;valor:number}[];
  } else {
    linhas=await sql`select m.codigo_ibge codigo,m.nome,m.codigo_uf uf,
      case when t.recurso='bpc' then t.valores[array_position(t.variaveis,'Bem_BPC')] else t.valores[array_position(t.variaveis,'Fam_Cad')] end::float8 valor,
      case when t.recurso='bpc' then array[t.valores[array_position(t.variaveis,'Ido_BPC')]::float8,t.valores[array_position(t.variaveis,'PCD_BPC')]::float8]
      else array[t.valores[array_position(t.variaveis,'Pes_Cad')]::float8] end extras
      from mart.transferencia_renda t join mart.municipio m on m.codigo_ibge=t.codigo
      where t.nivel='municipio' and t.recurso=${id==='bpc'?'bpc':'cad_pbf'} and t.mes=${referencia+'-01'}::date` as LinhaContextoMunicipal[];
  }
  return {linhas:linhas.filter(l=>linhaMunicipalValida(id,{...l,referencia,atualizado:''})).sort((a,b)=>b.valor-a.valor || a.codigo.localeCompare(b.codigo)),agregados};
},['contexto-municipal-v1'],{revalidate:3600,tags:['painel-economia']});

export async function contextoDoMunicipio(id:IndicadorMunicipal,referencia:string,codigo:string) {
  const resumo=await resumoTerritorialMunicipal(id,referencia);
  const cidades=resumo.linhas.filter(l=>l.uf===codigo.slice(0,2)),i=cidades.findIndex(l=>l.codigo===codigo);
  if(i<0)return null;
  const atual=cidades[i],uf=resumo.agregados.find(a=>a.codigo===atual.uf)?.valor??null,brasil=resumo.agregados.find(a=>a.codigo==='BR')?.valor??null;
  const posicao=cidades.findIndex(l=>l.valor===atual.valor)+1;
  const comparaveis=cidades.slice(Math.max(0,i-2),Math.min(cidades.length,i+3)).filter(l=>l.codigo!==codigo);
  return {posicao,comDados:cidades.length,uf,brasil,participacao:uf!==null && uf>0?atual.valor/uf*100:null,comparaveis};
}
