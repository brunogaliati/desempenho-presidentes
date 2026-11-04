"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./SeletorDados.module.css";

export interface OpcaoDado { valor: string; rotulo: string }

/** Um único controle para referências da fonte, medidas e territórios. */
export function SeletorDados({ rotulo, valor, opcoes, aoEscolher }: {
  rotulo: string; valor: string; opcoes: OpcaoDado[]; aoEscolher: (valor: string) => void;
}) {
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState("");
  const raiz = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  const id = useId(), labelId = `${id}-rotulo`;
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visiveis = opcoes.filter(o => normalizar(o.rotulo).includes(normalizar(busca)));
  const fechar = () => { setAberto(false); setBusca(""); };
  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
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
  return <div className={styles.campo} ref={raiz} onKeyDown={teclado} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) fechar(); }}>
    <span id={labelId} className={styles.rotulo}>{rotulo}</span>
    <button ref={gatilho} type="button" className={styles.gatilho} aria-label={`${rotulo}: ${opcoes.find(o => o.valor === valor)?.rotulo ?? "Escolher"}`} aria-haspopup="listbox" aria-expanded={aberto} aria-controls={aberto ? id : undefined} disabled={!opcoes.length} onClick={() => aberto ? fechar() : setAberto(true)}>
      <span>{opcoes.find(o => o.valor === valor)?.rotulo ?? "Escolher"}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {aberto && <div className={styles.menu}>
      {opcoes.length > 12 && <input className={styles.busca} type="search" aria-label={`Buscar em ${rotulo.toLowerCase()}`} placeholder="Buscar nome ou ano" value={busca} onChange={e => setBusca(e.target.value)}/>}
      <div id={id} role="listbox" aria-labelledby={labelId} className={styles.lista}>
        {visiveis.map(o => <button key={o.valor} type="button" role="option" tabIndex={-1} aria-selected={o.valor === valor} className={styles.opcao} onClick={() => { aoEscolher(o.valor); fechar(); gatilho.current?.focus(); }}>{o.rotulo}{o.valor === valor && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m5 12 4 4 10-10"/></svg>}</button>)}
      </div>
      {!visiveis.length && <p role="status" className={styles.vazio}>Nenhuma referência encontrada.</p>}
    </div>}
  </div>;
}
