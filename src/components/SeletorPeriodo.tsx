"use client";
import { SeletorDados } from "./SeletorDados";
import { rotuloPeriodoPublico } from "@/app/_painel/_dados/economiaModelo";

export function SeletorPeriodo({rotulo,valor,referencias,precisao="mes",aoEscolher}:{
  rotulo:string;valor:string;referencias:string[];precisao?:"mes"|"trimestre"|"ano";aoEscolher:(valor:string)=>void;
}) {
  return <SeletorDados rotulo={rotulo} valor={valor} aoEscolher={aoEscolher} opcoes={[...new Set(referencias)].sort().reverse().map(r=>({valor:r,rotulo:precisao==="ano"?r.slice(0,4):rotuloPeriodoPublico(r,precisao==="trimestre")}))}/>;
}
