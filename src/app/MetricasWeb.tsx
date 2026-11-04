"use client";
import { useReportWebVitals } from "next/web-vitals";

function registrar(metrica:{name:string;value:number;rating:string}){
  const corpo=JSON.stringify({nome:metrica.name,valor:metrica.value,avaliacao:metrica.rating,caminho:location.pathname});
  navigator.sendBeacon('/api/metricas-web',new Blob([corpo],{type:'application/json'}));
}
export function MetricasWeb(){useReportWebVitals(registrar);return null;}
