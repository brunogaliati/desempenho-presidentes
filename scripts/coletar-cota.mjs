/**
 * Fotografia da cota parlamentar (CEAP na Câmara, CEAPS no Senado) desde 2008.
 *
 *     node scripts/coletar-cota.mjs
 *     node scripts/coletar-cota.mjs --cache  # reutiliza os arquivos oficiais já baixados
 *
 * Grava em `public/painel/congresso/` um índice por casa (`cota-deputados.json`) e um arquivo
 * por ano (`cota-deputados-2026.json`), lidos
 * pela aba Congresso só quando alguém abre a seção. Como `coletar-prototipo.mjs`, não
 * toca no banco: a carga definitiva é trabalho do backend.
 *
 * - Câmara: arquivo anual oficial (Ano-AAAA.csv.zip, UTF-8, separado por ";"),
 *   ligado ao deputado por `ideCadastro`, o mesmo id da API e da fotografia.
 * - Senado: API de dados abertos (despesas_ceaps/AAAA), ligada por `codSenador`.
 *
 * Só entra quem está na fotografia atual. CPF não entra: fornecedor pessoa física
 * vira "Pessoa física", sem nome. Valores negativos (estornos de passagem) somam
 * como vieram, para o total bater com o da fonte.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "public", "painel", "congresso");
const fotografia = JSON.parse(await readFile(join(RAIZ, "src", "app", "_painel", "_dados", "fotografia.json"), "utf8"));
const ANOS = Array.from({ length: new Date().getFullYear() - 2008 + 1 }, (_, i) => 2008 + i);
const INICIO_LEGISLATURA = 2023 + 4 * Math.floor((new Date().getFullYear() - 2023) / 4);
const HISTORICO = "historico";
const CACHE = join(RAIZ, ".cache", "cota");
await mkdir(CACHE, { recursive: true });
const AGENTE = { "user-agent": "desempenho-do-governo/coleta (dados abertos)" };
const TOP_FORNECEDORES = 6;
/** Soma de fevereiro de 2023 a janeiro de 2027, em 48 meses. */
const LEGISLATURA = "legislatura";
const MESES_LEGISLATURA = 48;
/** Quem mais recebeu da casa inteira no ano, sem as pessoas físicas. */
const TOP_FORNECEDORES_CASA = 30;

async function baixar(url, tipo = "buffer", tentativas = 3) {
  const caminho = join(CACHE, createHash("sha256").update(url).digest("hex"));
  if (process.argv.includes("--cache")) {
    try { const salvo = await readFile(caminho); return tipo === "json" ? JSON.parse(salvo) : salvo; }
    catch (erro) { if (erro.code !== "ENOENT") throw erro; }
  }
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: AGENTE, signal: AbortSignal.timeout(180_000) });
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      const dados = Buffer.from(await r.arrayBuffer());
      if (tipo === "json") JSON.parse(dados);
      await writeFile(caminho, dados);
      return tipo === "json" ? JSON.parse(dados) : dados;
    } catch (erro) {
      if (i >= tentativas) throw erro;
      await new Promise(ok => setTimeout(ok, 2000 * i));
    }
  }
}

/** ZIP com um arquivo só: lê o diretório central e descomprime o primeiro item. */
function abrirZip(buf) {
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error("ZIP sem diretório central");
  const central = buf.readUInt32LE(fim + 16);
  if (buf.readUInt32LE(central) !== 0x02014b50) throw new Error("ZIP com diretório inválido");
  const metodo = buf.readUInt16LE(central + 10);
  const tamanho = buf.readUInt32LE(central + 20);
  const local = buf.readUInt32LE(central + 42);
  const inicio = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
  const dados = buf.subarray(inicio, inicio + tamanho);
  if (metodo === 0) return dados;
  if (metodo === 8) return inflateRawSync(dados);
  throw new Error(`ZIP com compressão ${metodo}`);
}

/** O arquivo da Câmara vem em UTF-8; se um dia voltar a latin-1, o decodificador estrito acusa e cai no outro. */
function decodificar(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

/** CSV com aspas e ";" (o da Câmara). */
function* linhasCsv(texto) {
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") { linha.push(campo); campo = ""; }
    else if (c === "\n") { linha.push(campo.replace(/\r$/, "")); yield linha; linha = []; campo = ""; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); yield linha; }
}

const semAcento = t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const CATEGORIAS = [
  ["manutencao de escritorio", "Escritório de apoio"],
  ["aluguel de imoveis para escritorio", "Escritório (aluguel e contas)"],
  ["aquisicao de material de consumo", "Material de escritório"],
  ["combustiveis", "Combustível"],
  ["consultorias", "Consultorias e pesquisas"],
  ["contratacao de consultorias", "Consultorias e assessorias"],
  ["divulgacao da atividade", "Divulgação do mandato"],
  ["passagem aerea", "Passagens aéreas"],
  ["passagens aereas", "Passagens"],
  ["passagens terrestres", "Passagens terrestres e fluviais"],
  ["locacao ou fretamento de veiculos", "Aluguel de veículos"],
  ["locacao ou fretamento de aeronaves", "Fretamento de aeronaves"],
  ["locacao ou fretamento de embarcacoes", "Fretamento de embarcações"],
  ["locomocao, hospedagem", "Locomoção, hospedagem e alimentação"],
  ["servico de seguranca", "Segurança"],
  ["servicos de seguranca", "Segurança"],
  ["telefonia", "Telefonia"],
  ["servicos postais", "Correios"],
  ["hospedagem", "Hospedagem"],
  ["servico de taxi", "Táxi, pedágio e estacionamento"],
  ["fornecimento de alimentacao", "Alimentação"],
  ["assinatura de publicacoes", "Assinaturas"],
  ["participacao em curso", "Cursos e eventos"],
  ["complementacao do auxilio-moradia", "Auxílio-moradia"],
  ["aquisicao de tokens", "Certificados digitais"],
];
function rotuloCategoria(bruto) {
  if (!bruto?.trim()) return "Sem categoria na nota";
  const t = semAcento(bruto);
  const achada = CATEGORIAS.find(([chave]) => t.startsWith(chave));
  if (achada) return achada[1];
  const curto = bruto.split(/[,.(]/)[0].trim().toLocaleLowerCase("pt-BR");
  return curto.charAt(0).toLocaleUpperCase("pt-BR") + curto.slice(1);
}
const digitos = t => (t ?? "").replace(/\D/g, "");
const nomeFornecedor = (nome, documento) => digitos(documento).length === 11 ? "Pessoa física" : (nome ?? "").replace(/\s+/g, " ").trim() || "Sem nome na nota";
const chaveFornecedor = (nome, documento) => { const d = digitos(documento); return d.length === 11 ? "pf" : d.length >= 8 ? d.slice(0, 8) : semAcento(nome ?? ""); };

/** Acumula por pessoa e ano. */
function novoAcumulador(ids) {
  const pessoas = new Map(ids.map(id => [id, new Map()]));
  return {
    somar(id, ano, mes, categoria, fornecedor, chave, valor) {
      const porAno = pessoas.get(id);
      if (!porAno || !Number.isFinite(valor)) return;
      const acumular = (periodo, meses, indice) => {
        let a = porAno.get(periodo);
        if (!a) porAno.set(periodo, a = { t: 0, n: 0, m: Array(meses).fill(0), c: new Map(), f: new Map() });
        a.t += valor; a.n++;
        if (indice >= 0 && indice < meses) a.m[indice] += valor;
        a.c.set(categoria, (a.c.get(categoria) ?? 0) + valor);
        const f = a.f.get(chave) ?? { nomes: new Map(), v: 0, n: 0 };
        f.v += valor; f.n++; f.nomes.set(fornecedor, (f.nomes.get(fornecedor) ?? 0) + 1);
        a.f.set(chave, f);
      };
      acumular(ano, 12, mes - 1);
      acumular(HISTORICO, ANOS.length * 12, (ano - ANOS[0]) * 12 + mes - 1);
      // A 57ª legislatura começou em 1º de fevereiro de 2023: janeiro de 2023 ainda é a anterior.
      if (mes >= 1 && mes <= 12 && ano >= INICIO_LEGISLATURA && ano <= INICIO_LEGISLATURA + 4
        && (ano > INICIO_LEGISLATURA || mes >= 2) && (ano < INICIO_LEGISLATURA + 4 || mes === 1)) acumular(LEGISLATURA, MESES_LEGISLATURA, (ano - INICIO_LEGISLATURA) * 12 + mes - 2);
    },
    pessoas,
  };
}

const reais = v => Math.round(v);
const mediana = v => { if (!v.length) return 0; const o = [...v].sort((a, b) => a - b), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };

/**
 * Um índice pequeno (total de cada pessoa em cada ano, para a lista e o ano a ano) e um arquivo
 * por ano com o detalhe: meses, categorias e os maiores fornecedores. A página baixa só o ano aberto.
 */
function exportar(casa, acumulador, ultimoMes, fontes) {
  const coletadoEm = new Date().toISOString();
  const totais = {};
  const media = {};
  const porAno = {};
  for (const ano of [...ANOS, LEGISLATURA, HISTORICO]) {
    const categorias = [];
    const indiceCategoria = c => { let i = categorias.indexOf(c); if (i < 0) { i = categorias.length; categorias.push(c); } return i; };
    const pessoas = {};
    const valores = [];
    const meses = Array(ano === HISTORICO ? ANOS.length * 12 : ano === LEGISLATURA ? MESES_LEGISLATURA : 12).fill(0);
    const daCasa = new Map();
    for (const [id, anos] of acumulador.pessoas) {
      const a = anos.get(ano);
      if (!a) continue;
      valores.push(a.t);
      a.m.forEach((v, i) => { meses[i] += v; });
      for (const [chave, f] of a.f) {
        if (chave === "pf") continue;
        const c = daCasa.get(chave) ?? { nomes: new Map(), v: 0, n: 0, pessoas: 0 };
        c.v += f.v; c.n += f.n; c.pessoas++;
        for (const [nome, vezes] of f.nomes) c.nomes.set(nome, (c.nomes.get(nome) ?? 0) + vezes);
        daCasa.set(chave, c);
      }
      pessoas[id] = {
        t: reais(a.t),
        n: a.n,
        m: a.m.map(reais),
        c: [...a.c].filter(([, v]) => Math.abs(v) >= 1).sort((x, y) => y[1] - x[1]).map(([c, v]) => [indiceCategoria(c), reais(v)]),
        f: [...a.f.values()].sort((x, y) => y.v - x.v).slice(0, TOP_FORNECEDORES)
          .map(f => [[...f.nomes].sort((x, y) => y[1] - x[1])[0][0], reais(f.v), f.n]),
      };
    }
    const total = valores.reduce((s, x) => s + x, 0);
    media[ano] = { pessoas: valores.length, total: reais(total), media: valores.length ? reais(total / valores.length) : 0, mediana: reais(mediana(valores)) };
    // [nome, valor, notas, quantos parlamentares pagaram]
    const fornecedores = [...daCasa.values()].sort((x, y) => y.v - x.v).slice(0, TOP_FORNECEDORES_CASA)
      .map(c => [[...c.nomes].sort((x, y) => y[1] - x[1])[0][0], reais(c.v), c.n, c.pessoas]);
    porAno[ano] = { casa, ano, ...(ano === LEGISLATURA ? { inicio: `${INICIO_LEGISLATURA}-02` } : ano === HISTORICO ? { inicio: `${ANOS[0]}-01` } : {}), coletadoEm, ultimoMes: ultimoMes[ano] ?? ultimoMes[ANOS.at(-1)] ?? 0, categorias, mediaMes: meses.map(v => valores.length ? reais(v / valores.length) : 0), fornecedores, pessoas };
  }
  for (const [id, anos] of acumulador.pessoas) if (anos.size) totais[id] = ANOS.map(ano => anos.has(ano) ? reais(anos.get(ano).t) : null);
  return { indice: { casa, coletadoEm, anos: ANOS, ultimoMes, fontes, media, totais }, porAno };
}

// ── Câmara ────────────────────────────────────────────────────────────────
const deputados = novoAcumulador(fotografia.deputados.map(p => p.id));
const ultimoMesCamara = {};
for (const ano of ANOS) {
  const zip = await baixar(`https://www.camara.leg.br/cotas/Ano-${ano}.csv.zip`);
  const texto = decodificar(abrirZip(zip));
  let cabecalho = null;
  let linhas = 0;
  for (const linha of linhasCsv(texto)) {
    if (!cabecalho) { cabecalho = Object.fromEntries(linha.map((c, i) => [c.replace(/^﻿/, ""), i])); continue; }
    if (linha.length < 10) continue;
    const id = Number(linha[cabecalho.ideCadastro]);
    if (!id) continue;
    const mes = Number(linha[cabecalho.numMes]);
    const valor = Number(String(linha[cabecalho.vlrLiquido]).replace(",", "."));
    const documento = linha[cabecalho.txtCNPJCPF];
    const nome = linha[cabecalho.txtFornecedor];
    deputados.somar(id, ano, mes, rotuloCategoria(linha[cabecalho.txtDescricao] ?? ""), nomeFornecedor(nome, documento), chaveFornecedor(nome, documento), valor);
    ultimoMesCamara[ano] = Math.max(ultimoMesCamara[ano] ?? 0, mes || 0);
    linhas++;
  }
  console.log(`Câmara ${ano}: ${linhas} notas`);
}

// ── Senado ────────────────────────────────────────────────────────────────
const senadores = novoAcumulador(fotografia.senadores.map(p => p.id));
const ultimoMesSenado = {};
for (const ano of ANOS) {
  const lista = await baixar(`https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/${ano}`, "json");
  if (!Array.isArray(lista)) throw new Error(`Senado ${ano}: resposta sem lista`);
  for (const r of lista) {
    const valor = Number(r.valorReembolsado);
    senadores.somar(Number(r.codSenador), ano, Number(r.mes), rotuloCategoria(r.tipoDespesa ?? ""), nomeFornecedor(r.fornecedor, r.cpfCnpj), chaveFornecedor(r.fornecedor, r.cpfCnpj), valor);
    ultimoMesSenado[ano] = Math.max(ultimoMesSenado[ano] ?? 0, Number(r.mes) || 0);
  }
  console.log(`Senado ${ano}: ${lista.length} notas`);
}

await mkdir(SAIDA, { recursive: true });
const casasColetadas = [
  ["deputados", deputados, ultimoMesCamara, { dados: "https://www.camara.leg.br/cotas/", explicacao: "https://www2.camara.leg.br/transparencia/acesso-a-informacao/copy_of_perguntas-frequentes/cota-para-o-exercicio-da-atividade-parlamentar" }],
  ["senadores", senadores, ultimoMesSenado, { dados: "https://www12.senado.leg.br/transparencia/dados-abertos-transparencia/dados-abertos-ceaps", explicacao: "https://www12.senado.leg.br/transparencia/sen/" }],
];
for (const [casa, acumulador, ultimoMes, fontes] of casasColetadas) {
  const { indice, porAno } = exportar(casa, acumulador, ultimoMes, fontes);
  const gravar = async (nome, dados) => {
    const json = JSON.stringify(dados);
    await writeFile(join(SAIDA, nome), `${json}\n`);
    return `${nome} ${(json.length / 1024).toFixed(0)} KB`;
  };
  const linhas = [await gravar(`cota-${casa}.json`, indice)];
  for (const ano of [...ANOS, LEGISLATURA, HISTORICO]) linhas.push(await gravar(`cota-${casa}-${ano}.json`, porAno[ano]));
  console.log(`${casa}: ${Object.keys(indice.totais).length} pessoas · ${linhas.join(" · ")}`);
}
