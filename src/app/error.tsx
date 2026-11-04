"use client";

export default function ErroPainel({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-24"><p className="text-sm" style={{ color: "var(--serie)" }}>Economia · Dados oficiais</p><h1 className="mt-3 text-3xl font-semibold">Os dados não carregaram.</h1><p className="my-6" style={{ color: "var(--tinta-2)" }}>Não foi possível consultar a base neste momento. Tente novamente para abrir o painel com os dados disponíveis.</p><button className="rounded-lg border px-4 py-3" onClick={reset}>Tentar novamente</button></main>;
}
