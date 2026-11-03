export default function CarregandoPainel() {
  return <main className="mx-auto max-w-7xl px-4 py-16" aria-busy="true"><p role="status">Carregando o painel com os dados oficiais…</p><div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-6" aria-hidden>{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 rounded-2xl" style={{ background: "var(--faixa-a)" }} />)}</div><div className="mt-6 h-96 rounded-2xl" style={{ background: "var(--faixa-a)" }} aria-hidden /></main>;
}
