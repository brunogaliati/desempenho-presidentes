import "server-only";

import { sql } from "@/lib/db";
import { mesPorExtenso, numero } from "@/lib/formatar";
import type { DadosSite, Direcao } from "@/types/dados";

import type { Formato, Novidade, SerieEconomia } from "./tipos";

/**
 * A economia no idioma de quem lê, a partir das séries do Neon.
 *
 * O banco guarda o dado como a fonte publica: IPCA do mês, índice de volume do
 * PIB, massa de renda em R$ milhões. Ninguém lê "IPCA de 0,48%" e entende o
 * ano; ninguém lê "índice 197,3" e entende crescimento. Aqui cada série vira a
 * medida que responde a pergunta, e `calculo` registra a transformação.
 */

import { acumulado12, contraAnoAnterior, regularizar, organizarPnad, type Pontos, type LinhaPnad } from "./economiaModelo";

/** O mapa revê o mandato a partir de dois anos antes da posse. */
const DESDE_MES = "2001-01-01";

interface Config {
  id: string;
  origem: string;
  rotulo: string;
  pergunta: string;
  formato: Formato;
  direcao: Direcao;
  fonte: string;
  calculo: string | null;
  transformar?: (s: Pontos) => Pontos;
}

const SERIES: Config[] = [
  {
    id: "inflacao12m",
    origem: "ipca",
    rotulo: "Inflação em 12 meses",
    pergunta: "Quanto os preços subiram no último ano?",
    formato: "pct1",
    direcao: "menor_melhor",
    fonte: "IBGE, IPCA",
    calculo: "IPCA mensal composto nos 12 meses anteriores",
    transformar: acumulado12,
  },
  {
    id: "desemprego",
    origem: "desemprego",
    rotulo: "Desemprego",
    pergunta: "Quantos procuram trabalho e não acham?",
    formato: "pct1",
    direcao: "menor_melhor",
    fonte: "IBGE, PNAD Contínua",
    calculo: "trimestre móvel terminado no mês",
  },
  {
    id: "salario_minimo_real",
    origem: "salario_minimo_real",
    rotulo: "Salário mínimo real",
    pergunta: "O que o salário mínimo compra?",
    formato: "reais0",
    direcao: "maior_melhor",
    fonte: "BCB e IBGE",
    calculo: "salário mínimo nominal deflacionado pelo IPCA",
  },
  {
    id: "renda",
    origem: "massa_renda_real",
    rotulo: "Massa de renda real",
    pergunta: "O dinheiro que os trabalhadores ganham cresceu?",
    formato: "pctsinal1",
    direcao: "maior_melhor",
    fonte: "IBGE, PNAD Contínua",
    calculo: "massa de renda real contra o mesmo período do ano anterior",
    transformar: contraAnoAnterior,
  },
  {
    id: "pib",
    origem: "pib_volume",
    rotulo: "Crescimento do PIB",
    pergunta: "A economia cresceu?",
    formato: "pctsinal1",
    direcao: "maior_melhor",
    fonte: "IBGE, Contas Nacionais",
    calculo: "trimestre contra o mesmo trimestre do ano anterior",
    transformar: contraAnoAnterior,
  },
  {
    id: "selic",
    origem: "selic",
    rotulo: "Juros (Selic)",
    pergunta: "Quanto custa o dinheiro emprestado?",
    formato: "pct2",
    direcao: "neutro",
    fonte: "BCB",
    calculo: "Selic efetiva acumulada no mês, anualizada (base 252); não é a meta do Copom",
  },
  {
    id: "juros_real",
    origem: "juros_real",
    rotulo: "Juros reais",
    pergunta: "Quanto o juro pesa, já descontada a inflação?",
    formato: "pct1",
    direcao: "neutro",
    fonte: "BCB e IBGE",
    calculo: "Selic descontada a inflação",
  },
  {
    id: "cambio",
    origem: "cambio",
    rotulo: "Dólar",
    pergunta: "Quanto custa um dólar?",
    formato: "reais2",
    // Cair é verde, como `LADO_BOM` em formatos.ts explica.
    direcao: "menor_melhor",
    fonte: "BCB, PTAX",
    calculo: "média do mês",
  },
  {
    id: "divida_bruta_pib",
    origem: "divida_bruta_pib",
    rotulo: "Dívida bruta",
    pergunta: "Quanto o governo deve, em proporção do PIB?",
    formato: "pct1",
    direcao: "menor_melhor",
    fonte: "BCB",
    calculo: null,
  },
];

export interface MetaEconomia { id: string; coletado_em: string | null; fonte_ref: string }

const BCB = "https://www.bcb.gov.br/controleinflacao";
const PNAD = "https://www.ibge.gov.br/estatisticas/sociais/trabalho/17270-pnad-continua.html";
const IPCA = "https://www.ibge.gov.br/estatisticas/economicas/precos-e-custos/9256-ipca.html";
const PIB = "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9300-contas-nacionais-trimestrais.html";
const MINIMO = "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/linha-do-tempo";
const FISCAL = "https://www.tesourotransparente.gov.br/temas/estatisticas-fiscais-e-planejamento/estatisticas-fiscais-do-governo-geral";

function instituicoes(id: string): SerieEconomia["instituicoes"] {
  if (id === "inflacao12m") return {
    mede: "O IBGE acompanha os preços da cesta de consumo usada no IPCA.",
    atua: "O Banco Central conduz a política monetária para buscar a meta de inflação.",
    contexto: "Câmbio, oferta, demanda, clima e preços internacionais também afetam os preços.",
    links: [{ nome: "Como o IBGE mede", url: IPCA }, { nome: "Política monetária", url: BCB }],
  };
  if (id === "selic" || id === "juros_real") return {
    mede: "O Banco Central publica a Selic efetiva. Os juros reais descontam a inflação passada pelo IPCA.",
    atua: "O Copom, formado pelo presidente e diretores do Banco Central, decide a meta da Selic.",
    contexto: "A série mensal efetiva pode diferir da meta. Juros reais aqui usam inflação observada, não expectativas.",
    links: [{ nome: "Banco Central e Copom", url: BCB }, { nome: "Série Selic 4189", url: "https://dadosabertos.bcb.gov.br/dataset/4189-taxa-de-juros---selic-acumulada-no-mes-anualizada-base-252" }],
  };
  if (id === "salario_minimo_real") return {
    mede: "O BCB publica o piso nominal; o IPCA do IBGE permite calcular seu poder de compra.",
    atua: "Executivo e Congresso participam da definição das regras do salário mínimo; as regras mudaram ao longo do tempo.",
    contexto: "O valor real depende tanto do piso nominal quanto da inflação. Não representa o salário médio do trabalhador.",
    links: [{ nome: "História do salário mínimo", url: MINIMO }, { nome: "IPCA", url: IPCA }],
  };
  if (id === "desemprego" || id === "renda") return {
    mede: "O IBGE pesquisa os domicílios na PNAD Contínua. A série nacional usa trimestres móveis.",
    atua: "Políticas de trabalho, educação, crédito e atividade econômica envolvem diferentes órgãos e níveis de governo.",
    contexto: "Empresas e famílias também tomam decisões de contratação e participação. Massa de renda é o total, não o rendimento médio.",
    links: [{ nome: "Pesquisa e metodologia da PNAD", url: PNAD }],
  };
  if (id === "pib") return {
    mede: "O IBGE produz as Contas Nacionais Trimestrais, que medem a atividade econômica.",
    atua: "Políticas fiscal e monetária, decisões do Congresso e ações dos entes federativos compõem o contexto econômico.",
    contexto: "Produção e investimento de empresas, consumo das famílias e cenário externo também influenciam a atividade.",
    links: [{ nome: "Contas Nacionais", url: PIB }, { nome: "Política monetária", url: BCB }],
  };
  if (id === "cambio") return {
    mede: "O BCB publica a PTAX; aqui as observações diárias são agregadas pela média mensal.",
    atua: "O Banco Central atua no mercado cambial. A taxa também se forma nas operações entre participantes do mercado.",
    contexto: "Juros, comércio, fluxos de capital e cenário externo influenciam o câmbio. Aqui, dólar em queda conta como melhora: barateia importados, viagens e insumos e alivia a inflação. Quem exporta recebe menos reais.",
    links: [{ nome: "Câmbio no Banco Central", url: "https://www.bcb.gov.br/estabilidadefinanceira/mercadocambio" }],
  };
  return {
    mede: "O Banco Central publica a dívida bruta do governo geral em proporção do PIB.",
    atua: "Decisões fiscais envolvem Executivo, Congresso, estados e municípios; juros e atividade também afetam a razão dívida/PIB.",
    contexto: "O governo geral não se limita à Presidência. O indicador muda com a dívida e com o PIB usado no denominador.",
    links: [{ nome: "Estatísticas fiscais", url: FISCAL }, { nome: "BCB: estatísticas", url: "https://www.bcb.gov.br/estatisticas/estatisticasfiscais" }],
  };
}

export function seriesEconomia(dados: DadosSite, metadados: MetaEconomia[], hoje: string): SerieEconomia[] {
  return SERIES.map((c) => {
    const s = dados.series[c.origem];
    const meta = metadados.find((m) => m.id === c.origem);
    const regulares = regularizar(s ?? { datas: [], valores: [] }, s?.frequencia ?? "mensal", hoje);
    const pontos = (c.transformar ?? ((p) => p))(regulares);
    const validos = pontos.datas.filter((_, i) => pontos.valores[i] !== null);
    const referencia = validos.at(-1) ?? null;
    const indiceRef = dados.series.ipca?.datas.filter((d) => d <= hoje.slice(0, 7)).at(-1);
    const fonteUrl = c.id === "inflacao12m" ? IPCA : c.id === "pib" ? PIB : ["renda", "desemprego"].includes(c.id) ? PNAD
      : meta && /^\d+$/.test(meta.fonte_ref) ? `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${meta.fonte_ref}/dados?formato=json`
      : c.id === "salario_minimo_real" ? MINIMO : BCB;
    return {
      id: c.id, origem: c.origem, rotulo: c.rotulo, pergunta: c.pergunta, formato: c.formato, direcao: c.direcao,
      ...pontos, fonte: c.fonte, fonteUrl,
      unidade: c.id === "inflacao12m" ? "% em 12 meses" : ["renda", "pib"].includes(c.id) ? "% ante o mesmo período do ano anterior" : s?.unidade ?? "%",
      frequencia: s?.frequencia ?? "mensal",
      mesesReferencia: c.id === "inflacao12m" ? 12 : ["desemprego", "renda", "pib"].includes(c.id) ? 3 : 1,
      referencia, coletadoEm: meta?.coletado_em ?? null,
      parcial: referencia === hoje.slice(0, 7) && hoje.slice(8, 10) !== new Date(Date.UTC(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0)).getUTCDate().toString(),
      cobertura: { inicio: validos[0] ?? null, fim: referencia, lacunas: pontos.valores.filter((v) => v === null).length },
      instituicoes: instituicoes(c.id),
      calculo: c.id === "salario_minimo_real" ? `${c.calculo}, em reais de ${indiceRef ? mesPorExtenso(indiceRef) : "referência não informada"}` : c.calculo,
    };
  });
}

export async function carregarMetadadosEconomia(): Promise<MetaEconomia[]> {
  return await sql`select id, fonte_ref,
    to_char(atualizado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from serie` as MetaEconomia[];
}

/**
 * As duas taxas da PNAD por UF: desocupação (4099) e subutilização da força
 * de trabalho (4118), as duas da tabela 4099 do SIDRA, por trimestre civil.
 */
export async function carregarPnad() {
  const linhas = await sql`select medida_codigo, nivel, codigo_territorio, periodo, valor,
      to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.pnad_trimestral
    where medida_codigo in (4099, 4118) and tipo_medida = 'taxa' and unidade = '%'
      and nivel in ('N1','N2','N3')
      and periodo_fim <= (now() at time zone 'America/Sao_Paulo')::date
    order by periodo, nivel, codigo_territorio` as (LinhaPnad & { medida_codigo: number; coletado_em: string })[];
  if (!linhas.length) throw new Error("PNAD trimestral sem dados disponíveis.");
  const medida = (codigo: number) => linhas.filter((r) => Number(r.medida_codigo) === codigo);
  return {
    desocupacao: organizarPnad(medida(4099)),
    subutilizacao: organizarPnad(medida(4118)),
    coletadoEm: linhas.map((r) => r.coletado_em).sort().at(-1)!,
  };
}

export interface LinhaLocal {
  nivel: string;
  localidade: string;
  mes: string;
  valor: number | null;
  coletado_em: string;
}

/**
 * Preço médio da gasolina comum nos postos, por mês, da ANP. As localidades
 * vêm por nome, em maiúsculas e sem acento ("RONDONIA", "CENTRO OESTE"); quem
 * chama resolve os códigos.
 */
export async function carregarGasolina(): Promise<LinhaLocal[]> {
  return (await sql`select nivel, localidade, to_char(mes, 'YYYY-MM') as mes,
      preco_medio_revenda::float8 as valor,
      to_char(coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.preco_combustivel_mensal
    where produto = 'GASOLINA COMUM' and mes >= ${DESDE_MES}::date
      and not coalesce(mes_em_andamento, false)
    order by mes`) as LinhaLocal[];
}

export interface LinhaCredito {
  uf: string;
  mes: string;
  inadimplente: number | null;
  ativa: number | null;
  coletado_em: string;
}

/**
 * Crédito às pessoas físicas por UF, do SCR.data do Banco Central: a carteira
 * ativa e a carteira inadimplida arrastada (o saldo inteiro das operações com
 * parcela atrasada há mais de 90 dias). A razão das duas é a inadimplência
 * que o BCB publica. Mês incompleto na fonte vem nulo, não zero.
 */
export async function carregarCreditoFamilias(): Promise<LinhaCredito[]> {
  return (await sql`select uf_sigla as uf, to_char(mes, 'YYYY-MM') as mes,
      max(valor_completo) filter (where medida = 'carteira_inadimplencia')::float8 as inadimplente,
      max(valor_completo) filter (where medida = 'carteira_ativa')::float8 as ativa,
      to_char(max(coletado_em) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
    from mart.scr_medida_uf
    where cliente = 'PF' and mes >= ${DESDE_MES}::date
      and medida in ('carteira_inadimplencia', 'carteira_ativa')
    group by 1, 2
    order by 2, 1`) as LinhaCredito[];
}

export interface LinhaPib {
  nivel: string;
  codigo: string;
  ano: number;
  pib: number;
  populacao: number | null;
  ano_populacao: number | null;
  coletado_em: string;
}

/**
 * PIB das UFs no último ano das Contas Regionais, com a população para o PIB
 * por habitante. O IBGE não publicou estimativa de população para 2022 e
 * 2023 (anos do Censo); vale a primeira estimativa depois do ano do PIB.
 */
export async function carregarPib(): Promise<LinhaPib[]> {
  return (await sql`with ultimo as (
        select max(ano) as ano from mart.pib_regional where medida_codigo = 37 and nivel = 'N3'
      ), pop as (
        select codigo_ibge, ano, populacao from mart.populacao_estimada
         where nivel = 'N3'
           and ano = (select min(ano) from mart.populacao_estimada
                       where nivel = 'N3' and ano >= (select ano from ultimo))
      )
    select p.nivel, p.codigo_territorio as codigo, p.ano, p.valor::float8 * 1000 as pib,
           pop.populacao::float8 as populacao, pop.ano as ano_populacao,
           to_char(p.coletado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as coletado_em
      from mart.pib_regional p
      left join pop on pop.codigo_ibge = p.codigo_territorio and p.nivel = 'N3'
     where p.medida_codigo = 37 and p.ano = (select ano from ultimo)`) as LinhaPib[];
}

// ---------------------------------------------------------------------------
// O que chegou na última coleta
// ---------------------------------------------------------------------------

/** Ordem de importância para a manchete: o que mais mexe com a vida primeiro. */
const PRIORIDADE = [
  "ipca",
  "desemprego",
  "pib_volume",
  "selic",
  "divida_bruta_pib",
  "massa_renda_real",
  "divida_liquida_pib",
  "cambio",
];

function texto(serieId: string, data: string, v: number): string | null {
  const mes = mesPorExtenso(data.slice(0, 7));
  switch (serieId) {
    case "ipca":
      return `IPCA de ${mes}: ${numero(v, 2)}% no mês`;
    case "desemprego":
      return `Desemprego no trimestre até ${mes}: ${numero(v, 1)}%`;
    case "pib_volume": {
      const t = Math.floor((Number(data.slice(5, 7)) - 1) / 3) + 1;
      return `PIB do ${t}º trimestre de ${data.slice(0, 4)} divulgado`;
    }
    case "selic":
      return `Selic em ${mes}: ${numero(v, 2)}% ao ano`;
    case "divida_bruta_pib":
      return `Dívida bruta em ${mes}: ${numero(v, 1)}% do PIB`;
    case "divida_liquida_pib":
      return `Dívida líquida em ${mes}: ${numero(v, 1)}% do PIB`;
    case "massa_renda_real":
      return `Massa de renda no trimestre até ${mes}: R$ ${numero(v / 1000, 0)} bi`;
    case "cambio":
      return `Dólar em ${data.slice(8, 10)}/${data.slice(5, 7)}: R$ ${numero(v, 2)}`;
    default:
      // Salário mínimo e séries anuais não viram manchete: o mínimo é
      // lançado meses à frente e as anuais chegam com dois anos de atraso.
      return null;
  }
}

/**
 * Dados novos que entraram no banco nos últimos 30 dias, um por série.
 *
 * Vem do histórico de versões (`historico.observacao`), que registra cada
 * inserção com o instante da coleta. Revisões de séries derivadas (o salário
 * mínimo real muda inteiro a cada IPCA) ficam de fora: não são notícia.
 */
export async function carregarNovidades(): Promise<Novidade[]> {
  const linhas = (await sql`
    select distinct on (h.serie_id)
           h.serie_id, to_char(h.data, 'YYYY-MM-DD') as data, h.valor,
           to_char(h.registrado_em at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as registrado_em
      from historico.observacao h
      join public.serie s on s.id = h.serie_id
     where h.operacao = 'INSERT'
       and not s.derivada
       and h.data <= (now() at time zone 'America/Sao_Paulo')::date
       and h.registrado_em > now() - interval '30 days'
     order by h.serie_id, h.data desc
  `) as Record<string, unknown>[];

  return linhas
    .flatMap((r) => {
      const serieId = String(r.serie_id);
      const t = texto(serieId, String(r.data), Number(r.valor));
      return t
        ? [{ serieId, texto: t, data: String(r.data), registradoEm: String(r.registrado_em) }]
        : [];
    })
    .sort((a, b) => {
      const pa = PRIORIDADE.indexOf(a.serieId);
      const pb = PRIORIDADE.indexOf(b.serieId);
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    });
}
