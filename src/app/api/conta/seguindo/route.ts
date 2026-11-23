import { NextResponse } from "next/server";

import { sessaoAtual } from "@/lib/contas";
import { listarSeguidos } from "@/lib/seguindo";
import { chaveSeguido } from "@/lib/seguindoChave";

/** Para o botão "Seguir" da página do parlamentar: se há sessão e quem a conta segue. */
export async function GET() {
  const cabecalhos = { "Cache-Control": "private, no-store" };
  const { usuario } = await sessaoAtual();
  if (!usuario) return NextResponse.json({ logado: false, seguidos: [] }, { headers: cabecalhos });
  try {
    const seguidos = (await listarSeguidos(usuario.id)).map(chaveSeguido);
    return NextResponse.json({ logado: true, seguidos }, { headers: cabecalhos });
  } catch (falha) {
    console.error("Lista de seguidos indisponível", falha);
    return NextResponse.json({ logado: true, seguidos: [], indisponivel: true }, { headers: cabecalhos });
  }
}
