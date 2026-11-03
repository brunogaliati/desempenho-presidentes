import { buscarPaginaEconomia } from "@/lib/catalogoEconomia";
import { carregarPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { imagemIndicador } from "@/app/economia/ImagemIndicador";

export const revalidate = 3600;

export async function GET(_request: Request,{params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  const config = buscarPaginaEconomia(pagina);
  if (!config || config.propria) return new Response("Não encontrado",{status:404});
  const dados = await carregarPaginaEconomia(config);
  return dados ? imagemIndicador(dados) : new Response("Não encontrado",{status:404});
}
