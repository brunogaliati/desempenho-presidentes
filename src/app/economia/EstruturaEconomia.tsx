"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Cabecalho } from "@/app/_painel/_componentes/Topo";
import { FiltroRefracao, useVidro } from "@/app/_painel/_componentes/Vidro";
import { Compartilhar } from "@/components/Compartilhar";
import styles from "./indicador.module.css";

import { RecortesCompartilhaveis } from "@/components/RecortesCompartilhaveis";
import { DefinirFrase } from "@/components/FraseDaPagina";

export function EstruturaEconomia({ children }: { children: React.ReactNode }) {
  const [frase, setFrase] = useState<string | null>(null);
  const caminho = usePathname();
  const institucional = ["/metodologia", "/sobre", "/correcoes"].includes(caminho);
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
  return <RecortesCompartilhaveis><DefinirFrase.Provider value={setFrase}><div className={`painel-governo min-h-dvh px-3 pb-10 ${styles.estrutura}`} data-aba="economia" data-visual="governo-v1">
    <div aria-hidden className="fundo-painel" />
    <FiltroRefracao />
    <div ref={cabecalho} className="painel-cabecalho">
      <Cabecalho aba="economia" semTemaAtivo explorarAtivo={!institucional} publico aoTrocar={() => {}} mandato={null}/>
    </div>
    <div className={`${styles.contexto} ${!institucional?styles.compartilharPagina:""}`}>
      {institucional&&<nav aria-label="Sobre os dados">
        {[["/metodologia","Metodologia"],["/sobre","Sobre o projeto"],["/correcoes","Relatar um erro"]].map(([url,nome])=><Link key={url} href={url} aria-current={caminho===url?"page":undefined}>{nome}</Link>)}
      </nav>}
      <Compartilhar mensagem={frase ?? "Dados do Desempenho do Governo"} contexto={frase ? "" : undefined} compacto/>
    </div>
    {children}
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-4 py-6 text-sm text-[var(--tinta-2)]"><Link href="/explorar">Explorar dados</Link><Link href="/metodologia">Metodologia</Link><Link href="/sobre">Sobre o projeto</Link><Link href="/correcoes">Relatar um erro</Link></footer>
  </div></DefinirFrase.Provider></RecortesCompartilhaveis>;
}
