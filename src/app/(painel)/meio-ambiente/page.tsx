import { PainelPublico } from "@/app/PainelPublico";
import { metadataPagina } from "@/lib/seo";
import { TEMAS_PAINEL } from "@/lib/temasPainel";
const tema=TEMAS_PAINEL.ambiente;
export const metadata=metadataPagina(tema.titulo,tema.descricao,tema.caminho);
export const revalidate=3600;
export default function Pagina() { return <PainelPublico tema="ambiente"/>; }
