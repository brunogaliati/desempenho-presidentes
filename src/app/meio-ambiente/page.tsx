import { Suspense } from "react";
import CarregandoPainel from "../_painel/_componentes/CarregandoPainel";
import { PainelPublico } from "../PainelPublico";
import { metadataPagina } from "@/lib/seo";
const titulo='Meio ambiente: desmatamento, queimadas e fiscalização';
const descricao='Explore dados do INPE e do Ibama sobre desmatamento, focos de calor e fiscalização ambiental no Brasil e nos estados.';
export const metadata=metadataPagina(titulo,descricao,'/meio-ambiente');
export const revalidate=3600;
export default function Ambiente({searchParams}:{searchParams:Promise<{uf?:string|string[];mandato?:string|string[]}>}){return <Suspense fallback={<CarregandoPainel aba="ambiente"/>}><PainelPublico aba="ambiente" titulo={titulo} descricao={descricao} caminho="/meio-ambiente" searchParams={searchParams}/></Suspense>;}
