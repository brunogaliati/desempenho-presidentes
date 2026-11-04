import { permanentRedirect } from "next/navigation";
import { destinoPainel, type ParametrosLegadosPainel } from "@/lib/rotasPainel";

/** Compatibilidade com links compartilhados antes da promoção do painel. */
export default async function PainelAnterior({ searchParams }: { searchParams: Promise<ParametrosLegadosPainel> }) {
  permanentRedirect(destinoPainel(await searchParams));
}
