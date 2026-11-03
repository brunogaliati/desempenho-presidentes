"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { Leitura } from "../_dados/tipos";
import { CLASSES, formatar, type Regua } from "./formatos";
import { Selo } from "./Selo";

/**
 * Rever o mandato: arrastar ou tocar o tempo e ver o mapa mudar.
 *
 * É o equivalente da régua de horário de um painel de apuração, só que a noite
 * aqui dura quatro anos. A cor do mapa usa uma régua fixa para o período
 * inteiro (`reguaDeCor`), então escurecer ao tocar significa piorar de verdade.
 */

interface Props {
  leitura: Leitura;
  periodo: number;
  setPeriodo: Dispatch<SetStateAction<number>>;
  inicio?: number;
  ativo?: boolean;
}

export function ReguaTempo({ leitura, periodo, setPeriodo, inicio = 0, ativo = true }: Props) {
  const n = leitura.periodos.length;
  const [tocando, setTocando] = useState(false);

  // Trocar de leitura no meio da animação para tudo: a régua nova tem outro
  // número de períodos.
  useEffect(() => setTocando(false), [leitura.id, inicio, ativo]);

  useEffect(() => {
    if (!ativo || !tocando) return;
    // A volta inteira dura uns 12 segundos, seja de 8 semestres ou 48 meses.
    const intervalo = Math.max(220, Math.min(900, 12000 / (n - inicio)));
    const id = window.setInterval(() => setPeriodo((p) => Math.min(p + 1, n - 1)), intervalo);
    return () => window.clearInterval(id);
  }, [ativo, tocando, n, inicio, setPeriodo]);

  // Chegou ao fim: para. Fora do atualizador do estado, que não deve ter efeito.
  useEffect(() => {
    if (tocando && periodo >= n - 1) setTocando(false);
  }, [tocando, periodo, n]);

  if (n - inicio < 2) return null;

  const anos = leitura.periodos
    .map((p, i) => ({ ano: p.codigo.slice(0, 4), i }))
    .filter((p) => p.i >= inicio)
    .filter((p, k, lista) => k === 0 || p.ano !== lista[k - 1].ano)
    .filter((p, k, lista) => k > 0 || lista.length < 2 || lista[1].i - p.i >= (n - 1 - inicio) * 0.12);
  const pos = (i: number) => `${((i - inicio) / (n - 1 - inicio)) * 100}%`;
  const posse = leitura.indicePosse !== null && leitura.indicePosse >= inicio && leitura.indicePosse < n ? leitura.indicePosse : null;

  return (
    <div className="flex items-center gap-3" data-regua={leitura.id} data-periodo={leitura.periodos[periodo]?.codigo}>
      <button
        onClick={() => {
          if (!tocando && periodo >= n - 1) setPeriodo(inicio);
          setTocando((t) => !t);
        }}
        className="botao-liquido flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium"
        aria-label={tocando ? "Pausar" : "Reproduzir histórico"}
      >
        <span aria-hidden>{tocando ? "❚❚" : "▶"}</span>
        <span className="hidden sm:inline">{tocando ? "Pausar" : "Reproduzir histórico"}</span>
      </button>

      <div className="w-20 shrink-0 text-center">
        <p className="tabular text-sm font-semibold leading-tight">{leitura.periodos[periodo]?.rotulo}</p>
        {periodo === n - 1 && (
          <p className="mono text-[9px] uppercase tracking-wider" style={{ color: "var(--tinta-3)" }}>
            mais recente
          </p>
        )}
      </div>

      <div className="relative min-w-0 flex-1 pb-4 pt-1">
        {posse !== null && (
          <span
            className="mono pointer-events-none absolute -top-2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wider"
            style={{ left: pos(posse), color: "var(--tinta-2)" }}
          >
            posse
          </span>
        )}
        {posse !== null && (
          <span
            className="pointer-events-none absolute top-1 h-4 w-px"
            style={{ left: pos(posse), background: "var(--tinta-2)" }}
            aria-hidden
          />
        )}
        <input
          type="range"
          min={inicio}
          max={n - 1}
          step={1}
          value={periodo}
          onChange={(e) => {
            setTocando(false);
            setPeriodo(Number(e.target.value));
          }}
          aria-label="Período"
          aria-valuetext={leitura.periodos[periodo]?.extenso}
          className="faixa-tempo block w-full cursor-pointer"
          style={{ "--progresso": pos(periodo) } as React.CSSProperties}
        />
        {anos.map(({ ano, i }) => (
          <span
            key={ano}
            className="tabular pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px]"
            style={{ left: pos(i), color: "var(--tinta-3)" }}
          >
            {ano}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Legenda da cor do mapa: medida, extremos e as cinco classes. */
export function Legenda({
  titulo,
  exemplo,
  formato,
  escala,
  regua,
}: {
  titulo: string;
  exemplo: boolean;
  formato: Leitura["formato"];
  escala: Leitura["escala"];
  regua: Regua;
}) {
  return (
    <div className="text-xs" style={{ color: "var(--tinta-2)" }} data-legenda>
      <p className="font-semibold" style={{ color: "var(--tinta)" }}>
        {titulo}
        {exemplo && <Selo />}
      </p>
      <div className="tabular mt-1.5 flex items-center gap-2">
        <span>{formatar(regua.min, formato)}</span>
        <span className="flex gap-[2px]" aria-hidden>
          {Array.from({ length: CLASSES }, (_, k) => (
            <span
              key={k}
              className="block h-2.5 w-6 rounded-sm"
              style={{ background: `var(--${regua.rampa}-${k + 1})` }}
            />
          ))}
        </span>
        <span>{formatar(regua.max, formato)}</span>
      </div>
      {escala === "log" && (
        <p className="mt-1" style={{ color: "var(--tinta-3)" }}>
          escala logarítmica: cada passo multiplica
        </p>
      )}
    </div>
  );
}
