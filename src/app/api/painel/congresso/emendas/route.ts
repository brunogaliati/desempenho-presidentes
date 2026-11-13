import { NextResponse } from "next/server";
import { carregarEmendasParlamentar } from "@/app/_painel/_dados/emendasParlamentar";
import { LEGISLATURA } from "@/app/_painel/_dados/congressoModelo";

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const casa = p.get("casa"), id = Number(p.get("id")), escolhido = p.get("ano") ?? LEGISLATURA;
  const periodo = escolhido === LEGISLATURA ? LEGISLATURA : Number(escolhido);
  if ((casa !== "deputados" && casa !== "senadores") || !Number.isSafeInteger(id) || id <= 0 ||
      (periodo !== LEGISLATURA && (!Number.isInteger(periodo) || periodo < 2014 || periodo > new Date().getFullYear()))) {
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  }
  try {
    const dados = await carregarEmendasParlamentar(casa, id, periodo);
    if (!dados) return NextResponse.json({ erro: "Parlamentar fora da composição consultada" }, { status: 404 });
    return NextResponse.json(dados);
  } catch (error) {
    console.error("Emendas por município indisponíveis", error);
    return NextResponse.json({ erro: "Emendas indisponíveis no momento" }, { status: 503 });
  }
}
