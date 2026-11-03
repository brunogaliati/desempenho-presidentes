"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { Cabecalho } from "@/app/prototipo/_componentes/Topo";
import { FiltroRefracao, useVidro } from "@/app/prototipo/_componentes/Vidro";
import { buscarPaginaEconomia, PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";
import styles from "./indicador.module.css";

export function EstruturaEconomia({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const atual = buscarPaginaEconomia(caminho.replace(/^\/economia\//, "").split("/"));
  const router = useRouter();
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
  return <div className={`painel-prototipo min-h-dvh px-3 pb-10 ${styles.estrutura}`} data-aba="economia">
    <div aria-hidden className="fundo-prototipo" />
    <FiltroRefracao />
    <div ref={cabecalho} className="prototipo-cabecalho">
      <Cabecalho aba="economia" aoTrocar={(aba) => router.push(`/prototipo${aba === "economia" ? "" : `?aba=${aba}`}`)} mandato={
        <nav aria-label="Indicadores de economia" className={styles.indicadores}>
          {PAGINAS_ECONOMIA.map((p) => <Link key={p.slug} href={rotaEconomia(p)} aria-current={atual?.id === p.id ? "page" : undefined}>{p.rotulo}</Link>)}
        </nav>
      } />
    </div>
    {children}
  </div>;
}
