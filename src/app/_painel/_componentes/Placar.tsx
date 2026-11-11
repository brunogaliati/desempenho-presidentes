"use client";

import { useState } from "react";

import type { Sentido } from "@/lib/formatar";

import { recortar } from "../_dados/economiaModelo";
import { doisAnosAntes } from "../_dados/mandatoRecorte";
import { Abrir } from "./Abrir";
import { rotuloDataDaSerie, ultimoDado, vereditoDaSerie } from "./formatos";
import { GraficoLinha } from "./GraficoLinha";
import { POSSE, VEREDITO, type FileiraPlacar, type GrupoPlacar, type ItemPlacar } from "./placarModelo";

export { FOCUS, itemDaSerie, placarDaEconomia, placarDoMandato, revisaoFocus } from "./placarModelo";
export type { FileiraPlacar, GrupoPlacar, ItemPlacar } from "./placarModelo";

/**
 * O placar do mandato: bater o olho e ver o que melhorou e o que piorou.
 *
 * Uma régua só para tudo, como a variação do dia num terminal: cada medida
 * hoje contra o que o governo recebeu. Taxas e níveis comparam o último dado
 * com o último antes da posse; PIB e renda, que só sobem ou descem, mostram
 * quanto cresceram desde a posse. A cor é o bloco inteiro, chapado: verde
 * melhorou, vermelho piorou. A palavra fica só para leitor de tela.
 *
 * Embaixo, o mercado: a bolsa desde a posse (subir é bom, como em qualquer
 * terminal), o dólar (cair é bom, ver `LADO_BOM`) e Selic e juros reais em
 * cinza, porque quem os decide é o Copom. Depois, o que a pesquisa Focus
 * espera para o último ano do mandato, com a cor da revisão da semana: PIB
 * revisado para cima é verde, inflação ou dólar revisados para cima são
 * vermelhos.
 *
 * A lista é fixa e vale para qualquer governo: escolher medidas pelo
 * resultado seria escolher a cor.
 *
 * `Placar` só desenha: recebe os grupos (contam no "melhoraram · pioraram")
 * e as fileiras de baixo (não contam). `placarDaEconomia` monta os da
 * economia; o meio ambiente tem os seus em `placarAmbiente.ts`.
 */

const FUNDO: Record<Sentido, string> = { bom: "var(--placar-bom)", ruim: "var(--placar-ruim)", neutro: "var(--mapa-estavel)" };
const TEXTO: Record<Sentido, string> = { bom: "var(--placar-texto)", ruim: "var(--placar-texto)", neutro: "var(--tinta)" };

export function Placar({
  grupos,
  fileiras,
  aoFocar,
  aoVerHistorico,
  cabecalho = true,
}: {
  /** Contam no "melhoraram · pioraram". */
  grupos: GrupoPlacar[];
  /** Embaixo, menores e fora da contagem. */
  fileiras: FileiraPlacar[];
  /** Abrir um indicador do país: o gráfico de baixo acompanha, sem rolar. */
  aoFocar: (id: string) => void;
  /** "Histórico completo": desce até o gráfico dele. */
  aoVerHistorico: (id: string) => void;
  /** Falso onde a contagem já aparece grande ao lado (o palco do Resumo). */
  cabecalho?: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const todos = grupos.flatMap((g) => g.itens);
  if (!todos.length) return null;
  const bons = todos.filter((x) => x.sentido === "bom");
  const ruins = todos.filter((x) => x.sentido === "ruim");
  const iguais = todos.filter((x) => x.sentido === "neutro");

  // Tocar abre o detalhe ali mesmo; a página não rola sozinha.
  const alternar = (x: ItemPlacar) => {
    const abrir = aberto !== x.id;
    setAberto(abrir ? x.id : null);
    if (abrir && x.nacional && x.serie) aoFocar(x.serie.id);
  };

  return (
    <section aria-label="Placar do mandato" className="px-3 pb-1 pt-2">
      {cabecalho && (<>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold" title="O último dado contra o que o governo recebeu">
          Desde a posse
        </h2>
        <p className="tabular flex flex-wrap justify-end gap-x-2.5 text-[11px]" style={{ color: "var(--tinta-2)" }}>
          <span>
            <strong style={{ color: "var(--bom)" }}>{bons.length}</strong> melhoraram
          </span>
          {iguais.length > 0 && (
            <span>
              <strong>{iguais.length}</strong> {iguais.length === 1 ? "igual" : "iguais"}
            </span>
          )}
          <span>
            <strong style={{ color: "var(--ruim)" }}>{ruins.length}</strong> pioraram
          </span>
        </p>
      </div>

      {/* A proporção primeiro: um traço por medida, os verdes juntos e os vermelhos juntos. */}
      <div className="mt-1.5 flex h-2 gap-[3px]" aria-hidden>
        {[...bons, ...iguais, ...ruins].map((x) => (
          <span key={x.id} className="flex-1 rounded-full" style={{ background: FUNDO[x.sentido] }} />
        ))}
      </div>
      </>)}

      <div className={cabecalho ? "mt-2.5 space-y-1" : "space-y-1"}>
        {grupos.map((g) => {
          const aberta = g.itens.find((x) => x.id === aberto) ?? null;
          return (
            <div key={g.titulo}>
              <div className="grid grid-cols-[4.4rem_minmax(0,1fr)] items-center gap-x-1.5">
                <span className="text-[10.5px] font-medium leading-tight" style={{ color: "var(--tinta-3)" }}>
                  {g.titulo}
                </span>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${g.itens.length}, minmax(0, 1fr))` }}>
                  {g.itens.map((x) => (
                    <Bloco key={x.id} x={x} aberto={aberto === x.id} aoAlternar={() => alternar(x)} />
                  ))}
                </div>
              </div>
              <Abrir aberto={aberta !== null}>{aberta && <Detalhe x={aberta} aoVerHistorico={aoVerHistorico} />}</Abrir>
            </div>
          );
        })}
      </div>

      {fileiras.map((f) => (
        <LinhaMercado
          key={f.titulo}
          titulo={f.titulo}
          detalhe={f.detalhe}
          itens={f.itens}
          aberto={aberto}
          aoAlternar={alternar}
          aoVerHistorico={aoVerHistorico}
          rotular={f.rotular}
        />
      ))}
    </section>
  );
}

/**
 * Uma fileira de células pequenas: o número em cima, a variação numa pílula
 * embaixo. A pílula só ganha cor quando a medida tem lado bom.
 */
function LinhaMercado({
  titulo,
  detalhe,
  itens,
  aberto,
  aoAlternar,
  aoVerHistorico,
  rotular,
}: {
  titulo: string;
  detalhe: string;
  itens: ItemPlacar[];
  aberto: string | null;
  aoAlternar: (x: ItemPlacar) => void;
  aoVerHistorico: (id: string) => void;
  rotular: (x: ItemPlacar) => string;
}) {
  if (!itens.length) return null;
  const aberta = itens.find((x) => x.id === aberto) ?? null;
  return (
    <div className="mt-2.5">
      <div className="flex items-baseline justify-between gap-2 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        <span className="font-medium">{titulo}</span>
        <span>{detalhe}</span>
      </div>
      <div className="mt-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${itens.length}, minmax(0, 1fr))` }}>
        {itens.map((x) => (
          <Celula key={x.id} x={x} aberto={aberto === x.id} aoAlternar={() => aoAlternar(x)} rotulo={rotular(x)} />
        ))}
      </div>
      <Abrir aberto={aberta !== null}>{aberta && <Detalhe x={aberta} aoVerHistorico={aoVerHistorico} />}</Abrir>
    </div>
  );
}

/** Um bloco chapado: a cor é o veredito; o número grande é o que mudou, o pequeno, onde está. */
function Bloco({ x, aberto, aoAlternar }: { x: ItemPlacar; aberto: boolean; aoAlternar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      aria-label={`${x.rotulo}: ${x.mudanca} desde a posse, ${VEREDITO[x.sentido]}. Agora ${x.agora}. ${aberto ? "Fechar" : "Abrir"} o detalhe.`}
      className="placar-bloco min-w-0 rounded-[10px] px-[7px] pb-1 pt-[3px] text-left"
      data-aberto={aberto || undefined}
      style={{ background: FUNDO[x.sentido], color: TEXTO[x.sentido] }}
    >
      <span className="block truncate text-[11px] font-medium opacity-90">{x.rotulo}</span>
      <span className="flex flex-wrap items-baseline gap-x-1">
        <Variacao texto={x.mudanca} className="text-[15px] font-bold leading-tight" />
        <span className="tabular truncate text-[10.5px] opacity-80">{x.agora}</span>
      </span>
    </button>
  );
}

function Celula({ x, aberto, aoAlternar, rotulo }: { x: ItemPlacar; aberto: boolean; aoAlternar: () => void; rotulo: string }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-expanded={aberto}
      aria-label={`${rotulo} ${aberto ? "Fechar" : "Abrir"} o detalhe.`}
      className="placar-bloco min-w-0 rounded-[10px] border px-1.5 pb-1.5 pt-0.5 text-left"
      data-aberto={aberto || undefined}
      style={{ borderColor: "var(--borda)" }}
    >
      <span className="block truncate text-[10px]" style={{ color: "var(--tinta-3)" }}>
        {x.rotulo}
      </span>
      <span className="tabular block truncate text-[12.5px] font-semibold leading-tight">{x.agora}</span>
      <PilulaVeredito texto={x.mudanca} sentido={x.sentido} className="mt-0.5 max-w-full align-top text-[10px]" />
    </button>
  );
}

/**
 * A variação numa pílula chapada na cor do veredito, a mesma do placar em
 * toda a aba. Sem lado bom, fica só o texto em cinza.
 */
export function PilulaVeredito({ texto, sentido: s, className = "" }: { texto: string; sentido: Sentido; className?: string }) {
  return (
    <span
      className={`tabular inline-block truncate rounded leading-[1.45] ${s === "neutro" ? "" : "px-1"} ${className}`}
      style={s === "neutro" ? { color: "var(--tinta-3)" } : { background: FUNDO[s], color: TEXTO[s], fontWeight: 600 }}
    >
      {texto}
    </span>
  );
}

/** "+11,3 pts" com o "pts" e o "%" menores, na cor do bloco. */
function Variacao({ texto, className }: { texto: string; className: string }) {
  const m = texto.match(/^([+\-−]?[\d.,]+)(%| pts)$/);
  if (!m) return <span className={`tabular ${className}`}>{texto}</span>;
  return (
    <span className={`tabular whitespace-nowrap ${className}`}>
      {m[1]}
      <span className="ml-[0.08em] text-[0.68em] font-semibold opacity-85">{m[2].trim()}</span>
    </span>
  );
}

export function Detalhe({ x, aoVerHistorico }: { x: ItemPlacar; aoVerHistorico: (id: string) => void }) {
  const s = x.serie;
  const ultimo = s ? ultimoDado(s) : null;
  const trecho = s && ultimo ? recortar(s, doisAnosAntes(s.posse ?? POSSE), ultimo.data) : null;
  const pontos = trecho ? trecho.datas.flatMap((d, i) => (trecho.valores[i] === null ? [] : [{ d, v: trecho.valores[i]! }])) : [];
  return (
    <div className="pb-2 pt-2">
      <p className="text-[11.5px] leading-snug" style={{ color: "var(--tinta-2)" }}>
        {x.leitura}
      </p>
      {x.diaria && (
        <>
          <p className="mt-2 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            {x.rotulo} · pontos, fechamento diário
          </p>
          <GraficoLinha
            datas={x.diaria.datas}
            valores={x.diaria.valores}
            formato="inteiro"
            diario
            altura={120}
            rotulo={x.rotulo}
            veredito={x.recebido === undefined ? null : { referencia: x.recebido, direcao: "maior_melhor", desde: s?.posse ?? POSSE, rotulo: null, sentido: x.sentido }}
          />
        </>
      )}
      {s && !x.diaria && pontos.length > 1 && (
        <>
          <p className="mt-2 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            {s.rotulo} · {s.unidade}
          </p>
          <GraficoLinha
            datas={pontos.map((p) => p.d)}
            valores={pontos.map((p) => p.v)}
            formato={s.formato}
            altura={120}
            rotulo={s.rotulo}
            rotuloData={rotuloDataDaSerie(s)}
            veredito={x.direcao && x.direcao !== "neutro" ? vereditoDaSerie(s, { direcao: x.direcao, sentido: x.sentido }) : null}
          />
        </>
      )}
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px]">
        {x.fonteUrl && (
          <a href={x.fonteUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline" style={{ color: "var(--tinta-3)" }}>
            {x.fonte} ↗
          </a>
        )}
        {x.nacional && s && (
          <button type="button" onClick={() => aoVerHistorico(s.id)} className="font-medium hover:underline" style={{ color: "var(--serie)" }}>
            Histórico completo ↓
          </button>
        )}
      </p>
    </div>
  );
}
