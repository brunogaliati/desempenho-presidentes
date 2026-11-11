import fotos from "./fotos-parlamentares.json";

/** Retratos oficiais: Câmara (bandep) e UrlFotoParlamentar da API do Senado.
 * https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json
 * O endereço do Senado é o final: o antigo (`www.senado.leg.br/.../senador{id}.jpg`) responde com um 301 para ele.
 */
export function fotoParlamentar(casa: "deputados" | "senadores", id: number): string | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return casa === "deputados"
    ? `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`
    : `https://legis.senado.leg.br/senadores/fotos-oficiais/${id}`;
}

const comMiniatura = { deputados: new Set<number>(fotos.deputados), senadores: new Set<number>(fotos.senadores) };

/**
 * A miniatura de 112 px servida pelo próprio site (`scripts/coletar-fotos-parlamentares.mjs`), para
 * listas e o plenário. Sem ela, a foto oficial. Direto das casas, as fotos faziam fila: a Câmara só
 * fala HTTP/1.1 (6 por vez) e o Senado manda 230 KB por retrato.
 */
export function miniaturaParlamentar(casa: "deputados" | "senadores", id: number): string | null {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return comMiniatura[casa].has(id) ? `/painel/congresso/fotos/${casa}/${id}.webp` : fotoParlamentar(casa, id);
}
