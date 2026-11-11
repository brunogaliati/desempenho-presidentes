import { NextResponse } from "next/server";
import { buscarMunicipioCodigo } from "@/lib/catalogoMunicipal";
import { carregarFiscalResumo, carregarSerieFiscal } from "@/app/_painel/_dados/resumoFiscal";

/** Dívida e pessoal do Executivo municipal (RGF), como `/api/painel/resumo/fiscal` faz para os estados. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const m = /^\d{7}$/.test(q.get("codigo") ?? "") ? buscarMunicipioCodigo(q.get("codigo")!) : null;
  const posse = q.get("posse") ?? "", fim = q.get("fim") ?? "";
  const mes = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
  if (!m || !mes.test(posse) || !mes.test(fim) || fim <= posse) return NextResponse.json({ erro: "Recorte inválido" }, { status: 400 });
  const codigo = Number(m.codigo);
  try {
    const [dados, serie] = await Promise.all([
      carregarFiscalResumo(codigo, posse, fim),
      carregarSerieFiscal(codigo).catch((e) => {
        console.error("Série do RGF municipal indisponível", e);
        return null;
      }),
    ]);
    return NextResponse.json({ ...dados, serie }, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("RGF municipal indisponível", error);
    return NextResponse.json({ erro: "O Tesouro não respondeu agora" }, { status: 503 });
  }
}
