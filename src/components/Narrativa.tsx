"use client";

import { useEffect, useRef, useState } from "react";

import { GraficoTempo } from "@/components/GraficoTempo";
import { Retrato } from "@/components/Retrato";
import { SERIES_UI_POR_ID } from "@/lib/registroSeries";
import type { DadosSite } from "@/types/dados";

/**
 * O gráfico que atravessa a página.
 *
 * Em vez de uma seção por gráfico, um gráfico só fica preso na tela e se
 * reenquadra conforme o leitor rola: troca de série, destaca um mandato,
 * recorta o período. O leitor nunca "muda de gráfico" — vê o mesmo dado sendo
 * reenquadrado, que é justamente o argumento do site.
 */

export interface Ato {
  id: string;
  serieId: string;
  destaque?: string | null;
  recorte?: string | null;
  titulo: string;
  texto: React.ReactNode;
  /** Número-manchete da seção, em corpo grande. */
  numero?: string;
  /** O que aquele número significa, numa linha. */
  numeroLegenda?: string;
}

interface Props {
  dados: DadosSite;
  atos: Ato[];
}

export function Narrativa({ dados, atos }: Props) {
  const [ativo, setAtivo] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Manda no gráfico a seção cujo centro está mais perto da linha de leitura
    // (40% da altura da tela).
    //
    // A primeira versão usava IntersectionObserver ordenando por
    // `intersectionRatio`, e isso escolhia errado: a razão é relativa ao
    // tamanho do próprio elemento, então uma seção curta atravessando a faixa
    // ganhava de uma seção alta que ocupava a tela inteira. O resultado era o
    // gráfico destacar Bolsonaro enquanto o leitor estava no texto sobre Lula.
    let pendente = false;

    const avaliar = () => {
      pendente = false;
      const linha = window.innerHeight * 0.4;
      let melhor = 0;
      let menorDist = Infinity;

      refs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.top + r.height / 2 - linha);
        if (dist < menorDist) {
          menorDist = dist;
          melhor = i;
        }
      });

      setAtivo(melhor);
    };

    const aoRolar = () => {
      if (pendente) return;
      pendente = true;
      requestAnimationFrame(avaliar);
    };

    avaliar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar);
    return () => {
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, [atos.length]);

  const ato = atos[ativo] ?? atos[0];
  const serie = dados.series[ato.serieId];
  const ui = SERIES_UI_POR_ID[ato.serieId];

  return (
    <div className="relative">
      {/* O gráfico gruda no topo no celular e à direita no desktop. */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-4 pt-3 backdrop-blur md:hidden"
           style={{ background: "color-mix(in srgb, var(--plano) 88%, transparent)" }}>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide"
           style={{ color: "var(--tinta-3)" }}>
          {ui?.rotulo ?? serie?.nome}
        </p>
        {serie && (
          <GraficoTempo
            serie={serie}
            presidentes={dados.presidentes}
            destaque={ato.destaque}
            recorte={ato.recorte}
            altura={300}
          />
        )}
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:gap-10">
        <div>
          {atos.map((a, i) => (
            <div
              key={a.id}
              id={a.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="flex min-h-[62vh] flex-col justify-center py-10 transition-opacity duration-300 md:min-h-[70vh]"
              style={{ opacity: i === ativo ? 1 : 0.35 }}
            >
              {/* Rosto de quem está em foco: o leitor sabe de quem é o número
                  antes de ler qualquer palavra. */}
              {a.destaque && (
                <div className="mb-3 flex items-center gap-2.5">
                  {(() => {
                    const p = dados.presidentes.find((x) => x.id === a.destaque);
                    return p ? (
                      <>
                        <Retrato presidente={p} tamanho="g" />
                        <span className="text-sm" style={{ color: "var(--tinta-2)" }}>
                          <span className="block font-semibold" style={{ color: "var(--tinta)" }}>
                            {p.nome}
                          </span>
                          {p.inicio.slice(0, 4)}–{p.fim.slice(0, 4)}
                          {p.partido ? ` · ${p.partido}` : ""}
                        </span>
                      </>
                    ) : null;
                  })()}
                </div>
              )}

              <h2 className="mb-3 text-2xl font-semibold tracking-tight md:text-3xl">
                {a.titulo}
              </h2>

              {/* O número em corpo de manchete, antes do texto: quem só passa
                  os olhos leva o dado, não a prosa. */}
              {a.numero && (
                <div className="mb-4">
                  {/* O corpo acompanha o comprimento: "R$ 1.621,00" cabe numa
                      linha em corpo grande, mas "+8,89% ao ano" quebrava em
                      três na coluna estreita do desktop. */}
                  <p
                    className={`manchete font-bold leading-none ${
                      a.numero.length > 11
                        ? "text-4xl md:text-5xl"
                        : "text-5xl md:text-6xl"
                    }`}
                  >
                    {a.numero}
                  </p>
                  {a.numeroLegenda && (
                    <p className="mt-1.5 text-sm" style={{ color: "var(--tinta-3)" }}>
                      {a.numeroLegenda}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3 text-[15px] leading-relaxed md:text-base"
                   style={{ color: "var(--tinta-2)" }}>
                {a.texto}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          {/* Ancorado perto do topo, não centralizado na tela: centralizar
              deixava um vazio grande acima da primeira seção. */}
          <div className="sticky top-12 pt-10">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide"
               style={{ color: "var(--tinta-3)" }}>
              {ui?.rotulo ?? serie?.nome}
            </p>
            {serie && (
              <GraficoTempo
                serie={serie}
                presidentes={dados.presidentes}
                destaque={ato.destaque}
                recorte={ato.recorte}
                altura={420}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
