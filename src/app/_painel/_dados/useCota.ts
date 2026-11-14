"use client";

import { useMemo } from "react";

import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { type CasaCongresso, type CotaDaPessoa, type CotaDoAno, type IndiceCota, type PeriodoCota, type ResumoCota, HISTORICO, LEGISLATURA } from "./congressoModelo";
import { useJson } from "./useJson";

const anoValido = (v: unknown) => v === HISTORICO || v === LEGISLATURA || (typeof v === "number" && Number.isInteger(v) && v >= 1991 && v <= 2100);

/** O período escolhido (no link, `r.congresso.ano`), o índice da casa e se o ano pedido está fora da fonte. */
function usePeriodoDaCota(casa: CasaCongresso, inicial: PeriodoCota) {
  const [periodo, setPeriodo] = useEstadoCompartilhavel<PeriodoCota>("congresso.ano", inicial, anoValido);
  const indice = useJson<IndiceCota>(`/painel/congresso/cota-${casa}.json`);
  const anos = indice.dados?.anos ?? [];
  // Antes de o índice chegar, confia no ano pedido; se ele não existir, volta para a legislatura.
  const foraCobertura = typeof periodo === "number" && !!indice.dados && !anos.includes(periodo);
  const vazio: CotaDoAno | null = foraCobertura && indice.dados ? { casa, ano: periodo, coletadoEm: indice.dados.coletadoEm, ultimoMes: 0, categorias: [], mediaMes: Array(12).fill(0), pessoas: {}, semCobertura: true } : null;
  return { periodo, setPeriodo, indice, anos, foraCobertura, vazio };
}

/**
 * O índice da casa e o arquivo do período escolhido, com todo mundo. É o da aba Congresso, que
 * compara todos. Sem escolha, a legislatura inteira.
 */
export function useCotaDoAno(casa: CasaCongresso) {
  const { periodo, setPeriodo, indice, anos, foraCobertura, vazio } = usePeriodoDaCota(casa, LEGISLATURA);
  const cota = useJson<CotaDoAno>(foraCobertura ? null : `/painel/congresso/cota-${casa}-${periodo}.json`);
  return { indice: indice.dados, cota: vazio ?? cota.dados, periodo, anos, setPeriodo, erro: indice.erro || (!foraCobertura && cota.erro) };
}

/**
 * A cota na página de um parlamentar, que abre no histórico: o resumo do período (média por mês
 * e total de cada um) e o arquivo da pessoa, com todos os períodos dela. Uns 6 KB em gzip, no
 * lugar dos 228 KB do histórico com a série de todos os 513 deputados (`scripts/dividir-cota.mjs`).
 *
 * Devolve o mesmo formato de `useCotaDoAno`. Os outros parlamentares vêm só com o total (`t`),
 * que é o que a posição e a bancada leem; meses, categorias e fornecedores, só os da pessoa.
 * Trocar de período baixa só o resumo novo: o arquivo da pessoa já tem todos.
 */
export function useCotaDaPessoa(casa: CasaCongresso, id: number) {
  const { periodo, setPeriodo, indice, anos, foraCobertura, vazio } = usePeriodoDaCota(casa, HISTORICO);
  const resumo = useJson<ResumoCota>(foraCobertura ? null : `/painel/congresso/cota-${casa}-${periodo}-resumo.json`);
  const propria = useJson<CotaDaPessoa>(`/painel/congresso/cota/${casa}/${id}.json`);
  const cota = useMemo<CotaDoAno | null>(() => {
    if (!resumo.dados || !propria.dados) return null;
    const { totais, ...doPeriodo } = resumo.dados;
    const pessoas: CotaDoAno["pessoas"] = Object.fromEntries(Object.entries(totais).map(([outro, t]) => [outro, { t, n: 0, m: [], c: [], f: [] }]));
    const { categorias = [], ...gasto } = propria.dados.periodos[String(resumo.dados.ano)] ?? {};
    if ("t" in gasto) pessoas[id] = gasto;
    return { ...doPeriodo, categorias, pessoas };
  }, [resumo.dados, propria.dados, id]);
  return { indice: indice.dados, cota: vazio ?? cota, periodo, anos, setPeriodo, erro: indice.erro || propria.erro || (!foraCobertura && resumo.erro) };
}
