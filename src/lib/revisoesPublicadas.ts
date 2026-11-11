import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { MUNICIPIOS_INDICADORES } from "./catalogoMunicipal";
import { catalogoEconomia } from "./catalogoEconomia";

// Alterar quando houver revisão significativa do texto, metodologia ou estrutura.
export const REVISAO_EDITORIAL="2026-11-04.1";
const hash=(partes:string[])=>createHash("sha256").update(partes.join("|")).digest("hex");

/** Assinaturas não contêm coleta, verificação, acesso ou timestamps de cache. */
export const revisoesPublicadas=unstable_cache(async()=>{
  const fontes=new Map<string,string>();
  const adicionar=(rows:{chave:string;assinatura:string}[])=>rows.forEach(r=>fontes.set(r.chave,r.assinatura));
  // Sequenciais: agregações históricas não competem por memória no banco.
  adicionar(await sql`select 'populacao:'||case when nivel='N6' then codigo_ibge else nivel||':'||codigo_ibge end chave,
    md5(string_agg(ano::text||':'||populacao::text,',' order by ano)) assinatura
    from mart.populacao_estimada where make_date(ano,7,1)<=current_date group by nivel,codigo_ibge` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select 'emprego-formal:'||case when nivel='municipio' then codigo else nivel||':'||codigo end chave,
    md5(string_agg(jsonb_build_array(mes,estoque,admissoes,desligamentos,saldo)::text,',' order by mes)) assinatura
    from mart.caged_emprego_mensal where ajuste='com_ajustes' and nivel in ('municipio','uf','brasil')
    and mes<date_trunc('month',current_date) group by nivel,codigo` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select case when recurso='bpc' then 'bpc:' else 'cadunico:' end||codigo chave,
    md5(string_agg(case when recurso='bpc' then jsonb_build_array(mes,valores[array_position(variaveis,'Bem_BPC')],valores[array_position(variaveis,'Ido_BPC')],valores[array_position(variaveis,'PCD_BPC')])
    else jsonb_build_array(mes,valores[array_position(variaveis,'Fam_Cad')],valores[array_position(variaveis,'Pes_Cad')]) end::text,',' order by mes)) assinatura
    from mart.transferencia_renda where nivel='municipio' and recurso in ('bpc','cad_pbf') and mes<date_trunc('month',current_date)
    group by recurso,codigo` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select 'serie:'||serie_id chave,md5(string_agg(jsonb_build_array(data,valor)::text,',' order by data)) assinatura
    from observacao where data<=current_date group by serie_id` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select 'gasolina:agregados' chave,md5(string_agg(jsonb_build_array(nivel,localidade,mes,preco_medio_revenda)::text,',' order by nivel,localidade,mes)) assinatura
    from mart.preco_combustivel_mensal where produto='GASOLINA COMUM' and nivel in ('brasil','estados') and unidade='R$/l'
    and not coalesce(mes_em_andamento,false) and mes<date_trunc('month',current_date)` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select 'gasolina:'||codigo_ibge chave,md5(string_agg(jsonb_build_array(mes,preco_medio,postos,preco_minimo,preco_maximo)::text,',' order by mes)) assinatura
    from mart.gasolina_municipal where mes<date_trunc('month',current_date) group by codigo_ibge` as {chave:string;assinatura:string}[]);
  adicionar(await sql`select 'pnad:estados' chave,md5(string_agg(jsonb_build_array(codigo_territorio,periodo,medida_codigo,valor)::text,',' order by codigo_territorio,periodo,medida_codigo)) assinatura
    from mart.pnad_trimestral where nivel in ('N1','N3') and medida_codigo in (4099,4103) and periodo_inicio+interval '3 months'<=current_date` as {chave:string;assinatura:string}[]);
  // Uma revisão em outra cidade pode alterar a posição e os vizinhos exibidos.
  const contexto=new Map<string,string[]>();
  for(const [chave,assinatura] of fontes){
    const m=chave.match(/^(populacao|emprego-formal|cadunico|bpc):(\d{6,7})$/);
    if(m){const grupo=`${m[1]}:contexto:${m[2].slice(0,2)}`;const valores=contexto.get(grupo)??[];valores.push(`${chave}:${assinatura}`);contexto.set(grupo,valores);}
  }
  for(const [chave,valores] of contexto)fontes.set(chave,hash(valores.sort()));
  const registros:{chave:string;assinatura:string}[]=[];
  const registrar=(chave:string,partes:string[])=>registros.push({chave,assinatura:hash([REVISAO_EDITORIAL,...partes])});
  for(const m of MUNICIPIOS_INDICADORES)for(const id of m.indicadores){
    const fonte=fontes.get(`${id}:${id==='emprego-formal'?m.codigo.slice(0,6):m.codigo}`);
    if(fonte)registrar(`${id}:${m.codigo}`,[fonte,fontes.get(`${id}:contexto:${m.uf.codigo}`)??'',fontes.get(`${id}:${id==='populacao'?'N3':'uf'}:${m.uf.codigo}`)??'',fontes.get(`${id}:${id==='populacao'?'N1:1':'brasil:BR'}`)??'']);
  }
  for(const p of catalogoEconomia()){
    const partes=p.id==='salario'?['serie:salario_minimo','serie:salario_minimo_real','serie:ipca']:p.id==='inflacao'?['serie:ipca']:p.id==='desemprego'?['serie:desemprego']:p.id==='estados'?['pnad:estados']:['gasolina:agregados',...(p.territorio?.uf?[`gasolina:${p.territorio.codigo}`]:[])];
    registrar(`economia:${p.slug}`,partes.map(k=>fontes.get(k)??''));
  }
  registrar('site:explorar',['catalogo-unificado-2026-11-04']);
  registrar('site:principal',['painel-publico-v1',...[...fontes].filter(([k])=>k.startsWith('serie:')).map(([,v])=>v).sort()]);
  for(const nome of ['metodologia','sobre','correcoes','economia','meio-ambiente','dinheiro','resumo'])registrar(`site:${nome}`,nome==='sobre'?['privacidade-ga4-compartilhamento-2026-11-06']:[]);
  // Lotes pequenos evitam esgotar a memória do Neon ao decodificar todo o cadastro.
  for(let inicio=0;inicio<registros.length;inicio+=500){
    await sql`insert into observatorio.revisao_publicacao as r(chave,assinatura)
      select chave,assinatura from jsonb_to_recordset(${JSON.stringify(registros.slice(inicio,inicio+500))}::jsonb) as x(chave text,assinatura text)
      on conflict(chave) do update set assinatura=excluded.assinatura,modificado_em=statement_timestamp(),verificado_em=statement_timestamp()
      where r.assinatura is distinct from excluded.assinatura`;
  }
  return await sql`select chave,to_char(modificado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') modificado from observatorio.revisao_publicacao` as {chave:string;modificado:string}[];
},["revisoes-publicadas-v2",REVISAO_EDITORIAL],{revalidate:3600,tags:["painel-economia"]});

export async function dataRevisao(chave:string) {
  const r=(await revisoesPublicadas()).find(r=>r.chave===chave);
  if(!r)throw new Error(`Revisão de publicação ausente: ${chave}`);
  return r.modificado;
}
