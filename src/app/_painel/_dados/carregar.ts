import "server-only";
import { unstable_cache } from "next/cache";

import { carregarDados } from "@/lib/dados";
import { sql } from "@/lib/db";
import type { Presidente } from "@/types/dados";

import {
  carregarCreditoFamilias,
  carregarGasolina,
  carregarMetadadosEconomia,
  carregarNovidades,
  carregarPib,
  carregarPnad,
  seriesEconomia,
} from "./economia";
import { carregarDeter, carregarFocos, carregarIbama, carregarProdesBiomas, carregarProtegidas, carregarTaxaProdes } from "./ambiente";
import { focosDaCopia, montarAmbiente } from "./ambienteModelo";
import { afinarLeitura, focoDoMandato } from "./mandatoRecorte";
import { alinharTerritorio, mesesEntre, type LinhaTerritorio } from "./economiaModelo";
import { carregarEconomiaAmpliada } from "./economiaAmpliada";
import { carregarIbovespa } from "./ibovespa";
import fotografia from "./fotografia.json";
import governos from "./governos.json";
import { carregarMarcos } from "./marcos";
import { serieDaBolsa } from "./mercadoModelo";
import { CADEIRAS, INICIO_MANDATO_EXECUTIVO, LEGISLATURA, POSSE_PRESIDENTE } from "./poderes";
import queimadas from "./queimadas.json";
import type { DadosPainel, Governos, Leitura, Parlamentar, Periodo, UF } from "./tipos";
import malha from "./ufs.json";

/**
 * Junta as origens do painel num objeto só.
 *
 * - Neon: indicadores do mandato em curso, séries da economia, desocupação
 *   por UF (PNAD trimestral), cadastro de UFs e população.
 * - `fotografia.json`: Câmara e Senado (APIs públicas).
 * - Neon: meio ambiente (PRODES, DETER, focos do INPE, fiscalização do
 *   Ibama), montado em `ambienteModelo.ts`.
 * - `queimadas.json`: cópia dos focos do INPE, para o mapa municipal e para
 *   quando o banco não responder.
 * - `governos.json`: quem governou cada UF e o país desde 1995, com partido
 *   (`scripts/gerar-governos.mjs`).
 * - Neon: seleção revisada de marcos por mandato, com evidências oficiais.
 * Apenas fontes públicas entram no payload; abas sem integração ficam indisponíveis.
 */

/**
 * Artigo de cada UF. "Desocupação em Pará" está errado; o certo é "no Pará",
 * "na Bahia" e "em São Paulo", e não há regra que dispense a lista.
 */
const ARTIGO: Record<string, "o" | "a" | ""> = {
  AC: "o", AP: "o", AM: "o", CE: "o", DF: "o", ES: "o", MA: "o", PA: "o",
  PR: "o", PI: "o", RJ: "o", RN: "o", RS: "o", TO: "o",
  BA: "a", PB: "a",
  AL: "", GO: "", MT: "", MS: "", MG: "", PE: "", RO: "", RR: "", SC: "",
  SP: "", SE: "",
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const trimestre = (codigo: string): Periodo => {
  const ano = codigo.slice(0, 4);
  const t = Number(codigo.slice(4));
  return { codigo, rotulo: `${t}º tri ${ano.slice(2)}`, extenso: `${t}º trimestre de ${ano}` };
};
const mes = (codigo: string): Periodo => {
  const [ano, m] = codigo.split("-");
  const i = Number(m) - 1;
  return { codigo, rotulo: `${MESES[i]}/${ano.slice(2)}`, extenso: `${MESES_EXTENSO[i]} de ${ano}` };
};
const anual = (ano: number, parcial = false): Periodo => ({
  codigo: String(ano),
  rotulo: parcial ? `${ano}*` : String(ano),
  extenso: parcial ? `${ano} (até agora)` : String(ano),
});

type Serie = (number | null)[];

/**
 * Devolve também o mandato em curso inteiro, que fica no servidor: serve para
 * desenhar o retrato e não deve atravessar para o cliente com todos os
 * indicadores dentro.
 */
async function carregarPainelSemCache(): Promise<{ painel: Omit<DadosPainel, "governos">; presidente: Presidente }> {
  const [dados, novidades, ufsRaw, populacaoRaw, metadados, pnadBanco, gasolina, credito, pib, focos, deter, taxa, biomas, ibama, protegidas] = await Promise.all([
    carregarDados(),
    carregarNovidades().catch(() => []),
    sql`
      select codigo, sigla, nome, regiao_codigo, regiao_nome
        from observatorio.territorio
       where tipo = 'uf' and ativo
       order by codigo
    `,
    // Último ano publicado, não o ano corrente: a tabela 6579 tem lacunas.
    sql`
      select codigo_ibge, populacao
        from observatorio.populacao_estimada
       where nivel = 'N3'
         and ano = (select max(ano) from observatorio.populacao_estimada
                     where nivel = 'N3')
    `,
    carregarMetadadosEconomia(),
    // Sem a PNAD do banco, o mapa usa a fotografia coletada da API do IBGE e
    // diz isso na fonte, em vez de abrir vazio. As outras leituras do mapa
    // somem se a fonte falhar; nenhuma vira zero.
    carregarPnad().catch(() => null),
    carregarGasolina().catch(() => null),
    carregarCreditoFamilias().catch(() => null),
    carregarPib().catch(() => null),
    carregarFocos().catch(() => null),
    carregarDeter().catch(() => null),
    carregarTaxaProdes().catch(() => null),
    carregarProdesBiomas().catch(() => null),
    carregarIbama().catch(() => null),
    carregarProtegidas().catch(() => null),
  ]);

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const complemento = await carregarEconomiaAmpliada(hoje);
  const presidente = dados.presidentes.find((p) => p.emCurso);
  if (!presidente) throw new Error("Nenhum mandato presidencial em curso no Neon.");
  const marcosPorMandato = await carregarMarcos(dados.presidentes, hoje);

  const populacao = new Map(
    (populacaoRaw as Record<string, unknown>[]).map((r) => [
      String(r.codigo_ibge),
      Number(r.populacao),
    ]),
  );
  const geo = new Map(malha.ufs.map((u) => [u.codigo, u]));

  const porUf = (lista: { nome: string; partido: string | null; uf: string }[]) => {
    const mapa = new Map<string, Parlamentar[]>();
    for (const p of lista) {
      const l = mapa.get(p.uf) ?? [];
      l.push({ nome: p.nome, partido: p.partido });
      mapa.set(p.uf, l);
    }
    return mapa;
  };
  const deputados = porUf(fotografia.deputados);
  const senadores = porUf(fotografia.senadores);

  const ufs: UF[] = (ufsRaw as Record<string, unknown>[]).map((r) => {
    const codigo = String(r.codigo);
    const sigla = String(r.sigla);
    const nome = String(r.nome);
    const forma = geo.get(codigo);
    if (!forma) throw new Error(`UF ${codigo} sem contorno em ufs.json`);
    const artigo = ARTIGO[sigla] ?? "";
    return {
      codigo,
      sigla,
      nome,
      emNome: `${artigo ? `n${artigo}` : "em"} ${nome}`,
      deNome: `${artigo ? `d${artigo}` : "de"} ${nome}`,
      regiao: String(r.regiao_nome),
      regiaoCodigo: String(r.regiao_codigo),
      d: forma.d,
      centro: [forma.centro[0], forma.centro[1]],
      area: forma.area,
      areaKm2: forma.areaKm2,
      caixa: [forma.caixa[0], forma.caixa[1], forma.caixa[2], forma.caixa[3]],
      populacao: populacao.get(codigo) ?? null,
      deputados: deputados.get(sigla) ?? [],
      senadores: senadores.get(sigla) ?? [],
    };
  });

  const regioes = [
    ...new Map(ufs.map((u) => [u.regiaoCodigo, { codigo: u.regiaoCodigo, nome: u.regiao }])).values(),
  ].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const ufsDaRegiao = (r: string) => ufs.filter((u) => u.regiaoCodigo === r);

  // --- Economia --------------------------------------------------------------
  //
  // Cada leitura é uma medida por estado. O mapa as mostra como cor, setas
  // desde a posse, minigráficos e círculos; por isso cada uma diz em que
  // sentido melhora (`direcao`) e qual período é "o que o governo recebeu".

  /** Último período antes da posse e primeiro depois dela, pelo mês de referência. */
  const marcosDoMandato = (meses: string[]) => {
    const posse = meses.findIndex((m) => m >= "2023-01");
    return { indicePosse: posse > 0 ? posse : null, indiceRecebido: posse > 0 ? posse - 1 : null };
  };
  const fimDoTrimestre = (codigo: string) =>
    `${codigo.slice(0, 4)}-${String(Number(codigo.slice(4)) * 3).padStart(2, "0")}`;
  const ultimaColeta = (linhas: { coletado_em: string }[]) =>
    linhas.map((r) => r.coletado_em).sort().at(-1) ?? null;

  // A PNAD vem do banco desde 2012, para os mandatos antigos. Quem corta a régua de
  // cor em dois anos antes da posse é `recortarLeitura`: com 2012 inteiro nela, o pico
  // da pandemia empurrava o mapa de hoje para as duas classes mais claras.
  const DESDE_TRIMESTRE = "201201";
  type Pnad = { periodos: { codigo: string }[]; brasil: Serie; regioes: Record<string, Serie>; ufs: Record<string, Serie> };
  const desdeTrimestre = (org: Pnad) => {
    const corte = Math.max(0, org.periodos.findIndex((p) => p.codigo >= DESDE_TRIMESTRE));
    const cortar = (s: Serie) => s.slice(corte);
    return {
      periodos: org.periodos.slice(corte).map((p) => p.codigo),
      brasil: cortar(org.brasil),
      regioes: Object.fromEntries(Object.entries(org.regioes).map(([k, s]) => [k, cortar(s)])),
      ufs: Object.fromEntries(Object.entries(org.ufs).map(([k, s]) => [k, cortar(s)])),
    };
  };
  const coletaPnad = pnadBanco?.coletadoEm ?? fotografia.coletadoEm;
  const fontePnad = pnadBanco
    ? "IBGE, PNAD Contínua, tabela 4099"
    : `IBGE, PNAD Contínua, tabela 4099 (cópia de ${new Date(fotografia.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}; o banco não respondeu)`;
  const leituraPnad = (org: Pnad, base: Pick<Leitura, "id" | "titulo" | "descricao" | "calculo">): Leitura => {
    const d = desdeTrimestre(org);
    return {
      ...base,
      fonte: fontePnad,
      fonteUrl: "https://sidra.ibge.gov.br/tabela/4099",
      coletadoEm: coletaPnad,
      exemplo: false,
      formato: "pct1",
      escala: "linear",
      direcao: "menor_melhor",
      periodos: d.periodos.map(trimestre),
      ...marcosDoMandato(d.periodos.map(fimDoTrimestre)),
      brasil: d.brasil,
      regioes: d.regioes,
      ufs: d.ufs,
    };
  };

  const desocupacao = leituraPnad(pnadBanco?.desocupacao ?? fotografia.desocupacao, {
    id: "desocupacao",
    titulo: "Desemprego",
    descricao: "Percentual de pessoas desocupadas na força de trabalho.",
    calculo: "taxa de desocupação por trimestre fechado; a série nacional mensal usa trimestre móvel",
  });
  const subutilizacao = pnadBanco
    ? leituraPnad(pnadBanco.subutilizacao, {
        id: "subutilizacao",
        titulo: "Subutilização da força de trabalho",
        descricao:
          "Percentual da força de trabalho ampliada que está desocupada, subocupada por insuficiência de horas ou na força de trabalho potencial.",
        calculo: "taxa composta de subutilização da força de trabalho, por trimestre fechado",
      })
    : null;

  // Códigos por nome, para as fontes que identificam o lugar por extenso
  // ("RONDONIA", "CENTRO OESTE").
  const semAcento = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/-/g, " ").toUpperCase();
  const lugarPorNome = new Map<string, { nivel: LinhaTerritorio["nivel"]; codigo: string }>([
    ["BRASIL", { nivel: "N1", codigo: "1" }],
    ...regioes.map((r) => [semAcento(r.nome), { nivel: "N2" as const, codigo: r.codigo }] as const),
    ...ufs.map((u) => [semAcento(u.nome), { nivel: "N3" as const, codigo: u.codigo }] as const),
  ]);

  let precoGasolina: Leitura | null = null;
  if (gasolina?.length) {
    const meses = mesesEntre(gasolina[0].mes, gasolina.at(-1)!.mes);
    const linhas = gasolina.flatMap((r) => {
      const lugar = lugarPorNome.get(semAcento(r.localidade));
      return lugar ? [{ ...lugar, periodo: r.mes, valor: r.valor }] : [];
    });
    precoGasolina = {
      id: "gasolina",
      titulo: "Gasolina",
      descricao: "Preço médio do litro da gasolina comum nos postos, no mês.",
      calculo: "média mensal do levantamento de preços da ANP, em reais da época (sem descontar a inflação)",
      fonte: "ANP, Levantamento de Preços de Combustíveis",
      fonteUrl:
        "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos",
      coletadoEm: ultimaColeta(gasolina),
      exemplo: false,
      formato: "reais2",
      escala: "linear",
      direcao: "menor_melhor",
      periodos: meses.map(mes),
      ...marcosDoMandato(meses),
      ...alinharTerritorio(linhas, meses),
    };
  }

  let inadimplencia: Leitura | null = null;
  if (credito?.length) {
    const meses = mesesEntre(credito[0].mes, credito.at(-1)!.mes);
    const siglaParaUf = new Map(ufs.map((u) => [u.sigla, u]));
    // Razão das somas, não média das razões: o Brasil e as regiões pesam cada
    // real emprestado igual. Mês em que falta um estado fica sem total.
    const linhas: LinhaTerritorio[] = [];
    for (const m of meses) {
      const doMes = credito.filter((r) => r.mes === m && r.inadimplente !== null && r.ativa);
      const razao = (lista: typeof doMes, esperado: number) =>
        lista.length === esperado
          ? (lista.reduce((t, r) => t + r.inadimplente!, 0) / lista.reduce((t, r) => t + r.ativa!, 0)) * 100
          : null;
      for (const r of doMes) {
        const u = siglaParaUf.get(r.uf);
        if (u) linhas.push({ nivel: "N3", codigo: u.codigo, periodo: m, valor: (r.inadimplente! / r.ativa!) * 100 });
      }
      for (const reg of regioes) {
        const daRegiao = doMes.filter((r) => siglaParaUf.get(r.uf)?.regiaoCodigo === reg.codigo);
        linhas.push({ nivel: "N2", codigo: reg.codigo, periodo: m, valor: razao(daRegiao, ufsDaRegiao(reg.codigo).length) });
      }
      linhas.push({ nivel: "N1", codigo: "1", periodo: m, valor: razao(doMes, ufs.length) });
    }
    inadimplencia = {
      id: "inadimplencia",
      titulo: "Inadimplência das famílias",
      descricao: "Parte do crédito às pessoas físicas com parcela atrasada há mais de 90 dias.",
      calculo:
        "carteira inadimplida arrastada ÷ carteira ativa, pessoas físicas, todas as instituições; é o saldo inteiro da dívida em atraso, não só a parcela",
      fonte: "Banco Central, SCR.data",
      fonteUrl: "https://dadosabertos.bcb.gov.br/dataset/scr_data",
      coletadoEm: ultimaColeta(credito),
      exemplo: false,
      formato: "pct1",
      escala: "linear",
      direcao: "menor_melhor",
      periodos: meses.map(mes),
      ...marcosDoMandato(meses),
      ...alinharTerritorio(linhas, meses),
    };
  }

  let pibPorHabitante: Leitura | null = null;
  const pibUfs = pib?.filter((r) => r.nivel === "N3" && r.populacao) ?? [];
  if (pib && pibUfs.length === ufs.length) {
    const ano = pibUfs[0].ano;
    const anoPop = pibUfs[0].ano_populacao;
    const porUfPib = new Map(pibUfs.map((r) => [r.codigo, r]));
    const total = (lista: UF[]) => {
      const rs = lista.map((u) => porUfPib.get(u.codigo)!);
      return rs.reduce((t, r) => t + r.pib, 0) / rs.reduce((t, r) => t + r.populacao!, 0);
    };
    const pibBrasil = pib.find((r) => r.nivel === "N1")?.pib ?? null;
    pibPorHabitante = {
      id: "pib",
      titulo: "PIB por habitante",
      descricao: `Quanto a economia de cada estado produziu por morador em ${ano}, o dado mais recente do IBGE.`,
      calculo: `PIB de ${ano} a preços correntes ÷ população estimada de ${anoPop}; o IBGE não estimou a população de 2022 e 2023, anos do Censo`,
      fonte: "IBGE, Contas Regionais",
      fonteUrl: "https://www.ibge.gov.br/estatisticas/economicas/contas-nacionais/9054-contas-regionais-do-brasil.html",
      coletadoEm: ultimaColeta(pib),
      exemplo: false,
      formato: "reais0",
      escala: "log",
      direcao: "maior_melhor",
      periodos: [anual(ano)],
      indicePosse: null,
      indiceRecebido: null,
      brasil: [total(ufs)],
      regioes: Object.fromEntries(regioes.map((r) => [r.codigo, [total(ufsDaRegiao(r.codigo))]])),
      ufs: Object.fromEntries(ufs.map((u) => [u.codigo, [total([u])]])),
      tamanho: {
        titulo: `PIB total de ${ano}`,
        brasil: pibBrasil,
        ufs: Object.fromEntries(pibUfs.map((r) => [r.codigo, r.pib])),
      },
    };
  }

  // --- Congresso -------------------------------------------------------------

  const representacao = (lista: UF[]): Serie => {
    const pop = lista.reduce((s, u) => s + (u.populacao ?? 0), 0);
    const dep = lista.reduce((s, u) => s + u.deputados.length, 0);
    return [pop ? Math.round((dep / pop) * 1e7) / 10 : null];
  };
  const deputadosPorMilhao: Leitura = {
    id: "representacao",
    titulo: "Deputados por milhão de habitantes",
    descricao: "Cada estado tem entre 8 e 70 deputados, então o peso de um eleitor muda conforme onde ele mora.",
    fonte: "Câmara (deputados em exercício) e IBGE (população)",
    exemplo: false,
    formato: "decimal1",
    escala: "log",
    periodos: [{ codigo: "hoje", rotulo: "hoje", extenso: "hoje" }],
    indicePosse: null,
    indiceRecebido: null,
    brasil: representacao(ufs),
    regioes: Object.fromEntries(regioes.map((r) => [r.codigo, representacao(ufsDaRegiao(r.codigo))])),
    ufs: Object.fromEntries(ufs.map((u) => [u.codigo, representacao([u])])),
  };

  // --- Meio ambiente -----------------------------------------------------------
  //
  // Sem os focos do banco, o mapa usa a cópia do arquivo anual do INPE e diz
  // isso na fonte. As outras medidas somem se a fonte falhar; nenhuma vira zero.

  const ambiente = montarAmbiente({
    hoje,
    ufs,
    regioes,
    focos: focos ?? focosDaCopia(queimadas, ufs),
    deter,
    taxa,
    biomas,
    ibama,
    protegidas,
    desde12m: "1999-12",
  });
  if (!focos) {
    const copia = new Date(queimadas.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    for (const l of ambiente.leituras) {
      if (l.id === "focos_12m") l.fonte = `INPE, Programa Queimadas (cópia de ${copia}; o banco não respondeu)`;
    }
  }

  // ---------------------------------------------------------------------------

  const mandatos = dados.presidentes.map(({ id, nome, nomeCurto, mandato, inicio, fim, partido, emCurso }) => ({ id, nome, nomeCurto, mandato, inicio, fim, partido, emCurso }));
  const painel: Omit<DadosPainel, "governos"> = {
    foco: focoDoMandato(mandatos, presidente.id)!,
    hoje: new Date().toISOString(),
    presidente: {
      id: presidente.id,
      nome: presidente.nomeCurto,
      mandato: presidente.mandato,
      partido: presidente.partido,
      inicio: INICIO_MANDATO_EXECUTIVO,
    },
    posse: POSSE_PRESIDENTE,
    marcosPorMandato,
    mapa: { largura: malha.largura, altura: malha.altura, fonte: malha.fonte },
    ufs,
    regioes,
    leituras: {
      economia: [desocupacao, subutilizacao, inadimplencia, precoGasolina, pibPorHabitante].filter((l): l is Leitura => l !== null).map(afinarLeitura),
      congresso: [deputadosPorMilhao],
      dinheiro: [],
      ambiente: ambiente.leituras.map(afinarLeitura),
    },
    economia: {
      complemento,
      indicadores: presidente.indicadores,
      series: seriesEconomia(dados, metadados, hoje),
      mandatos,
      benchmark: presidente.benchmark,
      porMandato: Object.fromEntries(
        dados.presidentes.map((p) => [
          p.id,
          p.indicadores.map((i) => ({
            serieId: i.serieId, unidade: i.unidade, tipo: i.tipo, direcao: i.direcao,
            cobertura: i.cobertura, fracaoMandatoCoberta: i.fracaoMandatoCoberta,
            valorInicial: i.valorInicial, valorFinal: i.valorFinal,
            variacaoAnualizada: i.variacaoAnualizada, unidadeAnualizada: i.unidadeAnualizada,
            tendenciaPrevia: i.tendenciaPrevia, ressalva: i.ressalva, dataInicio: i.dataInicio, dataFim: i.dataFim,
            herdadoValor: i.herdadoValor, fonteNome: i.fonteNome, fonteUrl: i.fonteUrl,
          })),
        ]),
      ),
      benchmarkPorMandato: Object.fromEntries(dados.presidentes.map((p) => [p.id, p.benchmark])),
    },
    novidades,
    congresso: {
      deputados: fotografia.deputados.length,
      senadores: fotografia.senadores.length,
      partidosNaCamara: new Set(fotografia.deputados.map((d) => d.partido)).size,
      legislatura: {
        numero: LEGISLATURA.numero,
        inicio: LEGISLATURA.inicio,
        proxima: LEGISLATURA.proxima,
      },
      senadoRenovadas: CADEIRAS.senadoRenovadas2026,
    },
    ambiente: { ...ambiente.dados, fiscalizacao: ambiente.dados.fiscalizacao.map(afinarLeitura) },
    queimadas: { anos: queimadas.anos, satelite: queimadas.satelite },
    feed: [],
    fontes: {
      coletadoEm: fotografia.coletadoEm,
      camara: fotografia.fontes.camara,
      senado: fotografia.fontes.senado,
      sidra: fotografia.fontes.sidra,
      malha: malha.fonte,
      queimadas: queimadas.fonte,
    },
  };
  return { painel, presidente };
}

const carregarPainelDoCache = unstable_cache(carregarPainelSemCache, ["painel-v11-fontes-publicas"], { revalidate: 3600, tags: ["painel-economia"] });

/** Quem governou vem de um arquivo do repositório: fica fora do cache, que é para o banco. */
export async function carregarPainel(): Promise<{ painel: DadosPainel; presidente: Presidente }> {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [{ painel, presidente }, ibovespa] = await Promise.all([carregarPainelDoCache(), carregarIbovespa(hoje)]);
  // A bolsa entra como mais uma série nacional, logo depois do dólar.
  const bolsa = serieDaBolsa(ibovespa, hoje);
  const series = [...painel.economia.series];
  if (bolsa) series.splice(series.findIndex((s) => s.id === "cambio") + 1 || series.length, 0, bolsa);
  return { painel: { ...painel, governos: governos as Governos, economia: { ...painel.economia, series,
    complemento: { ...painel.economia.complemento, ibovespa } } }, presidente };
}
