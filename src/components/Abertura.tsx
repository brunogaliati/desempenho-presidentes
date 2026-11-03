"use client";

import Link from "next/link";
import { useState } from "react";

import { Retrato } from "@/components/Retrato";
import { rotaMandato } from "@/lib/rotas";
import { rotuloMandato } from "@/lib/formatar";
import type { DadosSite, Presidente } from "@/types/dados";

/**
 * A primeira tela: uma faixa contínua de 1995 a 2026, dividida em nove
 * segmentos proporcionais ao tempo de cada mandato.
 *
 * Duas versões anteriores foram descartadas. A primeira abria com a curva do
 * salário mínimo, que não funciona como capa: linha serrilhada e eixo numérico
 * não são reconhecíveis antes da leitura. A segunda era uma grade de retratos
 * igualmente espaçados, cada um com uma barrinha e o texto "4,0 anos" embaixo —
 * a barra repetia o que o número já dizia, e nenhum dos dois estava ligado à
 * posição na grade, que era uniforme e portanto mentia sobre o tempo.
 *
 * Aqui a largura do segmento É a duração. Não há rótulo redundante, e o
 * argumento central do site aparece como forma: o bloco de Dilma 2 tem pouco
 * mais de um terço do de FHC, e é por isso que somar valores acumulados engana.
 */

interface Props {
  dados: DadosSite;
}

const MS_POR_ANO = 365.25 * 24 * 3600 * 1000;

/** Duração total do mandato. Para o que está em curso, é a data projetada. */
function anos(p: Presidente): number {
  return (new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / MS_POR_ANO;
}

/**
 * Quanto do mandato já aconteceu.
 *
 * Sem isto a faixa mostrava "4,0 anos" para Lula 3, que ainda está em curso:
 * o campo `fim` do mandato atual é uma data projetada, e exibi-la como duração
 * cumprida afirma um fato que ainda não ocorreu.
 *
 * A referência é `geradoEm`, o instante em que os dados foram lidos, e não o
 * relógio do navegador. Usar `new Date()` num componente de cliente daria
 * valores diferentes no servidor e no browser, quebrando a hidratação.
 */
function anosDecorridos(p: Presidente, agora: Date): number {
  const fim = Math.min(new Date(p.fim).getTime(), agora.getTime());
  return Math.max(0, (fim - new Date(p.inicio).getTime()) / MS_POR_ANO);
}

export function Abertura({ dados }: Props) {
  const mandatos = dados.presidentes;
  const [emFoco, setEmFoco] = useState<string | null>(null);

  const agora = new Date(dados.geradoEm);
  const total = mandatos.reduce((s, p) => s + anosDecorridos(p, agora), 0);

  return (
    <section
      className="flex min-h-[calc(100vh-3rem)] flex-col justify-center py-10"
      aria-labelledby="titulo-site"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h1
          id="titulo-site"
          className="text-3xl font-bold tracking-tight md:text-5xl"
        >
          Nove governos, uma régua só
        </h1>
        <p
          className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed md:text-lg"
          style={{ color: "var(--tinta-2)" }}
        >
          Desde o Plano Real, o Brasil teve nove mandatos presidenciais. Este
          site mede todos com o mesmo critério, a partir das fontes oficiais.
          Sem nota, sem ranking, sem escolher o número que favorece um lado.
        </p>
      </div>

      {/* ---------- celular: linha do tempo vertical ---------- */}
      <ol className="mt-10 sm:hidden">
        {mandatos.map((p, i) => (
          <li key={p.id} className="flex gap-3">
            {/* Trilho contínuo ligando um mandato ao seguinte. */}
            <div className="flex flex-col items-center">
              <Link href={rotaMandato(p)} aria-label={`Ver o governo ${p.nome}`}>
                <Retrato presidente={p} tamanho="m" numeroMandato={p.mandato} prioridade />
              </Link>
              {i < mandatos.length - 1 && (
                <span
                  className="w-0.5 flex-1 rounded-full"
                  style={{
                    // Altura proporcional ao mandato, com piso para o trilho
                    // não sumir nos curtos.
                    minHeight: Math.max(anos(p) * 9, 14),
                    background: "var(--serie-fraca)",
                  }}
                />
              )}
            </div>

            <div className="pb-4 pt-1">
              <Link
                href={rotaMandato(p)}
                className="text-sm font-semibold leading-tight hover:underline"
              >
                {rotuloMandato(mandatos, p)}
              </Link>
              <p
                className="tabular text-xs leading-tight"
                style={{ color: "var(--tinta-3)" }}
              >
                {p.inicio.slice(0, 4)}–{p.fim.slice(0, 4)}
                {p.emCurso ? " · em curso" : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* ---------- desktop: faixa horizontal proporcional ---------- */}
      <div className="mt-12 hidden sm:block">
        {/* Sem espaço entre os itens: a faixa precisa ler como um período
            contínuo de 32 anos repartido entre mandatos, não como nove blocos
            soltos. A separação fica por conta de um vão de 2px da própria cor
            do fundo, dentro de cada segmento. */}
        <ol className="flex items-end">
          {mandatos.map((p) => {
            const foco = emFoco === p.id;
            const apagado = emFoco !== null && !foco;
            const decorrido = anosDecorridos(p, agora);
            return (
              <li
                key={p.id}
                // `flexGrow` proporcional ao tempo: a largura do bloco passa a
                // ser a duração, sem precisar de barra nem de rótulo à parte.
                style={{ flexGrow: anos(p), flexBasis: 0 }}
                className="group flex min-w-0 flex-col items-center"
                onMouseEnter={() => setEmFoco(p.id)}
                onMouseLeave={() => setEmFoco(null)}
                title={
                  p.emCurso
                    ? `${p.nome}: ${decorrido.toFixed(1)} anos até agora, de 4 previstos`
                    : `${p.nome}: ${decorrido.toFixed(1)} anos`
                }
              >
                {/* O bloco inteiro leva à página do mandato: a área de clique
                    inclui foto, nome e período, não só o texto. */}
                <Link
                  href={rotaMandato(p)}
                  className="flex w-full flex-col items-center focus-visible:outline-2"
                  aria-label={`Ver o governo ${p.nome}, ${p.inicio.slice(0, 4)} a ${p.fim.slice(0, 4)}`}
                >
                <Retrato
                  presidente={p}
                  tamanho="g"
                  numeroMandato={p.mandato}
                  apagado={apagado}
                  prioridade
                  className="mb-2.5"
                />

                <span
                  className="block w-full overflow-hidden transition-all"
                  style={{
                    height: foco ? 18 : 12,
                    // O vão vem de uma borda da cor do plano, então os
                    // segmentos encostam sem se fundir.
                    borderLeft: "1px solid var(--plano)",
                    borderRight: "1px solid var(--plano)",
                    borderRadius: 2,
                    // O que ainda não aconteceu fica como fundo vazio.
                    background: p.emCurso ? "var(--faixa-a)" : "transparent",
                  }}
                >
                  <span
                    className="block h-full transition-all"
                    style={{
                      width: `${(decorrido / anos(p)) * 100}%`,
                      background: apagado ? "var(--eixo)" : "var(--serie)",
                    }}
                  />
                </span>

                <span className="mt-2 block truncate text-center text-xs font-semibold leading-tight group-hover:underline">
                  {rotuloMandato(mandatos, p)}
                </span>
                <span
                  className="tabular block truncate text-center text-[11px] leading-tight"
                  style={{ color: "var(--tinta-3)" }}
                >
                  {decorrido.toFixed(1).replace(".", ",")} anos
                  {p.emCurso ? " até agora" : ""}
                </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Réguas do início e do fim, para a faixa ter escala. */}
        <div
          className="tabular mt-2 flex justify-between text-xs"
          style={{ color: "var(--tinta-3)" }}
        >
          <span>{mandatos[0]?.inicio.slice(0, 4)}</span>
          <span>{Math.round(total)} anos de Plano Real</span>
          <span>{mandatos[mandatos.length - 1]?.fim.slice(0, 4)}</span>
        </div>
      </div>

      <p
        className="mx-auto mt-10 max-w-xl text-center text-sm leading-relaxed"
        style={{ color: "var(--tinta-3)" }}
      >
        Cada bloco é do tamanho do mandato. Dilma 2 caiu no impeachment com 1
        ano e 8 meses, Temer completou o restante em 2 e 4. É por isso que
        comparar totais acumulados não funciona, e é o primeiro problema que
        este site resolve.
      </p>
    </section>
  );
}
