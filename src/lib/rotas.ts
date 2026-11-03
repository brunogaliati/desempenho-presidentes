/**
 * Endereços das páginas.
 *
 * A página é da pessoa, não do mandato: FHC 1 e FHC 2 vivem em `/presidente/fhc`,
 * separados por seções. Um link para um mandato específico é a página da pessoa
 * mais a âncora daquele mandato, então quem clica em "Lula 3" na linha do tempo
 * cai direto na seção certa e ainda tem os outros dois mandatos ao alcance da
 * rolagem.
 */

/** Âncora do mandato dentro da página da pessoa. */
export function ancoraMandato(numeroDoMandato: number): string {
  return `mandato-${numeroDoMandato}`;
}

export function rotaPessoa(pessoaId: string): string {
  return `/presidente/${pessoaId}`;
}

/** Link para um mandato: página da pessoa, posicionada na seção dele. */
export function rotaMandato(
  mandato: { pessoaId: string; mandato: number },
): string {
  return `${rotaPessoa(mandato.pessoaId)}#${ancoraMandato(mandato.mandato)}`;
}
