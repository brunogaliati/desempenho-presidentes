import { NextResponse } from "next/server";

import { carregarResumo, SIGLAS_UF } from "@/app/_painel/_dados/resumo";

export async function GET(request: Request) {
  const pedido = (new URL(request.url).searchParams.get("uf") ?? "BR").toUpperCase();
  const territorio = pedido === "BR" || SIGLAS_UF.includes(pedido) ? pedido : null;
  if (!territorio) return NextResponse.json({ erro: "Território inválido" }, { status: 400 });
  const ano = new Date().getUTCFullYear();
  const posse = new URL(request.url).searchParams.get("posse") ?? `${ano - (ano - 2023) % 4}-01`;
  if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(posse)) return NextResponse.json({ erro: "Posse inválida" }, { status: 400 });
  try {
    return NextResponse.json(await carregarResumo(territorio, posse), { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("Resumo indisponível", error);
    return NextResponse.json({ erro: "Dados indisponíveis no momento" }, { status: 503 });
  }
}
