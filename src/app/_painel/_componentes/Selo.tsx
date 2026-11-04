/**
 * Marca de número ilustrativo.
 *
 * Borda tracejada e texto, não cor: tem que sobreviver a print, captura de
 * tela recortada e daltonismo. Vai ao lado de cada número que sai de
 * `_dados/exemplos.ts`, e no título de cada bloco feito só de exemplos.
 */
export function Selo() {
  return (
    <span
      data-selo-exemplo
      title="Número ilustrativo: a fonte ainda não está carregada."
      className="ml-1.5 inline-block whitespace-nowrap rounded border border-dashed px-1 align-middle text-[10px] font-semibold uppercase leading-4 tracking-wide"
      style={{ borderColor: "var(--tinta-3)", color: "var(--tinta-2)" }}
    >
      exemplo
    </span>
  );
}
