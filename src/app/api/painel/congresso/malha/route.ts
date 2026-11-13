import { NextResponse } from "next/server";
import malha from "../../../../../../public/painel/municipios-brasil.json";

/** O perfil desenha uma UF; a malha nacional continua disponível para o mapa do país. */
export function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get("uf");
  const municipios = malha.municipios.filter(m => m.uf === uf);
  if (!municipios.length) return NextResponse.json({ erro: "UF inválida" }, { status: 400 });
  return NextResponse.json({ municipios }, {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
