import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "./db";
import type { DadosRedeSaude, RegistroRedeSaude } from "./redeSaudeModelo";

export const carregarRedeSaude = unstable_cache(async (territorio: string): Promise<DadosRedeSaude> => {
  const municipal = /^\d{7}$/.test(territorio);
  const linhas = municipal ? await sql`
    select to_char(u.mes,'YYYY-MM') as mes,
      case when m.codigo is not null then m.hospitais_sus when u.nao_mapeados=0 then 0 end as hospitais_sus,
      case when m.codigo is not null then m.leitos_sus when u.nao_mapeados=0 then 0 end as leitos_sus,
      case when m.codigo is not null then m.uti_sus when u.nao_mapeados=0 then 0 end as uti_sus,
      case when m.codigo is not null then m.leitos_gestao_estadual when u.nao_mapeados=0 then 0 end as leitos_gestao_estadual,
      u.nao_mapeados, to_char(u.coletado_em,'YYYY-MM-DD') as coletado_em
    from mart.saude_rede u
    left join mart.saude_rede m on m.nivel='municipio' and m.codigo=${territorio} and m.mes=u.mes
    where u.nivel='uf' and u.codigo=(select uf from mart.municipio where codigo_ibge=${territorio}) order by u.mes`
    : await sql`select to_char(mes,'YYYY-MM') as mes,hospitais_sus,leitos_sus,uti_sus,leitos_gestao_estadual,nao_mapeados,
      to_char(coletado_em,'YYYY-MM-DD') as coletado_em from mart.saude_rede where codigo=${territorio} and nivel in ('brasil','uf') order by mes`;
  return { territorio, linhas: linhas as RegistroRedeSaude[] };
}, ["rede-saude-v1"], { revalidate: 3600, tags: ["painel-saude"] });
