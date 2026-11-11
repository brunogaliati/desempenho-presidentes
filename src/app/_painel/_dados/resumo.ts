import "server-only";

import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";
import { carregarRedeSaude } from "@/lib/dadosRedeSaude";

import { EVENTOS, ETAPAS, eleicaoGeralAntes, juntarEleicoes, type CargoId, type DadosResumo, type Eleicao, type EtapaId, type EventoId } from "./resumoModelo";
import { senadoresNaPosse } from "./resumoComplementos";

/**
 * O resumo carrega à parte do painel, como o Dinheiro: segurança, Ideb e eleitos
 * só servem a esta aba. O cache guarda o país inteiro uma vez; cada pedido leva
 * só o território escolhido e o Brasil.
 */

const COD_UF: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE",
  "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};
export const SIGLAS_UF = Object.values(COD_UF);

/** O TSE escreveu algumas siglas de jeitos diferentes ao longo dos anos. */
const SIGLA_TSE: Record<string, string> = { "PC do B": "PCdoB", "PC DO B": "PCdoB", PCDOB: "PCdoB", "PT do B": "PTdoB", "PT DO B": "PTdoB" };

const CARGO: Record<string, CargoId> = {
  "DEPUTADO ESTADUAL": "estadual",
  "DEPUTADO DISTRITAL": "estadual",
  "DEPUTADO FEDERAL": "federal",
  SENADOR: "senador",
  PREFEITO: "prefeito",
};

interface Base {
  meses: string[];
  /** Por UF e por evento, alinhado a `meses`. `null` é mês sem dado, nunca zero. */
  seguranca: Record<string, Record<EventoId, (number | null)[]>>;
  populacao: Record<string, Record<string, number>>;
  ideb: { anos: number[]; uf: Record<string, Record<EtapaId, (number | null)[]>>; brasil: Record<string, Record<EtapaId, (number | null)[]>> };
  eleicoes: { ano: number; uf: string; cargo: CargoId; partido: string; n: number; dataSuplementar: string | null }[];
  saude: { uf: string; mes: string; valor: number | null; coletado_em: string }[];
  coletas: { seguranca: string | null; ideb: string | null; eleicoes: string | null };
}

async function lerBase(): Promise<Base> {
  const [seg, pop, ideb, eleitos, saude] = (await Promise.all([
    sql`select uf, to_char(mes, 'YYYY-MM') as mes, evento,
          sum(total_vitima)::float8 as vitimas, sum(total_ocorrencia)::float8 as ocorrencias,
          to_char(max(coletado_em), 'YYYY-MM-DD') as coletado_em
        from mart.seguranca_publica_uf
       where abrangencia = 'Estadual' and mes >= '2015-01-01'
         and evento = any(${EVENTOS.map((e) => e.fonte)}::text[])
       group by 1, 2, 3`,
    sql`select nivel, codigo_ibge, ano::int as ano, populacao::float8 as populacao
          from mart.populacao_estimada where nivel in ('N1', 'N3') and ano >= 2010`,
    sql`select nivel, territorio_codigo as codigo, rede, etapa, ano::int as ano, valor::float8 as valor,
          to_char(coletado_em, 'YYYY-MM-DD') as coletado_em
          from mart.ideb_resultado
         where indicador = 'VL_OBSERVADO' and etapa = any(${ETAPAS.map((e) => e.id)}::text[])
           and ((nivel = 'uf' and rede = 'Estadual') or (nivel = 'brasil' and rede in ('Estadual', 'Pública')))`,
    // Uma linha por eleito: o arquivo repete quem passou de turno e traz as eleições
    // suplementares do ano, que contariam um município duas vezes.
    sql`with e as (
          select distinct on (ano_eleicao, uf, cargo, case when cargo = 'PREFEITO' then unidade_tse else coalesce(candidato_id::text, nome) end)
                 ano_eleicao, uf, cargo, partido_sigla, coletado_em,
                 case when tipo_eleicao ilike '%suplementar%' then to_char(data_eleicao, 'YYYY-MM-DD') end as data_suplementar
            from mart.eleitos_tse
           where cargo = any(${Object.keys(CARGO)}::text[]) and resultado like 'ELEITO%'
             and (tipo_eleicao not ilike '%suplementar%' or cargo = 'SENADOR')
           order by ano_eleicao, uf, cargo, case when cargo = 'PREFEITO' then unidade_tse else coalesce(candidato_id::text, nome) end, turno desc
        )
        select ano_eleicao::int as ano, uf, cargo, partido_sigla as partido, count(*)::int as n,
               to_char(max(coletado_em), 'YYYY-MM-DD') as coletado_em, data_suplementar
          from e
         group by 1, 2, 3, 4, data_suplementar`,
    sql`select uf_sigla as uf, to_char(mes, 'YYYY-MM') as mes,
          case when sem_ressalvas_detectadas then total_prof_ativos::float8 end as valor,
          to_char(coletado_em, 'YYYY-MM-DD') as coletado_em
          from mart.saude_mais_medicos where uf_sigla <> ''`,
  ])) as [
    { uf: string; mes: string; evento: string; vitimas: number | null; ocorrencias: number | null; coletado_em: string }[],
    { nivel: string; codigo_ibge: string; ano: number; populacao: number }[],
    { nivel: string; codigo: string | null; rede: string; etapa: EtapaId; ano: number; valor: number | null; coletado_em: string }[],
    { ano: number; uf: string; cargo: string; partido: string; n: number; coletado_em: string; data_suplementar: string | null }[],
    Base["saude"],
  ];
  if (!seg.length) throw new Error("Sinesp sem dados");

  const meses = [...new Set(seg.map((r) => r.mes))].sort();
  const posMes = new Map(meses.map((m, i) => [m, i]));
  const porEvento = new Map(EVENTOS.map((e) => [e.fonte, e]));
  const seguranca: Base["seguranca"] = {};
  for (const r of seg) {
    const e = porEvento.get(r.evento);
    if (!e) continue;
    const uf = (seguranca[r.uf] ??= Object.fromEntries(EVENTOS.map((x) => [x.id, meses.map(() => null)])) as Record<EventoId, (number | null)[]>);
    uf[e.id][posMes.get(r.mes)!] = e.medida === "vitima" ? r.vitimas : r.ocorrencias;
  }

  const populacao: Base["populacao"] = {};
  for (const p of pop) {
    const chave = p.nivel === "N1" ? "BR" : COD_UF[String(p.codigo_ibge)];
    if (chave) (populacao[chave] ??= {})[p.ano] = p.populacao;
  }

  const anos = [...new Set(ideb.map((r) => r.ano))].sort((a, b) => a - b);
  const posAno = new Map(anos.map((a, i) => [a, i]));
  const vazio = () => Object.fromEntries(ETAPAS.map((e) => [e.id, anos.map(() => null)])) as Record<EtapaId, (number | null)[]>;
  const idebUf: Base["ideb"]["uf"] = {};
  const idebBr: Base["ideb"]["brasil"] = {};
  for (const r of ideb) {
    if (r.nivel === "uf" && !COD_UF[String(r.codigo)]) continue;
    const alvo = r.nivel === "uf" ? (idebUf[COD_UF[String(r.codigo)]] ??= vazio()) : (idebBr[r.rede] ??= vazio());
    alvo[r.etapa][posAno.get(r.ano)!] = r.valor;
  }

  const eleicoes = eleitos.flatMap((r) => {
    const cargo = CARGO[r.cargo];
    return cargo ? [{ ano: r.ano, uf: r.uf, cargo, partido: SIGLA_TSE[r.partido] ?? r.partido, n: r.n, dataSuplementar: r.data_suplementar }] : [];
  });

  const ultima = (xs: { coletado_em: string }[]) => xs.map((x) => x.coletado_em).filter(Boolean).sort().at(-1) ?? null;
  return {
    meses,
    seguranca,
    populacao,
    ideb: { anos, uf: idebUf, brasil: idebBr },
    eleicoes,
    saude,
    coletas: { seguranca: ultima(seg), ideb: ultima(ideb), eleicoes: ultima(eleitos) },
  };
}

const baseEmCache = unstable_cache(lerBase, ["painel-resumo-v3"], { revalidate: 3600 * 6, tags:["painel-resumo"] });

/** O Brasil num mês só existe com as 27 UFs; uma faltando, falta o total. */
function somaBrasil(base: Base, id: EventoId): (number | null)[] {
  return base.meses.map((_, i) => {
    let s = 0;
    for (const uf of SIGLAS_UF) {
      const v = base.seguranca[uf]?.[id]?.[i];
      if (v === null || v === undefined) return null;
      s += v;
    }
    return s;
  });
}

function agruparEleicoes(linhas: Base["eleicoes"]): Eleicao[] {
  const grupos = new Map<string, Map<string, number>>();
  for (const l of linhas) {
    const chave = `${l.ano}|${l.cargo}`;
    const g = grupos.get(chave) ?? new Map<string, number>();
    g.set(l.partido, (g.get(l.partido) ?? 0) + l.n);
    grupos.set(chave, g);
  }
  return [...grupos.entries()].map(([chave, g]) => {
    const [ano, cargo] = chave.split("|");
    const partidos = [...g.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { ano: Number(ano), cargo: cargo as CargoId, partidos, total: partidos.reduce((s, [, n]) => s + n, 0) };
  }).sort((a, b) => a.ano - b.ano);
}

export async function carregarResumo(territorio: string, posse: string): Promise<DadosResumo> {
  const [base, rede] = await Promise.all([baseEmCache(), carregarRedeSaude(territorio)]);
  const brasil = Object.fromEntries(EVENTOS.map((e) => [e.id, somaBrasil(base, e.id)])) as Record<EventoId, (number | null)[]>;
  const nacional = territorio === "BR";
  const local = nacional ? brasil : (base.seguranca[territorio] ?? Object.fromEntries(EVENTOS.map((e) => [e.id, base.meses.map(() => null)])) as Record<EventoId, (number | null)[]>);

  // Posição entre as redes estaduais, contando só as UFs com o dado naquela edição.
  const etapas = ETAPAS.map(({ id }) => {
    const brasilEtapa = base.ideb.brasil[nacional ? "Pública" : "Estadual"]?.[id] ?? base.ideb.anos.map(() => null);
    const localEtapa = nacional ? brasilEtapa : base.ideb.uf[territorio]?.[id] ?? base.ideb.anos.map(() => null);
    const posicao = base.ideb.anos.map((_, i) => {
      const v = localEtapa[i];
      if (nacional || v === null) return null;
      return 1 + SIGLAS_UF.filter((u) => (base.ideb.uf[u]?.[id]?.[i] ?? -1) > v).length;
    });
    const total = base.ideb.anos.map((_, i) => SIGLAS_UF.filter((u) => base.ideb.uf[u]?.[id]?.[i] != null).length || null);
    return { id, local: localEtapa, brasil: brasilEtapa, posicao, total };
  });

  const eleicoes = nacional ? base.eleicoes : base.eleicoes.filter((e) => e.uf === territorio);
  const senadores = senadoresNaPosse(eleicoes, eleicaoGeralAntes(posse), posse);
  const mesesSaude = [...new Set(base.saude.map((r) => r.mes))].sort();
  const saudePorMes = new Map<string, Map<string, number | null>>();
  for (const r of base.saude) {
    const mes = saudePorMes.get(r.mes) ?? new Map<string, number | null>();
    mes.set(r.uf, r.valor);
    saudePorMes.set(r.mes, mes);
  }
  const valoresSaude = mesesSaude.map((m) => {
    const linhas = saudePorMes.get(m)!;
    if (!nacional) return linhas.get(territorio) ?? null;
    const valores = SIGLAS_UF.map((uf) => linhas.get(uf));
    return valores.every((v): v is number => typeof v === "number") ? valores.reduce((s, v) => s + v, 0) : null;
  });
  return {
    territorio,
    rede,
    seguranca: { meses: base.meses, local, brasil, coletadoEm: base.coletas.seguranca },
    populacao: { local: base.populacao[territorio] ?? {}, brasil: base.populacao.BR ?? {} },
    ideb: { rede: nacional ? "Pública" : "Estadual", anos: base.ideb.anos, etapas, coletadoEm: base.coletas.ideb },
    eleicoes: agruparEleicoes(eleicoes.filter((e) => !e.dataSuplementar)),
    senado: juntarEleicoes(agruparEleicoes(senadores)),
    senadoSuplementares: [...new Set(senadores.flatMap((e) => e.dataSuplementar ? [e.dataSuplementar] : []))].sort(),
    saude: { meses: mesesSaude, valores: valoresSaude, coletadoEm: ultimaSaude(base.saude) },
    coletadoEm: [base.coletas.seguranca, base.coletas.ideb, base.coletas.eleicoes].filter(Boolean).sort().at(-1) ?? null,
  };
}

function ultimaSaude(linhas: Base["saude"]) {
  return linhas.map((r) => r.coletado_em).filter(Boolean).sort().at(-1) ?? null;
}
