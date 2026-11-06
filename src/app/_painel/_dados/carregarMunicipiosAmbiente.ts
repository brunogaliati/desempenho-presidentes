import { unstable_cache } from "next/cache";
import "server-only";

import { sql } from "@/lib/db";

import biomas from "@/app/_painel/_dados/biomas-municipios.json";
import queimadas from "@/app/_painel/_dados/queimadas.json";
import {
  janela12,
  montarMunicipios,
  type Janela12,
  type LinhaDesmatamentoMunicipio,
  type LinhaIbamaMunicipio,
} from "@/app/_painel/_dados/ambienteMunicipal";

/**
 * O meio ambiente dos 5.570 municípios, para o mapa da aba: desmatamento do
 * PRODES por ano, alertas e cicatrizes de queimada do DETER e autos, multas e
 * embargos do Ibama em 12 meses,
 * focos do arquivo anual do INPE e o bioma predominante do IBGE.
 *
 * Cada fonte falha sozinha e sai da resposta.
 */

const CLASSES_DESMATAMENTO = ["DESMATAMENTO_CR", "DESMATAMENTO_VEG", "MINERACAO"];
const CLASSE_QUEIMADA = "CICATRIZ_DE_QUEIMADA";

const coleta = (linhas: unknown) => ((linhas as { coletado_em: string | null }[])[0]?.coletado_em ?? null);

/** O DETER começa em ago/2016 na Amazônia e mai/2018 no Cerrado: antes disso, sem base, e não zero. */
const DETER_AMAZONIA = "2016-08-01";
const DETER_CERRADO = "2018-05-01";

const mesAntes = (mes: string) => {
  const t = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 2;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

async function montar(posse: string, ate: string | null) {
  const fimRecebido = mesAntes(posse);
  const r = janela12(fimRecebido);
  // O ano PRODES termina em julho: quem assume em agosto já recebeu o que fechou.
  const anoAntes = (mes: string) => (Number(mes.slice(5, 7)) > 7 ? Number(mes.slice(0, 4)) : Number(mes.slice(0, 4)) - 1);
  const anoRecebido = anoAntes(posse);
  const anoFinal = ate ? anoAntes(ate) : 9999;
  const [desmatamento, publicados, fimAlertas, fimIbama] = await Promise.all([
    sql`select codigo as municipio, bioma, ano_prodes as ano, area_km2::float8 as area,
               situacao = 'preliminar' as preliminar
          from mart.desmatamento_recorte
         where recorte = 'municipio' and anos = 1 and ano_prodes >= 2017`.catch(() => null),
    sql`select bioma, array_agg(distinct ano_prodes order by ano_prodes) as anos,
               to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
          from mart.desmatamento_bioma_uf where anos = 1 group by bioma`.catch(() => null),
    // O último mês inteiro dos dois biomas: a janela só fecha onde os dois publicaram.
    sql`select to_char(min(ultimo), 'YYYY-MM') as fim,
               to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
          from (select bioma, max(mes) as ultimo, max(coletado_em) as coletado_em
                  from mart.alerta_municipio_mensal where not mes_em_andamento group by bioma) b`.catch(() => null),
    sql`select to_char(date_trunc('month', max(coletado_em)) - interval '1 month', 'YYYY-MM') as fim,
               to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
          from mart.ibama_municipio_mensal`.catch(() => null),
  ]);
  const fimA = (fimAlertas as { fim: string | null }[] | null)?.[0]?.fim ?? null;
  const fimI = (fimIbama as { fim: string | null }[] | null)?.[0]?.fim ?? null;
  // As duas janelas fecham no mesmo mês, o mais antigo dos dois: a coluna diz um mês só.
  const ultimo = fimA && fimI ? (fimA < fimI ? fimA : fimI) : (fimA ?? fimI);
  // Num mandato encerrado, a janela fecha no fim dele.
  const fim = ate ? mesAntes(ate) : ultimo;
  const j = fim ? janela12(fim) : null;
  // Antes de a fonte existir não há alerta nenhum para somar: a lente fica sem medida.
  const temDeter = fimA && j && j.ate >= DETER_AMAZONIA;
  const [alertas, cicatrizes, ibama] = await Promise.all([
    temDeter
      ? sql`select municipio,
                 coalesce(sum(area_km2) filter (where mes between ${r.de}::date and ${r.ate}::date and (bioma = 'amazonia' or ${r.de}::date >= ${DETER_CERRADO}::date)), 0)::float8 as recebido,
                 coalesce(sum(area_km2) filter (where mes between ${j.de}::date and ${j.ate}::date and (bioma = 'amazonia' or ${j.de}::date >= ${DETER_CERRADO}::date)), 0)::float8 as atual
            from mart.alerta_municipio_mensal
           where classe = any(${CLASSES_DESMATAMENTO})
           group by municipio`.catch(() => null)
      : null,
    temDeter
      ? sql`select municipio,
                 coalesce(sum(area_km2) filter (where mes between ${r.de}::date and ${r.ate}::date), 0)::float8 as recebido,
                 coalesce(sum(area_km2) filter (where mes between ${j.de}::date and ${j.ate}::date), 0)::float8 as atual
            from mart.alerta_municipio_mensal
           where classe = ${CLASSE_QUEIMADA}
           group by municipio`.catch(() => null)
      : null,
    fimI && j
      ? sql`select municipio,
                 coalesce(sum(n_validos) filter (where fonte = 'autos' and mes between ${r.de}::date and ${r.ate}::date), 0)::int as "autosRecebido",
                 coalesce(sum(n_validos) filter (where fonte = 'autos' and mes between ${j.de}::date and ${j.ate}::date), 0)::int as "autosAtual",
                 coalesce(sum(n_validos) filter (where fonte = 'autos' and tipo = 'Flora' and mes between ${r.de}::date and ${r.ate}::date), 0)::int as "floraRecebido",
                 coalesce(sum(n_validos) filter (where fonte = 'autos' and tipo = 'Flora' and mes between ${j.de}::date and ${j.ate}::date), 0)::int as "floraAtual",
                 coalesce(sum(valor) filter (where fonte = 'autos' and mes between ${r.de}::date and ${r.ate}::date), 0)::float8 as "multasRecebido",
                 coalesce(sum(valor) filter (where fonte = 'autos' and mes between ${j.de}::date and ${j.ate}::date), 0)::float8 as "multasAtual",
                 coalesce(sum(n) filter (where fonte = 'embargos' and mes between ${r.de}::date and ${r.ate}::date), 0)::int as "embargosRecebido",
                 coalesce(sum(n) filter (where fonte = 'embargos' and mes between ${j.de}::date and ${j.ate}::date), 0)::int as "embargosAtual"
            from mart.ibama_municipio_mensal
           where mes >= ${r.de}::date
           group by municipio`.catch(() => null)
      : null,
  ]);
  const pub = (publicados as { bioma: string; anos: number[]; coletado_em: string | null }[] | null) ?? [];
  // Janela anterior à fonte fica sem base, e não zero. O Cerrado vale só para alertas:
  // a cicatriz de queimada vem da camada da Amazônia, inclusive onde o bioma é outro.
  const semBase = (lista: unknown, soAmazonia: boolean): Janela12[] | null => {
    const linhas = lista as Janela12[] | null;
    if (!linhas) return linhas;
    if (r.de < DETER_AMAZONIA) return linhas.map((x) => ({ ...x, recebido: null }));
    if (soAmazonia || r.de >= DETER_CERRADO) return linhas;
    return linhas.map((x) => ((biomas.municipios as Record<string, string>)[x.municipio] === "cerrado" ? { ...x, recebido: null } : x));
  };
  // O arquivo anual dos focos termina no último ano do mandato, e as colunas com ele.
  const anosFocos = queimadas.anos.filter((a) => !ate || a < Number(ate.slice(0, 4)) || (ate.slice(5, 7) !== "01" && a === Number(ate.slice(0, 4))));
  const municipioAnual = Object.fromEntries(
    Object.entries(queimadas.municipioAnual as Record<string, number[]>).map(([c, v]) => [c, v.slice(0, anosFocos.length)]),
  );
  return montarMunicipios({
    codigos: Object.keys(biomas.municipios),
    biomas: biomas.municipios as Record<string, string>,
    desmatamento: ((desmatamento as LinhaDesmatamentoMunicipio[] | null) ?? []).filter((x) => x.ano <= anoFinal),
    publicados: Object.fromEntries(pub.map((p) => [p.bioma, p.anos.filter((a) => a <= anoFinal)])),
    alertas: semBase(alertas, false),
    queimadas: semBase(cicatrizes, true),
    ibama: ibama as LinhaIbamaMunicipio[] | null,
    focos: { anos: anosFocos, municipioAnual },
    janelaAtual: fim,
    janelaRecebido: fimRecebido,
    anoRecebido,
    coletas: {
      prodes: pub.map((p) => p.coletado_em).filter(Boolean).sort().at(-1) ?? null,
      deter: coleta(fimAlertas),
      ibama: coleta(fimIbama),
      focos: queimadas.coletadoEm,
      biomas: biomas.coletadoEm,
    },
  });
}

const montarDoCache = unstable_cache(montar, ["ambiente-municipios-v6"], { revalidate: 3600, tags: ["painel-economia"] });
/** Mandato começa em janeiro ou, no de Temer, em agosto: o resto não vai ao banco nem ao cache. */
const MES = /^(19|20)\d{2}-(01|08)$/;

export function carregarMunicipiosAmbiente(posse: string, ate: string | null) {
  return MES.test(posse) && (ate === null || MES.test(ate) && posse < ate) ? montarDoCache(posse, ate) : montarDoCache("2023-01", null);
}
