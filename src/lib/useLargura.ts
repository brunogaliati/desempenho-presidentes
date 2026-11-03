"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Largura em pixels de um elemento, acompanhando redimensionamento.
 *
 * Existe porque espaçamento mínimo entre marcas é um problema em pixels, não em
 * porcentagem: um retrato ocupa 32px tanto numa régua de 900px quanto numa de
 * 330px, e uma folga fixa de 5% que resolve no desktop deixa os rostos
 * empilhados no celular. Medir é a única forma de acertar as duas.
 *
 * Devolve 0 até a primeira medição, para o render do servidor e o do cliente
 * baterem: com a largura ainda desconhecida a régua distribui sem afastar
 * ninguém, e o ajuste entra no primeiro quadro depois da montagem.
 */
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // A primeira medida é síncrona, não via observer. `ResizeObserver` entrega
    // pelo ciclo de quadros, que o navegador congela quando a aba está oculta:
    // numa aba em segundo plano a largura ficava em 0 para sempre e a régua
    // nunca afastava os rostos. Ler o retângulo aqui não depende de quadro.
    setLargura(el.getBoundingClientRect().width);

    const obs = new ResizeObserver(([e]) => {
      setLargura(e.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, largura };
}
