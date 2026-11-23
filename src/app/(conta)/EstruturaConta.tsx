"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { Cabecalho } from "@/app/_painel/_componentes/Topo";
import { FiltroRefracao, useVidro } from "@/app/_painel/_componentes/Vidro";
import styles from "./conta.module.css";

/**
 * A moldura das páginas de conta: o mesmo topo, a mesma paisagem e o mesmo
 * rodapé das páginas públicas, sem o botão de compartilhar (não há o que
 * compartilhar num login) e sem nenhuma aba acesa.
 */
export function EstruturaConta({ children }: { children: React.ReactNode }) {
  const cabecalho = useRef<HTMLDivElement>(null);
  useVidro();
  useLayoutEffect(() => {
    const el = cabecalho.current;
    if (!el) return;
    const medir = () => el.parentElement?.style.setProperty("--altura-cabecalho", `${el.offsetHeight}px`);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`painel-governo ${styles.pagina}`} data-aba="economia">
      <div aria-hidden className="fundo-painel" />
      <FiltroRefracao />
      <div ref={cabecalho} className="painel-cabecalho">
        <Cabecalho aba="economia" semTemaAtivo publico aoTrocar={() => {}} mandato={null} />
      </div>
      <main className={styles.conteudo}>{children}</main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-6 gap-y-3 px-4 py-6 text-sm text-[var(--tinta-2)]">
        <Link href="/explorar">Explorar dados</Link>
        <Link href="/metodologia">Metodologia</Link>
        <Link href="/sobre">Sobre o projeto</Link>
        <Link href="/correcoes">Relatar um erro</Link>
      </footer>
    </div>
  );
}
