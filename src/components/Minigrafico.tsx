"use client";

import { useMemo } from "react";

import { useDesenho } from "@/lib/useDesenho";
import { useVisivel } from "@/lib/useVisivel";
import type { Serie } from "@/types/dados";

/**
 * A forma de um indicador dentro de um período, em miniatura.
 *
 * Existe porque a página do presidente era só número solto: "+3,09 pontos por
 * ano" não diz se a dívida subiu em linha reta, deu um salto na pandemia ou
 * caiu antes de voltar. A silhueta responde isso antes de qualquer leitura.
 *
 * Sem eixo, sem grade e sem rótulo de propósito. Os valores das pontas já
 * estão no cartão, e repeti-los aqui competiria com o número principal. Quem
 * quiser o detalhe expande para o gráfico inteiro.
 */

interface Props {
  /** Série já recortada no período que se quer mostrar. */
  serie: Serie;
  altura?: number;
  cor?: string;
}

export function Minigrafico({ serie, altura = 34, cor }: Props) {
  const { ref, visivel } = useVisivel<HTMLSpanElement>();
  const refTraco = useDesenho<SVGPathElement>(visivel);

  const pontos = useMemo(
    () => serie.valores.map((v) => ({ v })),
    [serie],
  );

  if (pontos.length < 2) return null;

  // Proporção próxima da largura real do cartão, para o SVG escalar
  // uniformemente e ainda preencher a linha. Ver o comentário da animação.
  const L = 400;
  const A = altura;
  const vs = pontos.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const faixa = max - min || 1;

  // Uma folga vertical impede que o extremo encoste na borda e pareça cortado.
  const y = (v: number) => A - 3 - ((v - min) / faixa) * (A - 6);
  const x = (i: number) => (i / (pontos.length - 1)) * L;

  const caminho = pontos
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(" ");

  const traco = cor ?? "var(--serie)";

  return (
    <span ref={ref} className="mt-2 block">
      {/*
        Sem `preserveAspectRatio="none"`.

        Esticar só na horizontal fazia o navegador errar o comprimento do
        traço, e a animação de desenho saía pontilhada ou não aparecia. Foram
        duas tentativas de contornar (tirar `vectorEffect`, revelar por
        máscara) antes de atacar a causa: com escala uniforme, a mesma técnica
        que já funciona no gráfico grande funciona aqui. O `viewBox` largo
        deixa a proporção perto da do cartão, então quase não sobra margem.
      */}
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Evolução de ${serie.nome} no período`}
      >
        <path
          ref={refTraco}
          d={caminho}
          fill="none"
          stroke={traco}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={L}
          cy={y(pontos[pontos.length - 1].v)}
          r={3}
          fill={traco}
          style={{
            opacity: visivel ? 1 : 0,
            transition: "opacity 300ms ease-out 800ms",
          }}
        />
      </svg>
    </span>
  );
}
