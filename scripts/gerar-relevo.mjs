/**
 * Relevo real para o estudo de atlas em /prototipo-2.
 *
 *     node scripts/gerar-relevo.mjs [caminho/GRAY_LR_SR.tif]
 *
 * Gray Earth, Natural Earth, domínio público:
 * https://www.naturalearthdata.com/downloads/10m-raster-data/10m-gray-earth/
 * Sem argumento, baixa o TIFF oficial para o cache temporário do sistema.
 * O recorte e os limites são os mesmos de gerar-mundo.mjs; mundo.json continua
 * sendo a fonte das coordenadas do SVG. A água é recortada com os próprios
 * vetores dos países e das 27 UFs, sem inferir litoral pela cor do raster.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "https://naturalearth.s3.amazonaws.com/10m_raster/GRAY_LR_SR.zip";
const CAIXA = { lonMin: -130, lonMax: 30, latMin: -60, latMax: 30 };
const LARGURA = 1800;
const ALTURA = Math.round(LARGURA * (CAIXA.latMax - CAIXA.latMin) / (CAIXA.lonMax - CAIXA.lonMin));
let fonte = process.argv[2] && resolve(process.argv[2]);

if (!fonte) {
  const cache = join(tmpdir(), "desempenho-gray-earth");
  await mkdir(cache, { recursive: true });
  fonte = join(cache, "GRAY_LR_SR.tif");
  try {
    await access(fonte);
  } catch {
    const resposta = await fetch(URL);
    if (!resposta.ok) throw new Error(`Gray Earth respondeu ${resposta.status}`);
    const zip = join(cache, "GRAY_LR_SR.zip");
    await writeFile(zip, Buffer.from(await resposta.arrayBuffer()));
    if (process.platform === "win32") {
      const citar = (s) => `'${s.replaceAll("'", "''")}'`;
      execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Expand-Archive -LiteralPath ${citar(zip)} -DestinationPath ${citar(cache)} -Force`], { windowsHide: true });
    } else {
      execFileSync("unzip", ["-oq", zip, "-d", cache]);
    }
  }
}

const [mundo, brasil] = await Promise.all([
  readFile(join(RAIZ, "src/app/_painel/_dados/mundo.json"), "utf8").then(JSON.parse),
  readFile(join(RAIZ, "src/app/_painel/_dados/ufs.json"), "utf8").then(JSON.parse),
]);
assert.equal(brasil.ufs.length, 27);
const meta = await sharp(fonte).metadata();
assert.equal(meta.width, meta.height * 2, "O raster deve cobrir o globo em projeção equiretangular");
const pixel = meta.width / 360;
const img = mundo.imagem;
const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}" viewBox="${img.x} ${img.y} ${img.largura} ${img.altura}" preserveAspectRatio="none"><g fill="white" fill-rule="evenodd" stroke="white" stroke-width="1" stroke-linejoin="round">${[...mundo.paises, ...brasil.ufs].map(({ d }) => `<path d="${d}"/>`).join("")}</g></svg>`);
const saida = join(RAIZ, "public/painel/relevo.webp");
await sharp(fonte)
  .extract({
    left: Math.round((CAIXA.lonMin + 180) * pixel),
    top: Math.round((90 - CAIXA.latMax) * pixel),
    width: Math.round((CAIXA.lonMax - CAIXA.lonMin) * pixel),
    height: Math.round((CAIXA.latMax - CAIXA.latMin) * pixel),
  })
  .resize(LARGURA, ALTURA)
  .greyscale()
  .ensureAlpha()
  .composite([{ input: mascara, blend: "dest-in" }])
  .webp({ quality: 84, alphaQuality: 90 })
  .toFile(saida);

const { data, info } = await sharp(saida).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const alfa = (lon, lat) => {
  const x = Math.round((lon - CAIXA.lonMin) / (CAIXA.lonMax - CAIXA.lonMin) * (info.width - 1));
  const y = Math.round((CAIXA.latMax - lat) / (CAIXA.latMax - CAIXA.latMin) * (info.height - 1));
  return data[(y * info.width + x) * info.channels + info.channels - 1];
};
assert.equal(alfa(-52, -10), 255, "Brasil precisa estar opaco");
assert.equal(alfa(-70, -20), 255, "Andes precisam estar opacos");
assert.equal(alfa(-100, -20), 0, "Pacífico precisa estar transparente");
assert.equal(alfa(-30, -20), 0, "Atlântico precisa estar transparente");
await writeFile(join(RAIZ, "public/painel/relevo-fonte.json"), JSON.stringify({
  nome: "Gray Earth with Shaded Relief and Hypsography",
  versao: await readFile(fonte.replace(/\.tif$/i, ".VERSION.txt"), "utf8").then((v) => v.trim()).catch(() => null),
  fonte: URL,
  pagina: "https://www.naturalearthdata.com/downloads/10m-raster-data/10m-gray-earth/",
  licenca: "Dominio publico",
  caixa: CAIXA,
  imagem: { href: "/painel/relevo.webp", larguraPixels: LARGURA, alturaPixels: ALTURA, x: img.x, y: img.y, largura: img.largura, altura: img.altura },
}, null, 2) + "\n");
console.log(`PASSOU: relevo ${info.width}x${info.height}, quatro pontos geográficos conferidos. ${saida}`);
