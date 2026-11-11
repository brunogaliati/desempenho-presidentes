"use client";
import { useEffect, useState } from "react";

/** Uma resposta só aparece quando corresponde ao endereço ainda selecionado. */
export function useJson<T>(url: string) {
  const [estado,setEstado]=useState<{url:string;dado:T}|null>(null);
  const [falhou,setFalhou]=useState<string|null>(null);
  const [tentativa,setTentativa]=useState(0);
  useEffect(()=>{
    const controle=new AbortController();
    fetch(url,{signal:controle.signal}).then(r=>{
      if(!r.ok)throw new Error(String(r.status));
      return r.json() as Promise<T>;
    }).then(dado=>{if(!controle.signal.aborted){setEstado({url,dado});setFalhou(null);}})
      .catch((e:Error)=>{if(e.name!=="AbortError")setFalhou(url);});
    return ()=>controle.abort();
  },[url,tentativa]);
  return {dado:estado?.url===url?estado.dado:null,erro:falhou===url,tentar:()=>{setFalhou(null);setTentativa(t=>t+1);}};
}
