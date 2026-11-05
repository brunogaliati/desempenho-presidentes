import "server-only";
import type { Metadata } from "next";

import { imagemDaPagina, URL_SITE } from "@/lib/seo";

import { cartaoDoEndereco } from "../_componentes/capaRecorte";
import { carregarPainel } from "./carregar";

export type Busca = Record<string, string | string[] | undefined>;

/**
 * A metadata de uma página do painel, com o cartão do recorte que o link pede.
 *
 * A canônica continua sendo a página: o recorte é para quem recebe o link, não para a
 * busca. `og:url` leva o recorte inteiro, porque o Facebook raspa o endereço que ela
 * disser e é para ele que o cartão manda quem clica.
 */
export async function metadataComRecorte(base: Metadata, caminho: string, busca: Busca): Promise<Metadata> {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(busca)) {
    if (typeof valor === "string" && /^(uf|mandato|painel|r\.[a-z0-9_.-]{1,140})$/.test(chave)) q.set(chave, valor);
  }
  // Sem recorte, a capa é a da página, e nem precisa dos dados.
  if (!q.has("mandato") && !q.has("painel")) return base;
  const { painel } = await carregarPainel();
  const cartao = cartaoDoEndereco(caminho, q, painel);
  if (!cartao) return base;
  const imagem = URL_SITE + imagemDaPagina(caminho, cartao.imagem);
  const { titulo: title, descricao: description } = cartao;
  return {
    ...base,
    // Com `metadataBase`, o Next corta a busca de qualquer URL em "/" e a home perderia o recorte.
    // Sem ela, as URLs saem como estão escritas: por isso todas aqui são absolutas.
    metadataBase: null,
    alternates: { canonical: URL_SITE + caminho },
    openGraph: { ...base.openGraph, title, description, url: `${URL_SITE}${caminho}?${q}`, images: [{ url: imagem, width: 1200, height: 630, alt: title }] },
    twitter: { ...base.twitter, title, description, images: [imagem] },
  };
}
