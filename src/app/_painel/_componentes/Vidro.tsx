"use client";

import { useEffect } from "react";

/**
 * Peças do vidro líquido (os estilos estão em `globals.css`, em `.vidro`).
 *
 * `FiltroRefracao` é o filtro SVG que entorta o fundo na beirada do vidro;
 * `useVidro` liga esse filtro onde ele funciona e faz o brilho acompanhar o
 * ponteiro; `Segmentos` reúne as opções num seletor de vidro.
 */

interface Opcao<T extends string> {
  id: T;
  rotulo: string;
  indisponivel?: boolean;
}

/**
 * Seletor de opções. `papel="radio"` para escolher o que o mapa desenha;
 * `papel="pagina"` para navegação, com `aria-current`.
 *
 * A opção escolhida é marcada pelo estado acessível, sem medição ou camada móvel.
 */
export function Segmentos<T extends string>({
  opcoes,
  ativo,
  aoEscolher,
  rotulo,
  papel = "radio",
  className = "",
  classeBotao = "px-3 py-1",
}: {
  opcoes: Opcao<T>[];
  ativo: T;
  aoEscolher: (id: T) => void;
  rotulo: string;
  papel?: "radio" | "pagina";
  className?: string;
  classeBotao?: string;
}) {
  return (
    <div
      className={`segmentos vidro relative flex gap-1 overflow-x-auto p-1 ${className}`}
      role={papel === "radio" ? "radiogroup" : undefined}
      aria-label={papel === "radio" ? rotulo : undefined}
      style={{ scrollbarWidth: "none" }}
    >
      {opcoes.map((o) => {
        const escolhida = o.id === ativo;
        return (
          <button
            key={o.id}
            type="button"
            data-opcao={o.id}
            disabled={o.indisponivel}
            onClick={() => aoEscolher(o.id)}
            {...(papel === "radio"
              ? { role: "radio", "aria-checked": escolhida }
              : { "aria-current": escolhida ? ("page" as const) : undefined })}
            className={`relative shrink-0 ${classeBotao}`}
          >
            {o.rotulo}{o.indisponivel && <span className="tema-em-breve">Em breve</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A lente da beirada, como mapa de deslocamento.
 *
 * Um retângulo um pouco menor que o vidro, desfocado, vira um relevo: plano
 * no miolo, em rampa perto das bordas. A inclinação dessa rampa (x no
 * vermelho, y no verde) diz para onde puxar cada ponto do fundo, e só a
 * beirada se mexe. Tudo em frações da caixa, para servir de botão a painel.
 *
 * Só o Chromium aplica filtro SVG em `backdrop-filter`; nos outros, a classe
 * `refrata` não entra e o vidro fica só fosco.
 */
export function FiltroRefracao() {
  const caixa = { x: 0, y: 0, width: 1, height: 1 };
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <filter id="refracao" {...caixa} primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
        <feFlood floodColor="#fff" x={0.05} y={0.05} width={0.9} height={0.9} result="miolo" />
        <feGaussianBlur in="miolo" stdDeviation={0.03} {...caixa} result="borda" />
        <feColorMatrix in="borda" type="matrix" values="0 0 0 1 0  0 0 0 1 0  0 0 0 0 0  0 0 0 0 1" {...caixa} result="relevo" />
        <feConvolveMatrix in="relevo" order="9 1" kernelMatrix="-1 0 0 0 0 0 0 0 1" divisor={0.6} bias={0.5} preserveAlpha edgeMode="duplicate" {...caixa} result="dx" />
        <feConvolveMatrix in="relevo" order="1 9" kernelMatrix="-1 0 0 0 0 0 0 0 1" divisor={0.6} bias={0.5} preserveAlpha edgeMode="duplicate" {...caixa} result="dy" />
        <feColorMatrix in="dx" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0 1" result="vermelho" />
        <feColorMatrix in="dy" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 0 1" result="verde" />
        <feComposite in="vermelho" in2="verde" operator="arithmetic" k2={1} k3={1} result="mapa" />
        <feDisplacementMap in="SourceGraphic" in2="mapa" scale={0.06} xChannelSelector="R" yChannelSelector="G" {...caixa} />
      </filter>
    </svg>
  );
}

/**
 * Liga o vidro: a refração onde o navegador sabe desenhá-la e o brilho que
 * segue o ponteiro. Um ouvinte só para a página acha o vidro sob o ponteiro
 * e passa a posição em `--mx` e `--my`; no toque, o vidro fica com o lustro
 * fixo.
 */
export function useVidro() {
  useEffect(() => {
    // `userAgentData` só existe em HTTPS; o "Chrome/" do user agent cobre
    // Chrome, Edge e Opera (o Chrome do iPhone é WebKit e diz "CriOS").
    const raiz = document.documentElement;
    if (/\bChrome\/\d/.test(navigator.userAgent)) raiz.classList.add("refrata");
    return () => raiz.classList.remove("refrata");
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    let ultimo: HTMLElement | null = null;
    const soltar = () => {
      ultimo?.style.removeProperty("--mx");
      ultimo?.style.removeProperty("--my");
      ultimo = null;
    };
    const mover = (e: PointerEvent) => {
      const vidro = e.target instanceof Element ? e.target.closest<HTMLElement>(".vidro") : null;
      // `data-lustro="fixo"`: painel grande demais para redesenhar o reflexo a cada movimento.
      const alvo = vidro?.dataset.lustro === "fixo" ? null : vidro;
      if (alvo !== ultimo) soltar();
      if (!alvo) return;
      ultimo = alvo;
      const b = alvo.getBoundingClientRect();
      alvo.style.setProperty("--mx", `${e.clientX - b.left}px`);
      alvo.style.setProperty("--my", `${e.clientY - b.top}px`);
    };
    document.addEventListener("pointermove", mover, { passive: true });
    document.documentElement.addEventListener("pointerleave", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.documentElement.removeEventListener("pointerleave", soltar);
      soltar();
    };
  }, []);
}
