import { imagemDaPagina, NOME_SITE, URL_SITE } from "./seo.ts";
import { TEMAS_PAINEL } from "./temasPainel.ts";

/** A prévia social da home não deve esperar pelas consultas e pelo SSR do painel. */
export function previaHome(endereco: string, agente: string): string | null {
  const url = new URL(endereco);
  if (url.pathname !== "/" || url.search || !/WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|LinkedInBot|Cardyb|Slackbot|Discordbot|SkypeUriPreview|Pinterestbot|Mastodon/i.test(agente)) return null;
  const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  const { titulo, descricao } = TEMAS_PAINEL.resumo;
  const imagem = escapar(URL_SITE + imagemDaPagina("/"));
  const tituloHtml = escapar(titulo), descricaoHtml = escapar(descricao), origem = escapar(URL_SITE + "/");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${tituloHtml}</title><meta name="description" content="${descricaoHtml}"><link rel="canonical" href="${origem}"><meta property="og:type" content="website"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="${escapar(NOME_SITE)}"><meta property="og:url" content="${origem}"><meta property="og:title" content="${tituloHtml}"><meta property="og:description" content="${descricaoHtml}"><meta property="og:image" content="${imagem}"><meta property="og:image:secure_url" content="${imagem}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${tituloHtml}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${tituloHtml}"><meta name="twitter:description" content="${descricaoHtml}"><meta name="twitter:image" content="${imagem}"></head><body><h1>${tituloHtml}</h1><p>${descricaoHtml}</p><a href="${origem}">Abrir ${escapar(NOME_SITE)}</a></body></html>`;
}
