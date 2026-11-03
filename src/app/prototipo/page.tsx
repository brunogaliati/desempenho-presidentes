import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Retrato } from "@/components/Retrato";

import { carregarPainel } from "./_dados/carregar";
import type { AbaId } from "./_dados/tipos";
import { Painel } from "./_componentes/Painel";

/**
 * Protótipo da nova home: o governo atual num painel, um tema por aba.
 *
 * Fora da busca enquanto o painel é preparado para publicação.
 */

export const metadata: Metadata = {
  title: "Protótipo · O governo atual",
  robots: { index: false, follow: false },
};

const ABAS: AbaId[] = ["economia", "ambiente", "dinheiro"];
/** Nomes antigos de aba que ainda chegam por link. */
const APELIDOS: Record<string, AbaId> = { queimadas: "ambiente" };

// Só o protótipo usa a Geist por enquanto; o resto do site segue na fonte do
// sistema. A mono vai nas datas e rótulos curtos (classe `.mono`).
const sans = Geist({ subsets: ["latin"], variable: "--fonte-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--fonte-mono" });

export default async function Prototipo({
  searchParams,
}: {
  searchParams: Promise<{ uf?: string | string[]; aba?: string | string[]; visao?: string | string[]; mandato?: string | string[] }>;
}) {
  const [params, { painel, presidente }] = await Promise.all([searchParams, carregarPainel()]);
  // `?uf=SP&uf=PA` chega como lista; vale o primeiro.
  const uf = [params.uf].flat()[0];
  const aba = [params.aba].flat()[0];
  const ufInicial = painel.ufs.find((u) => u.sigla === uf?.toUpperCase())?.sigla ?? null;
  // O mercado virou painéis do terminal da economia: `?aba=mercado` antigo cai nela.
  // Queimadas virou Meio ambiente: `?aba=queimadas` cai nele.
  const pedida = (aba && APELIDOS[aba]) ?? aba;
  const abaInicial = ABAS.includes(pedida as AbaId) ? (pedida as AbaId) : "economia";
  // Link com um mandato que não existe abre o atual (`recortarAoMandato`).
  const mandatoInicial = [params.mandato].flat()[0] ?? null;

  return (
    <div className={`${sans.variable} ${mono.variable} ${sans.className}`}>
      <Painel
        dados={painel}
        abaInicial={abaInicial}
        ufInicial={ufInicial}
        mandatoInicial={mandatoInicial}
        retrato={<Retrato presidente={presidente} tamanho="p" prioridade />}
      />
    </div>
  );
}
