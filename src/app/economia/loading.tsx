import styles from "./indicador.module.css";
export default function CarregandoDados() {
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`} aria-busy="true" aria-label="Carregando dados">
    <header className="motion-safe:animate-pulse"><div className="h-8 w-3/4 rounded bg-[var(--faixa-a)]"/><div className="mt-4 h-4 w-full rounded bg-[var(--faixa-a)]"/><div className="mt-2 h-4 w-2/3 rounded bg-[var(--faixa-a)]"/></header>
    <section className="vidro motion-safe:animate-pulse"><div className="h-6 w-1/2 rounded bg-[var(--faixa-a)]"/><div className="my-6 flex gap-3">{[0,1,2].map(i=><div key={i} className="h-11 flex-1 rounded-xl bg-[var(--faixa-a)]"/>)}</div><div className="h-64 rounded-xl bg-[var(--faixa-a)]"/></section>
    <span className="sr-only" role="status">Carregando referências e indicadores.</span>
  </main>;
}
