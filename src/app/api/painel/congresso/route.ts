import { NextResponse } from "next/server";

import { carregarPerfilParlamentar } from "@/app/_painel/_dados/perfilParlamentar";

/** Crachá de um parlamentar da fotografia: cadastro, trajetória na casa e Emendas Pix. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const casa = url.searchParams.get("casa");
  const id = Number(url.searchParams.get("id"));
  if ((casa !== "deputados" && casa !== "senadores") || !Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  }
  try {
    const perfil = await carregarPerfilParlamentar(casa, id);
    if (!perfil) return NextResponse.json({ erro: "Parlamentar fora da fotografia" }, { status: 404 });
    return NextResponse.json(perfil, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("Perfil parlamentar indisponível", error);
    return NextResponse.json({ erro: "Dados indisponíveis no momento" }, { status: 503 });
  }
}
