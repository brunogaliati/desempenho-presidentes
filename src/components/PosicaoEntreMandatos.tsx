"use client";

import { Retrato } from "@/components/Retrato";
import { numero, rotuloMandato, sentido } from "@/lib/formatar";
import { SERIES_UI_POR_ID, seriesOrdenadas } from "@/lib/registroSeries";
import { useLargura } from "@/lib/useLargura";
import type { Presidente } from "@/types/dados";

/**
 * Onde este mandato cai, indicador por indicador, entre todos os outros.
 *
 * Cada mandato é o próprio rosto sobre a régua. A versão anterior usava
 * tracinhos cinzas idênticos: dava para ver que havia nove marcas e que uma
 * delas era a deste mandato, mas não quem eram as outras oito, o que
 * transformava a comparação em enfeite.
 *
 * O site não publica **nota**, que seria um score composto com pesos escolhidos
 * por mim. Publica **posição num indicador isolado**, que é ordenação
 * aritmética de uma grandeza medida.
 *
 * A base é sempre explicitada. O desemprego só existe para 5 dos 9 mandatos,
 * então dizer "3º de 9" seria falso: o texto diz "3º entre os 5 com esse dado".
 */

interface Props {
  presidente: Presidente;
  todos: Presidente[];
}

/**
 * Largura de uma marca: o retrato mais 3px de respiro até o vizinho.
 *
 * No celular o rosto encolhe. Nove retratos de 32px numa régua de 330px ocupam
 * a largura inteira, e aí todos acabam igualmente espaçados: a régua vira uma
 * fila e para de mostrar quem está longe de quem, que é a única coisa que ela
 * tem para dizer. A 24px sobra cerca de um quarto da régua para a posição real.
 */
const MARCA = { normal: 35, estreito: 27 } as const;

/** Abaixo disso a régua usa o retrato pequeno e só rotula o mandato em foco. */
const LARGURA_ESTREITA = 520;

/**
 * Recuo lateral da faixa onde os rostos são posicionados.
 *
 * As marcas são centradas na própria posição, então quem cai no mínimo (0%) ou
 * no máximo (100%) transbordaria meio retrato para fora da régua. Metade de um
 * retrato, mais um fio.
 */
const RECUO = 18;

/** Afasta marcas que ficariam sobrepostas, mantendo a ordem. */
function afastar(posicoes: number[], minimo: number): number[] {
  if (minimo <= 0) return posicoes;

  const ordem = posicoes.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);

  for (let k = 1; k < ordem.length; k++) {
    const piso = ordem[k - 1].v + minimo;
    if (ordem[k].v < piso) ordem[k].v = piso;
  }
  // Volta empurrando para dentro, caso a passada tenha estourado a direita.
  for (let k = ordem.length - 1; k > 0; k--) {
    if (ordem[k].v > 100) ordem[k].v = 100;
    const teto = ordem[k].v - minimo;
    if (ordem[k - 1].v > teto) ordem[k - 1].v = teto;
  }

  const saida = new Array(posicoes.length).fill(0);
  ordem.forEach(({ v, i }) => {
    saida[i] = Math.max(0, Math.min(100, v));
  });
  return saida;
}

export function PosicaoEntreMandatos({ presidente, todos }: Props) {
  const { ref, largura } = useLargura<HTMLDivElement>();

  // Folga mínima entre dois rostos, em % da régua, derivada da largura real: a
  // sobreposição é um problema em pixels, e a mesma folga percentual que resolve
  // no desktop empilha os retratos no celular. Enquanto a largura é 0 (servidor
  // e primeiro quadro) não afasta ninguém, então o que aparece nesse instante
  // são as posições verdadeiras, nunca posições inventadas.
  const estreito = largura > 0 && largura < LARGURA_ESTREITA;
  const util = largura - 2 * RECUO;
  const folga =
    util > 0
      ? Math.min(
          ((estreito ? MARCA.estreito : MARCA.normal) / util) * 100,
          12.5,
        )
      : 0;

  const linhas = seriesOrdenadas()
    .map((s) => {
      const ui = SERIES_UI_POR_ID[s.id];
      const meu = presidente.indicadores.find((i) => i.serieId === s.id);
      if (!meu || meu.variacaoAnualizada === null) return null;

      // Só entram mandatos que têm o mesmo indicador medido. Comparar contra
      // quem não tem o dado inflaria o denominador e daria posição falsa.
      const comDado = todos
        .map((p) => {
          const i = p.indicadores.find((x) => x.serieId === s.id);
          return i && i.variacaoAnualizada !== null
            ? { p, valor: i.variacaoAnualizada }
            : null;
        })
        .filter((x): x is { p: Presidente; valor: number } => x !== null);

      if (comDado.length < 3) return null;

      const valores = comDado.map((c) => c.valor);
      const min = Math.min(...valores);
      const max = Math.max(...valores);
      const faixa = max - min || 1;

      // Ordena na direção que o indicador considera favorável. Onde não há
      // direção (dólar, juros), não existe "melhor": mostra a régua sem colocação.
      const temDirecao = !ui?.semDirecao && meu.direcao !== "neutro";
      const ordenados = [...comDado].sort((a, b) =>
        meu.direcao === "maior_melhor" ? b.valor - a.valor : a.valor - b.valor,
      );
      const colocacao =
        ordenados.findIndex((c) => c.p.id === presidente.id) + 1;

      const posicoes = afastar(
        comDado.map((c) => ((c.valor - min) / faixa) * 100),
        folga,
      );

      return { s, meu, comDado, posicoes, min, max, temDirecao, colocacao };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (linhas.length === 0) return null;

  return (
    <div ref={ref} className="space-y-7">
      {linhas.map(
        ({ s, meu, comDado, posicoes, min, max, temDirecao, colocacao }) => {
          const sent = temDirecao
            ? sentido(meu.variacaoAnualizada, meu.direcao)
            : "neutro";
          const total = comDado.length;

          return (
            <div key={s.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">
                  {s.rotulo}
                  <span
                    className="ml-2 text-xs font-normal"
                    style={{ color: "var(--tinta-3)" }}
                  >
                    {meu.unidadeAnualizada === "p.p./ano"
                      ? "pontos/ano"
                      : "% ao ano"}
                  </span>
                </span>
                <span className="text-xs" style={{ color: "var(--tinta-3)" }}>
                  {temDirecao ? (
                    <>
                      {colocacao}
                      {colocacao === 1 ? "º melhor" : "º"} entre os {total}
                      {total < todos.length ? " com esse dado" : ""}
                    </>
                  ) : (
                    <>sem direção boa ou ruim</>
                  )}
                </span>
              </div>

              {/* Régua com um rosto por mandato. A altura abriga o retrato e o
                valor embaixo dele. */}
              <div className="relative h-[4.6rem]">
                <span
                  className="absolute left-0 right-0 rounded-full"
                  style={{
                    // Na altura do centro do retrato, que muda com o tamanho.
                    top: estreito ? 11 : 15,
                    height: 2,
                    background: "var(--grade)",
                  }}
                />

                <div
                  className="absolute inset-y-0"
                  style={{ left: RECUO, right: RECUO }}
                >
                  {comDado.map((c, k) => {
                    const eu = c.p.id === presidente.id;
                    return (
                      <span
                        key={c.p.id}
                        className="absolute flex -translate-x-1/2 flex-col items-center"
                        style={{
                          left: `${posicoes[k]}%`,
                          top: 0,
                          zIndex: eu ? 2 : 1,
                        }}
                        title={`${rotuloMandato(todos, c.p)}: ${numero(c.valor)}`}
                      >
                        <Retrato
                          presidente={c.p}
                          tamanho={estreito ? "pp" : "p"}
                          numeroMandato={c.p.mandato}
                          apagado={!eu}
                          anel
                        />
                        {/* No estreito só o mandato em foco leva número: nove
                            rótulos a 27px de distância se sobrepõem, e o
                            resumo abaixo da régua já dá o mínimo e o máximo. */}
                        {(!estreito || eu) && (
                          <span
                            className="tabular mt-1 whitespace-nowrap text-[10px] leading-tight"
                            style={{
                              color: eu
                                ? sent === "bom"
                                  ? "var(--bom)"
                                  : sent === "ruim"
                                    ? "var(--ruim)"
                                    : "var(--tinta)"
                                : "var(--tinta-3)",
                              fontWeight: eu ? 700 : 400,
                            }}
                          >
                            {numero(c.valor, 1)}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <p
                className="tabular mt-1 text-xs"
                style={{ color: "var(--tinta-3)" }}
              >
                menor {numero(min, 1)} · maior {numero(max, 1)} · este mandato{" "}
                <strong style={{ color: "var(--tinta-2)" }}>
                  {numero(meu.variacaoAnualizada, 1)}
                </strong>
              </p>
            </div>
          );
        },
      )}
    </div>
  );
}
