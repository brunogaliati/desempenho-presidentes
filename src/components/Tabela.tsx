"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Retrato } from "@/components/Retrato";
import { numero, rotuloMandato, sentido } from "@/lib/formatar";
import { rotaMandato } from "@/lib/rotas";
import { SERIES_UI, type SerieUI } from "@/lib/registroSeries";
import type { Presidente } from "@/types/dados";

/**
 * A matriz de 9 mandatos × 14 indicadores.
 *
 * Fica no fim da narrativa de propósito: quem chegou até aqui já entendeu a
 * régua e já sabe o que significa "% ao ano", então a densidade vira recompensa
 * em vez de barreira.
 *
 * Ordenar por uma coluna é o leitor construindo o próprio ranking — o site
 * nunca publica um. É também a "versão em tabela" que a acessibilidade exige:
 * todo valor desenhado nos gráficos está aqui em texto.
 */

interface Props {
  presidentes: Presidente[];
}

type Ordem = { serieId: string | null; desc: boolean };

export function Tabela({ presidentes }: Props) {
  const [ordem, setOrdem] = useState<Ordem>({ serieId: null, desc: false });

  const series: SerieUI[] = useMemo(
    () => [...SERIES_UI].sort((a, b) => a.ordem - b.ordem),
    [],
  );

  const linhas = useMemo(() => {
    const base = presidentes.map((p) => ({
      p,
      valores: new Map(
        p.indicadores.map((i) => [i.serieId, i]),
      ),
    }));

    if (!ordem.serieId) return base; // ordem cronológica

    return [...base].sort((a, b) => {
      const va = a.valores.get(ordem.serieId!)?.variacaoAnualizada ?? null;
      const vb = b.valores.get(ordem.serieId!)?.variacaoAnualizada ?? null;
      // Sem dado vai sempre para o fim, independente da direção da ordenação.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return ordem.desc ? vb - va : va - vb;
    });
  }, [presidentes, ordem]);

  function alternar(serieId: string) {
    setOrdem((o) =>
      o.serieId === serieId
        ? o.desc
          ? { serieId: null, desc: false } // terceiro clique volta ao cronológico
          : { serieId, desc: true }
        : { serieId, desc: false },
    );
  }

  return (
    <section className="py-16" id="tabela">
      <h2 className="text-xl font-semibold md:text-2xl">Todos os números</h2>
      <p className="mt-2 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        Cada valor é anualizado, então mandatos de durações diferentes podem ser
        comparados. Clique num indicador para ordenar: o ranking é seu, e o site
        não publica nenhum.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <caption className="sr-only">
            Indicadores econômicos anualizados por mandato presidencial
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b p-2 text-left font-medium"
                style={{
                  borderColor: "var(--eixo)",
                  background: "var(--plano)",
                  color: "var(--tinta-2)",
                }}
              >
                Mandato
              </th>
              {series.map((s) => {
                const ativo = ordem.serieId === s.id;
                return (
                  <th
                    key={s.id}
                    scope="col"
                    className="border-b p-2 text-right font-medium"
                    style={{ borderColor: "var(--eixo)" }}
                    aria-sort={
                      ativo ? (ordem.desc ? "descending" : "ascending") : "none"
                    }
                  >
                    <button
                      onClick={() => alternar(s.id)}
                      className="w-full text-right hover:underline"
                      style={{ color: ativo ? "var(--tinta)" : "var(--tinta-2)" }}
                      title={s.pergunta}
                    >
                      {s.rotulo}
                      <span aria-hidden className="ml-0.5" style={{ opacity: ativo ? 1 : 0.25 }}>
                        {ativo ? (ordem.desc ? "↓" : "↑") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ p, valores }) => (
              <tr key={p.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap border-b p-2 text-left font-normal"
                  style={{
                    borderColor: "var(--grade)",
                    background: "var(--plano)",
                  }}
                >
                  <Link
                    href={rotaMandato(p)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Retrato presidente={p} tamanho="p" numeroMandato={p.mandato} />
                    <span>
                      <span className="block font-medium leading-tight">
                        {rotuloMandato(presidentes, p)}
                      </span>
                      <span className="block text-xs leading-tight"
                            style={{ color: "var(--tinta-3)" }}>
                        {p.inicio.slice(0, 4)}–{p.fim.slice(0, 4)}
                        {p.emCurso ? " · em curso" : ""}
                      </span>
                    </span>
                  </Link>
                </th>

                {series.map((s) => {
                  const i = valores.get(s.id);
                  const v = i?.variacaoAnualizada ?? null;

                  // Sem dado é resultado, não buraco: a célula diz por quê.
                  if (!i || i.cobertura === "indisponivel" || v === null) {
                    return (
                      <td
                        key={s.id}
                        className="border-b p-2 text-right"
                        style={{ borderColor: "var(--grade)", color: "var(--tinta-3)" }}
                        title={i?.ressalva ?? "Série não cobre este mandato."}
                      >
                        <span aria-label="sem dado nesta metodologia">—</span>
                      </td>
                    );
                  }

                  const sent = s.semDirecao ? "neutro" : sentido(v, i.direcao);
                  const cor =
                    sent === "bom"
                      ? "var(--bom)"
                      : sent === "ruim"
                        ? "var(--ruim)"
                        : "var(--tinta)";

                  return (
                    <td
                      key={s.id}
                      className="tabular border-b p-2 text-right"
                      style={{ borderColor: "var(--grade)", color: cor }}
                      title={`${i.serieNome}: ${numero(v)} ${i.unidadeAnualizada ?? ""}${
                        i.cobertura === "parcial" ? " (dados parciais)" : ""
                      }`}
                    >
                      {/* Seta + sinal acompanham a cor: verde e vermelho não
                          se distinguem em daltonismo, então a cor nunca
                          carrega o significado sozinha. */}
                      {sent !== "neutro" && (
                        <span aria-hidden className="mr-0.5">
                          {sent === "bom" ? "↑" : "↓"}
                        </span>
                      )}
                      {v > 0 ? "+" : ""}
                      {numero(v)}
                      {i.cobertura === "parcial" && (
                        <span aria-label="dados parciais" title="dados parciais"
                              style={{ color: "var(--tinta-3)" }}>
                          {" "}*
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 space-y-1 text-xs" style={{ color: "var(--tinta-3)" }}>
        <div className="flex gap-2">
          <dt>—</dt>
          <dd>
            Sem dado <em>nesta</em> metodologia. O desemprego pela PNAD
            Contínua, por exemplo, só existe desde 2012, porque a pesquisa
            anterior cobria seis regiões metropolitanas em vez do país e as
            duas não são comparáveis.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt>*</dt>
          <dd>Dados cobrem só parte do mandato.</dd>
        </div>
        <div className="flex gap-2">
          <dt className="whitespace-nowrap">↑ ↓</dt>
          <dd>
            O movimento foi favorável (↑) ou desfavorável (↓) para aquele
            indicador, e não o sinal do número, que já está no valor. Inflação de
            +6% recebe ↓ porque preços subindo é desfavorável. A seta existe
            para que a informação não dependa da cor, já que verde e vermelho
            não se distinguem na forma mais comum de daltonismo.
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="whitespace-nowrap">sem seta</dt>
          <dd>
            Indicadores sem direção boa ou ruim. Dólar e juros altos são bons
            para uns e ruins para outros, e o salário mínimo nominal só diz
            algo depois de descontada a inflação.
          </dd>
        </div>
      </dl>
    </section>
  );
}
