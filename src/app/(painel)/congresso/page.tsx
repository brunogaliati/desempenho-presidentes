import { metadataPagina } from "@/lib/seo";
import { TEMAS_PAINEL } from "@/lib/temasPainel";

const tema = TEMAS_PAINEL.congresso;
export const metadata = metadataPagina(tema.titulo, tema.descricao, tema.caminho);
export default function Congresso() { return null; }
