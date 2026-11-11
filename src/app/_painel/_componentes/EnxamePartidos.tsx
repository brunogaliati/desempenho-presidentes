"use client";

import { useMemo, useState } from "react";

import { useLargura } from "@/lib/useLargura";
import { type CasaCongresso, porcento } from "../_dados/congressoModelo";
import type { DadosPainel } from "../_dados/tipos";
import type { Parlamentar } from "./DiretorioCongresso";
import { FotoParlamentar } from "./FotoParlamentar";
import { IdentidadePartido } from "./PainelEconomia";
import estilos from "./Parlamentares.module.css";

/** Um parlamentar no gráfico: a taxa (0 a 1) e de onde ela sai ("412 de 443 votos"). */
export type PontoEnxame = { pessoa: Parlamentar; valor: number; base: string };
export type LinhaEnxame = { partido: string; pontos: PontoEnxame[]; mediana: number };

const R = 4.5;
const FOLGA = 1;
const PASSO = 2 * R + FOLGA;
/** Faixas para cada lado do eixo antes de apertar: bancada grande e unida não vira uma torre. No celular, menos. */
const FAIXAS = 4;
const FAIXAS_ESTREITO = 3;
const ROTULO = 92;
const RESUMO = 96;
const VAO = 12;
const MARCAS = [0, 0.25, 0.5, 0.75, 1];
/** Posição no trilho de largura `t`, com folga para o ponto em 0% e em 100% não ser cortado. */
const escala = (v: number, t: number) => R + 2 + v * Math.max(0, t - 2 * (R + 2));
type Apontado = { currentTarget: SVGSVGElement; clientX: number; clientY: number };

/**
 * Um ponto por parlamentar, sem sobrepor: o x é o valor; o y, a primeira faixa livre,
 * alternando acima e abaixo do eixo. Passando de `faixas`, o enxame é achatado e os pontos
 * se tocam, com o anel da cor do fundo separando um do outro.
 */
function enxame(xs: number[], faixas: number): { ys: number[]; meiaAltura: number } {
  const ordem = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const ys = new Array<number>(xs.length).fill(0);
  const postos: { x: number; y: number }[] = [];
  const min2 = (2 * R + FOLGA) ** 2;
  for (const i of ordem) {
    const x = xs[i];
    const perto = postos.filter((p) => x - p.x < 2 * R + FOLGA);
    for (let k = 0; ; k++) {
      const y = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * PASSO;
      if (perto.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= min2)) {
        ys[i] = y;
        postos.push({ x, y });
        break;
      }
    }
  }
  const maior = Math.max(0, ...ys.map(Math.abs));
  const teto = faixas * PASSO;
  if (maior > teto) for (let i = 0; i < ys.length; i++) ys[i] *= teto / maior;
  return { ys, meiaAltura: Math.min(maior, teto) };
}

/**
 * O plenário por partido, sem a média: uma linha por partido, um ponto por parlamentar.
 * A média de uma bancada esconde quem vota diferente dela; o ponto mostra.
 * Passar o mouse diz quem é; clicar abre o crachá; o partido filtra a lista.
 * Os pontos têm a cor da bancada, a mesma da maquete; o nome do partido está sempre na linha.
 */
export function EnxamePartidos({ casa, linhas, governos, corDe, medianaCasa, rotuloCasa, oQue, aoEscolher, aoFiltrarPartido }: {
  casa: CasaCongresso;
  linhas: LinhaEnxame[];
  governos: DadosPainel["governos"];
  corDe: (partido: string | null) => string;
  /** A mediana da casa inteira, tracejada em todas as linhas. */
  medianaCasa: number | null;
  rotuloCasa: string;
  /** "com o governo", "de presença": completa a dica e o resumo de cada linha. */
  oQue: string;
  aoEscolher: (id: number) => void;
  aoFiltrarPartido: (partido: string) => void;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [sob, setSob] = useState<{ linha: number; ponto: number } | null>(null);
  const estreito = largura > 0 && largura < 560;
  const trilho = Math.max(0, estreito ? largura : largura - ROTULO - RESUMO - 2 * VAO);
  const x = (v: number) => escala(v, trilho);

  const desenho = useMemo(() => linhas.map((l) => {
    const xs = l.pontos.map((p) => escala(p.valor, trilho));
    const { ys, meiaAltura } = enxame(xs, estreito ? FAIXAS_ESTREITO : FAIXAS);
    return { xs, ys, altura: Math.ceil(2 * meiaAltura + 2 * R + 10) };
  }), [linhas, trilho, estreito]);

  const singular = casa === "deputados" ? "deputado" : "senador";
  const maisPerto = (e: Apontado, i: number, raio: number) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - caixa.left, my = e.clientY - caixa.top;
    const d = desenho[i];
    const meio = d.altura / 2;
    let melhor = -1, menor = raio * raio;
    for (let k = 0; k < d.xs.length; k++) {
      const dd = (d.xs[k] - mx) ** 2 + (meio + d.ys[k] - my) ** 2;
      if (dd < menor) { menor = dd; melhor = k; }
    }
    return melhor;
  };

  return <div ref={ref} className={estilos.enxame} data-estreito={estreito || undefined} style={{ ["--rotulo" as string]: `${ROTULO}px`, ["--resumo" as string]: `${RESUMO}px`, ["--vao" as string]: `${VAO}px` }}>
    {trilho > 0 && <>
      <div className={estilos.enxameEixo} aria-hidden="true">
        <span style={{ width: trilho }}>
          {MARCAS.map((m) => <span key={m} style={{ left: x(m) }}>{Math.round(m * 100)}%</span>)}
        </span>
      </div>
      <ol className={estilos.enxameLinhas}>
        {linhas.map((l, i) => {
          const d = desenho[i];
          if (!d) return null;
          const meio = d.altura / 2;
          const sigla = l.partido === "S/Partido" ? "sem partido" : l.partido;
          const valores = l.pontos.map((p) => p.valor);
          const quantos = `${l.pontos.length} ${l.pontos.length === 1 ? singular : rotuloCasa}`;
          const ativo = sob?.linha === i ? l.pontos[sob.ponto] : null;
          const ordemDesenho = l.pontos.map((_, k) => k).filter((k) => !ativo || l.pontos[k] !== ativo);
          return <li key={l.partido} className={estilos.enxameLinha}>
            <button type="button" className={estilos.enxamePartido} onClick={() => aoFiltrarPartido(l.partido)} aria-label={`Filtrar a lista por ${sigla}`}>
              <IdentidadePartido governos={governos} sigla={l.partido === "S/Partido" ? "SEM" : l.partido} />
            </button>
            <div className={estilos.enxameTrilho} style={{ width: trilho, height: d.altura }}>
              <svg width={trilho} height={d.altura} role="img"
                aria-label={`${sigla}: ${quantos}; ${l.pontos.length === 1 ? `${porcento(valores[0])} ${oQue}.`
                  : `${l.pontos.length >= 3 ? `mediana de ${porcento(l.mediana)} ${oQue}; ` : ""}de ${porcento(Math.min(...valores))} a ${porcento(Math.max(...valores))}.`}`}
                data-apontando={ativo ? "" : undefined}
                onPointerMove={(e) => { if (e.pointerType !== "mouse") return; const k = maisPerto(e, i, 12); setSob(k >= 0 ? { linha: i, ponto: k } : null); }}
                onPointerLeave={() => setSob(null)}
                onClick={(e) => { const k = maisPerto(e, i, 16); if (k >= 0) aoEscolher(l.pontos[k].pessoa.id); }}>
                {MARCAS.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={0} y2={d.altura} className={estilos.enxameGrade} />)}
                {medianaCasa !== null && <line x1={x(medianaCasa)} x2={x(medianaCasa)} y1={0} y2={d.altura} className={estilos.enxameMedianaCasa} />}
                {ordemDesenho.map((k) => <circle key={l.pontos[k].pessoa.id} cx={d.xs[k]} cy={meio + d.ys[k]} r={R} fill={corDe(l.partido)} className={estilos.enxamePonto} />)}
                {/* A mediana com um halo da cor do fundo, para não sumir dentro de uma bancada grande. */}
                {l.pontos.length >= 3 && [estilos.enxameMedianaHalo, estilos.enxameMediana].map((c) =>
                  <line key={c} x1={x(l.mediana)} x2={x(l.mediana)} y1={meio - Math.min(meio - 2, PASSO * 1.2)} y2={meio + Math.min(meio - 2, PASSO * 1.2)} className={c} />)}
                {ativo && sob && <circle cx={d.xs[sob.ponto]} cy={meio + d.ys[sob.ponto]} r={R + 2} fill={corDe(l.partido)} className={estilos.enxamePontoAtivo} />}
              </svg>
              {ativo && sob && <div className={estilos.dicaEnxame} role="status"
                style={{ left: Math.min(Math.max(d.xs[sob.ponto], 100), trilho - 100), top: meio + d.ys[sob.ponto] - R - 8 }}>
                <FotoParlamentar casa={casa} id={ativo.pessoa.id} nome={ativo.pessoa.nome} tamanho={32} />
                <span>
                  <strong>{ativo.pessoa.nome}</strong>
                  <span>{sigla} · {ativo.pessoa.uf}</span>
                  <span><b className="tabular">{porcento(ativo.valor)}</b> {oQue}</span>
                  <span className="tabular">{ativo.base}</span>
                </span>
              </div>}
            </div>
            <span className={`tabular ${estilos.enxameResumo}`}>
              {l.pontos.length >= 3 && <span>mediana <b>{porcento(l.mediana)}</b></span>}<span>{quantos}</span>
            </span>
          </li>;
        })}
      </ol>
    </>}
  </div>;
}
