"use client";

import { useState } from "react";

import { numero, rotuloMandato } from "@/lib/formatar";
import type { Presidente } from "@/types/dados";

/**
 * Brasil contra o resto do mundo, no mesmo período.
 *
 * É o antídoto contra a atribuição indevida vinda dos dois lados: a inflação
 * de 2021-22 subiu no mundo inteiro, e a recessão de 2020 foi global. Sem esta
 * seção, qualquer número deste site pode ser lido como mérito ou culpa de uma
 * pessoa quando na verdade foi o mundo.
 *
 * Cor: o Brasil é a série (azul); as três referências são cinzas com rótulo
 * direto. Quatro hues categóricos não passariam a checagem de daltonismo, e o
 * enquadramento correto é mesmo "sujeito contra contexto", não quatro iguais.
 */

const INDICADORES = [
  { id: "NY.GDP.MKTP.KD.ZG", rotulo: "Crescimento do PIB", unidade: "% ao ano" },
  { id: "FP.CPI.TOTL.ZG", rotulo: "Inflação", unidade: "% ao ano" },
  { id: "SL.UEM.TOTL.ZS", rotulo: "Desemprego", unidade: "% da força de trabalho" },
];

const ORDEM_REGIOES = ["BRA", "LCN", "MIC", "WLD"];

interface Props {
  presidentes: Presidente[];
}

export function Benchmark({ presidentes }: Props) {
  const [indicador, setIndicador] = useState(INDICADORES[0]);

  const linhas = presidentes.map((p) => {
    const doIndicador = p.benchmark.filter((b) => b.indicadorWb === indicador.id);
    const porRegiao = new Map(doIndicador.map((b) => [b.regiao, b]));
    return { p, porRegiao };
  });

  const todos = linhas.flatMap(({ porRegiao }) =>
    [...porRegiao.values()].map((b) => b.mediaPeriodo ?? 0),
  );
  const min = Math.min(0, ...todos);
  const max = Math.max(...todos, 0);
  const faixa = max - min || 1;
  const pos = (v: number) => ((v - min) / faixa) * 100;

  return (
    <section className="py-16" id="mundo">
      <h2 className="text-xl font-semibold md:text-2xl">Foi a pandemia?</h2>
      <p className="mt-2 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        Todo governo é comparado consigo mesmo, mas nenhum governa sozinho no
        mundo. Aqui o Brasil aparece ao lado da média da América Latina, dos
        países de renda média e do mundo inteiro, no mesmo período de cada
        mandato.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {INDICADORES.map((op) => (
          <button
            key={op.id}
            onClick={() => setIndicador(op)}
            aria-pressed={indicador.id === op.id}
            className="rounded-full border px-3 py-1.5 text-sm transition-colors"
            style={{
              borderColor: indicador.id === op.id ? "var(--serie)" : "var(--borda)",
              background: indicador.id === op.id ? "var(--serie)" : "transparent",
              color: indicador.id === op.id ? "#fff" : "var(--tinta-2)",
            }}
          >
            {op.rotulo}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs" style={{ color: "var(--tinta-3)" }}>
        Média de {indicador.rotulo.toLowerCase()} durante o mandato, em{" "}
        {indicador.unidade}. Fonte: World Bank.
      </p>

      {/* Legenda uma vez só, no topo. Rotular cada marca dentro de cada linha
          fazia "Am. Latina" e "Mundo" se sobreporem quando os valores ficavam
          próximos — que é justamente o caso interessante. */}
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs"
          style={{ color: "var(--tinta-2)" }}>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-1 rounded-full"
                style={{ background: "var(--serie)" }} />
          Brasil
        </li>
        {[
          ["Am. Latina e Caribe", "LCN"],
          ["Renda média", "MIC"],
          ["Mundo", "WLD"],
        ].map(([nome]) => (
          <li key={nome} className="flex items-center gap-1.5">
            <span className="inline-block h-4 w-px" style={{ background: "var(--eixo)" }} />
            {nome}
          </li>
        ))}
      </ul>

      <ul className="mt-4 space-y-5">
        {linhas.map(({ p, porRegiao }) => {
          const brasil = porRegiao.get("BRA");
          if (!brasil || brasil.mediaPeriodo === null) return null;

          return (
            <li key={p.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {rotuloMandato(presidentes, p)}
                  <span className="ml-2 text-xs font-normal"
                        style={{ color: "var(--tinta-3)" }}>
                    {p.inicio.slice(0, 4)}–{p.fim.slice(0, 4)}
                  </span>
                </span>
                <span className="tabular text-sm font-semibold">
                  {numero(brasil.mediaPeriodo)}%
                </span>
              </div>

              <div className="relative h-9 rounded"
                   style={{ background: "var(--faixa-a)" }}>
                {/* Referências primeiro, como marcas finas atrás. */}
                {ORDEM_REGIOES.filter((r) => r !== "BRA").map((r) => {
                  const b = porRegiao.get(r);
                  if (!b || b.mediaPeriodo === null) return null;
                  return (
                    <span
                      key={r}
                      className="absolute top-0 block h-full w-px"
                      style={{
                        left: `${pos(b.mediaPeriodo)}%`,
                        background: "var(--eixo)",
                      }}
                      title={`${b.regiaoNome}: ${numero(b.mediaPeriodo)}%`}
                    />
                  );
                })}

                {/* O Brasil: o único marcador colorido e cheio. */}
                <span
                  className="absolute top-1 h-7 w-1 rounded-full"
                  style={{
                    left: `${pos(brasil.mediaPeriodo)}%`,
                    background: "var(--serie)",
                    transform: "translateX(-50%)",
                  }}
                  title={`Brasil: ${numero(brasil.mediaPeriodo)}%`}
                />
              </div>

              <p className="mt-1.5 text-xs" style={{ color: "var(--tinta-3)" }}>
                {(() => {
                  const mundo = porRegiao.get("WLD")?.mediaPeriodo;
                  if (mundo === undefined || mundo === null) return null;
                  const dif = brasil.mediaPeriodo! - mundo;
                  const acima = dif > 0;
                  return (
                    <>
                      Brasil {acima ? "acima" : "abaixo"} do mundo em{" "}
                      {numero(Math.abs(dif))} ponto
                      {Math.abs(dif) >= 2 ? "s" : ""} percentua
                      {Math.abs(dif) >= 2 ? "is" : "l"}.
                    </>
                  );
                })()}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        A leitura honesta é que nenhum lado sai limpo. A pandemia derrubou o
        mundo inteiro, e a inflação de 2021-22 foi global. Mas isso não explica
        toda a diferença, e o Brasil ficou acima da referência mundial em mais
        de um mandato, de partidos opostos.
      </p>
    </section>
  );
}
