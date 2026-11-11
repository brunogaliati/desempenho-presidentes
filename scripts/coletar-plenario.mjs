/**
 * Fotografia do plenário na legislatura atual: presença, votações nominais e voto com o governo.
 *
 *     node scripts/coletar-plenario.mjs
 *
 * Grava `public/painel/congresso/plenario-deputados.json` e `plenario-senadores.json`, lidos pela
 * aba Congresso. Como `coletar-cota.mjs`, não toca no banco.
 *
 * Câmara (arquivos anuais de dados abertos):
 * - Presença: sessões deliberativas do plenário encerradas (`eventos`) e quem registrou presença
 *   (`eventosPresencaDeputados`). O arquivo não separa ausência justificada da não justificada.
 * - Votações: só as nominais do plenário (`votacoes` + `votacoesVotos`). Qualquer voto registrado
 *   conta como participação, inclusive abstenção, obstrução e o voto do presidente (art. 17).
 * - Governo: a orientação "Governo" de `votacoesOrientacoes`. Conta só quando o governo orientou
 *   Sim ou Não e o deputado votou Sim ou Não.
 * - Quem estava no cargo: o histórico de cada deputado na API (`/deputados/{id}/historico`). Sessão
 *   ou votação fora do exercício (licença, ministério, suplente que ainda não tinha assumido) não
 *   entra na conta da pessoa.
 *
 * Senado (API de dados abertos):
 * - Votações nominais por ano (`/votacao?ano=`): cada votação lista quem estava em exercício,
 *   com o voto ou o motivo da ausência. Votação secreta conta para participação ("Votou"), mas
 *   não para o governo nem para a lista de votos.
 * - Governo: `/plenario/votacao/orientacaoBancada`, ligada pela sequência da votação.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "public", "painel", "congresso");
const fotografia = JSON.parse(await readFile(join(RAIZ, "src", "app", "_painel", "_dados", "fotografia.json"), "utf8"));
const ANOS = [2023, 2024, 2025, 2026];
/** A 57ª legislatura começou em 1º de fevereiro de 2023. */
const INICIO = "2023-02-01";
const LEGISLATURA = "legislatura";
const ULTIMAS_VOTACOES = 30;
const AGENTE = { "user-agent": "desempenho-do-governo/coleta (dados abertos)", accept: "application/json" };

async function baixar(url, tipo = "text", tentativas = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: AGENTE });
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      return tipo === "json" ? await r.json() : await r.text();
    } catch (e) {
      if (i >= tentativas) throw e;
      await new Promise(ok => setTimeout(ok, 1500 * i));
    }
  }
}

/** CSV com ";" e aspas, com aspas duplas e quebras de linha dentro dos campos. */
function* linhasCsv(texto) {
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo.endsWith("\r") ? campo.slice(0, -1) : campo); yield linha; linha = []; campo = ""; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); yield linha; }
}

/** Lê um arquivo anual da Câmara e chama `cada` com um leitor de colunas por nome. */
async function arquivoCamara(nome, ano, cada) {
  const texto = (await baixar(`https://dadosabertos.camara.leg.br/arquivos/${nome}/csv/${nome}-${ano}.csv`)).replace(/^﻿/, "");
  let cabecalho = null, n = 0;
  for (const linha of linhasCsv(texto)) {
    if (!cabecalho) { cabecalho = new Map(linha.map((c, i) => [c, i])); continue; }
    if (linha.length < cabecalho.size - 1) continue;
    cada(c => linha[cabecalho.get(c)] ?? "");
    n++;
  }
  return n;
}

/** Roda `tarefa` sobre a lista, `quantas` de cada vez. */
async function emLotes(lista, quantas, tarefa) {
  const saida = new Array(lista.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: quantas }, async () => {
    while (proximo < lista.length) { const i = proximo++; saida[i] = await tarefa(lista[i], i); }
  }));
  return saida;
}

const mediana = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const periodosDe = data => (data >= INICIO ? [LEGISLATURA, Number(data.slice(0, 4))] : []);

/**
 * Por pessoa e período: s = [presente, sessões], v = [votou, votações], g = [com o governo, comparáveis],
 * j = ausências justificadas e n = não compareceu (só no Senado, que publica o motivo).
 */
function novoPlacar() {
  const pessoas = new Map();
  const de = (id, periodo) => {
    let p = pessoas.get(id);
    if (!p) pessoas.set(id, p = new Map());
    let x = p.get(periodo);
    if (!x) p.set(periodo, x = { s: [0, 0], v: [0, 0], g: [0, 0], j: 0, n: 0 });
    return x;
  };
  return { pessoas, de };
}

/** Taxas por período, com a mediana da casa; só entra na mediana quem tem base para a taxa. */
function exportarPlacar(placar, ids, comSessoes, totais) {
  const periodos = [LEGISLATURA, ...ANOS];
  const pessoas = {};
  const casa = {};
  for (const periodo of periodos) {
    const taxas = { s: [], v: [], g: [] };
    for (const id of ids) {
      const x = placar.pessoas.get(id)?.get(periodo);
      if (!x) continue;
      const linha = { v: x.v, g: x.g };
      if (comSessoes) linha.s = x.s; else { linha.j = x.j; linha.n = x.n; }
      (pessoas[id] ??= {})[periodo] = linha;
      if (comSessoes && x.s[1] >= 10) taxas.s.push(x.s[0] / x.s[1]);
      if (x.v[1] >= 10) taxas.v.push(x.v[0] / x.v[1]);
      if (x.g[1] >= 10) taxas.g.push(x.g[0] / x.g[1]);
    }
    const arredondar = v => (v === null ? null : Math.round(v * 1000) / 1000);
    casa[periodo] = { ...totais[periodo], mediana: { s: arredondar(mediana(taxas.s)), v: arredondar(mediana(taxas.v)), g: arredondar(mediana(taxas.g)) } };
  }
  return { periodos, casa, pessoas };
}

// ── Câmara ────────────────────────────────────────────────────────────────
const idsDeputados = fotografia.deputados.map(p => p.id);
const exercicio = new Map();
let semHistorico = 0;
await emLotes(idsDeputados, 8, async id => {
  try {
    const { dados } = await baixar(`https://dadosabertos.camara.leg.br/api/v2/deputados/${id}/historico`, "json");
    const eventos = dados.filter(e => e.idLegislatura === 57 && e.situacao).sort((a, b) => a.dataHora.localeCompare(b.dataHora));
    const intervalos = [];
    for (const e of eventos) {
      const aberto = intervalos.at(-1) && intervalos.at(-1)[1] === null;
      if (e.situacao === "Exercício" && !aberto) intervalos.push([e.dataHora, null]);
      else if (e.situacao !== "Exercício" && aberto) intervalos.at(-1)[1] = e.dataHora;
    }
    exercicio.set(id, intervalos);
  } catch {
    semHistorico++;
  }
});
console.log(`Câmara: histórico de ${exercicio.size} deputados${semHistorico ? `, ${semHistorico} sem histórico (contam a legislatura inteira)` : ""}`);
const emExercicio = (id, dataHora) => {
  const intervalos = exercicio.get(id);
  if (!intervalos) return true;
  return intervalos.some(([a, b]) => dataHora >= a && (b === null || dataHora < b));
};

const camara = novoPlacar();
const totaisCamara = Object.fromEntries([LEGISLATURA, ...ANOS].map(p => [p, { sessoes: 0, votacoes: 0, governo: 0 }]));
const naFoto = new Set(idsDeputados);
/** As votações de mérito mais recentes, para a lista de votos. */
let meritoCamara = [];
for (const ano of ANOS) {
  const sessoes = new Map();
  await arquivoCamara("eventos", ano, c => {
    if (c("localCamara.nome") === "Plenário da Câmara dos Deputados" && c("descricaoTipo") === "Sessão Deliberativa" && c("situacao").startsWith("Encerrada") && c("dataHoraInicio") >= INICIO) {
      sessoes.set(c("id"), c("dataHoraInicio"));
    }
  });
  const presencas = new Map();
  await arquivoCamara("eventosPresencaDeputados", ano, c => {
    if (!sessoes.has(c("idEvento"))) return;
    const id = Number(c("idDeputado"));
    if (!naFoto.has(id)) return;
    (presencas.get(id) ?? presencas.set(id, new Set()).get(id)).add(c("idEvento"));
  });
  for (const [idEvento, data] of sessoes) {
    for (const periodo of periodosDe(data)) totaisCamara[periodo].sessoes++;
    for (const id of idsDeputados) {
      const presente = presencas.get(id)?.has(idEvento) ?? false;
      if (!presente && !emExercicio(id, data)) continue;
      for (const periodo of periodosDe(data)) { const x = camara.de(id, periodo); x.s[1]++; if (presente) x.s[0]++; }
    }
  }

  const votacoes = new Map();
  await arquivoCamara("votacoes", ano, c => {
    const total = Number(c("votosSim")) + Number(c("votosNao")) + Number(c("votosOutros"));
    if (c("siglaOrgao") !== "PLEN" || !(total > 0) || c("data") < INICIO) return;
    votacoes.set(c("id"), { data: c("dataHoraRegistro") || c("data"), descricao: c("descricao"), aprovada: c("aprovacao") === "1", sim: Number(c("votosSim")), nao: Number(c("votosNao")), governo: null });
  });
  await arquivoCamara("votacoesOrientacoes", ano, c => {
    const v = votacoes.get(c("idVotacao"));
    if (v && c("siglaBancada") === "Governo") v.governo = c("orientacao") === "Sim" ? "Sim" : c("orientacao") === "Não" ? "Não" : null;
  });
  const votos = new Map();
  const linhasVotos = await arquivoCamara("votacoesVotos", ano, c => {
    if (!votacoes.has(c("idVotacao"))) return;
    const id = Number(c("deputado_id"));
    if (!naFoto.has(id)) return;
    (votos.get(c("idVotacao")) ?? votos.set(c("idVotacao"), new Map()).get(c("idVotacao"))).set(id, c("voto"));
  });
  for (const [idVotacao, v] of votacoes) {
    const periodos = periodosDe(v.data.slice(0, 10));
    for (const periodo of periodos) { totaisCamara[periodo].votacoes++; if (v.governo) totaisCamara[periodo].governo++; }
    const desta = votos.get(idVotacao) ?? new Map();
    for (const id of idsDeputados) {
      const voto = desta.get(id);
      if (!voto && !emExercicio(id, v.data)) continue;
      for (const periodo of periodos) {
        const x = camara.de(id, periodo);
        x.v[1]++; if (voto) x.v[0]++;
        if (v.governo && (voto === "Sim" || voto === "Não")) { x.g[1]++; if (voto === v.governo) x.g[0]++; }
      }
    }
    // Mérito: o texto principal aprovado ou rejeitado, sem requerimentos e destaques.
    if (/^(Aprovad|Rejeitad)[ao]s? (?:o|a|os|as) (Proposta de Emenda|Projeto|Substitutivo|Medida Provisória|Redação Final|Parecer da Comissão Mista)/i.test(v.descricao) && !/Requerimento/i.test(v.descricao.slice(0, 80))) {
      meritoCamara.push({ id: idVotacao, ...v, votos: desta });
    }
  }
  console.log(`Câmara ${ano}: ${sessoes.size} sessões deliberativas, ${votacoes.size} votações nominais (${[...votacoes.values()].filter(v => v.governo).length} com orientação do governo), ${linhasVotos} linhas de voto lidas`);
}
meritoCamara = meritoCamara.sort((a, b) => b.data.localeCompare(a.data)).slice(0, ULTIMAS_VOTACOES);
// O que estava em votação, pela API: tipo, número e ementa da proposição.
await emLotes(meritoCamara, 6, async v => {
  try {
    const { dados } = await baixar(`https://dadosabertos.camara.leg.br/api/v2/votacoes/${v.id}`, "json");
    const p = dados.proposicoesAfetadas?.[0] ?? dados.objetosPossiveis?.[0];
    if (p) { v.titulo = `${p.siglaTipo} ${p.numero}/${p.ano}`; v.ementa = p.ementa ?? ""; }
  } catch { /* Sem a proposição, fica a descrição da votação. */ }
});

// ── Senado ────────────────────────────────────────────────────────────────
const idsSenadores = fotografia.senadores.map(p => p.id);
const naFotoSenado = new Set(idsSenadores);
const VOTOU = new Set(["Sim", "Não", "Abstenção", "Votou", "Presidente (art. 51 RISF)", "Obstrução", "P-OD"]);
const JUSTIFICADA = new Set(["AP", "MIS", "LS", "LP", "LAP", "LC", "LG", "LA", "REP"]);
const senado = novoPlacar();
const totaisSenado = Object.fromEntries([LEGISLATURA, ...ANOS].map(p => [p, { votacoes: 0, governo: 0 }]));
let meritoSenado = [];
const codigos = {};
/** O placar vem nulo nas votações mais novas; a lista de votos tem a contagem. */
const contarVoto = (v, sigla) => (v.votos ?? []).filter(x => x.siglaVotoParlamentar === sigla).length;
for (const ano of ANOS) {
  // `?ano=` filtra pelo ano da matéria (a PEC 18/2024, votada em 2025, fica de fora); o intervalo de datas pega o que foi votado no ano.
  const lista = await baixar(`https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=${ano}-01-01&dataFim=${ano}-12-31`, "json");
  const votacoes = (Array.isArray(lista) ? lista : Object.values(lista)[0] ?? []).filter(v => (v.casaSessao ?? "SF") === "SF" && v.dataSessao >= INICIO);
  let orientacoes = [];
  try {
    const r = await baixar(`https://legis.senado.leg.br/dadosabertos/plenario/votacao/orientacaoBancada/${ano}0101/${ano}1231`, "json");
    orientacoes = r.votacoes ?? [];
  } catch (e) { console.log(`Senado ${ano}: sem orientações (${e.message})`); }
  const governoPorSequencia = new Map();
  for (const o of orientacoes) {
    const g = o.orientacoesLideranca?.find(l => l.partido === "Governo")?.voto;
    if (g === "SIM" || g === "NÃO") governoPorSequencia.set(o.sequencialVotacao, g === "SIM" ? "Sim" : "Não");
  }
  let comGoverno = 0;
  for (const v of votacoes) {
    const secreta = v.votacaoSecreta === "S" || v.votacaoSecreta === true;
    const governo = secreta ? null : governoPorSequencia.get(v.sequencialVotacao) ?? null;
    if (governo) comGoverno++;
    const periodos = periodosDe(v.dataSessao);
    for (const periodo of periodos) { totaisSenado[periodo].votacoes++; if (governo) totaisSenado[periodo].governo++; }
    const desta = new Map();
    for (const voto of v.votos ?? []) {
      const id = Number(voto.codigoParlamentar), sigla = voto.siglaVotoParlamentar ?? "";
      codigos[sigla] = (codigos[sigla] ?? 0) + 1;
      if (!naFotoSenado.has(id)) continue;
      desta.set(id, sigla);
      // Votou, presente sem votar, ausência justificada ou falta; outros códigos ficam fora da conta.
      const votou = VOTOU.has(sigla), justificada = JUSTIFICADA.has(sigla), falta = sigla === "NCom", semVoto = sigla === "P-NRV";
      if (!votou && !justificada && !falta && !semVoto) continue;
      for (const periodo of periodos) {
        const x = senado.de(id, periodo);
        x.v[1]++; if (votou) x.v[0]++;
        if (justificada) x.j++;
        if (falta) x.n++;
        if (governo && (sigla === "Sim" || sigla === "Não")) { x.g[1]++; if (sigla === governo) x.g[0]++; }
      }
    }
    // Mérito: fora requerimentos, destaques e votações de um artigo só.
    const merito = !secreta && v.sigla !== "RQS" && !/requerimento|destaque|votação nominal d[oa]s? (art\.|§|inciso)/i.test(v.descricaoVotacao ?? "");
    if (merito) meritoSenado.push({ id: String(v.codigoSessaoVotacao ?? v.sequencialVotacao), data: v.dataSessao, titulo: v.identificacao ?? "", ementa: v.ementa ?? "", descricao: v.descricaoVotacao ?? "", aprovada: v.resultadoVotacao === "A", sim: Number(v.totalVotosSim) || contarVoto(v, "Sim"), nao: Number(v.totalVotosNao) || contarVoto(v, "Não"), governo, votos: desta });
  }
  console.log(`Senado ${ano}: ${votacoes.length} votações nominais (${votacoes.filter(v => v.votacaoSecreta === "S").length} secretas), ${orientacoes.length} com orientação publicada, ${comGoverno} ligadas ao voto do governo`);
}
meritoSenado = meritoSenado.sort((a, b) => b.data.localeCompare(a.data)).slice(0, ULTIMAS_VOTACOES);
console.log("Senado, códigos de voto:", Object.entries(codigos).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · "));

// ── Gravação ──────────────────────────────────────────────────────────────
/** Uma letra por votação, na ordem de `votacoes`: S, N, A(bstenção), O(bstrução), P(residente), V(otou), J(ustificada), F(alta), "-" sem voto, " " fora do cargo. */
function letra(voto, emCargo) {
  if (!voto) return emCargo ? "-" : " ";
  if (voto === "Sim") return "S";
  if (voto === "Não") return "N";
  if (voto === "Abstenção") return "A";
  if (voto === "Obstrução" || voto === "P-OD") return "O";
  if (/^Artigo 17|^Presidente/.test(voto)) return "P";
  if (voto === "Votou") return "V";
  if (JUSTIFICADA.has(voto)) return "J";
  if (voto === "NCom") return "F";
  return "-";
}
/** Corta no fim de uma palavra e marca o corte. */
const cortar = (texto, limite) => (texto.length <= limite ? texto : `${texto.slice(0, limite).replace(/[\s,;.:]+\S*$/, "")}…`);
await mkdir(SAIDA, { recursive: true });
const coletadoEm = new Date().toISOString();
const casas = [
  ["deputados", camara, idsDeputados, true, totaisCamara, meritoCamara, (id, v) => emExercicio(id, v.data), {
    dados: "https://dadosabertos.camara.leg.br/swagger/api.html#staticfile",
    explicacao: "https://www.camara.leg.br/deputados/quem-sao",
  }],
  ["senadores", senado, idsSenadores, false, totaisSenado, meritoSenado, (id, v) => v.votos.has(id), {
    dados: "https://legis.senado.leg.br/dadosabertos/docs/",
    explicacao: "https://www25.senado.leg.br/web/atividade/votacoes",
  }],
];
for (const [casa, placar, ids, comSessoes, totais, merito, emCargo, fontes] of casas) {
  const { periodos, casa: daCasa, pessoas } = exportarPlacar(placar, ids, comSessoes, totais);
  // Os votos de cada votação vão em `votos`, por pessoa; a lista leva só o que se lê.
  const votacoes = merito.map(v => ({ id: v.id, data: v.data, titulo: v.titulo, ementa: cortar(v.ementa ?? "", 320), descricao: cortar(v.descricao, 260), aprovada: v.aprovada, sim: v.sim, nao: v.nao, governo: v.governo }));
  const votos = Object.fromEntries(ids.map(id => [id, merito.map(v => letra(v.votos.get(id), emCargo(id, v))).join("")]));
  const json = JSON.stringify({ casa, coletadoEm, anos: ANOS, periodos, fontes, totais: daCasa, pessoas, votacoes, votos });
  await writeFile(join(SAIDA, `plenario-${casa}.json`), `${json}\n`);
  console.log(`plenario-${casa}.json ${(json.length / 1024).toFixed(0)} KB · ${Object.keys(pessoas).length} pessoas · ${votacoes.length} votações na lista`);
}
