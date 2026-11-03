import type { Metadata } from "next";

export const NOME_SITE = "Desempenho do Governo";
export const URL_SITE = new URL(process.env.SITE_URL || "https://desempenhodogoverno.com.br").origin;

export function podeIndexar(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview" && env.SEO_INDEXING !== "false";
}

export function metadataPagina(titulo: string, descricao: string, caminho: string, imagem?: string): Metadata {
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: { title: titulo, description: descricao, url: caminho, siteName: NOME_SITE, locale: "pt_BR", type: "website", ...(imagem ? {images:[{url:imagem,width:1200,height:630,alt:titulo}]} : {}) },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, ...(imagem ? {images:[imagem]} : {}) },
  };
}

/** Impede que conteúdo de dados feche a tag script ao serializar JSON-LD. */
export function jsonLd(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, "\\u003c");
}
