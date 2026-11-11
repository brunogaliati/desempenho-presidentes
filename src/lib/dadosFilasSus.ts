import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { buscarMunicipioCodigo } from "./catalogoMunicipal";
import { FONTE_FILAS_SUS, type DadosFilaSus } from "./filasSusModelo";

export const carregarFilasSus = unstable_cache(async(territorio:string):Promise<DadosFilaSus>=>{
  const municipal=/^\d{7}$/.test(territorio);
  const disponivel=territorio==='BR'||territorio==='RS'||municipal&&buscarMunicipioCodigo(territorio)?.uf.sigla==='RS';
  const vazio:DadosFilaSus={territorio,disponivel,referencia:null,anos:[],situacoes:[],municipiosNaoResolvidos:0,fonte:FONTE_FILAS_SUS,coletadoEm:null};
  if(!disponivel)return vazio;
  // Nunca mistura fotografias de extrações diferentes para inventar um total atual.
  const [metas,situacoes,pendencias] = await Promise.all([
    sql`select to_char(max(data_extracao),'YYYY-MM-DD') as referencia,
      array_agg(distinct ano_solicitacao order by ano_solicitacao) as anos,to_char(max(coletado_em),'YYYY-MM-DD') as coletado_em
      from mart.sus_fila_gercon where data_extracao=(select max(data_extracao) from mart.sus_fila_gercon)`,
    sql`select situacao,sum(solicitacoes)::float8 as solicitacoes from mart.sus_fila_gercon
      where data_extracao=(select max(data_extracao) from mart.sus_fila_gercon)
        and (${municipal}::boolean=false or codigo_ibge=${territorio}) group by situacao order by situacao`,
    sql`select count(distinct municipio_fonte)::int as n from mart.sus_fila_gercon
      where codigo_ibge is null and data_extracao=(select max(data_extracao) from mart.sus_fila_gercon)`,
  ]);
  return {...vazio,referencia:metas[0]?.referencia??null,anos:metas[0]?.anos??[],coletadoEm:metas[0]?.coletado_em??null,
    situacoes:situacoes as DadosFilaSus['situacoes'],municipiosNaoResolvidos:Number(pendencias[0]?.n??0)};
},["sus-filas-v1"],{revalidate:3600,tags:["painel-saude"]});
