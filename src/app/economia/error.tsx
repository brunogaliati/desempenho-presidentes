"use client";
import Link from "next/link";
import styles from "./indicador.module.css";
export default function ErroDados({reset}:{reset:()=>void}) {
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><header><h1>Não foi possível carregar os dados</h1><p>Ocorreu uma falha ao consultar esta página. Tente novamente ou escolha outro indicador.</p></header><section className="vidro"><div className="flex flex-wrap items-center gap-5"><button type="button" onClick={reset} className="min-h-11 rounded-xl border border-[var(--borda)] px-4 py-2">Tentar novamente</button><Link href="/explorar">Explorar dados</Link></div></section></main>;
}
