import { NextRequest, NextResponse } from "next/server";
import { destinoPainel, type ParametrosLegadosPainel } from "@/lib/rotasPainel";

/** Decide antes do streaming para devolver HTTP 308, não um redirect em HTML 200. */
export function middleware(request: NextRequest) {
  const params: ParametrosLegadosPainel = {};
  for (const chave of ["aba", "uf", "mandato"]) {
    params[chave] = request.nextUrl.searchParams.getAll(chave);
  }
  return NextResponse.redirect(new URL(destinoPainel(params), request.url), 308);
}

export const config = { matcher: ["/prototipo", "/prototipo-2"] };
