"use client";

import { useEffect, useRef, useState } from "react";

import { Abrir } from "./Abrir";
import { Detalhe, PilulaVeredito } from "./Placar";
import type { GrupoTerritorio, LinhaTerritorio, VistaDoMapa } from "./placarAmbiente";

/**
 * O placar do meio ambiente: uma lista, não uma parede de blocos.
 *
 * Quando quase tudo melhora, blocos chapados viram uma mancha verde em que a
 * cor não diz mais nada. Aqui cada medida é uma linha com uma barra na mesma
 * escala, com um traço no que o governo recebeu: de relance se vê que o desmatamento da Amazônia
 * caiu muito e os alertas do Cerrado caíram pouco. A barra leva a cor do tipo,
 * a mesma do mapa; o veredito continua chapado, em verde ou vermelho, só na
 * pílula. A fiscalização não tem veredito: a pílula sai em cinza e fica fora da
 * contagem.
 *
 * Um toque numa linha pinta o mapa com ela e abre o gráfico logo abaixo, de uma vez.
 * Tocar de novo fecha o gráfico, e o mapa fica. Medida que não existe no recorte fica
 * na lista, dizendo por quê, e não se toca.
 *
 * Enquanto uma linha do desmatamento está no mapa, "Outros biomas" fica aberto nos
 * quatro biomas, para ir de um a outro. O gráfico fica no fim do grupo: trocar de
 * bioma não move as linhas.
 */

/** A barra inteira vale 1,6 vez o recebido: o traço do recebido fica fixo e sobra lugar para o que subiu. */
const ESCALA = 1.6;
/** O tempo de abrir (`MOVIMENTO` em `Abrir.tsx`) e a faixa que esmaece no pé da barra. */
const TEMPO_DE_ABRIR = 600;
const FOLGA_DO_PE = 28;

export function PlacarTerritorio({
  grupos,
  fileiras,
  anoRecebido,
  emCurso,
  vistaAtiva,
  vistaAcesa,
  aoVerNoMapa,
  aoFocar,
  aoVerHistorico,
}: {
  grupos: GrupoTerritorio[];
  fileiras: GrupoTerritorio[];
  /** O ano que o traço marca. */
  anoRecebido: number;
  /** A barra é hoje, ou o fim de um mandato encerrado. */
  emCurso: boolean;
  /** Esta linha é exatamente o que está no mapa. */
  vistaAtiva: (v: VistaDoMapa) => boolean;
  /** Esta linha está dentro do que está no mapa: os quatro biomas de "Outros biomas". */
  vistaAcesa: (v: VistaDoMapa) => boolean;
  aoVerNoMapa: (v: VistaDoMapa) => void;
  aoFocar: (id: string) => void;
  aoVerHistorico: (id: string) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null);

  // As linhas de baixo abrem depois do fim da barra: ela rola junto, enquanto o gráfico
  // cresce, até ele aparecer inteiro. Só a barra rola, nunca a página.
  useEffect(() => {
    const rolagem = raiz.current?.parentElement;
    const linha = aberto ? raiz.current?.querySelector(`[data-linha="${CSS.escape(aberto)}"]`) : null;
    const grupo = linha?.closest("[data-grupo]");
    if (!rolagem || !linha || !grupo) return;
    const inicio = performance.now();
    let quadro = 0;
    const seguir = (agora: number) => {
      const caixa = rolagem.getBoundingClientRect();
      const acima = linha.getBoundingClientRect().top - caixa.top;
      const sobra = grupo.getBoundingClientRect().bottom + FOLGA_DO_PE - caixa.bottom;
      if (acima < 0) rolagem.scrollTop += acima;
      else if (sobra > 0) rolagem.scrollTop += Math.min(sobra, acima);
      if (agora - inicio < TEMPO_DE_ABRIR) quadro = requestAnimationFrame(seguir);
    };
    quadro = requestAnimationFrame(seguir);
    return () => cancelAnimationFrame(quadro);
  }, [aberto]);

  const contados = grupos.flatMap((g) => g.itens).filter((x) => !x.falta);
  const bons = contados.filter((x) => x.sentido === "bom").length;
  const ruins = contados.filter((x) => x.sentido === "ruim").length;
  const iguais = contados.length - bons - ruins;
  const secoes = [...grupos, ...fileiras].filter((s) => s.itens.length > 0);
  if (!secoes.length) return null;

  // O gráfico é do que está no mapa: trocar a medida pela coluna da esquerda o fecha.
  const estaAberta = (x: LinhaTerritorio) => aberto === x.id && (!x.vista || vistaAtiva(x.vista));
  const tocar = (x: LinhaTerritorio) => {
    const abrir = !estaAberta(x);
    setAberto(abrir ? x.id : null);
    if (x.vista && !vistaAtiva(x.vista)) aoVerNoMapa(x.vista);
    if (abrir && x.nacional && x.serie) aoFocar(x.serie.id);
  };

  return (
    <section ref={raiz} aria-label="Placar do mandato" className="px-2 pb-1 pt-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-[15px] font-semibold" title="O último dado contra o que o governo recebeu">
          Desde a posse
        </h2>
        <p className="tabular flex flex-wrap justify-end gap-x-2.5 text-[11px]" style={{ color: "var(--tinta-2)" }}>
          <span>
            <strong style={{ color: "var(--bom)" }}>{bons}</strong> melhoraram
          </span>
          {iguais > 0 && (
            <span>
              <strong>{iguais}</strong> {iguais === 1 ? "igual" : "iguais"}
            </span>
          )}
          <span>
            <strong style={{ color: "var(--ruim)" }}>{ruins}</strong> pioraram
          </span>
        </p>
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 px-1 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        Toque para ver no mapa e no gráfico · barra: {emCurso ? "hoje" : "fim"}; traço: {anoRecebido}
        <span aria-hidden className="inline-block h-[11px] w-[2px] rounded-full" style={{ background: "var(--tinta-2)" }} />
      </p>

      <div className="mt-1.5">
        {secoes.map((s) => {
          const todas = [...s.itens, ...(s.desdobra?.linhas ?? [])];
          const aberta = todas.find(estaAberta) ?? null;
          const desdobrado = Boolean(s.desdobra) && todas.some((x) => x.vista && vistaAtiva(x.vista));
          const linhaDe = (x: LinhaTerritorio) => (
            <Linha x={x} cor={s.cor} ativa={x.vista ? vistaAcesa(x.vista) : false} aberto={estaAberta(x)} aoTocar={() => tocar(x)} />
          );
          return (
            <div key={s.titulo} data-grupo className="mt-2 first:mt-0">
              <div className="flex items-baseline gap-1.5 px-1">
                <span aria-hidden className="h-2 w-2 shrink-0 self-center rounded-[3px]" style={{ background: s.cor }} />
                <h3 className="text-[11.5px] font-semibold">{s.titulo}</h3>
                {s.detalhe && (
                  <span className="ml-auto truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                    {s.detalhe}
                  </span>
                )}
              </div>
              <ul className="mt-0.5">
                {s.itens.map((x) => (
                  <li key={x.id}>
                    {x.falta ? (
                      <SemMedida x={x} />
                    ) : s.desdobra?.troca === x.id ? (
                      <>
                        <Abrir aberto={!desdobrado}>{linhaDe(x)}</Abrir>
                        <Abrir aberto={desdobrado}>
                          <ul>
                            {s.desdobra.linhas.map((l) => (
                              <li key={l.id}>{linhaDe(l)}</li>
                            ))}
                          </ul>
                        </Abrir>
                      </>
                    ) : (
                      linhaDe(x)
                    )}
                  </li>
                ))}
              </ul>
              <Abrir aberto={aberta !== null}>{aberta && <div className="px-1"><Detalhe x={aberta} aoVerHistorico={aoVerHistorico} /></div>}</Abrir>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A linha de uma medida que não existe no recorte: o nome e o motivo, na mesma altura das outras. */
function SemMedida({ x }: { x: LinhaTerritorio }) {
  return (
    <p className="grid h-6 grid-cols-[6.9rem_minmax(0,1fr)] items-center gap-x-2 px-1">
      <span className="truncate text-[12px]" style={{ color: "var(--tinta-3)" }}>
        {x.rotulo}
      </span>
      <span className="truncate text-right text-[10.5px]" style={{ color: "var(--tinta-3)" }} title={x.falta}>
        {x.falta}
      </span>
    </p>
  );
}

function Linha({ x, cor, ativa, aberto, aoTocar }: { x: LinhaTerritorio; cor: string | undefined; ativa: boolean; aberto: boolean; aoTocar: () => void }) {
  const fracao = x.proporcao === undefined ? null : Math.min(1, x.proporcao / ESCALA);
  const veredito = x.sentido === "bom" ? ", melhor que na posse" : x.sentido === "ruim" ? ", pior que na posse" : "";
  const acao = aberto ? "Fechar o gráfico" : ativa ? "Abrir o gráfico" : "Ver no mapa e no gráfico";
  return (
    <button
      type="button"
      data-linha={x.id}
      onClick={aoTocar}
      aria-pressed={ativa}
      aria-expanded={aberto}
      aria-label={`${x.rotulo}: ${x.agora}, ${x.mudanca} desde a posse${veredito}. ${acao}.`}
      className={`grid h-6 w-full grid-cols-[6.9rem_minmax(0,1fr)_3.9rem_3.05rem] items-center gap-x-2 rounded-md px-1 text-left ${ativa ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
    >
      <span className="truncate text-[12px]">{x.rotulo}</span>
      <span className="relative block h-[7px] rounded-full" style={{ background: "var(--faixa-a)" }} aria-hidden>
        {fracao !== null && fracao > 0 && (
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(1.5, fracao * 100)}%`, background: cor }} />
        )}
        <span className="absolute -inset-y-[2px] w-[2px] rounded-full" style={{ left: `${(1 / ESCALA) * 100}%`, background: "var(--tinta-2)" }} />
      </span>
      <span className="tabular truncate text-right text-[11.5px] font-medium">{x.agora}</span>
      <span className="flex justify-end">
        {/* Com três dígitos a casa decimal não cabe, e nem faz falta. */}
        <PilulaVeredito texto={x.mudanca.replace(/^([+\-−]\d{3,}),\d%$/, "$1%")} sentido={x.sentido} className="text-[10.5px]" />
      </span>
    </button>
  );
}
