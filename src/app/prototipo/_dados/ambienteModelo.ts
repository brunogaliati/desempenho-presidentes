import type { Direcao } from "@/types/dados";

import type { Formato, Leitura, Periodo, Rampa, SerieEconomia } from "./tipos";

/**
 * O meio ambiente no formato do painel, a partir das tabelas do Neon.
 *
 * Só funções puras e `import type`, para os testes rodarem com `node --test`
 * (que não resolve `@/` nem importação sem extensão).
 *
 * As regras dos números:
 * - Uma régua só, a da economia: o último dado contra o último antes da posse.
 * - O ano PRODES vai de agosto a julho e leva o código "AAAA-07" do mês em que
 *   termina: o recebido é o PRODES 2022 e o primeiro ano do governo, o 2023.
 * - O que é mensal (focos, alertas, autos) vira soma de 12 meses, datada pelo
 *   último mês da janela: tira a estação do fogo da comparação e o recebido é
 *   o ano de 2022 inteiro. O mês em andamento nunca entra.
 * - Ausência não vira zero. Onde a fonte publica o mês e a UF não aparece, a
 *   conta é zero (DETER, Ibama); UF fora da cobertura é `null`.
 * - O desmatamento por UF soma os seis biomas, que repartem o território. A
 *   taxa da Amazônia Legal é outro método e nunca entra nessa soma.
 */

type Serie = (number | null)[];

export interface LinhaFoco {
  /** Código IBGE da UF. */
  uf: string;
  mes: string;
  focos: number;
  parcial: boolean;
}
export interface LinhaFocoBioma {
  bioma: string;
  mes: string;
  focos: number;
}
export interface LinhaDeter {
  bioma: string;
  /** Sigla da UF. */
  uf: string;
  mes: string;
  /** Corte raso, com vegetação e mineração, em km². */
  desmatamento: number;
  /** Cicatriz de queimada, em km² (só o DETER Amazônia tem a classe). */
  cicatriz: number;
  emAndamento: boolean;
}
export interface LinhaTaxa {
  uf: string;
  ano: number;
  area: number;
  preliminar: boolean;
}
export interface LinhaBioma {
  bioma: string;
  uf: string;
  ano: number;
  /** Anos cobertos pelo período: os antigos vêm em blocos. */
  anos: number;
  area: number;
  preliminar: boolean;
}
export interface LinhaIbama {
  fonte: "autos" | "embargos";
  uf: string;
  mes: string;
  n: number;
  /** Soma dos valores informados das multas; `null` nos embargos. */
  valor: number | null;
}

/** O desmatamento mapeado dentro de uma Terra Indígena ou Unidade de Conservação, num ano e num bioma. */
export interface LinhaProtegida {
  recorte: "ti" | "uc";
  bioma: string;
  codigo: string;
  nome: string;
  ano: number;
  area: number;
  preliminar: boolean;
}

export interface EntradaAmbiente {
  /** AAAA-MM-DD. */
  hoje: string;
  ufs: { codigo: string; sigla: string; regiaoCodigo: string }[];
  regioes: { codigo: string }[];
  focos: { linhas: LinhaFoco[]; porBioma: LinhaFocoBioma[]; dataLimite: string | null; coletadoEm: string | null } | null;
  deter: { linhas: LinhaDeter[]; coletadoEm: string | null } | null;
  taxa: { linhas: LinhaTaxa[]; coletadoEm: string | null } | null;
  biomas: { linhas: LinhaBioma[]; coletadoEm: string | null } | null;
  ibama: { linhas: LinhaIbama[]; coletadoEm: string | null } | null;
  protegidas?: { linhas: LinhaProtegida[]; coletadoEm: string | null } | null;
  /** De onde as leituras de 12 meses partem; por padrão, a régua do mandato atual. */
  desde12m?: string;
}

export interface ItemProtegida {
  recorte: "ti" | "uc";
  nome: string;
  bioma: string;
  ultimo: number;
  /** A área no ano que o governo recebeu; `null` se esse ano não está na série. */
  recebido: number | null;
  /** A área em cada ano com desmatamento: de onde sai o recebido de outro mandato. */
  porAno: Record<string, number>;
}

/**
 * Terras Indígenas e Unidades de Conservação: o total por ano e as que mais
 * perderam. A conta usa só os biomas que já publicaram o último ano, em todos
 * os anos: assim 2026 compara com 2022 na mesma base, a régua do placar.
 */
export interface AreasProtegidas {
  anos: number[];
  /** Os biomas da conta. */
  biomas: string[];
  ti: SerieEconomia | null;
  uc: SerieEconomia | null;
  /** O último ano: o da comparação com 2022. */
  ano: number;
  /** As que mais perderam em cada ano. */
  maisPorAno: Record<string, ItemProtegida[]>;
  /** As mesmas séries em cada bioma, até o último ano dele, para o placar do bioma. */
  porBioma: Record<string, { ti: SerieEconomia | null; uc: SerieEconomia | null }>;
  coletadoEm: string | null;
}

/** Um bioma no painel "Por bioma": o desmatamento mapeado e os focos de cada um. */
export interface BiomaAmbiente {
  id: string;
  rotulo: string;
  prodes: SerieEconomia | null;
  focos: SerieEconomia | null;
}

export interface DadosAmbiente {
  /** As séries nacionais, na ordem do "Brasil agora". */
  series: SerieEconomia[];
  porBioma: BiomaAmbiente[];
  /** Autos e embargos por UF: só na tabela de estados, sem cor de veredito. */
  fiscalizacao: Leitura[];
  /** Focos por mês no Brasil, todos os meses inteiros: a temporada do fogo. */
  focosMensais: { meses: string[]; brasil: Serie } | null;
  /** O mês em andamento na fonte, que a soma de 12 meses não usa e a temporada mostra. */
  focosParcial: { mes: string; valor: number; ate: string | null } | null;
  protegidas: AreasProtegidas | null;
  /** A taxa da Amazônia Legal por estado: o mapa dos mandatos antes de 2017, quando não há todos os biomas. */
  desmatamentoLegal: Leitura | null;
  /** Fontes que não responderam nesta montagem. */
  indisponiveis: string[];
}

// ---------------------------------------------------------------------------
// Meses e janelas
// ---------------------------------------------------------------------------

const indiceMes = (mes: string) => Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1;
const deslocar = (mes: string, passos: number) => {
  const n = indiceMes(mes) + passos;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
};
export function mesesEntre(inicio: string, fim: string): string[] {
  const lista: string[] = [];
  for (let m = inicio; m <= fim; m = deslocar(m, 1)) lista.push(m);
  return lista;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** O último mês inteiro até `data` (AAAA-MM-DD): o próprio mês só se `data` for o último dia dele. */
export function ultimoMesCompleto(data: string): string {
  const mes = data.slice(0, 7);
  const ultimoDia = new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)), 0)).getUTCDate();
  return Number(data.slice(8, 10)) >= ultimoDia ? mes : deslocar(mes, -1);
}

/**
 * Soma de 12 meses, datada pelo último mês da janela. A janela só existe com
 * os 12 meses presentes: um buraco quebra as 12 janelas que passam por ele.
 */
export function soma12(valores: Serie): Serie {
  return valores.map((_, i) => {
    if (i < 11) return null;
    const janela = valores.slice(i - 11, i + 1);
    return janela.some((v) => v === null) ? null : janela.reduce<number>((a, v) => a + v!, 0);
  });
}

/** Soma posição a posição; `null` se faltar qualquer parcela. */
function somarTodos(series: Serie[], n: number): Serie {
  return Array.from({ length: n }, (_, i) => {
    let total = 0;
    for (const s of series) {
      const v = s[i];
      if (v === null || v === undefined) return null;
      total += v;
    }
    return series.length ? total : null;
  });
}

// ---------------------------------------------------------------------------
// Períodos e marcos do mandato
// ---------------------------------------------------------------------------

export const periodoMes = (codigo: string): Periodo => {
  const [ano, m] = codigo.split("-");
  const i = Number(m) - 1;
  return { codigo, rotulo: `${MESES[i]}/${ano.slice(2)}`, extenso: `${MESES_EXTENSO[i]} de ${ano}` };
};

export const periodo12 = (codigo: string): Periodo => {
  const [ano, m] = codigo.split("-");
  const i = Number(m) - 1;
  return { codigo, rotulo: `${MESES[i]}/${ano.slice(2)}`, extenso: `12 meses até ${MESES_EXTENSO[i]} de ${ano}` };
};

export const periodoProdes = (ano: number, preliminar = false): Periodo => ({
  codigo: `${ano}-07`,
  rotulo: preliminar ? `${ano}*` : String(ano),
  extenso: `ano PRODES ${ano} (ago/${ano - 1} a jul/${ano})${preliminar ? ", estimativa preliminar" : ""}`,
});

/** Último período antes da posse e primeiro depois dela, pelo mês de referência. */
export function marcosDoMandato(meses: string[]) {
  const posse = meses.findIndex((m) => m >= "2023-01");
  return { indicePosse: posse > 0 ? posse : null, indiceRecebido: posse > 0 ? posse - 1 : null };
}

// ---------------------------------------------------------------------------
// Fontes e textos
// ---------------------------------------------------------------------------

const FONTE = {
  taxa: { nome: "INPE, PRODES Amazônia Legal", url: "https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/legal_amazon/rates" },
  biomas: { nome: "INPE, PRODES por bioma", url: "https://terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/cerrado/increments" },
  deter: { nome: "INPE, DETER", url: "https://terrabrasilis.dpi.inpe.br/app/dashboard/alerts/legal/amazon/aggregated/" },
  focos: { nome: "INPE, Programa Queimadas", url: "https://data.inpe.br/queimadas/estatisticas/?tipo=estados" },
  ibama: { nome: "Ibama, dados abertos da fiscalização", url: "https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-auto-de-infracao" },
};

const QUEM_ATUA_DESMATAMENTO =
  "Ministério do Meio Ambiente, Ibama e ICMBio na fiscalização federal; os estados no licenciamento e no Cadastro Ambiental Rural; Polícia Federal e Ministério Público nos crimes.";

const INSTITUICOES = {
  prodes: {
    mede: "INPE, pelas imagens de satélite de agosto a julho (o ano PRODES). A taxa da Amazônia Legal é modelada; nos outros biomas é a área mapeada.",
    atua: QUEM_ATUA_DESMATAMENTO,
    contexto: "Preço da soja e do gado, crédito rural, ocupação de terra pública, regras de regularização fundiária.",
    links: [
      { nome: "TerraBrasilis (INPE)", url: FONTE.taxa.url },
      { nome: "PRODES por bioma", url: FONTE.biomas.url },
    ],
  },
  deter: {
    mede: "INPE, com alertas quase diários para orientar a fiscalização; não substitui a taxa anual do PRODES.",
    atua: QUEM_ATUA_DESMATAMENTO,
    contexto: "Nuvens escondem parte da floresta na estação chuvosa; o alerta mede menos área que o PRODES mapeia depois.",
    links: [
      { nome: "DETER Amazônia", url: FONTE.deter.url },
      { nome: "DETER Cerrado", url: "https://terrabrasilis.dpi.inpe.br/app/dashboard/alerts/biomes/cerrado/aggregated/" },
    ],
  },
  focos: {
    mede: "INPE, Programa Queimadas, pelo satélite de referência (a mesma passagem todo dia, para comparar anos).",
    atua: "Ibama (Prevfogo) e ICMBio no combate; corpos de bombeiros e defesas civis dos estados; Ministério do Meio Ambiente.",
    contexto: "Seca e calor pesam muito: o El Niño de 2023–24 trouxe a pior estiagem em décadas. Parte do fogo é o desmatamento recente sendo queimado.",
    links: [{ nome: "Estatísticas do Programa Queimadas", url: FONTE.focos.url }],
  },
  ibama: {
    mede: "Ibama, pelo sistema de fiscalização publicado em dados abertos.",
    atua: "Ibama, com orçamento e quadro de fiscais decididos pelo governo federal.",
    contexto: "O registro atrasa: os meses mais recentes ainda sobem. Auto lavrado não é multa paga, e muitos são cancelados ou anulados depois.",
    links: [{ nome: "Dados abertos do Ibama", url: FONTE.ibama.url }],
  },
};

interface ConfigSerie {
  id: string;
  rotulo: string;
  pergunta: string;
  formato: Formato;
  direcao: Direcao;
  unidade: string;
  frequencia: "ano-prodes" | "mensal";
  fonte: { nome: string; url: string };
  instituicoes: SerieEconomia["instituicoes"];
  calculo: string;
}

/** Uma série nacional no formato das da economia. Vazia ou só de nulos vira `null`. */
export function serieNacional(
  cfg: ConfigSerie,
  datas: string[],
  valores: Serie,
  coletadoEm: string | null,
  preliminares: string[] = [],
): SerieEconomia | null {
  const presentes = datas.flatMap((d, i) => (valores[i] === null ? [] : [i]));
  if (!presentes.length) return null;
  const primeiro = presentes[0];
  const ultimo = presentes.at(-1)!;
  const d = datas.slice(primeiro, ultimo + 1);
  const v = valores.slice(primeiro, ultimo + 1);
  return {
    id: cfg.id,
    origem: cfg.id,
    rotulo: cfg.rotulo,
    pergunta: cfg.pergunta,
    formato: cfg.formato,
    direcao: cfg.direcao,
    datas: d,
    valores: v,
    fonte: cfg.fonte.nome,
    fonteUrl: cfg.fonte.url,
    unidade: cfg.unidade,
    frequencia: cfg.frequencia,
    mesesReferencia: 12,
    referencia: d.at(-1)!,
    coletadoEm,
    parcial: false,
    cobertura: { inicio: d[0], fim: d.at(-1)!, lacunas: v.filter((x) => x === null).length },
    instituicoes: cfg.instituicoes,
    calculo: cfg.calculo,
    preliminares: preliminares.filter((p) => d.includes(p)),
  };
}

// ---------------------------------------------------------------------------
// Grades por UF
// ---------------------------------------------------------------------------

interface Grade {
  periodos: string[];
  /** Por código IBGE da UF. */
  ufs: Record<string, Serie>;
  brasil: Serie;
}

/** Brasil e regiões a partir das UFs: soma só com todas as parcelas presentes. */
function agregar(grade: Grade, entrada: EntradaAmbiente, cobertas: string[]) {
  const n = grade.periodos.length;
  const regioes = Object.fromEntries(
    entrada.regioes.flatMap((r) => {
      const ufs = entrada.ufs.filter((u) => u.regiaoCodigo === r.codigo && cobertas.includes(u.codigo));
      return ufs.length ? [[r.codigo, somarTodos(ufs.map((u) => grade.ufs[u.codigo]), n)]] : [];
    }),
  );
  return { brasil: grade.brasil, regioes };
}

/** Recorta a grade a partir de `desde`, mantendo o alinhamento de todas as séries. */
function recortarGrade(grade: Grade, desde: string): Grade {
  const corte = Math.max(0, grade.periodos.findIndex((p) => p >= desde));
  return {
    periodos: grade.periodos.slice(corte),
    ufs: Object.fromEntries(Object.entries(grade.ufs).map(([k, s]) => [k, s.slice(corte)])),
    brasil: grade.brasil.slice(corte),
  };
}

// ---------------------------------------------------------------------------
// Focos de queimada
// ---------------------------------------------------------------------------

/** Focos por UF e mês até o último mês inteiro; mês sem linha é `null`. */
export function gradeFocos(entrada: EntradaAmbiente): Grade | null {
  const f = entrada.focos;
  if (!f?.linhas.length) return null;
  const limite = ultimoMesCompleto(f.dataLimite ?? entrada.hoje);
  const inicio = f.linhas.reduce((m, r) => (r.mes < m ? r.mes : m), "9999-12");
  const meses = mesesEntre(inicio, limite);
  const pos = new Map(meses.map((m, i) => [m, i]));
  const ufs: Record<string, Serie> = Object.fromEntries(entrada.ufs.map((u) => [u.codigo, meses.map(() => null)]));
  for (const r of f.linhas) {
    const i = pos.get(r.mes);
    if (i === undefined || r.parcial || !ufs[r.uf]) continue;
    ufs[r.uf][i] = (ufs[r.uf][i] ?? 0) + r.focos;
  }
  return { periodos: meses, ufs, brasil: somarTodos(Object.values(ufs), meses.length) };
}

// ---------------------------------------------------------------------------
// DETER
// ---------------------------------------------------------------------------

/**
 * Alertas de desmatamento por UF e mês, num bioma. O mês é publicado se o
 * bioma tem alguma linha nele; publicado e sem linha da UF, zero. UF que nunca
 * aparece no bioma está fora dele e fica fora da conta.
 */
export function gradeDeter(entrada: EntradaAmbiente, bioma: string, campo: "desmatamento" | "cicatriz") {
  const linhas = entrada.deter?.linhas.filter((r) => r.bioma === bioma && !r.emAndamento) ?? [];
  if (!linhas.length) return null;
  const publicados = new Set(linhas.map((r) => r.mes));
  const inicio = [...publicados].sort()[0];
  const fim = [...publicados].sort().at(-1)!;
  const meses = mesesEntre(inicio, fim);
  const siglas = new Set(linhas.map((r) => r.uf));
  const cobertas = entrada.ufs.filter((u) => siglas.has(u.sigla));
  const pos = new Map(meses.map((m, i) => [m, i]));
  const ufs: Record<string, Serie> = Object.fromEntries(
    cobertas.map((u) => [u.codigo, meses.map((m) => (publicados.has(m) ? 0 : null))]),
  );
  const codigo = new Map(cobertas.map((u) => [u.sigla, u.codigo]));
  for (const r of linhas) {
    const s = ufs[codigo.get(r.uf)!];
    s[pos.get(r.mes)!] = (s[pos.get(r.mes)!] ?? 0) + r[campo];
  }
  return { meses, ufs, cobertas: cobertas.map((u) => u.codigo), total: somarTodos(Object.values(ufs), meses.length) };
}

/** Amazônia e Cerrado juntos por UF, na janela em que os dois publicaram. */
function gradeAlertas(entrada: EntradaAmbiente): (Grade & { cobertas: string[] }) | null {
  const biomas = ["amazonia", "cerrado"].flatMap((b) => {
    const g = gradeDeter(entrada, b, "desmatamento");
    return g ? [g] : [];
  });
  if (biomas.length < 2) return null;
  const inicio = biomas.map((g) => g.meses[0]).sort().at(-1)!;
  const fim = biomas.map((g) => g.meses.at(-1)!).sort()[0];
  const meses = mesesEntre(inicio, fim);
  const cobertas = [...new Set(biomas.flatMap((g) => g.cobertas))];
  const ufs: Record<string, Serie> = {};
  for (const codigo of cobertas) {
    const partes = biomas
      .filter((g) => g.ufs[codigo])
      .map((g) => meses.map((m) => g.ufs[codigo][g.meses.indexOf(m)] ?? null));
    ufs[codigo] = somarTodos(partes, meses.length);
  }
  return { periodos: meses, ufs, brasil: somarTodos(Object.values(ufs), meses.length), cobertas };
}

// ---------------------------------------------------------------------------
// PRODES
// ---------------------------------------------------------------------------

/**
 * Desmatamento mapeado por UF somando os biomas. Só anos anuais (os blocos
 * antigos de dois anos ficam de fora). A UF tem valor no ano em que todos os
 * biomas que a tocam publicaram; o Brasil, quando os seis publicaram.
 */
export function somarBiomas(linhas: LinhaBioma[], ufs: { codigo: string; sigla: string }[], desde: number) {
  const anuais = linhas.filter((r) => r.anos === 1 && r.ano >= desde);
  const biomas = [...new Set(linhas.map((r) => r.bioma))];
  const anos = [...new Set(anuais.map((r) => r.ano))].sort((a, b) => a - b);
  const publicado = (b: string, ano: number) => anuais.some((r) => r.bioma === b && r.ano === ano);
  const toca = new Map(biomas.map((b) => [b, new Set(anuais.filter((r) => r.bioma === b).map((r) => r.uf))]));
  const valor = new Map(anuais.map((r) => [`${r.bioma}|${r.uf}|${r.ano}`, r.area]));
  const porUf: Record<string, Serie> = {};
  for (const u of ufs) {
    const seus = biomas.filter((b) => toca.get(b)!.has(u.sigla));
    if (!seus.length) continue;
    porUf[u.codigo] = anos.map((ano) => {
      let total = 0;
      for (const b of seus) {
        const v = valor.get(`${b}|${u.sigla}|${ano}`);
        if (v === undefined) return null;
        total += v;
      }
      return total;
    });
  }
  const completos = anos.filter((ano) => biomas.length > 0 && biomas.every((b) => publicado(b, ano)));
  const brasil = anos.map((ano) =>
    completos.includes(ano) ? anuais.filter((r) => r.ano === ano).reduce((a, r) => a + r.area, 0) : null,
  );
  return { anos, porUf, brasil, completos, preliminares: [...new Set(anuais.filter((r) => r.preliminar).map((r) => r.ano))] };
}

/**
 * Total anual de um ou mais biomas, como o painel do INPE: soma das UFs
 * publicadas em cada ano. Ano em que algum dos biomas não tem dado anual sai nulo.
 */
function totalDeBiomas(linhas: LinhaBioma[], biomas: string[]) {
  const anuais = linhas.filter((r) => r.anos === 1 && biomas.includes(r.bioma));
  if (!anuais.length) return null;
  const anos = [...new Set(anuais.map((r) => r.ano))];
  const de = Math.min(...anos);
  const ate = Math.max(...anos);
  const lista = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const valores = lista.map((ano) => {
    const doAno = anuais.filter((r) => r.ano === ano);
    if (!biomas.every((b) => doAno.some((r) => r.bioma === b))) return null;
    return doAno.reduce((a, r) => a + r.area, 0);
  });
  const preliminares = [...new Set(anuais.filter((r) => r.preliminar).map((r) => `${r.ano}-07`))];
  return { datas: lista.map((a) => `${a}-07`), valores, preliminares };
}

// ---------------------------------------------------------------------------
// Ibama
// ---------------------------------------------------------------------------

const NOME_RECORTE = { ti: "Terras Indígenas", uc: "Unidades de Conservação" } as const;

/**
 * As áreas protegidas no formato das séries nacionais. Bioma publicado sem linha
 * da área é zero: o PRODES só lista onde houve área mapeada.
 */
export function montarProtegidas(
  linhas: LinhaProtegida[],
  publicados: Record<string, number[]>,
  coletadoEm: string | null,
  quantas = 6,
): AreasProtegidas | null {
  const todos = Object.values(publicados).flat();
  if (!linhas.length || !todos.length) return null;
  const ano = Math.max(...todos);
  const biomas = Object.keys(publicados).filter((b) => publicados[b].includes(ano));
  const anos = [...new Set(todos)].filter((a) => a <= ano && biomas.every((b) => publicados[b].includes(a))).sort((a, b) => a - b);
  const preliminares = [...new Set(linhas.filter((r) => r.preliminar).map((r) => `${r.ano}-07`))];

  const serie = (id: string, rotulo: string, recorte: "ti" | "uc", dosBiomas: string[], lista: number[]) => {
    const dentro = linhas.filter((r) => r.recorte === recorte && dosBiomas.includes(r.bioma));
    const valores = lista.map((a) => dentro.filter((r) => r.ano === a).reduce((t, r) => t + r.area, 0));
    return serieNacional(
      {
        id,
        rotulo,
        pergunta: `Quanto se desmatou dentro das ${NOME_RECORTE[recorte]} por ano?`,
        formato: "km2",
        direcao: "menor_melhor",
        unidade: "km² por ano PRODES",
        frequencia: "ano-prodes",
        fonte: FONTE.biomas,
        instituicoes: {
          ...INSTITUICOES.prodes,
          atua: recorte === "ti"
            ? "Funai na proteção das terras; Ibama e Polícia Federal na fiscalização e na retirada de invasores."
            : "ICMBio nas unidades federais; os órgãos estaduais e municipais nas demais; Ibama na fiscalização.",
        },
        calculo: `área desmatada mapeada pelo PRODES dentro das ${NOME_RECORTE[recorte]}, somando os biomas da conta: os que já publicaram o último ano`,
      },
      lista.map((a) => `${a}-07`),
      valores,
      coletadoEm,
      preliminares,
    );
  };

  const chave = (r: LinhaProtegida) => `${r.recorte}|${r.bioma}|${r.codigo}`;
  const em2022 = new Map(linhas.filter((r) => r.ano === 2022).map((r) => [chave(r), r.area]));
  const porAno = new Map<string, Record<string, number>>();
  for (const r of linhas) {
    if (r.area > 0) (porAno.get(chave(r)) ?? porAno.set(chave(r), {}).get(chave(r))!)[r.ano] = r.area;
  }
  const lista = (recorte: "ti" | "uc", a: number): ItemProtegida[] =>
    linhas
      .filter((r) => r.recorte === recorte && r.ano === a && r.area > 0 && biomas.includes(r.bioma))
      .sort((x, y) => y.area - x.area)
      .slice(0, quantas)
      .map((r) => ({
        recorte,
        nome: r.nome,
        bioma: r.bioma,
        ultimo: r.area,
        recebido: anos.includes(2022) ? (em2022.get(chave(r)) ?? 0) : null,
        porAno: porAno.get(chave(r)) ?? {},
      }));

  return {
    anos,
    biomas,
    ti: serie("protegidas_ti", "Desmatamento em Terras Indígenas", "ti", biomas, anos),
    uc: serie("protegidas_uc", "Desmatamento em Unidades de Conservação", "uc", biomas, anos),
    ano,
    maisPorAno: Object.fromEntries(anos.map((a) => [String(a), [...lista("ti", a), ...lista("uc", a)]])),
    porBioma: Object.fromEntries(
      Object.entries(publicados).map(([b, dele]) => {
        const seus = [...dele].sort((x, y) => x - y);
        return [
          b,
          {
            ti: serie(`protegidas_ti_${b}`, "Desmatamento em Terras Indígenas", "ti", [b], seus),
            uc: serie(`protegidas_uc_${b}`, "Desmatamento em Unidades de Conservação", "uc", [b], seus),
          },
        ];
      }),
    ),
    coletadoEm,
  };
}

/** Autos ou embargos por UF e mês; mês sem registro da UF é zero (é contagem). */
function gradeIbama(entrada: EntradaAmbiente, fonte: "autos" | "embargos", campo: "n" | "valor", desde: string) {
  const ib = entrada.ibama;
  if (!ib?.linhas.length) return null;
  const limite = ultimoMesCompleto(ib.coletadoEm?.slice(0, 10) ?? entrada.hoje);
  const meses = mesesEntre(desde, limite);
  const pos = new Map(meses.map((m, i) => [m, i]));
  const codigo = new Map(entrada.ufs.map((u) => [u.sigla, u.codigo]));
  const ufs: Record<string, Serie> = Object.fromEntries(entrada.ufs.map((u) => [u.codigo, meses.map(() => 0)]));
  for (const r of ib.linhas) {
    const i = pos.get(r.mes);
    const c = codigo.get(r.uf);
    if (r.fonte !== fonte || i === undefined || !c) continue;
    ufs[c][i] = (ufs[c][i] ?? 0) + (campo === "n" ? r.n : (r.valor ?? 0));
  }
  return { periodos: meses, ufs, brasil: somarTodos(Object.values(ufs), meses.length) };
}

// ---------------------------------------------------------------------------
// Leituras do mapa
// ---------------------------------------------------------------------------

/** O mapa revê o mandato desde o fim de 2021, como as leituras da economia. */
const DESDE_12M = "2021-12";
/** Primeiro ano em que os seis biomas têm incremento anual. */
const DESDE_PRODES = 2017;

interface BaseLeitura {
  id: string;
  titulo: string;
  tituloCurto: string;
  descricao: string;
  calculo: string;
  fonte: { nome: string; url: string };
  formato: Formato;
  rampa: Rampa;
  direcao: Direcao;
  coletadoEm: string | null;
}

function leitura(base: BaseLeitura, grade: Grade, periodos: Periodo[], entrada: EntradaAmbiente, cobertas: string[]): Leitura {
  return {
    id: base.id,
    titulo: base.titulo,
    tituloCurto: base.tituloCurto,
    descricao: base.descricao,
    calculo: base.calculo,
    fonte: base.fonte.nome,
    fonteUrl: base.fonte.url,
    coletadoEm: base.coletadoEm,
    exemplo: false,
    formato: base.formato,
    escala: "log",
    rampa: base.rampa,
    direcao: base.direcao,
    periodos,
    ...marcosDoMandato(grade.periodos),
    ...agregar(grade, entrada, cobertas),
    ufs: Object.fromEntries(cobertas.map((c) => [c, grade.ufs[c]])),
  };
}

/** A grade mensal virada em soma de 12 meses, recortada para o mapa. */
function em12meses(g: Grade, desde = DESDE_12M): Grade {
  return recortarGrade(
    {
      periodos: g.periodos,
      ufs: Object.fromEntries(Object.entries(g.ufs).map(([k, s]) => [k, soma12(s)])),
      brasil: soma12(g.brasil),
    },
    desde,
  );
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

const NO_BIOMA: Record<string, string> = {
  amazonia: "na Amazônia",
  cerrado: "no Cerrado",
  caatinga: "na Caatinga",
  mata_atlantica: "na Mata Atlântica",
  pampa: "no Pampa",
  pantanal: "no Pantanal",
};

const BIOMAS: [string, string, string][] = [
  ["amazonia", "Amazônia", "Amazônia"],
  ["cerrado", "Cerrado", "Cerrado"],
  ["caatinga", "Caatinga", "Caatinga"],
  ["mata_atlantica", "Mata Atlântica", "Mata Atlântica"],
  ["pampa", "Pampa", "Pampa"],
  ["pantanal", "Pantanal", "Pantanal"],
];

export function montarAmbiente(entrada: EntradaAmbiente): { leituras: Leitura[]; dados: DadosAmbiente } {
  const indisponiveis: string[] = [];
  const leituras: Leitura[] = [];
  const series: (SerieEconomia | null)[] = [];
  const todasUfs = entrada.ufs.map((u) => u.codigo);
  const desde12m = entrada.desde12m ?? DESDE_12M;
  let desmatamentoLegal: Leitura | null = null;

  // --- Desmatamento -----------------------------------------------------------

  if (entrada.taxa?.linhas.length) {
    const anos = [...new Set(entrada.taxa.linhas.map((r) => r.ano))].sort((a, b) => a - b);
    const ufsTaxa = new Set(entrada.taxa.linhas.map((r) => r.uf));
    const valores = anos.map((ano) => {
      const doAno = entrada.taxa!.linhas.filter((r) => r.ano === ano);
      return doAno.length === ufsTaxa.size ? doAno.reduce((a, r) => a + r.area, 0) : null;
    });
    series.push(
      serieNacional(
        {
          id: "prodes_amazonia",
          rotulo: "Desmatamento na Amazônia",
          pergunta: "Quanta floresta a Amazônia Legal perdeu por ano?",
          formato: "km2",
          direcao: "menor_melhor",
          unidade: "km² por ano PRODES",
          frequencia: "ano-prodes",
          fonte: FONTE.taxa,
          instituicoes: INSTITUICOES.prodes,
          calculo:
            "taxa anual modelada do PRODES na Amazônia Legal, de agosto a julho; o ano mais recente é estimativa preliminar, revista no ano seguinte",
        },
        anos.map((a) => `${a}-07`),
        valores,
        entrada.taxa.coletadoEm,
        [...new Set(entrada.taxa.linhas.filter((r) => r.preliminar).map((r) => `${r.ano}-07`))],
      ),
    );
    const noAno = new Map(entrada.taxa.linhas.map((r) => [`${r.uf}|${r.ano}`, r.area]));
    desmatamentoLegal = {
      id: "desmatamento",
      titulo: "Desmatamento na Amazônia Legal",
      tituloCurto: "Desmatamento",
      rampa: "desmate",
      descricao: "Taxa anual do PRODES nos nove estados da Amazônia Legal. Nesta época não há dado de todos os biomas por estado.",
      calculo: "taxa anual modelada do PRODES na Amazônia Legal, de agosto a julho",
      fonte: FONTE.taxa.nome,
      fonteUrl: FONTE.taxa.url,
      coletadoEm: entrada.taxa.coletadoEm,
      exemplo: false,
      formato: "km2",
      escala: "log",
      direcao: "menor_melhor",
      periodos: anos.map((a) => periodoProdes(a)),
      indicePosse: null,
      indiceRecebido: null,
      brasil: valores,
      regioes: {},
      ufs: Object.fromEntries(entrada.ufs.filter((u) => ufsTaxa.has(u.sigla)).map((u) => [u.codigo, anos.map((a) => noAno.get(`${u.sigla}|${a}`) ?? null)])),
    };
  } else indisponiveis.push(FONTE.taxa.nome);

  const porBioma: BiomaAmbiente[] = [];
  if (entrada.biomas?.linhas.length) {
    const linhas = entrada.biomas.linhas;
    const coleta = entrada.biomas.coletadoEm;
    const cfgBioma = (id: string, rotulo: string, calculo: string): ConfigSerie => ({
      id,
      rotulo,
      pergunta: "Quanta vegetação nativa foi desmatada por ano?",
      formato: "km2",
      direcao: "menor_melhor",
      unidade: "km² por ano PRODES",
      frequencia: "ano-prodes",
      fonte: FONTE.biomas,
      instituicoes: INSTITUICOES.prodes,
      calculo,
    });
    const cerrado = totalDeBiomas(linhas, ["cerrado"]);
    if (cerrado) {
      series.push(
        serieNacional(
          cfgBioma("prodes_cerrado", "Desmatamento no Cerrado", "área desmatada mapeada pelo PRODES no bioma Cerrado, de agosto a julho, soma das UFs publicadas"),
          cerrado.datas, cerrado.valores, coleta, cerrado.preliminares,
        ),
      );
    }
    const outros = totalDeBiomas(linhas, ["caatinga", "mata_atlantica", "pampa", "pantanal"]);
    if (outros) {
      series.push(
        serieNacional(
          { ...cfgBioma("prodes_outros", "Desmatamento nos outros biomas", "soma da área desmatada mapeada pelo PRODES na Caatinga, Mata Atlântica, Pampa e Pantanal, só nos anos em que os quatro têm dado anual"), pergunta: "Quanta vegetação nativa a Caatinga, a Mata Atlântica, o Pampa e o Pantanal perderam por ano?" },
          outros.datas, outros.valores, coleta, outros.preliminares,
        ),
      );
    }
    for (const [id, rotulo] of BIOMAS) {
      const t = totalDeBiomas(linhas, [id]);
      porBioma.push({
        id,
        rotulo,
        prodes: t ? serieNacional(cfgBioma(`prodes_bioma_${id}`, `Desmatamento ${NO_BIOMA[id]}`, `área desmatada mapeada pelo PRODES no bioma ${rotulo}`), t.datas, t.valores, coleta, t.preliminares) : null,
        focos: null,
      });
    }

    const soma = somarBiomas(linhas, entrada.ufs, DESDE_PRODES);
    const ultimoCompleto = soma.completos.at(-1);
    if (ultimoCompleto !== undefined) {
      const ate = soma.anos.indexOf(ultimoCompleto) + 1;
      const anos = soma.anos.slice(0, ate);
      const grade: Grade = {
        periodos: anos.map((a) => `${a}-07`),
        ufs: Object.fromEntries(Object.entries(soma.porUf).map(([k, s]) => [k, s.slice(0, ate)])),
        brasil: soma.brasil.slice(0, ate),
      };
      leituras.push(
        leitura(
          {
            id: "desmatamento",
            titulo: "Desmatamento",
            tituloCurto: "Desmatamento",
            descricao: "Vegetação nativa desmatada no ano PRODES (agosto a julho), somando os seis biomas.",
            calculo:
              "soma das áreas desmatadas mapeadas pelo PRODES em cada bioma dentro da UF; os biomas repartem o território, então nada conta duas vezes. Não é a taxa modelada da Amazônia Legal",
            fonte: FONTE.biomas,
            formato: "km2",
            rampa: "desmate",
            direcao: "menor_melhor",
            coletadoEm: coleta,
          },
          grade,
          anos.map((a) => periodoProdes(a, soma.preliminares.includes(a))),
          entrada,
          Object.keys(soma.porUf),
        ),
      );
    }
  } else indisponiveis.push(FONTE.biomas.nome);

  // --- Alertas (DETER) ---------------------------------------------------------

  if (entrada.deter?.linhas.length) {
    const coleta = entrada.deter.coletadoEm;
    const cfgAlerta = (id: string, rotulo: string, calculo: string): ConfigSerie => ({
      id,
      rotulo,
      pergunta: `Quanto desmatamento o satélite flagrou em 12 meses, ${rotulo.replace("Alertas ", "")}?`,
      formato: "km2",
      direcao: "menor_melhor",
      unidade: "km² em 12 meses",
      frequencia: "mensal",
      fonte: FONTE.deter,
      instituicoes: INSTITUICOES.deter,
      calculo,
    });
    for (const [bioma, id, rotulo] of [
      ["amazonia", "alertas_amazonia_12m", "Alertas na Amazônia"],
      ["cerrado", "alertas_cerrado_12m", "Alertas no Cerrado"],
    ] as const) {
      const g = gradeDeter(entrada, bioma, "desmatamento");
      if (!g) continue;
      series.push(
        serieNacional(
          cfgAlerta(id, rotulo, `soma de 12 meses dos alertas DETER de desmatamento no bioma (${bioma === "amazonia" ? "corte raso, com vegetação e mineração" : "corte raso"}), pela data da imagem`),
          g.meses,
          soma12(g.total),
          coleta,
        ),
      );
    }
    const alertas = gradeAlertas(entrada);
    if (alertas) {
      const g = em12meses(alertas, desde12m);
      leituras.push(
        leitura(
          {
            id: "alertas_12m",
            titulo: "Alertas de desmatamento",
            tituloCurto: "Alertas",
            descricao: "Área com alerta de desmatamento do DETER nos últimos 12 meses, na Amazônia e no Cerrado.",
            calculo:
              "soma de 12 meses dos alertas DETER Amazônia e DETER Cerrado; cada um cobre o seu bioma, então somam sem repetir. Estados fora dos dois biomas não têm o dado",
            fonte: FONTE.deter,
            formato: "km2",
            rampa: "alerta",
            direcao: "menor_melhor",
            coletadoEm: coleta,
          },
          g,
          g.periodos.map(periodo12),
          entrada,
          alertas.cobertas,
        ),
      );
    }
    const cicatriz = gradeDeter(entrada, "amazonia", "cicatriz");
    if (cicatriz) {
      series.push(
        serieNacional(
          {
            id: "cicatriz_12m",
            rotulo: "Área queimada na Amazônia",
            pergunta: "Quanta floresta amazônica pegou fogo em 12 meses?",
            formato: "km2",
            direcao: "menor_melhor",
            unidade: "km² em 12 meses",
            frequencia: "mensal",
            fonte: FONTE.deter,
            instituicoes: { ...INSTITUICOES.deter, contexto: INSTITUICOES.focos.contexto },
            calculo: "soma de 12 meses dos alertas DETER de cicatriz de queimada no bioma Amazônia, pela data da imagem",
          },
          cicatriz.meses,
          soma12(cicatriz.total),
          coleta,
        ),
      );
    }
  } else indisponiveis.push(FONTE.deter.nome);

  // --- Focos ---------------------------------------------------------------------

  let focosMensais: DadosAmbiente["focosMensais"] = null;
  let focosParcial: DadosAmbiente["focosParcial"] = null;
  const focos = gradeFocos(entrada);
  if (focos && entrada.focos) {
    const coleta = entrada.focos.coletadoEm;
    const cfgFocos = (id: string, rotulo: string): ConfigSerie => ({
      id,
      rotulo,
      pergunta: "Quantos focos de queimada o satélite viu em 12 meses?",
      formato: "contagem",
      direcao: "menor_melhor",
      unidade: "focos em 12 meses",
      frequencia: "mensal",
      fonte: FONTE.focos,
      instituicoes: INSTITUICOES.focos,
      calculo: "soma de 12 meses dos focos do satélite de referência; foco é ponto de calor, não área queimada",
    });
    series.push(serieNacional(cfgFocos("focos_12m", "Focos de queimada"), focos.periodos, soma12(focos.brasil), coleta));
    const g = em12meses(focos, desde12m);
    leituras.push(
      leitura(
        {
          id: "focos_12m",
          titulo: "Focos de queimada",
          tituloCurto: "Focos",
          descricao: "Pontos de calor vistos pelo satélite de referência nos últimos 12 meses. Foco não é área queimada.",
          calculo: "soma de 12 meses dos focos do satélite de referência do INPE, por UF",
          fonte: FONTE.focos,
          formato: "contagem",
          rampa: "fogo",
          direcao: "menor_melhor",
          coletadoEm: coleta,
        },
        g,
        g.periodos.map(periodo12),
        entrada,
        todasUfs,
      ),
    );
    focosMensais = { meses: focos.periodos, brasil: focos.brasil };
    const parciais = entrada.focos.linhas.filter((r) => r.parcial);
    if (parciais.length) {
      focosParcial = {
        mes: parciais[0].mes,
        valor: parciais.reduce((t, r) => t + r.focos, 0),
        ate: entrada.focos.dataLimite,
      };
    }

    // Por bioma, pelo bioma que o INPE dá a cada foco.
    const nomes = new Map(BIOMAS.map(([id, , nome]) => [nome, id]));
    const pos = new Map(focos.periodos.map((m, i) => [m, i]));
    for (const b of porBioma.length ? porBioma : BIOMAS.map(([id, rotulo]) => ({ id, rotulo, prodes: null, focos: null }))) {
      const mensal: Serie = focos.periodos.map(() => null);
      let viu = false;
      for (const r of entrada.focos.porBioma) {
        if (nomes.get(r.bioma) !== b.id) continue;
        const i = pos.get(r.mes);
        if (i === undefined) continue;
        mensal[i] = (mensal[i] ?? 0) + r.focos;
        viu = true;
      }
      // Mês publicado (o Brasil tem dado) sem foco no bioma é zero.
      const completo = mensal.map((v, i) => (v === null && focos.brasil[i] !== null ? 0 : v));
      b.focos = viu ? serieNacional(cfgFocos(`focos_bioma_${b.id}`, `Focos ${NO_BIOMA[b.id]}`), focos.periodos, soma12(completo), coleta) : null;
      if (!porBioma.includes(b)) porBioma.push(b);
    }
  } else indisponiveis.push(FONTE.focos.nome);

  // --- Fiscalização (Ibama) --------------------------------------------------------

  const fiscalizacao: Leitura[] = [];
  if (entrada.ibama?.linhas.length) {
    const coleta = entrada.ibama.coletadoEm;
    const cfgIbama = (id: string, rotulo: string, formato: Formato, unidade: string, calculo: string): ConfigSerie => ({
      id,
      rotulo,
      pergunta: "Quanto o Ibama fiscalizou em 12 meses?",
      formato,
      direcao: "neutro",
      unidade,
      frequencia: "mensal",
      fonte: FONTE.ibama,
      instituicoes: INSTITUICOES.ibama,
      calculo,
    });
    const desde = "2000-01";
    const autos = gradeIbama(entrada, "autos", "n", desde);
    const multas = gradeIbama(entrada, "autos", "valor", desde);
    const embargos = gradeIbama(entrada, "embargos", "n", desde);
    if (autos) series.push(serieNacional(cfgIbama("autos_12m", "Autos de infração", "contagem", "autos em 12 meses", "soma de 12 meses dos autos de infração lavrados pelo Ibama, sem os cancelados, pela data do auto"), autos.periodos, soma12(autos.brasil), coleta));
    if (multas) series.push(serieNacional(cfgIbama("multas_12m", "Multas aplicadas", "reaiscurto", "reais em 12 meses, valores da época", "soma de 12 meses do valor informado nos autos não cancelados; auto sem valor fica de fora, e aplicar não é receber"), multas.periodos, soma12(multas.brasil), coleta));
    if (embargos) series.push(serieNacional(cfgIbama("embargos_12m", "Áreas embargadas", "contagem", "embargos em 12 meses", "soma de 12 meses dos termos de embargo do Ibama, pela data do embargo"), embargos.periodos, soma12(embargos.brasil), coleta));
    for (const [g, id, titulo, curto] of [
      [autos, "autos_12m", "Autos de infração do Ibama", "Autos"],
      [embargos, "embargos_12m", "Embargos do Ibama", "Embargos"],
    ] as const) {
      if (!g) continue;
      const g12 = em12meses(g, desde12m);
      fiscalizacao.push(
        leitura(
          {
            id,
            titulo,
            tituloCurto: curto,
            descricao: `${curto} do Ibama nos últimos 12 meses. É ação do governo, não resultado no território: não tem cor de melhor ou pior.`,
            calculo: `soma de 12 meses dos ${curto.toLowerCase()} por UF${id === "autos_12m" ? ", sem os cancelados" : ""}`,
            fonte: FONTE.ibama,
            formato: "contagem",
            rampa: "fiscal",
            direcao: "neutro",
            coletadoEm: coleta,
          },
          g12,
          g12.periodos.map(periodo12),
          entrada,
          todasUfs,
        ),
      );
    }
  } else indisponiveis.push(FONTE.ibama.nome);

  const anosPublicados: Record<string, number[]> = {};
  for (const r of entrada.biomas?.linhas ?? []) {
    if (r.anos !== 1 || r.ano < DESDE_PRODES) continue;
    const anos = (anosPublicados[r.bioma] ??= []);
    if (!anos.includes(r.ano)) anos.push(r.ano);
  }
  const protegidas = entrada.protegidas?.linhas.length
    ? montarProtegidas(entrada.protegidas.linhas, anosPublicados, entrada.protegidas.coletadoEm)
    : null;

  // A ordem das lentes: o desmatamento primeiro, depois os alertas e o fogo.
  const ordem = ["desmatamento", "alertas_12m", "focos_12m"];
  leituras.sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
  const ordemSeries = [
    "prodes_amazonia", "prodes_cerrado", "prodes_outros", "alertas_amazonia_12m", "alertas_cerrado_12m",
    "focos_12m", "cicatriz_12m", "autos_12m", "multas_12m", "embargos_12m",
  ];
  return {
    leituras,
    dados: {
      series: series
        .filter((s): s is SerieEconomia => s !== null)
        .sort((a, b) => ordemSeries.indexOf(a.id) - ordemSeries.indexOf(b.id)),
      porBioma,
      fiscalizacao,
      focosMensais,
      focosParcial,
      protegidas,
      desmatamentoLegal,
      indisponiveis,
    },
  };
}

/**
 * Sem o banco, os focos saem da cópia do arquivo anual do INPE
 * (`queimadas.json`, 2022 a 2025): o mapa abre com o que se tem, e a fonte diz
 * que é cópia. O resto do meio ambiente fica indisponível.
 */
export function focosDaCopia(
  copia: { meses: string[]; ufMensal: Record<string, number[]>; coletadoEm: string },
  ufs: EntradaAmbiente["ufs"],
): EntradaAmbiente["focos"] {
  const linhas = Object.entries(copia.ufMensal).flatMap(([uf, valores]) =>
    valores.map((focos, i) => ({ uf, mes: copia.meses[i], focos, parcial: false })),
  );
  // UF sem foco no arquivo anual teve zero focos no satélite de referência.
  const presentes = new Set(Object.keys(copia.ufMensal));
  for (const u of ufs) {
    if (!presentes.has(u.codigo)) linhas.push(...copia.meses.map((mes) => ({ uf: u.codigo, mes, focos: 0, parcial: false })));
  }
  return { linhas, porBioma: [], dataLimite: `${copia.meses.at(-1)}-31`, coletadoEm: copia.coletadoEm };
}
