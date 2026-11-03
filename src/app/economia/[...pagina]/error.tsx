"use client";

export default function ErroIndicador({reset}:{reset:()=>void}) {
  return <main className="mx-auto max-w-3xl px-5 py-16"><h1 className="text-2xl font-semibold">Não foi possível carregar os dados</h1><p className="my-4">A fonte está temporariamente indisponível. Tente carregar a página novamente.</p><button onClick={reset} className="rounded-full border px-4 py-2 focus-visible:outline focus-visible:outline-2">Tentar novamente</button></main>;
}
