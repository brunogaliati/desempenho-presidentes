"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Avisa quando o elemento entra na tela pela primeira vez.
 *
 * Serve para as animações de entrada dos gráficos: um traço que se desenha
 * enquanto está fora da tela é trabalho perdido, e pior, o leitor chega depois
 * do fim da animação e vê só o resultado estático.
 *
 * Dispara uma vez só. Reanimar a cada rolagem transformaria a página num
 * piscar constante durante a leitura.
 */
export function useVisivel<T extends HTMLElement>(margem = "-10% 0px -10% 0px") {
  const ref = useRef<T | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visivel) return;

    // Quem pediu menos movimento recebe o estado final direto.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisivel(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { rootMargin: margem },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margem, visivel]);

  return { ref, visivel };
}
