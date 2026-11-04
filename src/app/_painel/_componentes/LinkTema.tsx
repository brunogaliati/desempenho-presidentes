"use client";
import Link, { useLinkStatus } from "next/link";
import { useRef } from "react";
import { createPortal } from "react-dom";
import CarregandoPainel, { type TemaPainel } from "./CarregandoPainel";

export function LinkTema({href,aba,rotulo,atual}:{href:string;aba:TemaPainel;rotulo:string;atual:boolean}) {
  return <Link href={href} aria-current={atual?'page':undefined} className="px-3 py-2"><Conteudo aba={aba} rotulo={rotulo}/></Link>;
}

function Conteudo({aba,rotulo}:{aba:TemaPainel;rotulo:string}) {
  const {pending}=useLinkStatus(),origem=useRef<HTMLSpanElement>(null);
  const painel=origem.current?.closest('.painel-governo');
  return <><span ref={origem} aria-busy={pending} data-troca-pendente={pending||undefined}>{rotulo}</span>{pending&&painel&&createPortal(<div className="painel-governo troca-aba" data-aba={aba}><CarregandoPainel aba={aba} embutido/></div>,painel)}</>;
}
