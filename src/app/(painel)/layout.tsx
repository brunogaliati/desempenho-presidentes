import { Suspense } from "react";
import { connection } from "next/server";
import { Retrato } from "@/components/Retrato";
import { carregarPainel } from "@/app/_painel/_dados/carregar";
import { Painel } from "@/app/_painel/_componentes/Painel";
import CarregandoRotaPainel from "@/app/_painel/_componentes/CarregandoRotaPainel";

async function Estrutura({children}:{children:React.ReactNode}) {
  // A URL inicial também fornece o recorte ao SSR do layout persistente.
  await connection();
  const {painel,presidente}=await carregarPainel();
  return <Painel dados={painel} retrato={<Retrato presidente={presidente} tamanho="p" prioridade/>}>{children}</Painel>;
}
export default function LayoutPainel({children}:{children:React.ReactNode}) {
  return <Suspense fallback={<CarregandoRotaPainel/>}><Estrutura>{children}</Estrutura></Suspense>;
}
