import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";
import fotografia from "./fotografia.json";
import type { CasaCongresso, PeriodoCota } from "./congressoModelo";
import { anosDasEmendas, type EmendasParlamentar, type MunicipioEmenda } from "./emendasParlamentarModelo";

type Linha = { codigo: string; nome: string; destinado: string | null; pago: string | null };
const medida = (v: string | null) => v === null ? null : Number(v);
const municipios = (linhas: Linha[]): MunicipioEmenda[] => linhas.map(r => ({ codigo: r.codigo, nome: r.nome, destinado: medida(r.destinado), pago: medida(r.pago) }));

async function emendasSemCache(casa: CasaCongresso, id: number, periodo: PeriodoCota): Promise<EmendasParlamentar | null> {
  const pessoa = fotografia[casa].find(p => p.id === id);
  if (!pessoa) return null;
  const casaBanco = casa === "deputados" ? "camara" : "senado";
  const { desde, ate } = anosDasEmendas(periodo);
  const [aplicacao, prefeituras, coletas] = await Promise.all([
    sql`select e.codigo_municipio as codigo, max(coalesce(m.nome,e.municipio)) as nome,
      (case when count(e.valor_destinado)=count(*) then sum(e.valor_destinado) end)::text as destinado,
      (case when count(e.valor_pago)=count(*) then sum(e.valor_pago) end)::text as pago
      from mart.emendas_parlamentar_municipio e left join mart.municipio m on m.codigo_ibge=e.codigo_municipio
      where e.casa=${casaBanco} and e.parlamentar_id=${id} and e.uf=${pessoa.uf}
        and e.ano_emenda between ${desde} and ${ate} and e.codigo_municipio is not null
      group by e.codigo_municipio`,
    sql`select e.codigo_municipio as codigo, max(coalesce(m.nome,e.municipio)) as nome, null::text as destinado,
      (case when count(e.valor_pago)=count(*) then sum(e.valor_pago) end)::text as pago
      from mart.emendas_parlamentar_municipio_recebido e left join mart.municipio m on m.codigo_ibge=e.codigo_municipio
      where e.casa=${casaBanco} and e.parlamentar_id=${id} and e.uf=${pessoa.uf}
        and e.ano_emenda between ${desde} and ${ate} and e.codigo_municipio is not null
        and e.tipo_destinatario='administracao_municipal'
      group by e.codigo_municipio`,
    sql`select dominio,coletado_em::text as data from mart.emendas_ultima_coleta`,
  ]);
  if (coletas.length !== 2) throw new Error("Fotografias de emendas incompletas");
  return { uf: pessoa.uf, desde, ate, coletadoEm: coletas.map(c => String(c.data)).sort()[0],
    aplicacao: municipios(aplicacao as Linha[]), prefeituras: municipios(prefeituras as Linha[]) };
}

export const carregarEmendasParlamentar = unstable_cache(emendasSemCache, ["congresso-emendas-municipios-v1"], {
  revalidate: 3600, tags: ["painel-congresso", "painel-economia"],
});
