import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import { carregarIndicadorMunicipal } from "./dadosIndicadoresMunicipais";
import { carregarRedeSaude } from "./dadosRedeSaude";
import { idsMunicipais, type MunicipioIndicadores } from "./indicadoresMunicipais";
import { normalizarNomeMunicipal, recorteMunicipal } from "./resumoMunicipalModelo";

const eleitosDaUf = unstable_cache(async (uf: string, ano: number) => await sql`
  select distinct on(unidade_tse) unidade_tse,nome_unidade,nome_urna,nome,partido_sigla,
    to_char(data_eleicao,'YYYY-MM-DD') as data_eleicao
    from mart.eleitos_tse where uf=${uf} and cargo='PREFEITO' and ano_eleicao=${ano - 1}
      and resultado like 'ELEITO%' and data_eleicao<=current_date
    order by unidade_tse,data_eleicao desc,turno desc` as {
      unidade_tse:string;nome_unidade:string;nome_urna:string|null;nome:string;partido_sigla:string;data_eleicao:string;
    }[], ["resumo-prefeitos-v1"], { revalidate:3600,tags:["painel-resumo"] });

export async function carregarResumoMunicipal(m: MunicipioIndicadores, ano: number) {
  const ids = idsMunicipais.filter((id) => m.indicadores.includes(id));
  const [indicadores, eleitos, rede] = await Promise.all([
    Promise.allSettled(ids.map(async (id) => {
      const d = await carregarIndicadorMunicipal(id, m);
      return { id, dados:d, ...recorteMunicipal(id,d?.pontos ?? [],ano) };
    })),
    eleitosDaUf(m.uf.sigla,ano).then((linhas) => ({linhas,erro:false})).catch(() => ({linhas:[],erro:true})),
    carregarRedeSaude(m.codigo).catch(() => null),
  ]);
  const candidatos = eleitos.linhas.filter((e) => normalizarNomeMunicipal(e.nome_unidade) === normalizarNomeMunicipal(m.nome));
  return { indicadores:indicadores.map((r,i) => r.status === "fulfilled" ? r.value : {id:ids[i],dados:null,base:null,atual:null}),
    prefeito:candidatos.length===1?candidatos[0]:null, erroEleicao:eleitos.erro, rede };
}
