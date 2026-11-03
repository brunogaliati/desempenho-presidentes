import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { DadosPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { rotuloPeriodoPublico } from "@/app/prototipo/_dados/economiaModelo";
import { numero, reais } from "@/lib/formatar";
import type { DadosIndicadorMunicipal } from "@/lib/dadosIndicadoresMunicipais";
import { INDICADORES_MUNICIPAIS,rotuloReferenciaMunicipal } from "@/lib/indicadoresMunicipais";

export async function imagemIndicador(d: DadosPaginaEconomia) {
  return imagemPublica(`${d.pagina.id === "gasolina" ? "Gasolina comum" : "Desemprego"} · ${d.territorio}${d.pagina.territorio?.uf ? ` (${d.pagina.territorio.uf.sigla}) · município` : d.pagina.territorio ? " (UF)" : ""}`,d.pagina.id === "gasolina" ? `${reais(d.ultimo.valor)}/litro` : `${numero(d.ultimo.valor,1)}%`,`${d.pagina.id === "desemprego" ? "Trimestre móvel encerrado em " : "Referência: "}${rotuloPeriodoPublico(d.ultimo.mes,d.trimestral)}`,d.fonte);
}

export async function imagemMunicipal(d:DadosIndicadorMunicipal) {
  const cfg=INDICADORES_MUNICIPAIS[d.id];
  return imagemPublica(`${cfg.nome} · ${d.municipio.nome} (${d.municipio.uf.sigla})`,numero(d.ultimo.valor,0),`Referência: ${rotuloReferenciaMunicipal(d.ultimo.referencia,cfg.anual)} · ${cfg.unidade}`,cfg.fonte);
}

async function imagemPublica(titulo:string,valor:string,referencia:string,fonteNome:string) {
  const fonte = await readFile(join(process.cwd(),"src/assets/Inter-Regular.ttf"));
  return new ImageResponse(<div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:"100%",height:"100%",padding:64,background:"#f8fafd",color:"#263746",fontFamily:"Inter"}}>
    <div style={{display:"flex",fontSize:36}}>{titulo}</div>
    <div style={{display:"flex",fontSize:96,color:"#285c84"}}>{valor}</div>
    <div style={{display:"flex",fontSize:28}}>{referencia}</div>
    <div style={{display:"flex",fontSize:23,color:"#46586a"}}>{fonteNome} · Desempenho do Governo</div>
  </div>,{width:1200,height:630,fonts:[{name:"Inter",data:fonte,weight:400,style:"normal"}],headers:{"X-Robots-Tag":"noindex"}});
}
