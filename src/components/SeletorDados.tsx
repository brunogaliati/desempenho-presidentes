"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import styles from "./SeletorDados.module.css";

export interface OpcaoDado { valor: string; rotulo: string }

/** Um único controle para referências da fonte, medidas e territórios. */
export function SeletorDados({ rotulo, valor, opcoes, aoEscolher, rotuloFechado, alinharFim=false, placeholderBusca="Buscar nome ou ano", compacto=false, rotuloOculto=false }: {
  rotulo: string; valor: string; opcoes: OpcaoDado[]; aoEscolher: (valor: string) => void; rotuloFechado?:string; alinharFim?:boolean; placeholderBusca?:string;
  /** Pílula no meio de uma frase: o rótulo fica só para o leitor de tela e o menu abre sob o ancestral posicionado. */
  compacto?: boolean;
  /** O rótulo fica só para o leitor de tela, quando a página já mostra o seu ao lado. */
  rotuloOculto?: boolean;
}) {
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState("");
  const [acima,setAcima]=useState(false);
  // O lado pedido (`alinharFim`), a não ser que o menu saia da tela por ele e caiba pelo outro.
  const [fim, setFim] = useState(alinharFim);
  const raiz = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!aberto || compacto) return;
    const campo = raiz.current?.getBoundingClientRect(), largura = menu.current?.offsetWidth;
    if (!campo || !largura) return;
    const cabeNoInicio = campo.left + largura <= innerWidth - 8, cabeNoFim = campo.right - largura >= 8;
    setFim(alinharFim ? cabeNoFim || !cabeNoInicio : !cabeNoInicio && cabeNoFim);
  }, [aberto, alinharFim, compacto]);
  // O id só vai para a lista, que nasce no navegador. Dentro do painel o `useId` do servidor e o do
  // navegador não batem (as abas entram por `dynamic`): um id no rótulo, que vem do servidor,
  // apontaria para o nada.
  const id = useId();
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visiveis = opcoes.filter(o => normalizar(o.rotulo).includes(normalizar(busca)));
  const fechar = () => { setAberto(false); setBusca(""); };
  useEffect(() => {
    if (!aberto) return;
    const selecionada=raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    selecionada?.focus({ preventScroll: true });
    if(selecionada?.parentElement)selecionada.parentElement.scrollTop=selecionada.offsetTop-selecionada.parentElement.offsetTop;
    const rect=raiz.current?.getBoundingClientRect();
    if(rect)setAcima(innerHeight-rect.bottom<320&&rect.top>innerHeight-rect.bottom);
    const fora = (e: PointerEvent) => { if (e.target instanceof Node && !raiz.current?.contains(e.target)) { setAberto(false); setBusca(""); } };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);
  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && aberto) { e.preventDefault(); e.stopPropagation(); fechar(); gatilho.current?.focus(); }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && !(e.target instanceof HTMLInputElement && ["Home", "End"].includes(e.key))) {
      e.preventDefault();
      if (!aberto) { setAberto(true); return; }
      const itens = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
      if (!itens.length) return;
      const i = itens.findIndex(o => o === document.activeElement);
      itens[e.key === "Home" ? 0 : e.key === "End" ? itens.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length]?.focus();
    }
  };
  return <div className={`${styles.campo} ${compacto ? styles.compacto : ""}`} ref={raiz} onKeyDown={teclado} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) fechar(); }}>
    <span className={`${styles.rotulo} ${rotuloOculto ? styles.rotuloOculto : ""}`}>{rotulo}</span>
    <button ref={gatilho} type="button" className={styles.gatilho} aria-label={`${rotulo}: ${opcoes.find(o => o.valor === valor)?.rotulo ?? "Escolher"}`} aria-haspopup="listbox" aria-expanded={aberto} aria-controls={aberto ? id : undefined} disabled={!opcoes.length} onClick={() => aberto ? fechar() : setAberto(true)}>
      <span>{rotuloFechado??opcoes.find(o => o.valor === valor)?.rotulo ?? "Escolher"}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {aberto && <div ref={menu} className={`${styles.menu} ${(compacto ? alinharFim : fim)?styles.menuFim:""} ${acima?styles.menuAcima:""}`}>
      {opcoes.length > 12 && <input className={styles.busca} type="search" aria-label={`Buscar em ${rotulo.toLowerCase()}`} placeholder={placeholderBusca} value={busca} onChange={e => setBusca(e.target.value)}/>}
      <div id={id} role="listbox" aria-label={rotulo} className={styles.lista}>
        {visiveis.map(o => <button key={o.valor} type="button" role="option" tabIndex={-1} aria-selected={o.valor === valor} className={styles.opcao} onClick={() => { aoEscolher(o.valor); fechar(); gatilho.current?.focus(); }}>{o.rotulo}{o.valor === valor && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m5 12 4 4 10-10"/></svg>}</button>)}
      </div>
      {!visiveis.length && <p role="status" className={styles.vazio}>Nenhuma referência encontrada.</p>}
    </div>}
  </div>;
}
