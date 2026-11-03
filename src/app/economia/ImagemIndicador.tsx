import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { DadosPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { rotuloPeriodoPublico } from "@/app/prototipo/_dados/economiaModelo";
import { numero, reais } from "@/lib/formatar";

export async function imagemIndicador(d: DadosPaginaEconomia) {
  const fonte = await readFile(join(process.cwd(),"src/assets/Inter-Regular.ttf"));
  return new ImageResponse(<div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",width:"100%",height:"100%",padding:64,background:"#f8fafd",color:"#263746",fontFamily:"Inter"}}>
    <div style={{display:"flex",fontSize:36}}>{d.pagina.id === "gasolina" ? "Gasolina comum" : "Desemprego"} · {d.territorio}{d.pagina.territorio?.uf ? ` (${d.pagina.territorio.uf.sigla}) · município` : d.pagina.territorio ? " (UF)" : ""}</div>
    <div style={{display:"flex",fontSize:96,color:"#285c84"}}>{d.pagina.id === "gasolina" ? `${reais(d.ultimo.valor)}/litro` : `${numero(d.ultimo.valor,1)}%`}</div>
    <div style={{display:"flex",fontSize:28}}>{d.pagina.id === "desemprego" ? "Trimestre móvel encerrado em " : "Referência: "}{rotuloPeriodoPublico(d.ultimo.mes,d.trimestral)}</div>
    <div style={{display:"flex",fontSize:23,color:"#46586a"}}>{d.fonte} · Desempenho do Governo</div>
  </div>,{width:1200,height:630,fonts:[{name:"Inter",data:fonte,weight:400,style:"normal"}],headers:{"X-Robots-Tag":"noindex"}});
}
