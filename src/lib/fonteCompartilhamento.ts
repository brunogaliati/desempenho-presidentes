import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Assets no Worker; arquivo local no build e no servidor Next tradicional. */
export async function fonteCompartilhamento(nome: "Inter-Regular.ttf" | "Inter-SemiBold.ttf") {
  let assets: CloudflareEnv["ASSETS"];
  try { assets = getCloudflareContext().env.ASSETS; } catch { /* Fora do Worker. */ }
  if (assets) {
    const resposta = await assets.fetch(`https://assets.local/fontes/${nome}`);
    if (!resposta.ok) throw new Error(`Fonte de compartilhamento indisponível: ${nome}`);
    return resposta.arrayBuffer();
  }
  return readFile(join(process.cwd(), "public", "fontes", nome));
}
