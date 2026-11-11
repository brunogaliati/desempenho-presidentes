"use client";
import Link, { useLinkStatus } from "next/link";
import { useRef } from "react";
import { createPortal } from "react-dom";
import CarregandoPainel, { type TemaPainel } from "./CarregandoPainel";

export function LinkTema({href,aba,rotulo,curto,atual}:{href:string;aba:TemaPainel;rotulo:string;curto?:string;atual:boolean}) {
  return <Link href={href} scroll={false} onNavigate={()=>window.scrollTo({top:0,behavior:"instant"})} aria-current={atual?'page':undefined} className="px-3 py-2"><Conteudo aba={aba} rotulo={rotulo} curto={curto}/></Link>;
}

function Conteudo({aba,rotulo,curto}:{aba:TemaPainel;rotulo:string;curto?:string}) {
  const {pending}=useLinkStatus(),origem=useRef<HTMLSpanElement>(null);
  const painel=origem.current?.closest('.painel-governo');
  return <><span ref={origem} aria-busy={pending} data-troca-pendente={pending||undefined}>{curto?<><span className="rotulo-tema-longo">{rotulo}</span><span className="rotulo-tema-curto" aria-hidden="true">{curto}</span></>:rotulo}</span>{pending&&painel&&createPortal(<div className="painel-governo troca-aba" data-aba={aba}><CarregandoPainel aba={aba} embutido/></div>,painel)}</>;
}
