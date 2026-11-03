/**
 * As contas da aba Dinheiro, sem banco nem tela: de linhas do Tesouro para blocos,
 * o arranjo do treemap, a base das comparações e a régua dos estados.
 *
 * O orçamento se lê em "de cada R$ 100". Valores são liquidados e acumulados no ano,
 * sem operações intraorçamentárias e sem refinanciamento da dívida.
 */

export type FamiliaId = "beneficios" | "divida" | "transfer" | "servicos" | "opaco" | "estado";

/** Ordem fixa: trocar de ano ou de estado não embaralha o treemap. */
export const ORDEM_FAMILIAS: FamiliaId[] = ["beneficios", "divida", "transfer", "servicos", "opaco", "estado"];

export const NOME_FAMILIA: Record<FamiliaId, string> = {
  beneficios: "Benefícios e renda",
  divida: "Dívida",
  transfer: "Repasses",
  servicos: "Serviços públicos",
  opaco: "Encargos e Banco Central",
  estado: "Máquina do Estado",
};

export interface ItemOrcamento {
  id: string;
  nome: string;
  familia: FamiliaId;
}

export const ITENS: ItemOrcamento[] = (
  [
    ["previdencia", "Previdência", "beneficios"],
    ["assistencia", "Assistência social", "beneficios"],
    ["trabalho", "Trabalho", "beneficios"],
    ["divida", "Dívida", "divida"],
    ["transf", "Transferências", "transfer"],
    ["edbasica", "Repasse à educação básica", "transfer"],
    ["saude", "Saúde", "servicos"],
    ["educacao", "Educação", "servicos"],
    ["agricultura", "Agricultura", "servicos"],
    ["ambiente", "Meio ambiente", "servicos"],
    ["ciencia", "Ciência e tecnologia", "servicos"],
    ["seguranca", "Segurança pública", "servicos"],
    ["transporte", "Transporte", "servicos"],
    ["agraria", "Organização agrária", "servicos"],
    ["comunicacoes", "Comunicações", "servicos"],
    ["cultura", "Cultura", "servicos"],
    ["industria", "Indústria", "servicos"],
    ["urbanismo", "Urbanismo", "servicos"],
    ["comercio", "Comércio e serviços", "servicos"],
    ["cidadania", "Direitos da cidadania", "servicos"],
    ["energia", "Energia", "servicos"],
    ["esporte", "Esporte e lazer", "servicos"],
    ["habitacao", "Habitação", "servicos"],
    ["saneamento", "Saneamento", "servicos"],
    ["bancocentral", "Cobertura do Banco Central", "opaco"],
    ["outros", "Outros encargos", "opaco"],
    ["naoclass", "Sem classificação", "opaco"],
    ["defesa", "Defesa", "estado"],
    ["judiciaria", "Judiciário", "estado"],
    ["administracao", "Administração", "estado"],
    ["justica", "Essencial à Justiça", "estado"],
    ["legislativa", "Legislativo", "estado"],
    ["exteriores", "Relações exteriores", "estado"],
  ] as [string, string, FamiliaId][]
).map(([id, nome, familia]) => ({ id, nome, familia }));

const POR_ID: Record<string, ItemOrcamento> = Object.fromEntries(ITENS.map((i) => [i.id, i]));
export const itemDe = (id: string): ItemOrcamento | undefined => POR_ID[id];

export const nomeDoItem = (id: string) => POR_ID[id]?.nome ?? id;

const FUNCAO_PARA_ITEM: Record<string, string> = {
  "Previdência Social": "previdencia",
  "Assistência Social": "assistencia",
  Trabalho: "trabalho",
  Saúde: "saude",
  Educação: "educacao",
  Agricultura: "agricultura",
  "Gestão Ambiental": "ambiente",
  "Ciência e Tecnologia": "ciencia",
  "Segurança Pública": "seguranca",
  Transporte: "transporte",
  "Organização Agrária": "agraria",
  Comunicações: "comunicacoes",
  Cultura: "cultura",
  Indústria: "industria",
  Urbanismo: "urbanismo",
  "Comércio e Serviços": "comercio",
  "Direitos da Cidadania": "cidadania",
  Energia: "energia",
  "Desporto e Lazer": "esporte",
  Habitação: "habitacao",
  Saneamento: "saneamento",
  "Defesa Nacional": "defesa",
  Judiciária: "judiciaria",
  Administração: "administracao",
  "Essencial à Justiça": "justica",
  Legislativa: "legislativa",
  "Relações Exteriores": "exteriores",
};

export interface LinhaFuncao {
  nivel: "total" | "funcao" | "subfuncao";
  funcao: string | null;
  conta: string;
  valor: number | null;
}

/** O que um ente gastou num período. `p` é a população usada no "por habitante". */
export interface PontoDinheiro {
  t: number;
  p: number | null;
  v: Record<string, number>;
  /** O que ficou fora de `t`: as transferências que só alguns estados lançam como despesa. */
  fora?: number;
}

const limparSubfuncao = (n: string) => n.replace(/^FU\d+\s*-\s*/, "").replace("Demais Subfunções", "Demais").trim();

/**
 * De linhas do Anexo 02 para blocos. Refinanciamento sai do total: rolar dívida não é
 * gasto, e só alguns anos trazem a linha (R$ 1,41 tri em 2022). O que não casar com
 * função nenhuma vai para "Sem classificação", para o total sempre fechar.
 */
export interface BaldesDoPeriodo {
  t: number;
  v: Record<string, number>;
  abre: Record<string, [string, number][]>;
  /** O refinanciamento rotulado que saiu do total. */
  refinanciamento: number;
}

export function baldesDoPeriodo(linhas: LinhaFuncao[]): BaldesDoPeriodo | null {
  const total = linhas.find((l) => l.nivel === "total")?.valor;
  if (total == null) return null;
  const v: Record<string, number> = {};
  const subs: Record<string, [string, number][]> = {};
  const somar = (id: string, x: number) => {
    v[id] = (v[id] ?? 0) + x;
  };
  let refinanciamento = 0;
  for (const l of linhas) {
    const x = l.valor ?? 0;
    if (l.nivel === "funcao") {
      const id = FUNCAO_PARA_ITEM[l.conta];
      if (id) somar(id, x);
    } else if (l.nivel === "subfuncao") {
      if (l.funcao === "Encargos Especiais") {
        if (/^Refinanciamento/.test(l.conta)) refinanciamento += x;
        else if (/^Serviço da Dívida/.test(l.conta)) {
          somar("divida", x);
          (subs.divida ??= []).push([l.conta, x]);
        }
        else if (/Educação Básica/.test(l.conta)) somar("edbasica", x);
        else if (/^(Outras )?Transferências/.test(l.conta)) somar("transf", x);
        else somar("outros", x);
      } else {
        const id = l.funcao ? FUNCAO_PARA_ITEM[l.funcao] : undefined;
        if (id) (subs[id] ??= []).push([limparSubfuncao(l.conta), x]);
      }
    }
  }
  const t = total - refinanciamento;
  const resto = t - Object.values(v).reduce((s, x) => s + x, 0);
  if (resto > 1) v.naoclass = resto;
  const abre: Record<string, [string, number][]> = {};
  for (const [id, lista] of Object.entries(subs)) {
    const base = v[id] || 1;
    const topo = lista
      .filter(([, x]) => x > 0 && x / base >= 0.02)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (topo.length >= 2) abre[id] = topo;
  }
  return { t, v, abre, refinanciamento };
}

/**
 * O fechamento de 2022 traz no total o refinanciamento inteiro, mas só rotula o da
 * dívida mobiliária. O contratual (R$ 13,2 bi) fica sem nome: o Anexo 01 dá o total
 * certo, e a sobra sai de "Dívida". Só vale para período com refinanciamento rotulado.
 */
export function descontarRefinanciamentoSemRotulo(b: BaldesDoPeriodo, totalAnexo01: number | null | undefined): BaldesDoPeriodo {
  if (!b.refinanciamento || totalAnexo01 == null) return b;
  const sobra = b.t - totalAnexo01;
  if (sobra <= 1 || !(b.v.divida >= sobra)) return b;
  return { ...b, t: totalAnexo01, v: { ...b.v, divida: b.v.divida - sobra } };
}

export interface AcaoDaUniao {
  funcao: string;
  subfuncao: string;
  acao: string;
  nome: string;
  realizado: number;
}

const ACAO_BANCO_CENTRAL = "0669";
const ACAO_PENSOES_MILITARES = "0179";
const SUBFUNCOES_DO_ITEM: Record<string, string[]> = { transf: ["845"], edbasica: ["847"] };

/** "TRANSFERÊNCIA AO FPM (CF, art. 159)" vira um nome que cabe na barra. */
const nomeDaAcao = (n: string) => {
  const curto = n.replace(/\s*\(.*$/, "").trim();
  return curto === curto.toUpperCase() ? curto.charAt(0) + curto.slice(1).toLowerCase() : curto;
};

/**
 * Abre os encargos da União com o orçamento por ação da CGU.
 *
 * A cobertura do resultado negativo do Banco Central vira bloco próprio. O Anexo 02 a
 * deixa em "Outros Encargos" e o Anexo 01 a conta em juros e amortização, então, sem o
 * arquivo da CGU ou no ano ainda aberto, ela é a diferença entre os dois.
 *
 * As pensões militares voltam a Previdência: em 2025 saíram da função 09 para a 28.
 * No ano aberto ficam onde estão, porque o arquivo da CGU não tem o mesmo recorte de meses.
 *
 * O "realizado" da CGU vem quase zerado em precatórios: eles são o que sobra da linha.
 */
export function abrirComAcoes(b: BaldesDoPeriodo, { acoes, jurosEAmortizacao }: { acoes?: AcaoDaUniao[]; jurosEAmortizacao?: number | null }): BaldesDoPeriodo {
  const v = { ...b.v };
  const abre = { ...b.abre };
  const outros = v.outros ?? 0;
  const soma = (l: AcaoDaUniao[]) => l.reduce((s, a) => s + a.realizado, 0);
  const em846 = (acoes ?? []).filter((a) => a.funcao === "28" && a.subfuncao === "846");
  let bancoCentral: number;
  if (acoes?.length) bancoCentral = soma(em846.filter((a) => a.acao === ACAO_BANCO_CENTRAL));
  else {
    const diferenca = b.refinanciamento || jurosEAmortizacao == null ? 0 : jurosEAmortizacao - (v.divida ?? 0);
    bancoCentral = diferenca > 1e9 ? diferenca : 0;
  }
  const pensoes = soma(em846.filter((a) => a.acao === ACAO_PENSOES_MILITARES));
  if (bancoCentral + pensoes > outros) return b;
  if (bancoCentral > 0) v.bancocentral = bancoCentral;
  if (pensoes > 0) v.previdencia = (v.previdencia ?? 0) + pensoes;
  v.outros = outros - bancoCentral - pensoes;
  if (acoes?.length) {
    const resto = em846.filter((a) => a.acao !== ACAO_BANCO_CENTRAL && a.acao !== ACAO_PENSOES_MILITARES && !/SENTEN|PRECAT|REQUISI/i.test(a.nome));
    const financiamentos = soma(resto.filter((a) => /FINANCIAMENTO|FUNDO|INTEGRALIZ|PARTICIPA/i.test(a.nome)));
    const demais = soma(resto) - financiamentos;
    const lista: [string, number][] = [
      ["Precatórios e sentenças (por diferença)", v.outros - financiamentos - demais],
      ["Financiamentos e fundos", financiamentos],
      ["Demais encargos", demais],
    ];
    abre.outros = lista.filter(([, x]) => x > 0).sort((x, y) => y[1] - x[1]);
    for (const [id, subs] of Object.entries(SUBFUNCOES_DO_ITEM)) {
      const base = v[id];
      if (!base) continue;
      const topo = acoes
        .filter((a) => a.funcao === "28" && subs.includes(a.subfuncao) && a.realizado / base >= 0.02)
        .sort((x, y) => y.realizado - x.realizado)
        .slice(0, 3)
        .map((a): [string, number] => [nomeDaAcao(a.nome), a.realizado]);
      if (topo.length >= 2) abre[id] = topo;
    }
  }
  return { ...b, v, abre };
}

/**
 * Nos estados, a linha "Transferências" sai da conta. Em 2025, só Acre, Amazonas e São
 * Paulo lançaram nela o repasse legal a municípios: dentro da base, ela tornaria "de
 * cada R$ 100" incomparável entre estados. O valor segue visível em `fora`.
 */
export function tirarRepasseDaBase(b: BaldesDoPeriodo): BaldesDoPeriodo & { fora?: number } {
  const fora = b.v.transf ?? 0;
  if (!fora) return b;
  const v = { ...b.v };
  delete v.transf;
  return { ...b, t: b.t - fora, v, fora };
}

/** A população do ano; sem estimativa naquele ano, interpola entre os vizinhos ou usa o mais próximo. */
export function populacaoNoAno(serie: Record<string, number> | undefined, ano: number): number | null {
  if (!serie) return null;
  if (serie[ano] > 0) return serie[ano];
  const anos = Object.keys(serie).map(Number).filter((a) => serie[a] > 0).sort((a, b) => a - b);
  const antes = anos.filter((a) => a < ano).at(-1);
  const depois = anos.find((a) => a > ano);
  if (antes !== undefined && depois !== undefined) return Math.round(serie[antes] + ((serie[depois] - serie[antes]) * (ano - antes)) / (depois - antes));
  const perto = antes ?? depois;
  return perto === undefined ? null : serie[perto];
}

export interface EnteDinheiro {
  nome: string;
  /** Por ano; `2022p` é o mesmo trecho do ano parcial, em 2022, para comparar. */
  anos: Record<string, PontoDinheiro>;
  /** Por ano e por bloco, as maiores subfunções. */
  abre: Record<string, Record<string, [string, number][]>>;
}

export interface ReceitaDinheiro {
  t: number;
  imp: number;
  con: number;
  out: number;
  emp: number;
  cap: number;
}

export interface PainelDinheiro {
  anos: number[];
  /** O ano ainda aberto e o bimestre até onde há dado. */
  parcial: { ano: number; bim: number; mes: string } | null;
  /** O mês para o qual os valores reais são trazidos, como "set/2026". */
  baseReal: string;
  /** Multiplicador que leva cada período a valores de `baseReal`. */
  idx: Record<string, number>;
  entes: Record<string, EnteDinheiro>;
  receita: Record<string, ReceitaDinheiro>;
  /** Se o orçamento por ação da CGU já está no banco. */
  abertura: boolean;
  coletadoEm: string | null;
}

export const MES_DO_BIMESTRE = ["", "fev", "abr", "jun", "ago", "out", "dez"];

// --- Formatos -----------------------------------------------------------------

export const numero = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function reais(v: number) {
  const a = Math.abs(v);
  if (a >= 1e12) return `R$ ${numero(v / 1e12, 2)} tri`;
  if (a >= 1e10) return `R$ ${numero(v / 1e9, 0)} bi`;
  if (a >= 1e9) return `R$ ${numero(v / 1e9, 1)} bi`;
  if (a >= 1e7) return `R$ ${numero(v / 1e6, 0)} mi`;
  if (a >= 1e6) return `R$ ${numero(v / 1e6, 1)} mi`;
  return `R$ ${numero(v, 0)}`;
}

export const deCem = (v: number, t: number) => numero((100 * v) / t, 2);
export const sinal = (p: number) => `${p >= 0 ? "+" : "−"}${numero(Math.abs(p), 0)}%`;

// --- Treemap ------------------------------------------------------------------

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

const piorRazao = (linha: { a: number }[], lado: number) => {
  let soma = 0;
  let maior = 0;
  let menor = Infinity;
  for (const i of linha) {
    soma += i.a;
    if (i.a > maior) maior = i.a;
    if (i.a < menor) menor = i.a;
  }
  return Math.max((lado * lado * maior) / (soma * soma), (soma * soma) / (lado * lado * menor));
};

/** Squarified treemap: a área de cada item é proporcional a `v`, e os retângulos ficam o menos finos possível. */
export function squarify<T extends { v: number }>(itens: T[], r: Retangulo): (T & Retangulo)[] {
  const total = itens.reduce((s, i) => s + i.v, 0);
  if (!total || r.w <= 0 || r.h <= 0) return [];
  const k = (r.w * r.h) / total;
  let resto = itens.map((i) => ({ ...i, a: i.v * k }));
  const saida: (T & Retangulo)[] = [];
  let { x, y, w, h } = r;
  while (resto.length) {
    const lado = Math.min(w, h);
    let linha: typeof resto = [];
    let melhor = Infinity;
    let n = 0;
    while (n < resto.length) {
      const teste = [...linha, resto[n]];
      const pior = piorRazao(teste, lado);
      if (pior > melhor) break;
      linha = teste;
      melhor = pior;
      n++;
    }
    const soma = linha.reduce((q, i) => q + i.a, 0);
    const espessura = soma / lado;
    if (w >= h) {
      let yy = y;
      for (const { a, ...i } of linha) {
        const hh = a / espessura;
        saida.push({ ...(i as unknown as T), x, y: yy, w: espessura, h: hh });
        yy += hh;
      }
      x += espessura;
      w -= espessura;
    } else {
      let xx = x;
      for (const { a, ...i } of linha) {
        const ww = a / espessura;
        saida.push({ ...(i as unknown as T), x: xx, y, w: ww, h: espessura });
        xx += ww;
      }
      y += espessura;
      h -= espessura;
    }
    resto = resto.slice(n);
  }
  return saida;
}

const encolher = <T extends Retangulo>(r: T, m: number): T => ({ ...r, x: r.x + m, y: r.y + m, w: Math.max(0, r.w - 2 * m), h: Math.max(0, r.h - 2 * m) });

export interface BlocoTreemap extends Retangulo {
  id: string;
  familia: FamiliaId;
  v: number;
  /** Quantos itens foram juntados neste bloco ("Mais N áreas"). */
  dobra?: number;
}

/** Abaixo disso o bloco não comporta nome e valor. */
export const LIMIAR_DOBRA = 0.009;
/** No celular o palco tem um quinto da área: só os blocos grandes ficam soltos. */
export const LIMIAR_DOBRA_CELULAR = 0.03;

/**
 * O arranjo do palco. `larguraDeCalculo` é a largura com a barra fechada: ao abrir, os
 * blocos só estreitam em vez de mudar de lugar.
 */
export function arranjarTreemap(ponto: PontoDinheiro, area: { w: number; h: number }, zoom: FamiliaId | null, larguraDeCalculo = area.w, limiar = LIMIAR_DOBRA): BlocoTreemap[] {
  const fx = area.w / (larguraDeCalculo || 1);
  const R: Retangulo = { x: 0, y: 0, w: larguraDeCalculo, h: area.h };
  const estreitar = <T extends Retangulo>(l: T[]) => l.map((r) => ({ ...r, x: r.x * fx, w: r.w * fx }));
  const todos = ITENS.map((i) => ({ id: i.id, familia: i.familia, v: ponto.v[i.id] ?? 0 })).filter((i) => i.v > 0);
  if (zoom) {
    return estreitar(squarify(todos.filter((i) => i.familia === zoom).sort((a, b) => b.v - a.v), R)).map((r) => encolher(r, 1));
  }
  const familias = ORDEM_FAMILIAS.map((familia) => {
    const membros: { id: string; familia: FamiliaId; v: number; dobra?: number }[] = todos.filter((i) => i.familia === familia);
    const pequenos = membros.filter((i) => i.v / ponto.t < limiar);
    const grupos = pequenos.length >= 2
      ? [...membros.filter((i) => i.v / ponto.t >= limiar), { id: `dobra-${familia}`, familia, v: pequenos.reduce((s, i) => s + i.v, 0), dobra: pequenos.length }]
      : membros;
    return { familia, v: membros.reduce((s, i) => s + i.v, 0), grupos };
  }).filter((f) => f.v > 0);
  const saida: BlocoTreemap[] = [];
  for (const f of squarify(familias, R)) {
    for (const b of squarify(f.grupos, encolher(f, 2))) saida.push(b);
  }
  return estreitar(saida).map((r) => encolher(r, 1));
}

export type ConteudoBloco =
  | { tipo: "vazio" }
  | { tipo: "vertical"; texto: string }
  | { tipo: "compacto"; tamNome: number }
  | { tipo: "cheio"; tamNome: number; tamValor: number; valor: boolean; absoluto: boolean; abrir: boolean };

/** O que cabe em cada bloco, pelo tamanho que ele terá ao fim da animação. */
export function conteudoDoBloco(b: { w: number; h: number; dobra?: number }, nome: string, valor: string): ConteudoBloco {
  const miolo = b.w - 22;
  const raiz = Math.sqrt(b.w * b.h);
  const tamValor = Math.min(46, Math.max(15, raiz / 8.2), miolo / (valor.length * 0.53));
  const tamNome = Math.max(12, Math.min(16, raiz / 17));
  const linhas = Math.max(1, Math.ceil((nome.length * tamNome * 0.54) / Math.max(miolo, 1)));
  const altura = linhas * tamNome * 1.18;
  // Palavra longa não quebra: se não couber na largura, sairia cortada.
  const maiorPalavra = Math.max(...nome.split(" ").map((p) => p.length));
  if (miolo < 36 || linhas > 3 || altura + 18 > b.h || maiorPalavra * tamNome * 0.58 > miolo) {
    // Baixo e largo: letra menor e pouca margem, em vez de ficar mudo.
    const largura = b.w - 12;
    const linhasCompacto = Math.ceil((nome.length * 10.5 * 0.54) / Math.max(largura, 1));
    if (b.h <= b.w * 2 && largura >= 30 && maiorPalavra * 10.5 * 0.58 <= largura && linhasCompacto * 12.5 + 8 <= b.h) return { tipo: "compacto", tamNome: 10.5 };
    if (b.w >= 20 && b.h >= 64) {
      const cabe = (s: string) => s.length * 6.3 <= b.h - 14;
      const junto = `${nome} · ${valor}`;
      const texto = cabe(junto) ? junto : cabe(nome) ? nome : "";
      if (texto) return { tipo: "vertical", texto };
    }
    return { tipo: "vazio" };
  }
  return {
    tipo: "cheio",
    tamNome,
    tamValor,
    valor: tamValor >= 12 && miolo >= valor.length * tamValor * 0.5 && altura + tamValor * 1.1 + 20 <= b.h,
    absoluto: !b.dobra && b.h >= altura + tamValor + 44 && miolo >= 78,
    abrir: Boolean(b.dobra) && b.h >= altura + tamValor + 42 && miolo >= 70,
  };
}

// --- Governos e comparações ---------------------------------------------------

export interface GrupoDeAnos {
  id: string;
  rotulo: string;
  anos: number[];
}

/** Quem governava em julho fica com o ano: 2016 é de Dilma, que saiu em 31 de agosto. */
export function gruposDePresidentes(anos: number[], mandatos: { id: string; nomeCurto: string; mandato: number; inicio: string }[]): GrupoDeAnos[] {
  const ordem = [...mandatos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const saida: GrupoDeAnos[] = [];
  for (const ano of anos) {
    const dia = `${ano}-07-01`;
    const m = ordem.filter((x) => x.inicio.slice(0, 10) <= dia).at(-1);
    if (!m) continue;
    const ultimo = saida.at(-1);
    if (ultimo?.id === m.id) ultimo.anos.push(ano);
    else saida.push({ id: m.id, rotulo: m.mandato > 1 ? `${m.nomeCurto} ${m.mandato}` : m.nomeCurto, anos: [ano] });
  }
  return saida;
}

/** Os mandatos de governador cortados aos anos que a base tem. */
export function gruposDeGovernadores(anos: number[], termos: { id: string; ano: number; nomes: string[] }[]): GrupoDeAnos[] {
  return termos
    .map((t) => ({
      id: t.id,
      rotulo: t.nomes.length > 1 ? `${t.nomes[0]} +${t.nomes.length - 1}` : (t.nomes[0] ?? `${t.ano}–${t.ano + 3}`),
      anos: anos.filter((a) => a >= t.ano && a <= t.ano + 3),
    }))
    .filter((g) => g.anos.length > 0);
}

export interface BaseDeComparacao {
  chave: string;
  ano: number;
  texto: string;
}

/** Contra o que o ano se compara: o último ano antes do governo que o contém. Ano aberto usa o mesmo trecho. */
export function baseDoAno(painel: Pick<PainelDinheiro, "anos" | "parcial">, ano: number, grupos: GrupoDeAnos[]): BaseDeComparacao | null {
  const grupo = grupos.find((g) => g.anos.includes(ano));
  if (!grupo) return null;
  const base = grupo.anos[0] - 1;
  if (base < painel.anos[0]) return null;
  if (painel.parcial?.ano === ano) return { chave: `${base}p`, ano: base, texto: `jan–${painel.parcial.mes} de ${base}` };
  return { chave: String(base), ano: base, texto: String(base) };
}

/** A mudança descontada a inflação, em %. `null` quando não há base: nunca vira zero. */
export function variacaoReal(
  painel: Pick<PainelDinheiro, "idx">,
  ente: Pick<EnteDinheiro, "anos">,
  ano: number,
  base: BaseDeComparacao | null,
  id: string | "_total",
): number | null {
  if (!base) return null;
  const agora = ente.anos[String(ano)];
  const antes = ente.anos[base.chave];
  const idxAgora = painel.idx[String(ano)];
  const idxAntes = painel.idx[base.chave];
  if (!agora || !antes || !idxAgora || !idxAntes) return null;
  const a = id === "_total" ? agora.t : agora.v[id];
  const b = id === "_total" ? antes.t : antes.v[id];
  if (!(a > 0) || !(b > 0) || b / antes.t < 0.0005) return null;
  return 100 * ((a * idxAgora) / (b * idxAntes) - 1);
}

export interface PontoRegua {
  sigla: string;
  nome: string;
  porHabitante: number;
  deCadaCem: number;
  coluna: number;
  linha: number;
}

export const COLUNAS_REGUA = 10;
const ALTURA_REGUA = 5;

/**
 * Os estados numa régua de log, com as siglas empilhadas onde caem juntas. Abaixo de
 * R$ 1 por habitante fica fora: o DF quase não tem Judiciário próprio, e esse ponto
 * esmagaria os outros 26 contra a direita.
 */
export function reguaDosEstados(entes: Record<string, EnteDinheiro>, id: string, ano: number): { pontos: PontoRegua[]; min: number; max: number; linhas: number } | null {
  const dados = Object.entries(entes)
    .filter(([k]) => k !== "BR")
    .flatMap(([sigla, e]) => {
      const p = e.anos[String(ano)];
      const v = p?.v[id];
      if (!p || !p.p || !(v && v > 0) || v / p.p < 1) return [];
      return [{ sigla, nome: e.nome, porHabitante: v / p.p, deCadaCem: (100 * v) / p.t }];
    })
    .sort((a, b) => a.porHabitante - b.porHabitante);
  if (dados.length < 5) return null;
  const min = dados[0].porHabitante;
  const max = dados[dados.length - 1].porHabitante;
  const escala = (v: number) => (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min) || 1);
  const alturas = new Array(COLUNAS_REGUA).fill(0) as number[];
  const pontos = dados.map((d) => {
    const alvo = Math.min(COLUNAS_REGUA - 1, Math.round(escala(d.porHabitante) * (COLUNAS_REGUA - 1)));
    let coluna = alvo;
    if (alturas[alvo] >= ALTURA_REGUA) {
      for (let o = 1; o < COLUNAS_REGUA; o++) {
        if (alvo - o >= 0 && alturas[alvo - o] < ALTURA_REGUA) {
          coluna = alvo - o;
          break;
        }
        if (alvo + o < COLUNAS_REGUA && alturas[alvo + o] < ALTURA_REGUA) {
          coluna = alvo + o;
          break;
        }
      }
    }
    return { ...d, coluna, linha: alturas[coluna]++ };
  });
  return { pontos, min, max, linhas: Math.max(...alturas) };
}

// --- Emendas ------------------------------------------------------------------

export interface EmendasDoAno {
  ano: number;
  total: { v: number; q: number };
  porUf: Record<string, { v: number; q: number }>;
  /** nome, UF, valor, planos, população, CNPJ */
  municipios: [string, string, number, number, number, string][];
  /** nome, UF, valor, planos */
  parlamentares: [string, string, number, number][];
}

/** Nome sem acento, sem "Município de", em caixa alta: o último recurso quando o CNPJ não casa. */
export const normalizarEnte = (s: string | null) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^(PREFEITURA MUNICIPAL DE|PREFEITURA DE|MUNICIPIO DE|MUNICIPIO DO|MUNICIPIO DA|MUNICIPIO)\s+/, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const SITUACAO_PLANO: Record<string, string> = {
  CIENTE: "Beneficiário ciente",
  IMPEDIDO: "Impedido",
  IMPEDIDO_REJEICAO_PLANO_TRABALHO: "Impedido: plano de trabalho rejeitado",
};
