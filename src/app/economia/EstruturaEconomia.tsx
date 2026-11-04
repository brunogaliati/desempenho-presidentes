"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { Cabecalho } from "@/app/_painel/_componentes/Topo";
import { FiltroRefracao, useVidro } from "@/app/_painel/_componentes/Vidro";
import { buscarPaginaEconomia, PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";
import styles from "./indicador.module.css";
import { idsMunicipais } from "@/lib/indicadoresMunicipais";

export function EstruturaEconomia({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const presidentes = caminho.startsWith('/presidente/');
  const economia = caminho.startsWith('/economia');
  const atual = buscarPaginaEconomia(caminho.replace(/^\/economia\//, "").split("/"));
  const municipal=caminho.startsWith("/economia/municipios") || idsMunicipais.some(id=>caminho.startsWith(`/economia/${id}/`));
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
  return <div className={`painel-governo min-h-dvh px-3 pb-10 ${styles.estrutura}`} data-aba="economia" data-visual="governo-v1">
    <div aria-hidden className="fundo-painel" />
    <FiltroRefracao />
    <div ref={cabecalho} className="painel-cabecalho">
      <Cabecalho aba="economia" semTemaAtivo={!economia&&!presidentes} publico aoTrocar={() => {}} mandato={presidentes ?
        <nav aria-label="Presidentes" className={styles.indicadores}>{[['fhc','FHC'],['lula','Lula'],['dilma','Dilma'],['temer','Temer'],['bolsonaro','Bolsonaro']].map(([id,nome])=><Link key={id} href={`/presidente/${id}`} aria-current={caminho===`/presidente/${id}`?'page':undefined}>{nome}</Link>)}</nav>
        : !economia ? <nav aria-label="Sobre os dados" className={styles.indicadores}>{[['/metodologia','Metodologia'],['/sobre','Sobre o projeto'],['/correcoes','Relatar um erro']].map(([url,nome])=><Link key={url} href={url} aria-current={caminho===url?'page':undefined}>{nome}</Link>)}</nav>
        : <nav aria-label="Indicadores de economia" className={styles.indicadores}>
          {PAGINAS_ECONOMIA.map((p) => <Link key={p.slug} href={rotaEconomia(p)} aria-current={atual?.id === p.id ? "page" : undefined}>{p.rotulo}</Link>)}
          <Link href="/economia/municipios" aria-current={municipal?"page":undefined}>Municípios</Link>
        </nav>
      } />
    </div>
    {children}
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-3 px-4 py-6 text-sm text-[var(--tinta-2)]"><Link href="/economia">Economia</Link><Link href="/metodologia">Metodologia</Link><Link href="/sobre">Sobre o projeto</Link><Link href="/correcoes">Relatar um erro</Link></footer>
  </div>;
}
