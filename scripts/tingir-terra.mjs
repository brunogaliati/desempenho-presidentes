/**
 * Os tons da terra do mapa da economia, já aplicados na imagem.
 *
 *     node scripts/tingir-terra.mjs
 *
 * Lê `public/prototipo/terra.webp` (de `gerar-mundo.mjs`) e grava
 * `terra-claro.webp` e `terra-escuro.webp`, cada uma com a cadeia de filtros
 * do CSS já calculada pixel a pixel. Com o filtro no CSS, o navegador refazia
 * a conta a cada quadro do zoom, em software e sobre a imagem inteira, que no
 * zoom passa de 10 mil pixels de largura: era o que travava a animação.
 *
 * As contas são as das funções de filtro do CSS (Filter Effects, em sRGB, com
 * corte em 0 e 1 a cada passo), na mesma ordem em que estavam escritas.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = join(RAIZ, "public", "prototipo");

const TONS = {
  claro: { passos: [["saturate", 0.55], ["brightness", 1.55], ["contrast", 0.6], ["sepia", 0.15]], opacidade: 0.9 },
  escuro: { passos: [["saturate", 0.6], ["brightness", 1.15], ["contrast", 0.8], ["sepia", 0.12]], opacidade: 0.85 },
};

const cortar = (v) => Math.min(1, Math.max(0, v));

function matriz(nome, s) {
  if (nome === "saturate") {
    return [
      [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
      [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
    ];
  }
  const p = 1 - s;
  return [
    [0.393 + 0.607 * p, 0.769 - 0.769 * p, 0.189 - 0.189 * p],
    [0.349 - 0.349 * p, 0.686 + 0.314 * p, 0.168 - 0.168 * p],
    [0.272 - 0.272 * p, 0.534 - 0.534 * p, 0.131 + 0.869 * p],
  ];
}

function aplicar([r, g, b], [nome, v]) {
  if (nome === "brightness") return [r * v, g * v, b * v].map(cortar);
  if (nome === "contrast") return [r, g, b].map((c) => cortar((c - 0.5) * v + 0.5));
  const m = matriz(nome, v);
  return m.map(([a, b2, c]) => cortar(a * r + b2 * g + c * b));
}

const { data, info } = await sharp(join(PASTA, "terra.webp")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (const [tom, { passos, opacidade }] of Object.entries(TONS)) {
  const saida = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 4) {
    let cor = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    for (const passo of passos) cor = aplicar(cor, passo);
    saida[i] = Math.round(cor[0] * 255);
    saida[i + 1] = Math.round(cor[1] * 255);
    saida[i + 2] = Math.round(cor[2] * 255);
    saida[i + 3] = Math.round(data[i + 3] * opacidade);
  }
  const arquivo = join(PASTA, `terra-${tom}.webp`);
  await sharp(saida, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 78, alphaQuality: 70 })
    .toFile(arquivo);
  console.log(`${tom}: ${arquivo}`);
}
