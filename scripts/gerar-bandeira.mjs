// Primeiro: blender -b --factory-startup --python scripts/gerar-bandeira-3d.py
// Depois: node scripts/gerar-bandeira.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const largura = 256, altura = 200, quantidadeQuadros = 48;
const imagens = await Promise.all(Array.from({ length:quantidadeQuadros }, (_, i) =>
  readFile(new URL('../.cache/marca/tecido-3d/quadro-'+String(i).padStart(2, '0')+'.png', import.meta.url))));
const quadros = await Promise.all(imagens.map(async input => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  assert.equal(info.width, largura);
  assert.equal(info.height, altura);
  let area = 0;
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    const alpha = data[(y * largura + x) * 4 + 3];
    if (alpha > 128) area++;
    if (x === 0 || y === 0 || x === largura - 1 || y === altura - 1) assert(alpha === 0, 'Tecido inteiro, sem cortes');
  }
  assert(area > 16000, 'Desenho visível no tamanho da logo');
  return data;
}));
assert.equal(new Set(quadros.map(pixels => pixels.toString('base64'))).size, quantidadeQuadros, 'Poses renderizadas distintas');
await sharp({ create:{ width:largura * quantidadeQuadros, height:altura, channels:4, background:'#00000000' } })
  .composite(imagens.map((input, i) => ({ input, left:i * largura, top:0 })))
  .webp({ quality:92, alphaQuality:100 }).toFile(fileURLToPath(new URL('../public/marca/bandeira-vento.webp', import.meta.url)));
await writeFile(new URL('../.cache/marca/quadros.rgba', import.meta.url), Buffer.concat(quadros));
console.log('PASSOU: 48 poses renderizadas de tecido em 3D, com transparência, desenho visível e sem cortes.');
