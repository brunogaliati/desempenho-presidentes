// Miniaturas dos prefeitos eleitos para o resumo municipal do painel.
//
// Uso: node scripts/gerar-fotos-prefeitos.mjs
//
// Os originais vêm da coleta do backend (python -m desempenho.prefeitos_fotos), que os
// guarda em ../backend/dados/observatorio/prefeitos_fotos_tse e no R2; a lista e os
// SHA-256 vêm de mart.prefeito_foto no Neon. Cada original é conferido pelo SHA antes
// de virar webp. Saídas: public/painel/prefeitos/<ano>/<candidato>.webp e
// src/lib/fotosPrefeitos.json (os candidatos com foto, por ano da eleição).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");
const sql = neon(process.env.DATABASE_URL);
const ORIGINAIS = path.resolve("../backend/dados/observatorio/prefeitos_fotos_tse");
const SAIDA = path.resolve("public/painel/prefeitos");
const LISTA = path.resolve("src/lib/fotosPrefeitos.json");

const fotos = await sql`select distinct on (ano_eleicao, candidato_id) ano_eleicao, candidato_id, sha256, foto_r2_uri
  from mart.prefeito_foto order by ano_eleicao, candidato_id, coletado_em desc`;
if (!fotos.length) throw new Error("mart.prefeito_foto está vazia: rode a coleta do backend antes.");

const lista = {};
let geradas = 0, iguais = 0;
const faltam = [];
for (const f of fotos) {
  if (!/^\d+$/.test(f.candidato_id) || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error(`Registro inválido: ${JSON.stringify(f)}`);
  const ext = path.extname(f.foto_r2_uri);
  const original = path.join(ORIGINAIS, f.sha256 + ext);
  if (!fs.existsSync(original)) { faltam.push(f.candidato_id); continue; }
  const bytes = fs.readFileSync(original);
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== f.sha256) throw new Error(`Original diverge do SHA-256: ${original}`);
  const destino = path.join(SAIDA, String(f.ano_eleicao), `${f.candidato_id}.webp`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  // 160 px de largura: o retrato maior do painel tem 84 px, em tela de densidade 2.
  const webp = await sharp(bytes).resize({ width: 160, withoutEnlargement: true }).webp({ quality: 70, effort: 6 }).toBuffer();
  if (fs.existsSync(destino) && Buffer.compare(fs.readFileSync(destino), webp) === 0) iguais++;
  else { fs.writeFileSync(destino, webp); geradas++; }
  (lista[f.ano_eleicao] ??= []).push(f.candidato_id);
}

// Miniatura sem registro no Neon sai: a lista e os arquivos andam juntos.
let removidas = 0;
for (const ano of fs.existsSync(SAIDA) ? fs.readdirSync(SAIDA) : []) {
  const validos = new Set(lista[ano] ?? []);
  for (const arquivo of fs.readdirSync(path.join(SAIDA, ano))) {
    if (!validos.has(path.basename(arquivo, ".webp"))) { fs.rmSync(path.join(SAIDA, ano, arquivo)); removidas++; }
  }
}
for (const ano of Object.keys(lista)) lista[ano].sort();
fs.writeFileSync(LISTA, JSON.stringify(lista) + "\n");
const total = Object.values(lista).reduce((s, l) => s + l.length, 0);
console.log(JSON.stringify({ total, geradas, iguais, removidas, sem_original_local: faltam.length }));
if (faltam.length) console.log("Sem original local (rode a coleta nesta máquina):", faltam.slice(0, 10).join(", "));
