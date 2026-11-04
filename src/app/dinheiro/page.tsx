import { Suspense } from "react";
import CarregandoPainel from "../_painel/_componentes/CarregandoPainel";
import { PainelPublico } from "../PainelPublico";
import { metadataPagina } from "@/lib/seo";
const titulo='Dinheiro público: orçamento e transferências';
const descricao='Explore o orçamento por função e as transferências especiais, com dados do Tesouro Nacional, Siconfi e Transferegov.';
export const metadata=metadataPagina(titulo,descricao,'/dinheiro');
export const revalidate=3600;
export default function Dinheiro({searchParams}:{searchParams:Promise<{uf?:string|string[];mandato?:string|string[]}>}){return <Suspense fallback={<CarregandoPainel aba="dinheiro"/>}><PainelPublico aba="dinheiro" titulo={titulo} descricao={descricao} caminho="/dinheiro" searchParams={searchParams}/></Suspense>;}
