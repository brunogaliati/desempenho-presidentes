import { PainelPublico, type ParametrosPainel } from "./PainelPublico";
import { metadataPagina } from "@/lib/seo";
import { Suspense } from "react";
import CarregandoPainel from "./_painel/_componentes/CarregandoPainel";

const titulo = "Desempenho do Governo: indicadores do Brasil e dos estados";
const descricao = "Explore os indicadores econômicos, compare mandatos desde o Plano Real e consulte dados oficiais do Brasil e dos estados.";

export const metadata = metadataPagina(titulo, descricao, "/");
export const revalidate = 3600;

export default function Home({ searchParams }: { searchParams: Promise<ParametrosPainel> }) {
  return <Suspense fallback={<CarregandoPainel />}><PainelPublico aba="economia" titulo={titulo} descricao={descricao} caminho="/" searchParams={searchParams} /></Suspense>;
}
