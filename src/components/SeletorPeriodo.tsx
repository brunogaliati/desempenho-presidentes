"use client";
import { SeletorDados } from "./SeletorDados";
import { rotuloPeriodoPublico } from "@/app/_painel/_dados/economiaModelo";
import { mesLegivel } from "@/lib/formatar";

export function SeletorPeriodo({rotulo,valor,referencias,precisao="mes",aoEscolher}:{
  rotulo:string;valor:string;referencias:string[];precisao?:"mes"|"trimestre"|"ano";aoEscolher:(valor:string)=>void;
}) {
  const curto=precisao==="ano"?valor.slice(0,4):precisao==="trimestre"?`${Math.ceil(Number(valor.slice(5,7))/3)}º tri/${valor.slice(0,4)}`:mesLegivel(valor);
  return <SeletorDados rotulo={rotulo} valor={valor} rotuloFechado={curto} alinharFim={rotulo==="Até"} aoEscolher={aoEscolher} opcoes={[...new Set(referencias)].sort().reverse().map(r=>({valor:r,rotulo:precisao==="ano"?r.slice(0,4):rotuloPeriodoPublico(r,precisao==="trimestre")}))}/>;
}
