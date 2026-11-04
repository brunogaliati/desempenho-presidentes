/**
 * Quem governou cada estado e o país desde 1995, para o modo "Quem governa"
 * do mapa da economia.
 *
 *     node scripts/gerar-governos.mjs
 *
 * Lê a curadoria de governadores do backend (`backend/dados/governadores`,
 * gerada por `python -m desempenho.governadores validar`) e o complemento
 * deste diretório (`governos-complemento.json`), que acrescenta as trocas de
 * partido com data e fonte onde a curadoria deixou o partido vazio. Grava
 * `src/app/_painel/_dados/governos.json`.
 *
 * Os trechos usam `[inicio, fim)`, como no backend. Partido `null` é
 * desconhecido, nunca "sem partido": sem filiação é a sigla "SEM", e só entra
 * com fonte (magistrado no cargo, político entre dois partidos).
 *
 * A cor de cada partido não está aqui: fica no CSS (`--partido-<familia>` em
 * `globals.css`). A família junta os nomes de um mesmo partido ao longo do
 * tempo (PFL, DEM e União; PPR, PPB e PP; PL e PR), para a cor não mudar
 * só porque a sigla mudou.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(RAIZ, "..", "backend", "dados", "governadores");
const COMPLEMENTO = join(RAIZ, "scripts", "governos-complemento.json");
const SAIDA = join(RAIZ, "src", "app", "_painel", "_dados", "governos.json");

const INICIO = "1995-01-01";

/** Identidade do backend → família de cor. */
const FAMILIA = {
  psdb: "psdb", pt: "pt", mdb: "mdb", pfl: "uniao", uniao: "uniao", psl: "psl",
  ppr: "pp", ppb: "pp", pl1985: "pl", pl2006: "pl", psb: "psb", pdt: "pdt",
  ptb: "ptb", prd: "ptb", pps: "pps", psd: "psd", republicanos: "rep", pmn: "pmn",
  pros: "pros", psc: "psc", phs: "phs", pode: "pode", novo: "novo", pv: "pv",
  pcdob: "pcdob", solidariedade: "sd",
};

/** Como a sigla aparece na legenda e, mais curta, sobre o estado. */
const ROTULO = {
  UNIÃO: ["União", "União"], REPUBLICANOS: ["Republicanos", "Rep."], SOLIDARIEDADE: ["Solidariedade", "SD"],
  SD: ["Solidariedade", "SD"], CIDADANIA: ["Cidadania", "Cid."], MOBILIZA: ["Mobiliza", "Mob."],
  PODE: ["Podemos", "Pode"], NOVO: ["Novo", "Novo"],
};

/** CSV com aspas, como o backend grava (UTF-8 com BOM). */
function lerCsv(texto) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.length > 1 || linha[0] !== "") linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  const [cab, ...resto] = linhas;
  return resto.map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i] ?? ""])));
}

/** "2026-01" (só o mês) vira o dia 1; a nota do trecho diz que é aproximado. */
const dia = (d) => (d.length === 7 ? `${d}-01` : d);

const [governadores, denominacoes, complemento] = await Promise.all([
  readFile(join(BACKEND, "governadores.csv"), "utf8").then(lerCsv),
  readFile(join(BACKEND, "partidos.csv"), "utf8").then(lerCsv),
  readFile(COMPLEMENTO, "utf8").then(JSON.parse),
]);

const avisos = [];

/** A denominação de uma sigla numa data, ou nada se a sigla não existia. */
function denominacao(sigla, data) {
  return denominacoes.find(
    (d) => d.sigla === sigla && (!d.inicio || d.inicio <= data) && (!d.fim || data < d.fim),
  );
}

const partidos = {};
function registrar(sigla, data, onde) {
  if (sigla === null || sigla === "SEM") return sigla;
  const d = denominacao(sigla, data);
  if (!d) {
    avisos.push(`${onde}: ${sigla} não existia em ${data}`);
    return null;
  }
  const familia = FAMILIA[d.partido_id];
  if (!familia) avisos.push(`${onde}: ${sigla} (${d.partido_id}) sem família de cor`);
  const [rotulo, curta] = ROTULO[sigla] ?? [sigla, sigla];
  partidos[sigla] ??= { nome: d.nome, familia, rotulo, curta };
  // A mesma sigla com nomes diferentes em épocas diferentes (PP): vale o mais recente.
  if (!d.fim) partidos[sigla].nome = d.nome;
  return sigla;
}

/**
 * A observação do backend mistura a ressalva padrão, notas de rodapé da lista
 * de origem e o cargo anterior. Fica só o que explica uma troca no cargo.
 */
const PENDENCIA = /refer[êe]ncia secund|conferir|confirmar|requer|precisa|pendente|enquanto não|confrontad|preservad|não confundir|não é interinidade|fronteira|indevidamente|^Fim original|convertido para limite|não prolongar|galeria/i;
const EXPLICA = /assum|ren[uú]nc|licen|afast|cass|mort|falec|interin|retorno|volta|pris|impeach|STF|STJ|TSE|decis|suplementar|indiret|tamp[aã]o|substitu/i;
function limparNota(texto, como) {
  if (como === "eleito" || como === "reeleito") return null;
  const partes = texto
    .split(" | ")
    .map((p) => p.replace(/\[(nota )?\d+\]/g, "").replace(/\s+/g, " ").trim())
    .filter((p) => p && EXPLICA.test(p))
    // Frase a frase: as pendências da curadoria ("a conferir", "requer ato")
    // são do backend, não do leitor.
    .flatMap((p) => p.split(/(?<=[.;])\s+/))
    .map((f) => f.trim().replace(/;$/, ".").replace(/^\p{Ll}/u, (c) => c.toUpperCase()))
    .filter((f) => f && !PENDENCIA.test(f));
  if (!partes.length) return null;
  const nota = partes.join(" ").replace(/\s+([.,;])/g, "$1");
  return /[.!?]$/.test(nota) ? nota : `${nota}.`;
}

const porChave = new Map(complemento.trechos.map((t) => [`${t.uf} ${t.inicio}`, t]));
const usados = new Set();
const ufs = {};
const previstos = {};

for (const g of governadores) {
  if (g.situacao === "previsto") {
    previstos[g.uf] = {
      nome: g.nome_curto,
      partido: g.partido_eleicao ? registrar(g.partido_eleicao, "2026-10-01", `${g.uf} previsto`) : null,
      como: g.como,
      posse: g.inicio,
      fonte: g.fonte_eleicao || g.fonte,
    };
    continue;
  }
  const chave = `${g.uf} ${g.inicio}`;
  const extra = porChave.get(chave);
  if (extra) usados.add(chave);
  const base = {
    nome: g.nome_curto,
    como: g.como,
    eleicao: g.eleicao ? Number(g.eleicao) : null,
    fonte: g.fonte,
  };
  const nota = [limparNota(g.observacao, g.como), extra?.nota].filter(Boolean).join(" ") || null;

  // Sem complemento, o partido do backend; com ele, as trocas pesquisadas.
  const trocas =
    extra?.partidos ??
    (g.partido ? [[g.inicio, g.partido]] : [[g.inicio, null]]);
  const lista = (ufs[g.uf] ??= []);
  trocas.forEach(([desde, sigla], i) => {
    const inicio = dia(desde);
    const fim = i + 1 < trocas.length ? dia(trocas[i + 1][0]) : g.fim || null;
    if (inicio < g.inicio || (g.fim && inicio >= g.fim)) avisos.push(`${chave}: troca ${desde} fora do trecho`);
    lista.push({
      ...base,
      inicio,
      fim,
      partido: registrar(sigla, inicio, chave),
      // De onde vem o partido: a curadoria (oficial ou lista histórica) ou o complemento.
      origem: extra?.partidos ? "complemento" : g.partido ? g.validacao_partido : "desconhecido",
      fontePartido: extra?.partidos ? extra.fonte ?? g.fonte_eleicao ?? null : g.fonte_partido || null,
      eleitoPor: g.partido_eleicao && g.partido_eleicao !== sigla ? g.partido_eleicao.replace("PC do B", "PCdoB") : null,
      aproximado: desde.length === 7 ? true : undefined,
      nota,
    });
  });
}

for (const chave of porChave.keys()) if (!usados.has(chave)) avisos.push(`complemento ${chave}: trecho não existe no CSV`);

// Siglas do TSE na candidatura não seguem sempre a do cadastro (PC do B).
for (const lista of Object.values(ufs)) {
  for (const t of lista) if (t.eleitoPor) t.eleitoPor = registrar(t.eleitoPor, `${t.eleicao ?? t.inicio.slice(0, 4)}-10-01`, "eleitoPor");
}

const presidentes = complemento.presidentes.map((p) => ({ ...p, partido: registrar(p.partido, p.inicio, `presidente ${p.curto}`) }));

// --- Conferência: cobertura, sobreposição e quanto ficou sem partido ---------

const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dias = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
let semPartido = 0, total = 0;
for (const [uf, lista] of Object.entries(ufs)) {
  lista.sort((a, b) => a.inicio.localeCompare(b.inicio));
  let fimAnterior = INICIO;
  for (const t of lista) {
    if (t.inicio > fimAnterior) avisos.push(`${uf}: lacuna ${fimAnterior} → ${t.inicio}`);
    if (t.inicio < fimAnterior) avisos.push(`${uf}: sobreposição em ${t.inicio}`);
    fimAnterior = t.fim ?? hoje;
    const n = dias(t.inicio, t.fim ?? hoje);
    total += n;
    if (t.partido === null) semPartido += n;
  }
}

const saida = {
  fonte:
    "Curadoria de governadores do backend (TSE, atos oficiais e listas históricas) com o complemento de trocas de partido de scripts/governos-complemento.json",
  referencia: hoje,
  partidos: Object.fromEntries(Object.entries(partidos).sort(([a], [b]) => a.localeCompare(b))),
  presidentes,
  ufs: Object.fromEntries(Object.entries(ufs).sort(([a], [b]) => a.localeCompare(b))),
  previstos,
};
await writeFile(SAIDA, `${JSON.stringify(saida, null, 1)}\n`);

console.log(`${Object.keys(ufs).length} UFs, ${Object.values(ufs).flat().length} trechos, ${Object.keys(partidos).length} siglas`);
console.log(`tempo sem partido confirmado: ${((100 * semPartido) / total).toFixed(1)}%`);
for (const a of avisos) console.log(`aviso: ${a}`);
