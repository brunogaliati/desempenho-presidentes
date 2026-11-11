export type ParametrosLegadosPainel = Record<string, string | string[] | undefined>;

/** Links compartilhados do painel antigo continuam abrindo o mesmo recorte. */
export function destinoPainel(params: ParametrosLegadosPainel): string {
  const primeiro = (nome: string) => [params[nome]].flat()[0];
  const aba = primeiro("aba");
  const caminho = aba === "ambiente" || aba === "queimadas"
    ? "/meio-ambiente"
    : aba === "dinheiro" ? "/dinheiro" : aba === "resumo" ? "/" : "/economia";
  const query = new URLSearchParams();
  for (const chave of ["uf", "mandato"]) {
    const valor = primeiro(chave);
    if (valor) query.set(chave, chave === "uf" ? valor.toUpperCase() : valor);
  }
  return caminho + (query.size ? `?${query}` : "");
}

/** As seções da Economia que os botões de compartilhar levam em `painel`. */
const PAINEIS_ECONOMIA = new Set(["agora", "de-perto", "historico-serie", "mapa-economia", "governo-a-governo", "estados", "emprego-e-credito",
  "bloco-credito-e-inadimplencia", "bloco-ritmo-no-mandato", "bloco-governadores-por-partido", "bloco-brasil-e-o-mundo", "bloco-ultimos-dados", "fontes"]);

/**
 * A Economia foi a home até 11/11/2026. Um link dela que já circula ("/?r.serie=…", "/?painel=governo-a-governo")
 * tem de abrir a Economia, com o cartão dela. Só `uf` e `mandato` não bastam para saber: esses abrem o Resumo.
 * "bloco-orcamento-federal-em-…" fica no Resumo, que tem um bloco com o mesmo título.
 */
export function linkDaEconomia(q: URLSearchParams): boolean {
  const painel = q.get("painel") ?? q.get("secao");
  if (painel && (PAINEIS_ECONOMIA.has(painel) || painel.startsWith("bloco-quem-governou-"))) return true;
  return [...q.keys()].some((k) => k.startsWith("r.") && !k.startsWith("r.resumo."));
}
