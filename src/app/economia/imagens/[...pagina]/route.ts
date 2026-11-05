import { buscarPaginaEconomia } from "@/lib/catalogoEconomia";
import { carregarPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { imagemIndicador,imagemMunicipal } from "@/app/economia/ImagemIndicador";
import { buscarPaginaMunicipal } from "@/lib/catalogoMunicipal";
import { carregarIndicadorMunicipal } from "@/lib/dadosIndicadoresMunicipais";
import { imagemEmCache } from "@/lib/imagemEmCache";

export const revalidate = 3600;

export async function GET(request: Request,{params}:{params:Promise<{pagina:string[]}>}) {
  const {pagina} = await params;
  return imagemEmCache(request,async()=>{
    const municipal=buscarPaginaMunicipal(pagina);
    if(municipal){const d=await carregarIndicadorMunicipal(municipal.id,municipal.municipio);return d?imagemMunicipal(d):new Response("Não encontrado",{status:404});}
    const config = buscarPaginaEconomia(pagina);
    if (!config || config.propria) return new Response("Não encontrado",{status:404});
    const dados = await carregarPaginaEconomia(config);
    return dados ? imagemIndicador(dados) : new Response("Não encontrado",{status:404});
  });
}
