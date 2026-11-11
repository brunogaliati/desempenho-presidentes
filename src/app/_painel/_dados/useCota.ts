"use client";

import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { type CasaCongresso, type CotaDoAno, type IndiceCota, type PeriodoCota, LEGISLATURA } from "./congressoModelo";
import { useJson } from "./useJson";

const anoValido = (v: unknown) => v === null || (typeof v === "number" && Number.isInteger(v) && v >= 2000 && v <= 2100);

/**
 * O índice da casa e o arquivo do período escolhido. Sem escolha, a legislatura inteira;
 * um ano escolhido vai no link (`r.congresso.ano`).
 */
export function useCotaDoAno(casa: CasaCongresso) {
  const [anoPedido, setAno] = useEstadoCompartilhavel<number | null>("congresso.ano", null, anoValido);
  const indice = useJson<IndiceCota>(`/painel/congresso/cota-${casa}.json`);
  const anos = indice.dados?.anos ?? [];
  // Antes de o índice chegar, confia no ano pedido; se ele não existir, volta para a legislatura.
  const periodo: PeriodoCota = anoPedido !== null && (!indice.dados || anos.includes(anoPedido)) ? anoPedido : LEGISLATURA;
  const cota = useJson<CotaDoAno>(`/painel/congresso/cota-${casa}-${periodo}.json`);
  const setPeriodo = (p: PeriodoCota) => setAno(p === LEGISLATURA ? null : p);
  return { indice: indice.dados, cota: cota.dados, periodo, anos, setPeriodo, erro: indice.erro || cota.erro };
}
