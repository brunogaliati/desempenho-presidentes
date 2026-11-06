import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Assets no Worker; arquivo local no build e no servidor Next tradicional. */
async function arquivoPublico(caminho: string) {
  let assets: CloudflareEnv["ASSETS"];
  try { assets = getCloudflareContext().env.ASSETS; } catch { /* Fora do Worker. */ }
  if (assets) {
    const resposta = await assets.fetch(`https://assets.local/${caminho}`);
    if (!resposta.ok) throw new Error(`Arquivo de compartilhamento indisponível: ${caminho}`);
    return resposta.arrayBuffer();
  }
  return readFile(join(process.cwd(), "public", caminho));
}

export async function jsonCompartilhamento(caminho: 'painel/municipios-brasil.json' | 'painel/areas-protegidas.json') {
  return JSON.parse(Buffer.from(await arquivoPublico(caminho) as ArrayBuffer).toString('utf8'));
}

export function fonteCompartilhamento(nome: "Inter-Regular.ttf" | "Inter-SemiBold.ttf") {
  return arquivoPublico(`fontes/${nome}`);
}

/** Um jpg de `public/` como endereço de dados: é o que o gerador de imagem aceita sem buscar nada de fora. */
export async function fotoCompartilhamento(caminho: string) {
  const bytes = await arquivoPublico(caminho.replace(/^\//, ""));
  return `data:image/jpeg;base64,${Buffer.from(bytes as ArrayBuffer).toString("base64")}`;
}
