"use client";

import { useMemo, useState } from "react";

import { Compartilhar } from "@/components/Compartilhar";
import { Retrato } from "@/components/Retrato";
import { numero, rotuloMandato } from "@/lib/formatar";
import { SERIES_UI_POR_ID } from "@/lib/registroSeries";
import type { Presidente } from "@/types/dados";

/**
 * "Em que governo isso foi melhor?"
 *
 * Fica no fim da página de propósito. Na abertura seria uma brincadeira antes
 * de o site ter credibilidade; aqui é teste do que a pessoa acabou de ler, e é
 * o momento natural de compartilhar — errar em público sobre economia é
 * socialmente seguro, e provoca o outro a tentar.
 *
 * As perguntas são geradas dos dados, não escritas à mão: se o pipeline
 * atualizar e a resposta mudar, o jogo acompanha sozinho.
 */

interface Opcao {
  id: string;
  rotulo: string;
  valor: number;
  unidade: string;
  presidente: Presidente;
}

interface Pergunta {
  serieId: string;
  enunciado: string;
  opcoes: Opcao[];
  certaId: string;
  unidade: string;
}

const RODADA = [
  { serieId: "salario_minimo_real", melhor: "maior" as const, verbo: "mais aumentou o poder de compra do salário mínimo" },
  { serieId: "ipca", melhor: "menor" as const, verbo: "teve a menor inflação por ano" },
  { serieId: "pib_volume", melhor: "maior" as const, verbo: "teve o maior crescimento do PIB por ano" },
  { serieId: "desemprego", melhor: "menor" as const, verbo: "mais reduziu o desemprego por ano" },
  { serieId: "divida_bruta_pib", melhor: "menor" as const, verbo: "menos aumentou a dívida por ano" },
];

function embaralhar<T>(xs: T[], semente: number): T[] {
  // Ordem estável entre servidor e cliente: um embaralhamento aleatório de
  // verdade causaria erro de hidratação no Next.
  return [...xs].sort(
    (a, b) =>
      ((JSON.stringify(a).length * semente) % 7) -
      ((JSON.stringify(b).length * semente) % 7),
  );
}

export function Jogo({ presidentes }: { presidentes: Presidente[] }) {
  const [respostas, setRespostas] = useState<Record<number, string>>({});

  const perguntas: Pergunta[] = useMemo(() => {
    const saida: Pergunta[] = [];

    RODADA.forEach((r, idx) => {
      const candidatos: Opcao[] = [];

      for (const p of presidentes) {
        const i = p.indicadores.find((x) => x.serieId === r.serieId);
        // Mandatos sem o dado ficam fora: uma alternativa "—" entregaria a
        // resposta por eliminação.
        if (!i || i.variacaoAnualizada === null || i.cobertura === "indisponivel") {
          continue;
        }
        candidatos.push({
          id: p.id,
          rotulo: rotuloMandato(presidentes, p),
          valor: i.variacaoAnualizada,
          unidade: i.unidadeAnualizada ?? "",
          presidente: p,
        });
      }

      if (candidatos.length < 4) return;

      const ordenados = [...candidatos].sort((a, b) =>
        r.melhor === "maior" ? b.valor - a.valor : a.valor - b.valor,
      );
      const certo = ordenados[0];

      // Distratores do segundo, do meio e do último: se todos viessem do topo,
      // a diferença entre alternativas seria pequena demais para ser jogo.
      const vistos = new Set([certo.id]);
      const outros: typeof candidatos = [];
      for (const cand of [
        ordenados[1],
        ordenados[Math.floor(ordenados.length / 2)],
        ordenados[ordenados.length - 1],
      ]) {
        if (cand && !vistos.has(cand.id)) {
          vistos.add(cand.id);
          outros.push(cand);
        }
      }

      if (outros.length < 3) return;

      saida.push({
        serieId: r.serieId,
        enunciado: `Qual governo ${r.verbo}?`,
        opcoes: embaralhar([certo, ...outros], idx + 2),
        certaId: certo.id,
        unidade: certo.unidade,
      });
    });

    return saida;
  }, [presidentes]);

  const respondidas = Object.keys(respostas).length;
  const acertos = perguntas.filter((p, i) => respostas[i] === p.certaId).length;
  const terminou = respondidas === perguntas.length && perguntas.length > 0;

  return (
    <section className="py-16" id="jogo">
      <h2 className="text-xl font-semibold md:text-2xl">Você chutaria certo?</h2>
      <p className="mt-2 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        Cinco perguntas, com os mesmos números que você acabou de ver. As
        respostas saem direto dos dados, então se eles mudarem o jogo muda junto.
      </p>

      <ol className="mt-8 space-y-8">
        {perguntas.map((p, idx) => {
          const escolhida = respostas[idx];
          const ui = SERIES_UI_POR_ID[p.serieId];

          return (
            <li key={p.serieId}>
              <p className="font-medium">
                {idx + 1}. {p.enunciado}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {p.opcoes.map((o) => {
                  const respondida = Boolean(escolhida);
                  const eCerta = o.id === p.certaId;
                  const eEscolhida = o.id === escolhida;

                  const cor = !respondida
                    ? "var(--borda)"
                    : eCerta
                      ? "var(--bom)"
                      : eEscolhida
                        ? "var(--ruim)"
                        : "var(--borda)";

                  return (
                    <button
                      key={o.id}
                      disabled={respondida}
                      onClick={() =>
                        setRespostas((r) => ({ ...r, [idx]: o.id }))
                      }
                      className="flex items-center justify-between gap-3 rounded-md border p-2 text-left text-sm transition-colors disabled:cursor-default"
                      style={{
                        borderColor: cor,
                        borderWidth: respondida && (eCerta || eEscolhida) ? 2 : 1,
                        background: "var(--superficie)",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Retrato presidente={o.presidente} tamanho="m" numeroMandato={o.presidente.mandato} />
                        <span className="font-medium">{o.rotulo}</span>
                        {/* Símbolo além da cor: verde e vermelho não se
                            distinguem em daltonismo. */}
                        {respondida && (eCerta || eEscolhida) && (
                          <span aria-hidden className="text-base">
                            {eCerta ? "✓" : "✗"}
                          </span>
                        )}
                      </span>
                      {respondida && (
                        <span className="tabular text-xs" style={{ color: "var(--tinta-3)" }}>
                          {o.valor > 0 ? "+" : ""}
                          {numero(o.valor)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {escolhida && (
                <p className="mt-2 text-sm" style={{ color: "var(--tinta-2)" }}>
                  {escolhida === p.certaId ? "Certo." : "Não foi esse."} Os
                  números ao lado são {ui ? ui.rotulo.toLowerCase() : "o indicador"}{" "}
                  em {p.unidade}, já anualizados.
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {terminou && (
        <div
          className="mt-10 rounded-lg border p-5"
          style={{ borderColor: "var(--borda)", background: "var(--superficie)" }}
        >
          <p className="text-lg font-semibold">
            {acertos} de {perguntas.length}
          </p>
          <p className="mt-1 max-w-prose text-[15px]" style={{ color: "var(--tinta-2)" }}>
            {acertos <= 2
              ? "A maioria erra. É por isso que dá para discutir economia por anos sem ninguém mudar de ideia."
              : acertos === perguntas.length
                ? "Todas. Você já conhecia os números, ou leu a página inteira com atenção."
                : "Melhor que a média. Os que costumam escapar são os que contrariam a intuição partidária."}
          </p>
          <div className="mt-4">
            <Compartilhar
              ancora="jogo"
              mensagem={`Acertei ${acertos} de ${perguntas.length} sobre a economia dos governos brasileiros. Tenta você:`}
            />
          </div>
        </div>
      )}
    </section>
  );
}
