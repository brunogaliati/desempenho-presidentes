import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import type { DadosVotacoesAssembleia, VotacaoEstadual } from "./votacoesAssembleiaModelo";

export const carregarVotacoesAssembleia = unstable_cache(async (uf:string,posse:string,fim:string,executivo:boolean,busca:string,pagina:number):Promise<DadosVotacoesAssembleia> => {
  const [votacoes,contagem,referencia,cobertura] = await Promise.all([
    sql`select id_fonte,to_char(data_votacao,'YYYY-MM-DD') as data,titulo,ementa,resultado,sim,nao,abstencoes,executivo,fonte,proposicao,votos
      from mart.assembleia_votacao where uf=${uf} and data_votacao>=${posse+'-01'}::date and data_votacao<${fim+'-01'}::date
        and (${executivo}::boolean=false or executivo is true)
        and strpos(lower(titulo||' '||ementa),lower(${busca}))>0
      order by data_votacao desc,id_fonte limit 20 offset ${pagina*20}`,
    sql`select count(*)::int as total from mart.assembleia_votacao where uf=${uf}
      and data_votacao>=${posse+'-01'}::date and data_votacao<${fim+'-01'}::date
      and (${executivo}::boolean=false or executivo is true) and strpos(lower(titulo||' '||ementa),lower(${busca}))>0`,
    sql`select to_char(min(data_votacao),'YYYY-MM-DD') as inicio,to_char(max(data_votacao),'YYYY-MM-DD') as fim,
      to_char(max(coletado_em),'YYYY-MM-DD') as coletado_em from mart.assembleia_votacao where uf=${uf}`,
    sql`select estado,tipo,fonte_url,ressalva from mart.assembleia_votacoes_cobertura where uf=${uf} order by particao`,
  ]);
  const total=Number(contagem[0]?.total??0),r=referencia[0];
  return {uf,total,pagina,paginas:Math.max(1,Math.ceil(total/20)),inicio:r?.inicio??null,fim:r?.fim??null,coletadoEm:r?.coletado_em??null,
    cobertura:cobertura as DadosVotacoesAssembleia["cobertura"],votacoes:votacoes as VotacaoEstadual[]};
}, ["assembleias-votacoes-v1"], {revalidate:3600,tags:["painel-votacoes"]});
