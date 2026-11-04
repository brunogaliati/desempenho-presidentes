"use client";
import { inteiroCompartilhado } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { GraficoTempo } from "@/components/GraficoTempo";
import { useLargura } from "@/lib/useLargura";
import { numero, comSinal } from "@/lib/formatar";
import { INDICADORES_MUNICIPAIS, rotuloReferenciaMunicipal, type IndicadorMunicipal, type LinhaMunicipal } from "@/lib/indicadoresMunicipais";

export function HistoricoMunicipal({id,nome,pontos}:{id:IndicadorMunicipal;nome:string;pontos:LinhaMunicipal[]}) {
  const cfg=INDICADORES_MUNICIPAIS[id],ultimo=pontos.at(-1)!.referencia;
  const [medida,setMedida]=useEstadoCompartilhavel("medida",0,v=>inteiroCompartilhado(v)&&Number(v)<cfg.medidas.length),[de,setDe]=useEstadoCompartilhavel("de",pontos.find(p=>Number(p.referencia.slice(0,4))>=Number(ultimo.slice(0,4))-10)?.referencia??pontos[0].referencia,v=>pontos.some(p=>p.referencia===v)),[ate,setAte]=useEstadoCompartilhavel("ate",ultimo,v=>pontos.some(p=>p.referencia===v));
  const {ref,largura}=useLargura<HTMLDivElement>();
  const valor=(p:LinhaMunicipal|undefined)=>p?[p.valor,...p.extras][medida]??null:null;
  const a=valor(pontos.find(p=>p.referencia===de)),b=valor(pontos.find(p=>p.referencia===ate));
  const valido=de<=ate && a!==null && b!==null;
  const recorte=pontos.filter(p=>p.referencia>=de && p.referencia<=ate);
  const data=(r:string)=>rotuloReferenciaMunicipal(r,cfg.anual);
  const unidade=id==="cadunico" && medida===1?"pessoas":id==="emprego-formal" && medida>0?"movimentações":cfg.unidade;
  return <div ref={ref}>
    <div className="my-5 flex flex-wrap items-end gap-4">
      {cfg.medidas.length>1 && <label className="grid gap-1 text-sm">Medida<select value={medida} onChange={e=>setMedida(Number(e.target.value))}>{cfg.medidas.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></label>}
      {([["De",de,setDe],["Até",ate,setAte]] as const).map(([nome,valor,mudar])=><label className="grid gap-1 text-sm" key={nome}>{nome}{cfg.anual?<select value={valor} onChange={e=>mudar(e.target.value)}>{pontos.filter(p=>p.valor!==null).map(p=><option key={p.referencia} value={p.referencia}>{data(p.referencia)}</option>)}</select>:<input type="month" min={pontos[0].referencia} max={ultimo} value={valor} onChange={e=>mudar(e.target.value)}/>}</label>)}
    </div>
    {valido ? <>
      <p aria-live="polite" className="max-w-prose text-sm leading-relaxed">De {data(de)} a {data(ate)}, a diferença na medida selecionada foi de <strong>{comSinal(b!-a!,0)} {unidade}</strong>{a!>0?` (${comSinal((b!/a!-1)*100,2)}%)`:""}. {medida===3 && id==="emprego-formal"?"Comparamos os saldos dos dois meses, sem somar o intervalo.":"Comparação dos valores nas duas referências."}</p>
      <div style={{minHeight:330}}><GraficoTempo serie={{id:`municipal-${id}-${medida}`,nome:`${cfg.medidas[medida]} · ${nome}`,unidade,frequencia:cfg.anual?"anual":"mensal",agregacao:null,datas:recorte.map(p=>p.referencia),valores:recorte.map(valor)}} presidentes={[]} formatoValor={v=>numero(v,0)} rotuloData={data} largura={largura||1000} altura={300}/></div>
    </>:<p role="status" className="py-5">Escolha referências com dados e início anterior ou igual ao fim.</p>}
    <p className="text-sm leading-relaxed text-[var(--tinta-2)]">{cfg.anual?"Estimativas anuais. Anos sem publicação interrompem a linha.":"Referências mensais. Ausências interrompem a linha e não são transformadas em zero."}</p>
  </div>;
}
