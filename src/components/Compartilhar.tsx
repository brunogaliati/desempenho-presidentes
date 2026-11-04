"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { linkCompartilhado, type FiltrosCompartilhados } from "@/lib/compartilhamento";
import { useRecorteCompartilhado } from "./RecortesCompartilhaveis";

export function Compartilhar({mensagem,ancora,compacto=false,filtros={},contexto:contextoForcado}:{mensagem:string;ancora?:string;compacto?:boolean;filtros?:FiltrosCompartilhados;contexto?:string}) {
  const ctx=useRecorteCompartilhado(),botao=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),campo=useRef<HTMLInputElement>(null),id=useId();
  const [aberto,setAberto]=useState<{url:string;texto:string;top:number;left:number}|null>(null),[status,setStatus]=useState('');
  useLayoutEffect(()=>{if(!aberto||!menu.current)return;const top=Math.max(12,Math.min(aberto.top,innerHeight-menu.current.getBoundingClientRect().height-12));if(top!==aberto.top)setAberto({...aberto,top});},[aberto]);
  const fechar=()=>{setAberto(null);botao.current?.focus({preventScroll:true});};
  useEffect(()=>{if(!aberto)return;campo.current?.focus();const fora=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node)&&!botao.current?.contains(e.target as Node))setAberto(null);};const tecla=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setAberto(null);botao.current?.focus();}};const mover=()=>setAberto(null);document.addEventListener('pointerdown',fora);document.addEventListener('keydown',tecla);window.addEventListener('resize',mover);window.addEventListener('scroll',mover);return()=>{document.removeEventListener('pointerdown',fora);document.removeEventListener('keydown',tecla);window.removeEventListener('resize',mover);window.removeEventListener('scroll',mover);};},[aberto]);
  const abrir=()=>{
    if(aberto){fechar();return;}
    const contexto=ctx?.contexto(),url=linkCompartilhado(location.href,ctx?.registros??[],{...contexto?.filtros,...filtros},ancora);
    const descricao=contextoForcado??(contexto?.titulo||document.querySelector('main h1')?.textContent||document.title);
    const texto=mensagem+(descricao&&descricao!==mensagem?' · '+descricao:'');
    const r=botao.current!.getBoundingClientRect(),largura=Math.min(340,innerWidth-24),altura=Math.min(390,innerHeight-24);
    setStatus('');setAberto({url,texto,left:Math.max(12,Math.min(r.right-largura,innerWidth-largura-12)),top:r.bottom+altura+12<=innerHeight?r.bottom+8:Math.max(12,r.top-altura-8)});
  };
  const copiar=async(comTexto=false)=>{if(!aberto)return;try{await navigator.clipboard.writeText(comTexto?aberto.texto+'\n\n'+aberto.url:aberto.url);setStatus(comTexto?'Texto e link copiados':'Link copiado');}catch{campo.current?.focus();campo.current?.select();setStatus('Selecione e copie o link no campo acima.');}};
  const nativo=async()=>{if(!aberto)return;try{await navigator.share({title:aberto.texto,text:aberto.texto,url:aberto.url});setAberto(null);}catch(e){if((e as Error).name!=='AbortError')setStatus('Use Copiar link para compartilhar.');}};
  const links=aberto?[
    ['WhatsApp','https://api.whatsapp.com/send?text='+encodeURIComponent(aberto.texto+'\n\n'+aberto.url)],
    ['Telegram','https://t.me/share/url?url='+encodeURIComponent(aberto.url)+'&text='+encodeURIComponent(aberto.texto)],
    ['X','https://twitter.com/intent/tweet?text='+encodeURIComponent(aberto.texto)+'&url='+encodeURIComponent(aberto.url)],
    ['Facebook','https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(aberto.url)],
    ['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+encodeURIComponent(aberto.url)],
  ]:[];
  return <>
    <button ref={botao} type="button" className="compartilhar-gatilho" aria-label={'Compartilhar '+mensagem} aria-haspopup="dialog" aria-expanded={!!aberto} aria-controls={aberto?id:undefined} title={'Compartilhar '+mensagem} onClick={abrir}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-5-7 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>
      {!compacto&&<span>Compartilhar</span>}
    </button>
    {aberto&&createPortal(<div className="painel-governo compartilhar-portal"><div id={id} ref={menu} role="dialog" aria-label="Compartilhar recorte" className="vidro compartilhar-menu" style={{top:aberto.top,left:aberto.left}}>
      <div className="compartilhar-topo"><strong>Compartilhar recorte</strong><button type="button" aria-label="Fechar compartilhamento" onClick={fechar}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <p className="compartilhar-descricao">{aberto.texto}</p>
      <input ref={campo} aria-label="Link do recorte" readOnly value={aberto.url} onFocus={e=>e.currentTarget.select()}/>
      <div className="compartilhar-opcoes"><button type="button" onClick={()=>copiar()}>Copiar link</button>{typeof navigator.share==='function'?<button type="button" onClick={nativo}>Mais aplicativos</button>:<button type="button" onClick={()=>copiar(true)}>Copiar texto e link</button>}</div>
      <div className="compartilhar-plataformas">{links.map(([nome,href])=><a key={nome} href={href} target="_blank" rel="noopener noreferrer">{nome}</a>)}</div>
      <p className="compartilhar-nota">O link abre este dado com os filtros selecionados.</p><p role="status" className="compartilhar-status">{status}</p>
    </div></div>,document.body)}
  </>;
}
