import "server-only";

import { sql } from "@/lib/db";
import type {
  Benchmark,
  Cobertura,
  DadosSite,
  Direcao,
  Indicador,
  PeriodoContinuo,
  Presidente,
  Serie,
  TipoSerie,
} from "@/types/dados";

/**
 * Carrega tudo que o site precisa, do Neon.
 *
 * Chamado em build time e nas revalidações do ISR — nunca por visita. Por isso
 * pode ser caro: três queries e a série histórica inteira.
 */

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Datas chegam como texto porque as queries usam `to_char`, nunca como `Date`.
 *
 * O driver constrói `Date` em meia-noite local; num fuso a leste de UTC,
 * `toISOString()` devolveria o dia anterior — e 1º de julho viraria 30 de
 * junho, jogando a observação para o mês errado. Formatar no Postgres elimina
 * a ambiguidade em vez de tentar corrigi-la depois.
 */
function texto(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v);
}

export async function carregarDados(): Promise<DadosSite> {
  const [
    presidentesRaw,
    indicadoresRaw,
    benchmarksRaw,
    seriesRaw,
    obsRaw,
    periodosRaw,
    indPeriodoRaw,
  ] = await Promise.all([
      sql`
        select id, pessoa_id, nome, nome_curto, mandato, partido, em_curso,
               foto_url, observacao,
               to_char(inicio, 'YYYY-MM-DD')          as inicio,
               to_char(fim, 'YYYY-MM-DD')             as fim,
               to_char(fim_alternativo, 'YYYY-MM-DD') as fim_alternativo
          from presidente
         order by inicio
      `,
      sql`
        select presidente_id, serie_id, serie_nome, serie_descricao, unidade,
               tipo, direcao, verificacao, fonte_nome, fonte_url, fonte_ref,
               cobertura, anos_cobertos,
               fracao_mandato_coberta, valor_inicial, valor_final,
               valor_minimo, valor_maximo, media_periodo, variacao_total,
               variacao_anualizada, unidade_anualizada, herdado_valor,
               tendencia_previa, delta_vs_tendencia, ressalva,
               to_char(data_inicio, 'YYYY-MM-DD') as data_inicio,
               to_char(data_fim, 'YYYY-MM-DD')    as data_fim
          from v_indicador_completo
         order by presidente_id, serie_id
      `,
      sql`
        select presidente_id, indicador_wb, regiao, media_periodo,
               valor_inicial, valor_final, n_anos
          from benchmark
         order by presidente_id, indicador_wb, regiao
      `,
      sql`
        select id, nome, unidade, frequencia from serie order by id
      `,
      // Séries diárias (câmbio) viram média mensal aqui, no banco: são 8.066
      // pontos que ninguém distingue num gráfico de 31 anos, e mandá-los ao
      // browser dobraria o peso da página. O `group by` também passa as séries
      // não-diárias intactas, já que cada grupo tem uma linha só.
      sql`
        select o.serie_id,
               to_char(
                 case when s.frequencia = 'diaria'
                      then date_trunc('month', o.data)::date
                      else o.data
                 end, 'YYYY-MM'
               )                    as mes,
               avg(o.valor)::float8 as valor
          from observacao o
          join serie s on s.id = o.serie_id
         group by 1, 2
         order by 1, 2
      `,
      sql`
        select id, pessoa_id, nome, nome_curto, n_mandatos, mandatos, em_curso,
               to_char(inicio, 'YYYY-MM-DD') as inicio,
               to_char(fim, 'YYYY-MM-DD')    as fim
          from periodo_continuo
         order by inicio
      `,
      // Os indicadores de período reaproveitam as colunas descritivas da série
      // via join, do mesmo jeito que `v_indicador_completo` faz para mandatos.
      sql`
        select ip.periodo_id, ip.serie_id, s.nome as serie_nome,
               s.descricao as serie_descricao, s.unidade, s.tipo, s.direcao,
               s.verificacao, f.nome as fonte_nome, f.url as fonte_url,
               s.fonte_ref, ip.cobertura, ip.anos_cobertos,
               ip.fracao_mandato_coberta, ip.valor_inicial, ip.valor_final,
               ip.valor_minimo, ip.valor_maximo, ip.media_periodo,
               ip.variacao_total, ip.variacao_anualizada,
               ip.unidade_anualizada, ip.herdado_valor, ip.tendencia_previa,
               ip.delta_vs_tendencia, ip.ressalva,
               to_char(ip.data_inicio, 'YYYY-MM-DD') as data_inicio,
               to_char(ip.data_fim, 'YYYY-MM-DD')    as data_fim
          from indicador_periodo ip
          join serie s on s.id = ip.serie_id
          join fonte f on f.id = s.fonte_id
         order by ip.periodo_id, ip.serie_id
      `,
    ]);

  // --- séries -------------------------------------------------------------
  const series: Record<string, Serie> = {};
  for (const s of seriesRaw as Record<string, unknown>[]) {
    const id = String(s.id);
    const diaria = s.frequencia === "diaria";
    series[id] = {
      id,
      nome: String(s.nome),
      unidade: String(s.unidade),
      frequencia: diaria ? "mensal" : String(s.frequencia),
      agregacao: diaria ? "média mensal de observações diárias" : null,
      datas: [],
      valores: [],
    };
  }

  for (const o of obsRaw as Record<string, unknown>[]) {
    const serie = series[String(o.serie_id)];
    if (!serie) continue;
    const mes = texto(o.mes);
    const valor = num(o.valor);
    if (!mes || valor === null) continue;
    serie.datas.push(mes);
    // 4 casas cobrem a série mais precisa (PTAX) e enxugam o HTML da página.
    serie.valores.push(Math.round(valor * 1e4) / 1e4);
  }

  // --- indicadores ---------------------------------------------------------
  // Mandatos e períodos contínuos produzem exatamente a mesma forma, porque
  // saem da mesma função de cálculo no backend. Uma conversão só evita que as
  // duas divirjam quando um campo for acrescentado.
  const agruparIndicadores = (linhas: unknown, chave: string) => {
    const mapa = new Map<string, Indicador[]>();
    for (const r of linhas as Record<string, unknown>[]) {
      const id = String(r[chave]);
      const lista = mapa.get(id) ?? [];
      lista.push({
        serieId: String(r.serie_id),
        serieNome: String(r.serie_nome),
        serieDescricao: String(r.serie_descricao),
        unidade: String(r.unidade),
        tipo: r.tipo as TipoSerie,
        direcao: r.direcao as Direcao,
        verificacao: String(r.verificacao),
        fonteNome: String(r.fonte_nome),
        fonteUrl: String(r.fonte_url),
        fonteRef: String(r.fonte_ref),
        cobertura: r.cobertura as Cobertura,
        dataInicio: texto(r.data_inicio),
        dataFim: texto(r.data_fim),
        anosCobertos: num(r.anos_cobertos),
        fracaoMandatoCoberta: num(r.fracao_mandato_coberta),
        valorInicial: num(r.valor_inicial),
        valorFinal: num(r.valor_final),
        valorMinimo: num(r.valor_minimo),
        valorMaximo: num(r.valor_maximo),
        mediaPeriodo: num(r.media_periodo),
        variacaoTotal: num(r.variacao_total),
        variacaoAnualizada: num(r.variacao_anualizada),
        unidadeAnualizada: r.unidade_anualizada
          ? String(r.unidade_anualizada)
          : null,
        herdadoValor: num(r.herdado_valor),
        tendenciaPrevia: num(r.tendencia_previa),
        deltaVsTendencia: num(r.delta_vs_tendencia),
        ressalva: r.ressalva ? String(r.ressalva) : null,
      });
      mapa.set(id, lista);
    }
    return mapa;
  };

  const indicadoresPorPresidente = agruparIndicadores(
    indicadoresRaw,
    "presidente_id",
  );
  const indicadoresPorPeriodo = agruparIndicadores(indPeriodoRaw, "periodo_id");

  // --- benchmark por presidente -------------------------------------------
  const benchmarkPorPresidente = new Map<string, Benchmark[]>();
  for (const b of benchmarksRaw as Record<string, unknown>[]) {
    const lista = benchmarkPorPresidente.get(String(b.presidente_id)) ?? [];
    lista.push({
      indicadorWb: String(b.indicador_wb),
      indicadorNome: NOMES_BENCHMARK[String(b.indicador_wb)] ?? String(b.indicador_wb),
      regiao: String(b.regiao),
      regiaoNome: NOMES_REGIAO[String(b.regiao)] ?? String(b.regiao),
      mediaPeriodo: num(b.media_periodo),
      valorInicial: num(b.valor_inicial),
      valorFinal: num(b.valor_final),
      nAnos: Number(b.n_anos ?? 0),
    });
    benchmarkPorPresidente.set(String(b.presidente_id), lista);
  }

  // --- presidentes --------------------------------------------------------
  const presidentes: Presidente[] = (
    presidentesRaw as Record<string, unknown>[]
  ).map((p) => ({
    id: String(p.id),
    pessoaId: String(p.pessoa_id ?? p.id),
    nome: String(p.nome),
    nomeCurto: String(p.nome_curto),
    mandato: Number(p.mandato),
    inicio: texto(p.inicio) ?? "",
    fim: texto(p.fim) ?? "",
    fimAlternativo: texto(p.fim_alternativo),
    partido: p.partido ? String(p.partido) : null,
    emCurso: Boolean(p.em_curso),
    fotoUrl: p.foto_url ? String(p.foto_url) : null,
    observacao: p.observacao ? String(p.observacao) : null,
    indicadores: indicadoresPorPresidente.get(String(p.id)) ?? [],
    benchmark: benchmarkPorPresidente.get(String(p.id)) ?? [],
  }));

  // --- períodos contínuos --------------------------------------------------
  const periodos: PeriodoContinuo[] = (
    periodosRaw as Record<string, unknown>[]
  ).map((p) => ({
    id: String(p.id),
    pessoaId: String(p.pessoa_id),
    nome: String(p.nome),
    nomeCurto: String(p.nome_curto),
    inicio: texto(p.inicio) ?? "",
    fim: texto(p.fim) ?? "",
    nMandatos: Number(p.n_mandatos),
    mandatos: Array.isArray(p.mandatos) ? p.mandatos.map(String) : [],
    emCurso: Boolean(p.em_curso),
    indicadores: indicadoresPorPeriodo.get(String(p.id)) ?? [],
  }));

  return {
    geradoEm: new Date().toISOString(),
    presidentes,
    periodos,
    series,
  };
}

/** Rótulos legíveis para os códigos do World Bank. */
const NOMES_BENCHMARK: Record<string, string> = {
  "NY.GDP.MKTP.KD.ZG": "Crescimento do PIB",
  "FP.CPI.TOTL.ZG": "Inflação ao consumidor",
  "SL.UEM.TOTL.ZS": "Desemprego",
  "NY.GDP.PCAP.KD": "PIB per capita",
};

const NOMES_REGIAO: Record<string, string> = {
  BRA: "Brasil",
  LCN: "América Latina e Caribe",
  MIC: "Países de renda média",
  WLD: "Mundo",
};
