import "server-only";

import { sql } from "@/lib/db";
import { inadimplenciaNacional, organizarExpectativas, serieComplementar, urlExpectativas, type ComplementoEconomia } from "./panoramaModelo";

export async function carregarEconomiaAmpliada(hoje: string): Promise<ComplementoEconomia> {
  const fontes = ["Emprego formal", "Crédito", "Execução orçamentária", "Expectativas de mercado"];
  const resultados = await Promise.allSettled([
    sql`select to_char(mes, 'YYYY-MM') as mes, estoque::float8, saldo::float8,
        admissoes::float8, desligamentos::float8,
        to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
      from mart.caged_emprego_mensal
      where nivel = 'brasil' and codigo = 'BR' and ajuste = 'com_ajustes'
        and mes >= '2021-01-01' and mes + interval '1 month' <= ${hoje}::date + 1
      order by mes`,
    sql`select cliente, to_char(mes, 'YYYY-MM') as mes,
        case when count(*) filter (where medida = 'carteira_ativa') = 27
          and count(valor_completo) filter (where medida = 'carteira_ativa') = 27
          then sum(valor_completo) filter (where medida = 'carteira_ativa')::float8 end as ativa,
        case when count(*) filter (where medida = 'carteira_inadimplencia') = 27
          and count(valor_completo) filter (where medida = 'carteira_inadimplencia') = 27
          then sum(valor_completo) filter (where medida = 'carteira_inadimplencia')::float8 end as vencida,
        count(distinct uf_sigla)::int as ufs,
        to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
      from mart.scr_medida_uf
      where medida in ('carteira_ativa','carteira_inadimplencia') and cliente in ('PF','PJ')
        and mes >= '2021-01-01' and mes + interval '1 month' <= ${hoje}::date + 1
      group by cliente, mes order by mes, cliente`,
    // Células exatas, sem somar estágios da despesa, previsões ou contas hierárquicas.
    sql`select exercicio, bimestre, conta_codigo, coluna, valor::float8,
        to_char(periodo_fim, 'YYYY-MM') as mes,
        to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
      from mart.rreo_federal
      where exercicio = (select max(exercicio) from mart.rreo_federal where periodo_fim <= ${hoje}::date)
        and periodo_fim <= ${hoje}::date and rotulo = 'Padrão'
        and ((conta_codigo = 'ReceitasExcetoIntraOrcamentarias' and coluna = 'Até o Bimestre (c)')
          or (conta_codigo = 'DespesasExcetoIntraOrcamentarias' and coluna = 'DESPESAS PAGAS ATÉ O BIMESTRE (j)'))
      order by periodo_fim`,
    fetch(urlExpectativas(hoje), {
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`BCB respondeu ${r.status}`);
      const json = await r.json();
      return organizarExpectativas(json.value, hoje);
    }),
  ]);
  const indisponiveis: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "rejected" || !r.value.length) {
      indisponiveis.push(fontes[i]);
      if (r.status === "rejected") console.error(`Economia: ${fontes[i]} indisponível.`);
    }
  });
  const caged = resultados[0].status === "fulfilled" ? resultados[0].value : [];
  const credito = resultados[1].status === "fulfilled" ? resultados[1].value : [];
  const fiscal = resultados[2].status === "fulfilled" ? resultados[2].value : [];
  const series: ComplementoEconomia["series"] = [];
  const cagedUrl = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/estatisticas-trabalho/novo-caged";
  for (const [id, rotulo, coluna] of [
    ["caged_saldo", "Saldo de empregos formais", "saldo"],
    ["caged_estoque", "Vínculos formais", "estoque"],
    ["caged_admissoes", "Admissões", "admissoes"],
    ["caged_desligamentos", "Desligamentos", "desligamentos"],
  ] as const) {
    series.push(serieComplementar(id, rotulo, "O emprego com carteira está aumentando?", "inteiro", "vínculos", "MTE · Novo Caged", cagedUrl,
      "Série nacional com ajustes da divulgação disponível. Saldo é admissões menos desligamentos; estoque é o total de vínculos, não de pessoas.",
      caged.map((r) => ({ mes: r.mes, valor: r[coluna], coletado_em: r.coletado_em }))));
  }
  for (const cliente of ["PF", "PJ"]) {
    const linhas = credito.filter((r) => r.cliente === cliente);
    const nome = cliente === "PF" ? "famílias" : "empresas";
    for (const carteira of [false, true]) {
      series.push(serieComplementar(`credito_${cliente.toLowerCase()}_${carteira ? "saldo" : "inadimplencia"}`,
        `${carteira ? "Crédito às" : "Inadimplência das"} ${nome}`, "As famílias e empresas conseguem pagar o crédito?",
        carteira ? "decimal1" : "pct1", carteira ? "R$ trilhões" : "% da carteira", "BCB · SCR.data", "https://dadosabertos.bcb.gov.br/dataset/scr_data",
        carteira ? "Saldo nominal da carteira ativa, em trilhões de reais. Estoque de crédito, não novas concessões."
          : "Carteira inadimplida arrastada / carteira ativa, somadas nas 27 UFs. Operações com atraso superior a 90 dias; não é a proporção de pessoas inadimplentes.",
        linhas.map((r) => ({ mes: r.mes, valor: carteira ? r.ativa === null ? null : r.ativa / 1e12 : inadimplenciaNacional(r.ativa, r.vencida, r.ufs), coletado_em: r.coletado_em }))));
    }
  }
  for (const [id, rotulo, conta] of [
    ["fiscal_receitas", "Receitas realizadas", "ReceitasExcetoIntraOrcamentarias"],
    ["fiscal_pagas", "Despesas pagas", "DespesasExcetoIntraOrcamentarias"],
  ] as const) {
    const linhas = fiscal.filter((r) => r.conta_codigo === conta);
    // Chaves ambíguas permanecem ausentes: nenhuma célula é escolhida arbitrariamente.
    const meses = [...new Set(linhas.map((r) => r.mes))];
    const s = serieComplementar(id, rotulo, "Como está a execução do orçamento federal?", "decimal1", "R$ bilhões · acumulado no ano", "Tesouro · Siconfi, RREO Anexo 01",
      "https://www.tesourotransparente.gov.br/temas/contabilidade-e-custos/relatorio-resumido-da-execucao-orcamentaria-rreo",
      "União, exceto operações intraorçamentárias. Valores nominais acumulados no ano, sem somar bimestres. Incluem operações financeiras; a diferença não é o resultado primário.",
      meses.map((mes) => { const rs = linhas.filter((r) => r.mes === mes); return { mes, valor: rs.length === 1 && rs[0].valor !== null ? rs[0].valor / 1e9 : null, coletado_em: rs[0]?.coletado_em ?? null }; }));
    s.frequencia = "bimestral";
    series.push(s);
  }
  return { series, expectativas: resultados[3].status === "fulfilled" ? resultados[3].value : [], indisponiveis };
}
