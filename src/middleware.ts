import { NextRequest, NextResponse } from "next/server";
import { destinoPainel, linkDaEconomia, type ParametrosLegadosPainel } from "@/lib/rotasPainel";
import { acharParlamentar } from "@/app/_painel/_dados/paginaParlamentar";

/** Decide antes do streaming para devolver HTTP 308, não um redirect em HTML 200. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/congresso/")) {
    const [, , casa, pessoa] = request.nextUrl.pathname.split("/");
    const parlamentar = acharParlamentar(casa, pessoa);
    if (!parlamentar || parlamentar.caminho === request.nextUrl.pathname) return NextResponse.next();
    const destino = request.nextUrl.clone();
    destino.pathname = parlamentar.caminho;
    return NextResponse.redirect(destino, 308);
  }
  // A home é o Resumo; links da Economia de quando ela morava em "/" seguem para /economia, com a busca inteira.
  // Temporário (307): se a home mudar de novo, nenhum navegador fica preso a este desvio.
  if (request.nextUrl.pathname === "/") {
    if (!linkDaEconomia(request.nextUrl.searchParams)) return NextResponse.next();
    const destino = request.nextUrl.clone();
    destino.pathname = "/economia";
    return NextResponse.redirect(destino, 307);
  }
  const params: ParametrosLegadosPainel = {};
  for (const chave of ["aba", "uf", "mandato"]) {
    params[chave] = request.nextUrl.searchParams.getAll(chave);
  }
  return NextResponse.redirect(new URL(destinoPainel(params), request.url), 308);
}

export const config = { matcher: ["/", "/prototipo", "/prototipo-2", "/congresso/deputados/:pessoa", "/congresso/senadores/:pessoa"] };
