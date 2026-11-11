import type { Metadata } from "next";

export const NOME_SITE = "Desempenho do Governo";
export const URL_SITE = new URL(process.env.SITE_URL || "https://desempenhodogoverno.com.br").origin;

export function podeIndexar(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview" && env.SEO_INDEXING !== "false";
}

/** A imagem que uma página anuncia. A prévia do compartilhar precisa chegar na mesma URL. */
export function imagemDaPagina(caminho: string, imagem?: string): string {
  const propria = caminho === '/economia/inflacao' || caminho === '/economia/salario-minimo' || /^\/presidente\/[^/]+$/.test(caminho) || /^\/congresso\/(deputados|senadores)\/[^/]+$/.test(caminho);
  const capa = imagem ?? (propria ? `${caminho}/opengraph-image` : `/compartilhar?pagina=${encodeURIComponent(caminho.split('?')[0])}`);
  return `${capa}${capa.includes('?')?'&':'?'}v=${caminho === '/' || caminho === '/dinheiro' ? '20261111' : caminho === '/resumo' ? '20261110' : '20261104'}`;
}

export function metadataPagina(titulo: string, descricao: string, caminho: string, imagem?: string): Metadata {
  const imagemFinal = imagemDaPagina(caminho, imagem);
  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    openGraph: { title: titulo, description: descricao, url: caminho, siteName: NOME_SITE, locale: "pt_BR", type: "website", images:[{url:imagemFinal,width:1200,height:630,alt:titulo}] },
    twitter: { card: "summary_large_image", title: titulo, description: descricao, images:[imagemFinal] },
  };
}

/** Impede que conteúdo de dados feche a tag script ao serializar JSON-LD. */
export function jsonLd(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, "\\u003c");
}
