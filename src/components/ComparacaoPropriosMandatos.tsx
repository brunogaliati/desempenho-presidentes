"use client";

import { useState } from "react";

import { numero, rotuloMandato, sentido } from "@/lib/formatar";
import { SERIES_UI_POR_ID, seriesOrdenadas } from "@/lib/registroSeries";
import { useVisivel } from "@/lib/useVisivel";
import type { Presidente } from "@/types/dados";

/**
 * Os mandatos da mesma pessoa, lado a lado.
 *
 * É a comparação mais defensável do site: controla quem governou e varia só o
 * período. Não há como responder "é porque o outro é de outro partido", que é
 * a saída usual quando a comparação é entre pessoas diferentes.
 */

interface Props {
  mandatos: Presidente[];
  todos: Presidente[];
}

export function ComparacaoPropriosMandatos({ mandatos, todos }: Props) {
  const disponiveis = seriesOrdenadas().filter((s) =>
    mandatos.some((m) =>
      m.indicadores.some(
        (i) => i.serieId === s.id && i.variacaoAnualizada !== null,
      ),
    ),
  );

  const [serieId, setSerieId] = useState(disponiveis[0]?.id ?? "");
  const ui = SERIES_UI_POR_ID[serieId];
  const { ref, visivel } = useVisivel<HTMLElement>();

  if (mandatos.length < 2 || disponiveis.length === 0) return null;

  const linhas = mandatos.map((m) => ({
    m,
    i: m.indicadores.find((x) => x.serieId === serieId) ?? null,
  }));

  const valores = linhas
    .map((l) => l.i?.variacaoAnualizada)
    .filter((v): v is number => v !== null && v !== undefined);

  // A escala inclui o zero para que barras positivas e negativas cresçam a
  // partir da mesma referência: sem isso, uma queda de 1% e uma alta de 1%
  // apareceriam com o mesmo tamanho e lados trocados.
  const max = Math.max(0, ...valores);
  const min = Math.min(0, ...valores);
  const faixa = max - min || 1;
  const zero = ((0 - min) / faixa) * 100;

  return (
    <section className="py-10" ref={ref}>
      <h2 className="text-xl font-semibold">Um mandato contra o outro</h2>
      <p
        className="mt-1.5 max-w-prose text-[15px] leading-relaxed"
        style={{ color: "var(--tinta-2)" }}
      >
        A mesma pessoa, períodos diferentes. É a única comparação deste site em
        que não cabe atribuir a diferença ao partido ou ao estilo de quem
        governou, porque isso está fixo.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {disponiveis.map((s) => (
          <button
            key={s.id}
            onClick={() => setSerieId(s.id)}
            aria-pressed={serieId === s.id}
            className="rounded-full border px-3 py-1.5 text-sm transition-colors"
            style={{
              borderColor: serieId === s.id ? "var(--serie)" : "var(--borda)",
              background: serieId === s.id ? "var(--serie)" : "transparent",
              color: serieId === s.id ? "#fff" : "var(--tinta-2)",
            }}
          >
            {s.rotulo}
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {linhas.map(({ m, i }) => {
          const v = i?.variacaoAnualizada ?? null;
          const semDado = v === null || i?.cobertura === "indisponivel";
          const sent =
            semDado || ui?.semDirecao ? "neutro" : sentido(v, i!.direcao);

          return (
            <li
              key={m.id}
              className="grid grid-cols-[7rem_1fr_6rem] items-center gap-3"
            >
              <span className="text-sm font-medium">
                {rotuloMandato(todos, m)}
                <span
                  className="block text-xs font-normal"
                  style={{ color: "var(--tinta-3)" }}
                >
                  {m.inicio.slice(0, 4)}–{m.fim.slice(0, 4)}
                </span>
              </span>

              {semDado ? (
                <span className="text-xs" style={{ color: "var(--tinta-3)" }}>
                  sem dado nesta metodologia
                </span>
              ) : (
                <span
                  className="relative block h-5 rounded-sm"
                  style={{ background: "var(--faixa-a)" }}
                >
                  <span
                    className="absolute top-0 h-full w-px"
                    style={{ left: `${zero}%`, background: "var(--eixo)" }}
                  />
                  <span
                    className="absolute top-0 h-full rounded-sm"
                    style={{
                      left: v! >= 0 ? `${zero}%` : `${((v! - min) / faixa) * 100}%`,
                      // Cresce a partir da linha do zero quando entra na tela.
                      width: visivel ? `${(Math.abs(v!) / faixa) * 100}%` : "0%",
                      background:
                        sent === "bom"
                          ? "var(--bom)"
                          : sent === "ruim"
                            ? "var(--ruim)"
                            : "var(--serie)",
                      transition: "width 700ms cubic-bezier(.4,0,.2,1)",
                    }}
                  />
                </span>
              )}

              <span className="tabular text-right text-sm">
                {semDado ? "—" : `${v! > 0 ? "+" : ""}${numero(v)}`}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs" style={{ color: "var(--tinta-3)" }}>
        {ui?.pergunta} Valores anualizados em{" "}
        {linhas.find((l) => l.i?.unidadeAnualizada)?.i?.unidadeAnualizada ===
        "p.p./ano"
          ? "pontos por ano"
          : "% ao ano"}
        .
      </p>
    </section>
  );
}
