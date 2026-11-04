"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { codificarFiltro, decodificarFiltro, type FiltrosCompartilhados } from '@/lib/compartilhamento';

type Contexto = { registros: Map<string,string|null>; contexto: () => {titulo:string;filtros:FiltrosCompartilhados} };
const RecorteContexto = createContext<Contexto|null>(null);
export const useRecorteCompartilhado = () => useContext(RecorteContexto);

export function RecortesCompartilhaveis({children,titulo='',filtros={}}:{children:React.ReactNode;titulo?:string;filtros?:FiltrosCompartilhados}) {
  const registros=useRef(new Map<string,string|null>()),atual=useRef({titulo,filtros});atual.current={titulo,filtros};
  const contexto=useMemo(()=>({registros:registros.current,contexto:()=>atual.current}),[]);
  return <RecorteContexto.Provider value={contexto}><FocoCompartilhado/>{children}</RecorteContexto.Provider>;
}

/** Mantém ISR/HTML canônico: filtros de apresentação são restaurados na hidratação. */
export function useEstadoCompartilhavel<T>(chave:string,inicial:T,validar:(valor:unknown)=>boolean,paraLink?:(valor:T)=>unknown):[T,Dispatch<SetStateAction<T>>] {
  const [valor,setValor]=useState<T>(inicial),ctx=useRecorteCompartilhado(),aplicado=useRef<string|null>(null);
  const ultimoValor=useRef(valor);ultimoValor.current=valor;
  const nome=`r.${chave}`;
  useLayoutEffect(()=>{
    const raw=new URLSearchParams(window.location.search).get(nome),token=window.location.pathname+'|'+raw;
    if(aplicado.current===token)return;
    if(raw===null){aplicado.current=token;return;}
    const salvo=decodificarFiltro<T>(raw,validar);
    // Um componente pode receber suas opções depois de uma consulta assíncrona.
    if(salvo!==undefined){aplicado.current=token;setValor(salvo);}
  },[nome,validar]);
  useLayoutEffect(()=>{ctx?.registros.set(nome,codificarFiltro(paraLink?paraLink(valor):valor));return()=>{ctx?.registros.delete(nome);};},[ctx,nome,valor,paraLink]);
  useEffect(()=>{const restaurar=()=>{aplicado.current=null;const raw=new URLSearchParams(location.search).get(nome);if(raw!==null){const salvo=decodificarFiltro<T>(raw,validar);if(salvo!==undefined)setValor(salvo);}};window.addEventListener('popstate',restaurar);return()=>window.removeEventListener('popstate',restaurar);},[nome,validar]);
  const alterar=useCallback<Dispatch<SetStateAction<T>>>(acao=>{
    const proximo=typeof acao==='function'?(acao as (anterior:T)=>T)(ultimoValor.current):acao;
    ultimoValor.current=proximo;setValor(proximo);
    const url=new URL(location.href),salvo=codificarFiltro(proximo);
    if(salvo===null)url.searchParams.delete(nome);else url.searchParams.set(nome,salvo);
    aplicado.current=url.pathname+'|'+url.searchParams.get(nome);
    history.replaceState(history.state,'',url);
  },[nome]);
  return [valor,alterar];
}

function FocoCompartilhado() {
  useEffect(()=>{
    let observador:MutationObserver|undefined,timer:ReturnType<typeof setTimeout>|undefined,encerrado=false;
    const parar=()=>{encerrado=true;observador?.disconnect();if(timer)clearTimeout(timer);};
    const abrir=()=>{
      const url=new URL(location.href),id=url.searchParams.get('painel');
      if(!id||!/^[a-zA-Z0-9_.-]{1,100}$/.test(id))return;
      const tentar=()=>{if(encerrado)return;const el=document.getElementById(id);if(!el||el.querySelector('[aria-busy="true"]'))return;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(encerrado)return;el.scrollIntoView({block:'start',behavior:'instant'});el.setAttribute('data-compartilhado','true');el.setAttribute('tabindex','-1');el.focus({preventScroll:true});parar();setTimeout(()=>el.removeAttribute('data-compartilhado'),4500);}));
      };
      observador=new MutationObserver(tentar);observador.observe(document.body,{childList:true,subtree:true});timer=setTimeout(parar,30000);tentar();
    };
    abrir();window.addEventListener('wheel',parar,{passive:true});window.addEventListener('pointerdown',parar,{passive:true});
    return()=>{parar();window.removeEventListener('wheel',parar);window.removeEventListener('pointerdown',parar);};
  },[]);
  return null;
}
