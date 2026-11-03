import { redirect } from "next/navigation";

/** O estudo de relevo foi promovido para a página principal. */
export default async function PrototipoAnterior({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [chave, valor] of Object.entries(await searchParams)) {
    if (valor === undefined) continue;
    for (const item of [valor].flat()) query.append(chave, item);
  }
  redirect(`/prototipo${query.size ? `?${query}` : ""}`);
}
