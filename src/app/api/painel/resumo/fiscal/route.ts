import { NextResponse } from "next/server";
import { carregarFiscalResumo, carregarSerieFiscal } from "@/app/_painel/_dados/resumoFiscal";

const CODIGOS: Record<string, number> = { RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53 };
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const codigo = CODIGOS[(q.get("uf") ?? "").toUpperCase()];
  const posse = q.get("posse") ?? "", fim = q.get("fim") ?? "";
  const mes = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
  if (!codigo || !mes.test(posse) || !mes.test(fim) || fim <= posse) return NextResponse.json({ erro: "Recorte inválido" }, { status: 400 });
  try {
    // A série é só do gráfico: se falhar, os números do mandato saem assim mesmo.
    const [dados, serie] = await Promise.all([
      carregarFiscalResumo(codigo, posse, fim),
      carregarSerieFiscal(codigo).catch((e) => {
        console.error("Série do RGF indisponível", e);
        return null;
      }),
    ]);
    return NextResponse.json({ ...dados, serie }, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=3600" } });
  } catch (error) {
    console.error("RGF do resumo indisponível", error);
    return NextResponse.json({ erro: "O Tesouro não respondeu agora" }, { status: 503 });
  }
}
