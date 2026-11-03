"use client";

import { useState } from "react";

import { Retrato } from "@/components/Retrato";
import { numero, rotuloMandato } from "@/lib/formatar";
import { SERIES_UI, SERIES_UI_POR_ID } from "@/lib/registroSeries";
import type { Presidente } from "@/types/dados";

/**
 * "Mas ele pegou o país quebrado."
 *
 * Compara o que o mandato entregou com a tendência que já vinha nos 24 meses
 * anteriores à posse. Separa mérito de inércia: continuar uma queda que já
 * acontecia não é o mesmo que provocá-la, e herdar uma alta não é o mesmo que
 * causá-la.
 *
 * Nenhum outro comparativo de governos no Brasil publica isso.
 */

const CANDIDATAS = ["desemprego", "ipca", "salario_minimo_real", "divida_bruta_pib"];

interface Props {
  presidentes: Presidente[];
}

export function Heranca({ presidentes }: Props) {
  const opcoes = SERIES_UI.filter((s) => CANDIDATAS.includes(s.id));
  const [serieId, setSerieId] = useState(opcoes[0]?.id ?? "desemprego");
  const ui = SERIES_UI_POR_ID[serieId];

  const linhas = presidentes
    .map((p) => {
      const i = p.indicadores.find((x) => x.serieId === serieId);
      if (
        !i ||
        i.variacaoAnualizada === null ||
        i.tendenciaPrevia === null ||
        i.deltaVsTendencia === null
      ) {
        return null;
      }
      return { p, i };
    })
    .filter((x): x is { p: Presidente; i: NonNullable<typeof x>["i"] } => x !== null);

  const escala = Math.max(
    ...linhas.flatMap(({ i }) => [
      Math.abs(i.variacaoAnualizada!),
      Math.abs(i.tendenciaPrevia!),
    ]),
    1,
  );

  return (
    <section className="py-16" id="heranca">
      <h2 className="text-xl font-semibold md:text-2xl">
        &ldquo;Mas ele pegou o país quebrado&rdquo;
      </h2>
      <p className="mt-2 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        Todo governo herda uma trajetória. Aqui cada mandato aparece duas vezes:
        o ritmo que já vinha nos dois anos anteriores à posse, e o ritmo durante
        o mandato. A diferença entre os dois é o que mudou de fato.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {opcoes.map((s) => (
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

      <ul className="mt-6 space-y-4">
        {linhas.map(({ p, i }) => {
          const antes = i.tendenciaPrevia!;
          const durante = i.variacaoAnualizada!;
          const acelerou = Math.abs(durante) > Math.abs(antes);
          const mudouDeSinal = Math.sign(antes) !== Math.sign(durante) && antes !== 0;

          const larg = (v: number) => `${(Math.abs(v) / escala) * 48}%`;
          const lado = (v: number) => (v >= 0 ? "left-1/2" : "right-1/2");

          return (
            <li
              key={p.id}
              className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)_10rem]"
            >
              <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                <Retrato presidente={p} tamanho="p" numeroMandato={p.mandato} />
                <div>
                  <p className="text-sm font-medium leading-tight">
                    {rotuloMandato(presidentes, p)}
                  </p>
                  <p className="text-[11px] leading-tight" style={{ color: "var(--tinta-3)" }}>
                    {mudouDeSinal
                      ? "inverteu a direção"
                      : acelerou
                        ? "acelerou o que vinha"
                        : "seguiu, mais devagar"}
                  </p>
                </div>
              </div>

              {/* Barras divergentes em torno da linha do zero: à esquerda é
                  queda, à direita é alta. */}
              <div className="space-y-1">
                {[
                  { v: antes, forte: false },
                  { v: durante, forte: true },
                ].map((b, k) => (
                  <div key={k} className="relative h-4">
                    <span className="absolute left-1/2 top-0 h-full w-px"
                          style={{ background: "var(--eixo)" }} />
                    <span
                      className={`absolute top-0 h-full ${lado(b.v)} rounded-sm`}
                      style={{
                        width: larg(b.v),
                        background: b.forte ? "var(--serie)" : "var(--serie-fraca)",
                        transition: "width 500ms",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Valores em coluna própria: quando ficavam sobre a área das
                  barras, uma barra longa passava por baixo do texto. */}
              <div className="col-span-2 flex gap-4 text-[11px] sm:col-span-1 sm:flex-col sm:gap-0.5">
                <span className="tabular" style={{ color: "var(--tinta-3)" }}>
                  {antes > 0 ? "+" : ""}
                  {numero(antes)} antes
                </span>
                <span className="tabular" style={{ color: "var(--tinta)" }}>
                  {durante > 0 ? "+" : ""}
                  {numero(durante)} no mandato
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-prose text-sm" style={{ color: "var(--tinta-3)" }}>
        A tendência prévia usa os 24 meses anteriores à posse e nunca atravessa
        o Plano Real. Antes de julho de 1994 os valores estavam em outra moeda
        e a inflação corria a três dígitos ao ano.{" "}
        {ui ? `Indicador em exibição: ${ui.pergunta.toLowerCase()}` : ""}
      </p>
    </section>
  );
}
