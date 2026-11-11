import { PainelPublico } from "@/app/PainelPublico";
import { metadataComRecorte, type Busca } from "@/app/_painel/_dados/metadataRecorte";
import { metadataPagina } from "@/lib/seo";
import { TEMAS_PAINEL } from "@/lib/temasPainel";
// A Economia foi a home até 11/11/2026; os links antigos dela chegam aqui pelo middleware (src/middleware.ts).
const tema=TEMAS_PAINEL.economia;
export async function generateMetadata({searchParams}:{searchParams:Promise<Busca>}) {
  return metadataComRecorte(metadataPagina(tema.titulo,tema.descricao,tema.caminho),tema.caminho,await searchParams);
}
export const revalidate=3600;
export default function Pagina() { return <PainelPublico tema="economia"/>; }
