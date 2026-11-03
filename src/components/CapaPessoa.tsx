import Link from "next/link";

import { Retrato } from "@/components/Retrato";
import { rotuloMandato } from "@/lib/formatar";
import { ancoraMandato } from "@/lib/rotas";
import type { Presidente } from "@/types/dados";

/**
 * A capa da página de uma pessoa.
 *
 * A faixa reaproveita a linguagem da abertura do site: 31 anos repartidos por
 * mandato, largura proporcional à duração. Aqui os mandatos desta pessoa ficam
 * acesos e o resto apagado, então o leitor vê onde ela se encaixa na história
 * antes de encontrar qualquer número.
 *
 * Os blocos acesos são o índice da página: clicar leva à seção do mandato.
 */

interface Props {
  pessoa: { nome: string; partido: string | null };
  mandatos: Presidente[];
  todos: Presidente[];
  anosNoCargo: number;
}

const MS_POR_ANO = 365.25 * 24 * 3600 * 1000;

function anos(p: Presidente): number {
  return (new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / MS_POR_ANO;
}

export function CapaPessoa({ pessoa, mandatos, todos, anosNoCargo }: Props) {
  const idsDaPessoa = new Set(mandatos.map((m) => m.id));
  const plural = mandatos.length > 1;

  return (
    <header className="py-10">
      <div className="flex flex-wrap items-center gap-5">
        <Retrato presidente={mandatos[0]} tamanho="gg" prioridade />
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {pessoa.nome}
          </h1>
          <p className="mt-1 text-[15px]" style={{ color: "var(--tinta-2)" }}>
            {mandatos.length} mandato{plural ? "s" : ""}
            {pessoa.partido ? ` · ${pessoa.partido}` : ""} ·{" "}
            {anosNoCargo.toFixed(1).replace(".", ",")} anos no cargo
          </p>
        </div>
      </div>

      {/* Os 31 anos, com os mandatos desta pessoa acesos. */}
      <ol className="mt-8 flex items-end" aria-label="Mandatos desta pessoa na linha do tempo">
        {todos.map((m) => {
          const dela = idsDaPessoa.has(m.id);
          const bloco = (
            <>
              <span
                className="block w-full rounded-sm"
                style={{
                  height: dela ? 16 : 8,
                  borderLeft: "1px solid var(--plano)",
                  borderRight: "1px solid var(--plano)",
                  background: dela ? "var(--serie)" : "var(--eixo)",
                }}
              />
              <span
                className="mt-1.5 block truncate text-center text-[11px] leading-tight"
                style={{
                  color: dela ? "var(--tinta)" : "var(--tinta-3)",
                  fontWeight: dela ? 600 : 400,
                }}
              >
                {rotuloMandato(todos, m)}
              </span>
            </>
          );

          return (
            <li
              key={m.id}
              style={{ flexGrow: anos(m), flexBasis: 0 }}
              className="min-w-0"
              title={`${m.nome} · ${m.inicio.slice(0, 4)}–${m.fim.slice(0, 4)}`}
            >
              {dela ? (
                <Link
                  href={`#${ancoraMandato(m.mandato)}`}
                  className="block hover:opacity-80"
                >
                  {bloco}
                </Link>
              ) : (
                bloco
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs" style={{ color: "var(--tinta-3)" }}>
        Cada bloco é do tamanho do mandato, dentro dos 31 anos desde o Plano
        Real. {plural ? "Clique num dos mandatos acesos para ir até ele." : ""}
      </p>
    </header>
  );
}
