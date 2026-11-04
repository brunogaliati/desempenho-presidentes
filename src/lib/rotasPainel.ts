export type ParametrosLegadosPainel = Record<string, string | string[] | undefined>;

/** Links compartilhados do painel antigo continuam abrindo o mesmo recorte. */
export function destinoPainel(params: ParametrosLegadosPainel): string {
  const primeiro = (nome: string) => [params[nome]].flat()[0];
  const aba = primeiro("aba");
  const caminho = aba === "ambiente" || aba === "queimadas"
    ? "/meio-ambiente"
    : aba === "dinheiro" ? "/dinheiro" : "/";
  const query = new URLSearchParams();
  for (const chave of ["uf", "mandato"]) {
    const valor = primeiro(chave);
    if (valor) query.set(chave, chave === "uf" ? valor.toUpperCase() : valor);
  }
  return caminho + (query.size ? `?${query}` : "");
}
