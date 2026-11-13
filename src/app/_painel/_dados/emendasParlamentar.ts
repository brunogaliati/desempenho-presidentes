import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";
import fotografia from "./fotografia.json";
import type { CasaCongresso, PeriodoCota } from "./congressoModelo";
import { anosDasEmendas, type EmendasParlamentar, type MunicipioEmenda, type PlanoEmenda } from "./emendasParlamentarModelo";

type Linha = { codigo: string; nome: string; destinado: string | null; pago: string | null };
const medida = (v: string | null) => v === null ? null : Number(v);
const municipios = (linhas: Linha[]): MunicipioEmenda[] => linhas.map(r => ({ codigo: r.codigo, nome: r.nome, destinado: medida(r.destinado), pago: medida(r.pago) }));

async function emendasSemCache(casa: CasaCongresso, id: number, periodo: PeriodoCota): Promise<EmendasParlamentar | null> {
  const pessoa = fotografia[casa].find(p => p.id === id);
  if (!pessoa) return null;
  const casaBanco = casa === "deputados" ? "camara" : "senado";
  const { desde, ate } = anosDasEmendas(periodo);
  const [aplicacao, prefeituras, coletas, cobertura, planos, coletasPlanos] = await Promise.all([
    sql`select e.codigo_municipio as codigo, max(coalesce(m.nome,e.municipio)) as nome,
      (case when count(e.valor) filter(where e.fase='Empenho')=count(*) filter(where e.fase='Empenho')
        then sum(e.valor) filter(where e.fase='Empenho') end)::text as destinado,
      (case when count(e.valor) filter(where e.fase='Pagamento')=count(*) filter(where e.fase='Pagamento')
        then sum(e.valor) filter(where e.fase='Pagamento') end)::text as pago
      from mart.emendas_municipios e left join mart.municipio m on m.codigo_ibge=e.codigo_municipio
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
    sql`select coletado_em::text as data from mart.emendas_municipios_coleta`,
    sql`select
      case when count(*) filter(where fase='Empenho')>0 and count(valor) filter(where fase='Empenho')=count(*) filter(where fase='Empenho')
        then coalesce(sum(valor) filter(where fase='Empenho'),0)::text end as total,
      case when count(valor) filter(where fase='Empenho' and codigo_municipio is not null and uf=${pessoa.uf})=
        count(*) filter(where fase='Empenho' and codigo_municipio is not null and uf=${pessoa.uf})
        then coalesce(sum(valor) filter(where fase='Empenho' and codigo_municipio is not null and uf=${pessoa.uf}),0)::text end as no_estado,
      case when count(valor) filter(where fase='Empenho' and codigo_municipio is null)=count(*) filter(where fase='Empenho' and codigo_municipio is null)
        then coalesce(sum(valor) filter(where fase='Empenho' and codigo_municipio is null),0)::text end as sem_municipio,
      case when count(valor) filter(where fase='Empenho' and codigo_municipio is not null and uf<>${pessoa.uf})=
        count(*) filter(where fase='Empenho' and codigo_municipio is not null and uf<>${pessoa.uf})
        then coalesce(sum(valor) filter(where fase='Empenho' and codigo_municipio is not null and uf<>${pessoa.uf}),0)::text end as fora_estado,
      case when count(valor) filter(where fase='Pagamento' and codigo_municipio is null)=count(*) filter(where fase='Pagamento' and codigo_municipio is null)
        then coalesce(sum(valor) filter(where fase='Pagamento' and codigo_municipio is null),0)::text end as pago_sem_municipio,
      count(distinct codigo_emenda) filter(where origem='resumo_cgu' and valor is distinct from 0)::int as pendentes
      from mart.emendas_municipios where casa=${casaBanco} and parlamentar_id=${id}
        and ano_emenda between ${desde} and ${ate}`,
    sql`select codigo_emenda as emenda,fonte,instrumento_id as instrumento,executor_id as executor,objeto,situacao,
      codigo_municipio as "codigoMunicipio",municipio,uf,metodo_localizacao as "metodoLocalizacao",
      valor_previsto::text as previsto,valor_instrumento::text as "totalInstrumento",beneficiario,
      valor_empenho_plano::text as "empenhoPlano",documentos_empenho as documentos,
      conciliacao_empenho as conciliacao,fonte_url as "fonteUrl"
      from mart.emendas_planos where casa=${casaBanco} and parlamentar_id=${id}
        and ano_emenda between ${desde} and ${ate} and (uf=${pessoa.uf} or uf is null)`,
    sql`select coletado_em::text as data from mart.emendas_planos_coleta`,
  ]);
  if (coletas.length !== 1 || coletasPlanos.length !== 1) throw new Error("Fotografia municipal de emendas incompleta");
  const c = cobertura[0];
  return { uf: pessoa.uf, desde, ate, coletadoEm: coletas.map(c => String(c.data)).sort()[0],
    coletadoEmPlanos: String(coletasPlanos[0].data),
    planos: planos.map(p => ({ ...p, previsto: medida(p.previsto), totalInstrumento: medida(p.totalInstrumento), empenhoPlano: medida(p.empenhoPlano) })) as PlanoEmenda[],
    cobertura: { destinadoTotal: medida(c.total), destinadoNoEstado: medida(c.no_estado),
      destinadoSemMunicipio: medida(c.sem_municipio), destinadoForaEstado: medida(c.fora_estado),
      pagoSemMunicipio: medida(c.pago_sem_municipio), emendasPendentes: Number(c.pendentes) },
    aplicacao: municipios(aplicacao as Linha[]), prefeituras: municipios(prefeituras as Linha[]) };
}

export const carregarEmendasParlamentar = unstable_cache(emendasSemCache, ["congresso-emendas-municipios-v3"], {
  revalidate: 3600, tags: ["painel-congresso", "painel-economia"],
});
