"use client";

import { useEffect, useRef } from "react";

/**
 * Faz um traço de SVG se desenhar da esquerda para a direita.
 *
 * Mede o caminho com `getTotalLength()` e escreve `stroke-dasharray` e
 * `stroke-dashoffset` em pixels reais.
 *
 * A versão anterior usava `pathLength={1}` com `strokeDasharray={1}`, contando
 * que o navegador normalizasse o comprimento. Ele não normalizou: o valor foi
 * tratado como 1 pixel, e a linha saía pontilhada de 1px em 1px, tão fina que
 * parecia não existir. Medir custa uma leitura de layout por gráfico e funciona
 * em qualquer proporção, inclusive quando o SVG é esticado só na horizontal.
 */
export function useDesenho<T extends SVGPathElement>(
  desenhar: boolean,
  ms = 900,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const comprimento = el.getTotalLength();
    if (!Number.isFinite(comprimento) || comprimento === 0) return;

    el.style.strokeDasharray = `${comprimento}`;

    if (!desenhar) {
      // Estado inicial sem transição, para não animar enquanto está escondido.
      el.style.transition = "none";
      el.style.strokeDashoffset = `${comprimento}`;
      return;
    }

    // Um quadro de intervalo garante que o navegador registre o estado inicial
    // antes da transição; sem isso ele funde os dois e não há animação.
    const id = requestAnimationFrame(() => {
      el.style.transition = `stroke-dashoffset ${ms}ms ease-out`;
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [desenhar, ms]);

  return ref;
}
