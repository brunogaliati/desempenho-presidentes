"use client";
import Link from "next/link";
import styles from "@/app/economia/indicador.module.css";

export function ErroPagina({ reset, titulo = "Os dados não carregaram" }: { reset: () => void; titulo?: string }) {
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><header><h1>{titulo}</h1><p className="my-5 max-w-prose text-lg leading-relaxed">Não foi possível consultar a base neste momento. Tente novamente para abrir a página com os dados disponíveis.</p></header><section className="vidro" data-lustro="fixo"><h2>Continue explorando</h2><div className="mt-5 flex flex-wrap items-center gap-6"><button type="button" className="botao-liquido px-5 py-3" onClick={reset}>Tentar novamente</button><Link href="/">Voltar ao painel do Brasil</Link></div></section></main>;
}
