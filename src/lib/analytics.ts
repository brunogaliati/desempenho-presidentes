/** Identificador público do fluxo web; não é uma credencial. */
export const ID_ANALYTICS = "G-DSETD1YL9C";
export const CHAVE_ANALYTICS = "ddg:estatisticas:v1";

export function dominioComAnalytics(hostname: string) {
  return hostname === "desempenhodogoverno.com.br" || hostname === "www.desempenhodogoverno.com.br";
}

/** Filtros, buscas, fragmentos e credenciais não entram nos relatórios. */
export function enderecoAnalytics(endereco: string): string | undefined {
  try {
    const u = new URL(endereco);
    return ["https:", "http:"].includes(u.protocol) ? u.origin + u.pathname : undefined;
  } catch { return undefined; }
}

export function paginaAnalytics(endereco: string, anterior: string | null) {
  const pagina = enderecoAnalytics(endereco);
  return pagina && pagina !== anterior ? pagina : null;
}
