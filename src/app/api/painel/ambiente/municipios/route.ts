import { NextResponse } from "next/server";
import { carregarMunicipiosAmbiente } from "@/app/_painel/_dados/carregarMunicipiosAmbiente";

export async function GET(pedido: Request) {
  // Sem parâmetros, o mandato em curso. Mês inválido cai nele, em vez de ir para o banco.
  const u = new URL(pedido.url).searchParams;
  const posse = u.get("posse") ?? "";
  const ate = u.get("ate") ?? "";
  return NextResponse.json(/^(19|20)\d{2}-(01|08)$/.test(posse) && /^(19|20)\d{2}-(01|08)$/.test(ate) && posse < ate ? await carregarMunicipiosAmbiente(posse, ate) : await carregarMunicipiosAmbiente("2023-01", null));
}
