import { NextResponse } from "next/server";
import { buscarMunicipioCodigo } from "@/lib/catalogoMunicipal";
import { carregarResumoMunicipalPainel } from "@/app/_painel/_dados/resumoMunicipal";
import { gestaoEmCurso, gestaoValida } from "@/app/_painel/_dados/resumoMunicipalModelo";

/** O resumo de uma prefeitura numa gestão: `?codigo=3550308&ano=2025` (código IBGE e ano da posse). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const m = /^\d{7}$/.test(q.get("codigo") ?? "") ? buscarMunicipioCodigo(q.get("codigo")!) : null;
  const ano = q.get("ano") === null ? gestaoEmCurso() : Number(q.get("ano"));
  if (!m || !gestaoValida(ano)) return NextResponse.json({ erro: "Recorte inválido" }, { status: 400 });
  try {
    return NextResponse.json(await carregarResumoMunicipalPainel(m, ano), { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("Resumo municipal indisponível", error);
    return NextResponse.json({ erro: "Dados indisponíveis no momento" }, { status: 503 });
  }
}
