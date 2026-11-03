"use client";

import { useEffect, useRef, useState } from "react";

import { Retrato } from "@/components/Retrato";
import { numero, rotuloMandato } from "@/lib/formatar";
import type { Presidente } from "@/types/dados";

/**
 * A demonstração de que comparar acumulado é enganoso.
 *
 * Este é o ato em que o leitor decide se confia no site, então ele não afirma —
 * ele mostra. As mesmas barras aparecem primeiro em inflação acumulada (onde
 * Dilma 2 parece a melhor de todas, porque durou 1 ano e 8 meses) e depois
 * anualizadas (onde ela é a pior). Nenhum número muda; muda a régua.
 */

interface Linha {
  id: string;
  rotulo: string;
  presidente: Presidente;
  anos: number;
  acumulado: number;
  anualizado: number;
}

interface Props {
  presidentes: Presidente[];
}

export function Regua({ presidentes }: Props) {
  const [anualizar, setAnualizar] = useState(false);
  const [jaViu, setJaViu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const linhas: Linha[] = presidentes
    .map((p) => {
      const i = p.indicadores.find((x) => x.serieId === "ipca");
      if (!i || i.variacaoTotal === null || i.variacaoAnualizada === null) return null;
      return {
        id: p.id,
        rotulo: rotuloMandato(presidentes, p),
        presidente: p,
        anos: i.anosCobertos ?? 0,
        acumulado: i.variacaoTotal,
        anualizado: i.variacaoAnualizada,
      };
    })
    .filter((x): x is Linha => x !== null);

  // Vira a régua sozinho na primeira vez que a seção aparece: o leitor precisa
  // ver a transformação acontecer, não encontrar o resultado já pronto.
  useEffect(() => {
    if (!ref.current || jaViu) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setJaViu(true);
        const t = setTimeout(() => setAnualizar(true), 1400);
        return () => clearTimeout(t);
      },
      { threshold: 0.55 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [jaViu]);

  const chave = anualizar ? "anualizado" : "acumulado";
  const max = Math.max(...linhas.map((l) => l[chave]));
  const ordenadas = [...linhas].sort((a, b) => a[chave] - b[chave]);
  const melhor = ordenadas[0];
  const pior = ordenadas[ordenadas.length - 1];

  return (
    <section ref={ref} className="py-16">
      <h2 className="text-xl font-semibold md:text-2xl">
        O mesmo dado, duas réguas
      </h2>

      <div className="mt-3 max-w-prose space-y-3 text-[15px] leading-relaxed md:text-base"
           style={{ color: "var(--tinta-2)" }}>
        <p>
          Os mandatos duraram tempos diferentes: Dilma 2 durou 1 ano e 8 meses,
          FHC 1 durou quatro anos. Somar a inflação de cada período mede
          duração, não desempenho.
        </p>
        <p>
          Abaixo está a inflação de cada governo. Troque a régua e veja a ordem
          se desfazer.
        </p>
      </div>

      <div className="mt-6 inline-flex rounded-full border p-1 text-sm"
           style={{ borderColor: "var(--borda)" }}>
        {[
          { v: false, r: "Acumulada no mandato" },
          { v: true, r: "Por ano" },
        ].map((op) => (
          <button
            key={String(op.v)}
            onClick={() => {
              setJaViu(true);
              setAnualizar(op.v);
            }}
            aria-pressed={anualizar === op.v}
            className="rounded-full px-4 py-1.5 transition-colors"
            style={{
              background: anualizar === op.v ? "var(--serie)" : "transparent",
              color: anualizar === op.v ? "#fff" : "var(--tinta-2)",
            }}
          >
            {op.r}
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-2">
        {linhas.map((l) => {
          const v = l[chave];
          const destaque = l.id === "dilma_2";
          return (
            <li key={l.id} className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-3">
              <span className="flex items-center gap-2">
                <Retrato presidente={l.presidente} tamanho="p" numeroMandato={l.presidente.mandato} />
                <span
                  className="text-sm"
                  style={{
                    color: destaque ? "var(--tinta)" : "var(--tinta-2)",
                    fontWeight: destaque ? 600 : 400,
                  }}
                >
                  {l.rotulo}
                </span>
              </span>
              <span className="h-5 overflow-hidden rounded-sm"
                    style={{ background: "var(--faixa-a)" }}>
                {/* As barras crescem do zero quando a seção entra na tela: sem
                    isso, quem chega já rolado vê o gráfico pronto e perde a
                    demonstração, que é o argumento inteiro desta seção. */}
                <span
                  className="block h-full rounded-sm"
                  style={{
                    width: jaViu ? `${Math.max((v / max) * 100, 1)}%` : "0%",
                    background: destaque ? "var(--serie)" : "var(--serie-fraca)",
                    transition: "width 900ms cubic-bezier(.4,0,.2,1)",
                  }}
                />
              </span>
              <span className="tabular text-right text-sm"
                    style={{ color: "var(--tinta)" }}>
                {numero(v)}%
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        {anualizar ? (
          <>
            Por ano, <strong style={{ color: "var(--tinta)" }}>Dilma 2 tem a
            maior inflação</strong> de todos os nove mandatos. O governo mais
            curto virou o de pior desempenho quando os prazos foram igualados.
            Todo número deste site é calculado assim.
          </>
        ) : (
          <>
            Nesta régua, <strong style={{ color: "var(--tinta)" }}>Dilma 2
            aparece entre as menores inflações</strong>, não porque os preços
            subiram pouco, mas porque ela teve{" "}
            {numero(linhas.find((l) => l.id === "dilma_2")?.anos ?? 0, 1)} anos
            para acumular, contra 4 dos outros.
          </>
        )}
      </p>

      <p className="mt-2 text-sm" style={{ color: "var(--tinta-3)" }}>
        {anualizar ? "Nesta régua (por ano)" : "Nesta régua (acumulada)"}, menor
        inflação: {melhor?.rotulo} ({numero(melhor?.[chave] ?? 0)}%). Maior:{" "}
        {pior?.rotulo} ({numero(pior?.[chave] ?? 0)}%).
      </p>
    </section>
  );
}
