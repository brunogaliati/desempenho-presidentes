"use client";

import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { type CasaCongresso, type CotaDoAno, type IndiceCota, type PeriodoCota, HISTORICO, LEGISLATURA } from "./congressoModelo";
import { useJson } from "./useJson";

const anoValido = (v: unknown) => v === HISTORICO || v === LEGISLATURA || (typeof v === "number" && Number.isInteger(v) && v >= 1991 && v <= 2100);

/**
 * O índice da casa e o arquivo do período escolhido. Sem escolha, a legislatura inteira;
 * um ano escolhido vai no link (`r.congresso.ano`).
 */
export function useCotaDoAno(casa: CasaCongresso, historicoInicial = false) {
  const [periodo, setPeriodo] = useEstadoCompartilhavel<PeriodoCota>("congresso.ano", historicoInicial ? HISTORICO : LEGISLATURA, anoValido);
  const indice = useJson<IndiceCota>(`/painel/congresso/cota-${casa}.json`);
  const anos = indice.dados?.anos ?? [];
  // Antes de o índice chegar, confia no ano pedido; se ele não existir, volta para a legislatura.
  const foraCobertura = typeof periodo === "number" && !!indice.dados && !anos.includes(periodo);
  const cota = useJson<CotaDoAno>(foraCobertura ? null : `/painel/congresso/cota-${casa}-${periodo}.json`);
  const vazio: CotaDoAno | null = foraCobertura && indice.dados ? { casa, ano: periodo, coletadoEm: indice.dados.coletadoEm, ultimoMes: 0, categorias: [], mediaMes: Array(12).fill(0), pessoas: {}, semCobertura: true } : null;
  return { indice: indice.dados, cota: vazio ?? cota.dados, periodo, anos, setPeriodo, erro: indice.erro || (!foraCobertura && cota.erro) };
}
