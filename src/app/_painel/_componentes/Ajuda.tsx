"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import s from "./Ajuda.module.css";

/**
 * Um "?" que guarda a explicação de um painel, para o texto não tomar o lugar dos números.
 * Passar o mouse abre o balão e tirar fecha; clicar (ou tocar, no celular) deixa aberto até Esc,
 * um clique fora ou outro clique no "?". O balão vai para a camada de cima do navegador
 * (`popover`), então a rolagem do painel não o corta; fica abaixo do "?" (acima, se não couber)
 * e acompanha a rolagem da página.
 */
export function Ajuda({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const id = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const fixo = useRef(false);
  const espera = useRef<number | undefined>(undefined);
  // Os ids só existem com o balão aberto: o servidor e o navegador montam árvores um pouco
  // diferentes acima daqui, o `useId` muda, e um id no HTML inicial dava aviso de hidratação.

  const posicionar = () => {
    const b = botao.current, p = balao.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const largura = Math.min(380, window.innerWidth - 16);
    p.style.width = `${largura}px`;
    p.style.left = `${Math.min(Math.max(8, r.left - 16), window.innerWidth - largura - 8)}px`;
    const alto = p.offsetHeight;
    const cabeAbaixo = r.bottom + 8 + alto <= window.innerHeight - 8;
    p.style.top = `${cabeAbaixo || r.top - 8 - alto < 8 ? r.bottom + 8 : r.top - 8 - alto}px`;
  };
  const abrir = () => {
    window.clearTimeout(espera.current);
    const p = balao.current;
    if (!p) return;
    if (!p.matches(":popover-open")) p.showPopover();
    posicionar();
    setAberto(true);
  };
  const fechar = () => {
    window.clearTimeout(espera.current);
    fixo.current = false;
    if (balao.current?.matches(":popover-open")) balao.current.hidePopover();
    setAberto(false);
  };
  // Tirar o mouse fecha com uma folga, para dar tempo de chegar ao balão.
  const fecharDepois = () => {
    window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => { if (!fixo.current) fechar(); }, 160);
  };

  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { fechar(); botao.current?.focus(); } };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !balao.current?.contains(alvo)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora);
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);
  useEffect(() => () => window.clearTimeout(espera.current), []);

  return <>
    <button ref={botao} type="button" className={s.botao} aria-label={rotulo} aria-expanded={aberto} aria-controls={aberto ? id : undefined}
      onClick={() => { if (aberto && fixo.current) fechar(); else { fixo.current = true; abrir(); } }}
      onPointerEnter={e => { if (e.pointerType === "mouse") abrir(); }}
      onPointerLeave={e => { if (e.pointerType === "mouse") fecharDepois(); }}>?</button>
    <div ref={balao} id={aberto ? id : undefined} popover="manual" className={s.balao} role="note" aria-label={rotulo}
      onPointerEnter={() => window.clearTimeout(espera.current)} onPointerLeave={e => { if (e.pointerType === "mouse") fecharDepois(); }}>
      {children}
    </div>
  </>;
}
