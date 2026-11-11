import { NextResponse } from "next/server";
import { MUNICIPIOS_INDICADORES } from "@/lib/catalogoMunicipal";
import { normalizarNomeMunicipal } from "@/lib/resumoMunicipalModelo";
import type { OpcaoMunicipio } from "@/app/_painel/_dados/resumoMunicipalModelo";

// O cadastro vem em ordem de população: sem busca, as maiores cidades aparecem primeiro.
const INDICE = MUNICIPIOS_INDICADORES.map((m) => ({ opcao: { codigo: m.codigo, nome: m.nome, uf: m.uf.sigla } satisfies OpcaoMunicipio, chave: normalizarNomeMunicipal(m.nome) }));

/** A lista do seletor de municípios: `?uf=SP&q=campi`. Sem `q`, as maiores da UF (ou do país). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const uf = (q.get("uf") ?? "").toUpperCase(), texto = q.get("q") ?? "";
  if ((uf && !/^[A-Z]{2}$/.test(uf)) || texto.length > 80) return NextResponse.json({ erro: "Busca inválida" }, { status: 400 });
  const busca = normalizarNomeMunicipal(texto);
  const daUf = (o: OpcaoMunicipio) => !uf || o.uf === uf;
  let lista: OpcaoMunicipio[];
  if (!busca) lista = INDICE.filter((x) => daUf(x.opcao)).slice(0, 40).map((x) => x.opcao);
  else {
    // O começo do nome vale mais que o meio; a UF escolhida vem antes das outras.
    const nota = (x: (typeof INDICE)[number]) => (x.chave.startsWith(busca) ? 0 : 2) + (daUf(x.opcao) ? 0 : 1);
    lista = INDICE.filter((x) => x.chave.includes(busca))
      .map((x, i) => ({ x, i, n: nota(x) }))
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .slice(0, 40)
      .map(({ x }) => x.opcao);
  }
  return NextResponse.json({ municipios: lista }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
