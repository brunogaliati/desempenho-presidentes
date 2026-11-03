/**
 * Focos de queimada do INPE, satélite de referência, por UF e por município.
 *
 *     node scripts/coletar-queimadas.mjs
 *
 * Grava `src/app/prototipo/_dados/queimadas.json` (UF por mês, bioma, Brasil) e
 * `public/prototipo/queimadas-municipios.json` (município por ano, carregado só
 * quando o leitor abre a aba de queimadas). Usa os arquivos anuais do
 * satélite de referência (2022 a 2025): é a série que o INPE usa para comparar
 * anos. Os arquivos mensais trazem todos os satélites, contam o mesmo fogo
 * várias vezes e chegam a 400 MB por mês, então não servem para isso. 2026
 * ainda não tem arquivo anual.
 *
 * O arquivo anual identifica estado e município só pelo nome, em maiúsculas. O
 * casamento com o código do IBGE é por nome normalizado (sem acento, sem
 * pontuação) dentro da UF; o que não casar fica contado em
 * `naoIdentificados`, nunca descartado em silêncio.
 *
 * Precisa do `unzip` no PATH (vem com o Git Bash).
 */

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const SAIDA = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "prototipo",
  "_dados",
  "queimadas.json",
);
const BASE =
  "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/Brasil_sat_ref";
const ANOS = [2022, 2023, 2024, 2025];
const PASTA = join(tmpdir(), "inpe-focos-ref");
const SAIDA_PUBLICA = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "prototipo",
  "queimadas-municipios.json",
);

const normalizar = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

// --- Cadastro do IBGE, para casar nomes com códigos ----------------------------

const municipiosIBGE = await (
  await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios")
).json();
const estadosIBGE = await (
  await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados")
).json();

const ufPorNome = new Map(estadosIBGE.map((e) => [normalizar(e.nome), String(e.id)]));
const municipioPorNome = new Map();
for (const m of municipiosIBGE) {
  const uf = String(m.id).slice(0, 2);
  municipioPorNome.set(`${uf}|${normalizar(m.nome)}`, String(m.id));
}

// Nomes antigos que o INPE ainda usa. Conferidos contra o cadastro do IBGE em
// 26/10/2026; eram 99% dos focos sem município.
const APELIDOS = {
  "51|SANTOANTONIODOLEVERGER": "5107800", // Santo Antônio de Leverger
  "14|SAOLUIZ": "1400605", // São Luiz do Anauá
  "17|FORTALEZADOTABOCAO": "1708254", // Tabocão
  "24|ACU": "2400208", // Assú
};
for (const [chave, codigo] of Object.entries(APELIDOS)) municipioPorNome.set(chave, codigo);

// --- Download e contagem ---------------------------------------------------------

await mkdir(PASTA, { recursive: true });

const meses = ANOS.flatMap((a) =>
  Array.from({ length: 12 }, (_, i) => `${a}-${String(i + 1).padStart(2, "0")}`),
);
const indiceMes = new Map(meses.map((m, i) => [m, i]));

const ufMensal = {};
const municipioAnual = {};
const biomaAnual = {};
const brasilAnual = ANOS.map(() => 0);
const naoIdentificados = {};

for (const [ia, ano] of ANOS.entries()) {
  const arquivo = join(PASTA, `focos_br_ref_${ano}.zip`);
  const url = `${BASE}/focos_br_ref_${ano}.zip`;
  const cabeca = await fetch(url, { method: "HEAD" });
  const tamanho = Number(cabeca.headers.get("content-length"));
  if (!existsSync(arquivo) || statSync(arquivo).size !== tamanho) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} respondeu ${r.status}`);
    await pipeline(Readable.fromWeb(r.body), createWriteStream(arquivo));
  }

  const unzip = spawn("unzip", ["-p", arquivo]);
  const linhas = createInterface({ input: unzip.stdout, crlfDelay: Infinity });
  let colunas = null;
  const semUf = { focos: 0 };
  const semMunicipio = { focos: 0, nomes: new Map() };

  for await (const linha of linhas) {
    if (!colunas) {
      colunas = Object.fromEntries(linha.split(",").map((c, i) => [c.trim(), i]));
      for (const c of ["data_pas", "estado", "municipio", "bioma"]) {
        if (!(c in colunas)) throw new Error(`${ano}: coluna ${c} ausente`);
      }
      continue;
    }
    const v = linha.split(",");
    const mes = v[colunas.data_pas].slice(0, 7);
    const im = indiceMes.get(mes);
    if (im === undefined) continue;

    brasilAnual[ia]++;
    const bioma = v[colunas.bioma]?.trim() || "Sem bioma";
    (biomaAnual[bioma] ??= ANOS.map(() => 0))[ia]++;

    const uf = ufPorNome.get(normalizar(v[colunas.estado] ?? ""));
    if (!uf) {
      semUf.focos++;
      continue;
    }
    (ufMensal[uf] ??= meses.map(() => 0))[im]++;

    const nome = normalizar(v[colunas.municipio] ?? "");
    const mun = municipioPorNome.get(`${uf}|${nome}`);
    if (!mun) {
      semMunicipio.focos++;
      const chave = `${uf}|${v[colunas.municipio]}`;
      semMunicipio.nomes.set(chave, (semMunicipio.nomes.get(chave) ?? 0) + 1);
      continue;
    }
    (municipioAnual[mun] ??= ANOS.map(() => 0))[ia]++;
  }

  const principais = [...semMunicipio.nomes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  naoIdentificados[ano] = {
    semEstado: semUf.focos,
    semMunicipio: semMunicipio.focos,
    principais: Object.fromEntries(principais),
  };
  console.log(
    `${ano}: ${brasilAnual[ia]} focos, sem UF ${semUf.focos}, sem município ${semMunicipio.focos}`,
    principais.slice(0, 4),
  );
}

await writeFile(
  SAIDA,
  JSON.stringify({
    fonte: `${BASE}/`,
    satelite: "satélite de referência do INPE",
    coletadoEm: new Date().toISOString(),
    anos: ANOS,
    meses,
    brasilAnual,
    biomaAnual,
    ufMensal,
    municipioAnual,
    naoIdentificados,
  }) + "\n",
);
await writeFile(SAIDA_PUBLICA, JSON.stringify({ anos: ANOS, municipioAnual }) + "\n");
console.log(`${Object.keys(municipioAnual).length} municípios com foco`);
