// Gráficos de interface derivados da marca vetorial, sem fontes ou serviços externos.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const svg = await readFile(new URL('../public/icone.svg', import.meta.url));
for (const [nome, tamanho] of [['icone-32.png',32],['icone-192.png',192],['icone-512.png',512],['apple-touch-icon.png',180]]) {
  await writeFile(new URL('../public/'+nome,import.meta.url),await sharp(svg).resize(tamanho,tamanho).png().toBuffer());
}
// O ICO inclui 16, 32 e 48 px para abas e favoritos de navegadores antigos.
const tamanhos = [16,32,48], imagens = await Promise.all(tamanhos.map(n=>sharp(svg).resize(n,n).png().toBuffer()));
const cabecalho = Buffer.alloc(6+16*imagens.length);cabecalho.writeUInt16LE(1,2);cabecalho.writeUInt16LE(imagens.length,4);
let deslocamento = cabecalho.length;
imagens.forEach((imagem,i)=>{const p=6+i*16;cabecalho[p]=tamanhos[i];cabecalho[p+1]=tamanhos[i];cabecalho.writeUInt16LE(1,p+4);cabecalho.writeUInt16LE(32,p+6);cabecalho.writeUInt32LE(imagem.length,p+8);cabecalho.writeUInt32LE(deslocamento,p+12);deslocamento+=imagem.length;});
await writeFile(new URL('../src/app/favicon.ico',import.meta.url),Buffer.concat([cabecalho,...imagens]));
console.log('Ícones SVG, PNG, Apple e ICO gerados a partir da mesma marca.');
