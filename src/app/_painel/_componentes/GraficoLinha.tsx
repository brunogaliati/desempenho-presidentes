"use client";

import { createContext, useContext, useState, type PointerEvent } from "react";

import { corDoVeredito, sentidoDoTrecho, type Veredito } from "@/components/GraficoTempo";
import { useLargura } from "@/lib/useLargura";

import type { Formato } from "../_dados/tipos";
import { formatar } from "./formatos";

/**
 * Linha de uma série nacional desde 2021, com a posse marcada.
 *
 * Os dois anos antes da posse ficam numa faixa apagada: é o que o governo
 * recebeu, e a linha atravessa a marca sem quebrar, para o leitor ver se a
 * direção mudou ou só continuou. Passar o mouse mostra o ponto mais próximo
 * (cruz e valor), como pede a camada de hover da skill de dataviz.
 *
 * Mede a largura em pixels (`useLargura`) em vez de esticar um viewBox: texto
 * esticado sai deformado.
 */

/** A posse do mandato na tela: a faixa "antes da posse" e o traço de todos os gráficos. */
export const PosseContext = createContext("2023-01");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]}/${d.slice(2, 4)}`;

/** Até `n` marcas "redondas" cobrindo [min, max]. */
function marcas(min: number, max: number, n = 4): number[] {
  const bruto = (max - min) / n || 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
  const ini = Math.floor(min / passo) * passo;
  const lista: number[] = [];
  for (let v = ini; v <= max + passo * 0.001; v += passo) lista.push(Math.round(v * 1e6) / 1e6);
  return lista;
}

interface Props {
  datas: string[];
  valores: (number | null)[];
  formato: Formato;
  altura?: number;
  rotulo: string;
  diario?: boolean;
  mostrarPosse?: boolean;
  /** Pinta o trecho desde a posse numa cor só, com a régua do placar (ver `Veredito`). */
  veredito?: Veredito | null;
  /** A data no balão, quando não é o mês ("PRODES 2025"). */
  rotuloData?: (mes: string) => string;
}

export function GraficoLinha({ datas, valores, formato, altura = 300, rotulo, diario = false, mostrarPosse = true, veredito = null, rotuloData }: Props) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const posse = useContext(PosseContext);
  const eixo = (v: number) => (formato === "inteiro" || formato === "contagem" || formato === "km2") && Math.abs(v) >= 1000
    ? new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v) : formatar(v, formato);

  const M = { topo: 16, dir: 64, base: 28, esq: 48 };
  const L = Math.max(0, largura - M.esq - M.dir);
  const A = altura - M.topo - M.base;
  const n = valores.length;
  const tempos = datas.map((d) => new Date(`${d.length === 7 ? `${d}-01` : d}T12:00:00Z`).getTime());
  const dataLegivel = (d: string) => diario ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : rotuloData ? rotuloData(d) : rotuloMes(d);

  // A referência do veredito entra na escala: o traço dela tem que aparecer.
  const presentes = [...valores.filter((v): v is number => v !== null && Number.isFinite(v)), ...(veredito ? [veredito.referencia] : [])];
  const vmin = presentes.length ? Math.min(...presentes) : 0;
  const vmax = presentes.length ? Math.max(...presentes) : 0;
  const folga = (vmax - vmin) * 0.08 || Math.abs(vmax) * 0.1 || 1;
  // Séries de variação cruzam o zero; a linha do zero tem que aparecer.
  const cruzaZero = vmin < 0 && vmax > 0;
  const y0 = vmin - folga;
  const y1 = vmax + folga;
  const ticks = marcas(y0, y1).filter((v) => v >= y0 && v <= y1);

  const x = (i: number) => M.esq + (n <= 1 ? 0 : (tempos[i] - tempos[0]) / (tempos[n - 1] - tempos[0] || 1) * L);
  const y = (v: number) => M.topo + A - ((v - y0) / (y1 - y0)) * A;
  const iPosse = datas.findIndex((d) => d >= posse);
  const anos = datas
    .map((d, i) => ({ ano: d.slice(0, 4), i }))
    .filter((p, k, l) => k === 0 || p.ano !== l[k - 1].ano);
  const meses = datas.map((d, i) => ({ mes: d.slice(0, 7), i })).filter((p, k, ps) => k === 0 || p.mes !== ps[k - 1].mes);
  const marcasTempo = tempos.at(-1)! - tempos[0] < 550 * 86400000
    ? meses.filter((_, i) => i % Math.max(1, Math.ceil(meses.length / (largura < 520 ? 3 : 5))) === 0).map((p) => ({ texto: rotuloMes(p.mes), i: p.i }))
    : anos.filter((_, k) => largura >= 520 || k % 2 === 0).map((p) => ({ texto: p.ano, i: p.i }));

  // Os rótulos desviam da linha: "posse" riscado ou "recebido" em cima da curva não se lê.
  const alturaDaLinha = (px: number) => {
    for (let i = 1; i < n; i++) {
      const a = valores[i - 1];
      const b = valores[i];
      if (a === null || b === null || px < x(i - 1) || px > x(i)) continue;
      const t = x(i) === x(i - 1) ? 0 : (px - x(i - 1)) / (x(i) - x(i - 1));
      return y(a) + t * (y(b) - y(a));
    }
    return null;
  };
  const linhaPassaPor = (xa: number, xb: number, ya: number, yb: number) => {
    const alturas = Array.from({ length: 9 }, (_, k) => alturaDaLinha(xa + ((xb - xa) * k) / 8));
    return alturas.some((h, k) => {
      const prox = alturas[k + 1] ?? h;
      return h !== null && prox !== null && Math.max(h, prox) >= ya && Math.min(h, prox) <= yb;
    });
  };
  const xPosse = iPosse > 0 ? x(iPosse) + 6 : 0;
  const yPosse = iPosse > 0 && linhaPassaPor(xPosse - 2, xPosse + 34, M.topo + 2, M.topo + 18) ? M.topo + A - 6 : M.topo + 14;

  const caminho = valores.map((v, i) => v === null ? "" : `${i && valores[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ultimo = valores.findLastIndex((v) => v !== null);
  // O trecho julgado começa no último ponto antes de `desde` (o recebido),
  // para a área nascer com largura zero ali, e leva uma cor só: a do
  // último ponto contra a referência, ou a que quem chama mandou.
  const julgado = (() => {
    if (!veredito || largura <= 0) return null;
    const i = datas.findIndex((d) => d >= veredito.desde);
    if (i < 0) return null;
    const idx = valores.map((_, k) => k).filter((k) => k >= Math.max(0, i - 1) && valores[k] !== null);
    if (idx.length < 2) return null;
    const yRef = y(veredito.referencia);
    const linha = idx.map((k, n) => `${n ? "L" : "M"}${x(k).toFixed(1)},${y(valores[k]!).toFixed(1)}`).join("");
    const x0 = x(idx[0]);
    const area = `${linha}L${x(idx[idx.length - 1]).toFixed(1)},${yRef.toFixed(1)}L${x0.toFixed(1)},${yRef.toFixed(1)}Z`;
    const sentido = sentidoDoTrecho(veredito, valores[idx[idx.length - 1]]!);
    // O nome da referência vai do lado do traço por onde a linha não passa no
    // começo: em cima dela, "recebido: 3,9%" ficava riscado.
    const comeco = idx.slice(0, Math.max(2, Math.ceil(idx.length / 4)));
    const sobe = comeco.reduce((a, k) => a + valores[k]!, 0) / comeco.length >= veredito.referencia;
    const [primeiro, segundo] = sobe ? [yRef + 14, yRef - 6] : [yRef - 6, yRef + 14];
    const largo = (veredito.rotulo?.length ?? 0) * 5.7;
    const fim = M.esq + L - 4;
    // Sem lugar livre o nome some: a frase acima do gráfico já diz o número.
    const rotuloRef = [
      { x: x0 + 5, y: primeiro, ancora: "start" as const },
      { x: x0 + 5, y: segundo, ancora: "start" as const },
      { x: fim, y: primeiro, ancora: "end" as const },
      { x: fim, y: segundo, ancora: "end" as const },
    ].find((o) => {
      const xa = o.ancora === "end" ? o.x - largo : o.x;
      const ya = o.y - 10;
      const yb = o.y + 3;
      const cabe = xa + largo <= M.esq + L;
      const naPosse = mostrarPosse && iPosse > 0 && xa < xPosse + 36 && xa + largo > xPosse - 2 && ya < yPosse + 3 && yb > yPosse - 11;
      return cabe && !naPosse && !linhaPassaPor(xa, xa + largo, ya, yb);
    });
    return { linha, area, yRef, x0, faixa0: x(i), sentido, cor: corDoVeredito(sentido), rotuloRef };
  })();
  const corFinal = julgado ? julgado.cor : "var(--serie)";
  const consultar = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left - M.esq;
    const alvo = tempos[0] + Math.max(0, Math.min(1, px / (L || 1))) * (tempos[n - 1] - tempos[0]);
    setFoco(tempos.reduce((melhor, t, i) => Math.abs(t - alvo) < Math.abs(tempos[melhor] - alvo) ? i : melhor, 0));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height: altura }}>
      {largura > 0 && ultimo >= 0 && (
        <svg
          width={largura}
          height={altura}
          role="img"
          aria-label={`${rotulo}: de ${formatar(valores[0], formato)} em ${dataLegivel(datas[0])} a ${formatar(valores[ultimo], formato)} em ${dataLegivel(datas[ultimo])}. Use as setas para consultar os pontos.`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
            e.preventDefault();
            setFoco(e.key === "Escape" ? null : e.key === "Home" ? 0 : e.key === "End" ? n - 1
              : Math.max(0, Math.min(n - 1, (foco ?? ultimo) + (e.key === "ArrowLeft" ? -1 : 1))));
          }}
          onPointerMove={consultar}
          onPointerDown={consultar}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setFoco(null); }}
        >
          {mostrarPosse && iPosse > 0 && (
            <>
              <rect
                x={M.esq}
                y={M.topo}
                width={x(iPosse) - M.esq}
                height={A}
                fill="var(--faixa-a)"
              />
              {/* Num gráfico estreito o rótulo encostaria no "posse", e a linha pode passar por ele: só entra se couber. */}
              {x(iPosse) - M.esq > 96 && !linhaPassaPor(M.esq + 4, M.esq + 86, M.topo + 2, M.topo + 18) && (
                <text x={M.esq + 6} y={M.topo + 14} fill="var(--tinta-3)" style={{ fontSize: 11 }}>
                  antes da posse
                </text>
              )}
              <line
                x1={x(iPosse)}
                x2={x(iPosse)}
                y1={M.topo}
                y2={M.topo + A}
                stroke="var(--tinta-2)"
                strokeDasharray="3 3"
              />
            </>
          )}

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.esq}
                x2={M.esq + L}
                y1={y(t)}
                y2={y(t)}
                stroke={cruzaZero && t === 0 ? "var(--eixo)" : "var(--grade)"}
                strokeWidth={cruzaZero && t === 0 ? 1.5 : 1}
              />
              <text
                x={M.esq - 8}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="central"
                fill="var(--tinta-3)"
                className="tabular"
                style={{ fontSize: 11 }}
              >
                {eixo(t)}
              </text>
            </g>
          ))}

          {marcasTempo.filter((marca, indice, lista) => indice === 0 || x(marca.i) - x(lista[indice - 1].i) >= 58).map(({ texto, i }) => (
            <text
              key={texto}
              x={x(i)}
              y={altura - 8}
              textAnchor="middle"
              fill="var(--tinta-3)"
              className="tabular"
              style={{ fontSize: 11 }}
            >
              {texto}
            </text>
          ))}

          <path d={caminho} fill="none" stroke={julgado ? "var(--tinta-3)" : "var(--serie)"} strokeWidth={2} strokeLinejoin="round" />
          {/* O trecho julgado numa cor só: a faixa desde a posse, a área entre
              a linha e a referência, e a linha. */}
          {julgado && (
            <g pointerEvents="none">
              {julgado.sentido !== "neutro" && (
                <rect x={julgado.faixa0} y={M.topo} width={Math.max(0, M.esq + L - julgado.faixa0)} height={A} fill={julgado.cor} fillOpacity={0.09} />
              )}
              <path d={julgado.area} fill={julgado.cor} fillOpacity={julgado.sentido === "neutro" ? 0.08 : 0.2} />
              <line x1={julgado.x0} x2={M.esq + L} y1={julgado.yRef} y2={julgado.yRef} stroke="var(--tinta-2)" strokeDasharray="4 3" />
              {veredito?.rotulo && julgado.rotuloRef && (
                <text
                  x={julgado.rotuloRef.x}
                  y={julgado.rotuloRef.y}
                  textAnchor={julgado.rotuloRef.ancora}
                  fill="var(--tinta-2)"
                  stroke="var(--superficie)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  className="tabular"
                  style={{ fontSize: 10.5 }}
                >
                  {veredito.rotulo}
                </text>
              )}
              <path d={julgado.linha} fill="none" stroke={julgado.cor} strokeWidth={2.4} strokeLinejoin="round" />
            </g>
          )}
          {mostrarPosse && iPosse > 0 && (
            <text
              x={xPosse}
              y={yPosse}
              fill="var(--tinta-2)"
              stroke="var(--superficie)"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
              pointerEvents="none"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              posse
            </text>
          )}
          <circle cx={x(ultimo)} cy={y(valores[ultimo]!)} r={4} fill={corFinal} stroke="var(--superficie)" strokeWidth={2} />
          <text
            x={x(ultimo) + 8}
            y={y(valores[ultimo]!)}
            dominantBaseline="central"
            fill="var(--tinta)"
            className="tabular"
            style={{ fontSize: 12, fontWeight: 650 }}
          >
            {eixo(valores[ultimo]!)}
          </text>

          {foco !== null && valores[foco] !== null && (
            <g pointerEvents="none">
              <line x1={x(foco)} x2={x(foco)} y1={M.topo} y2={M.topo + A} stroke="var(--tinta-3)" />
              <circle cx={x(foco)} cy={y(valores[foco]!)} r={4} fill="var(--serie)" stroke="var(--superficie)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {foco !== null && largura > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-xs shadow-sm"
          style={{
            left: Math.min(x(foco) + 10, largura - 130),
            top: valores[foco] === null ? 10 : Math.max(0, y(valores[foco]!) - 46),
            background: "var(--superficie)",
            borderColor: "var(--borda)",
          }}
        >
          <span style={{ color: "var(--tinta-3)" }}>{dataLegivel(datas[foco])}</span>{" "}
          <strong className="tabular">{formatar(valores[foco], formato)}</strong>
        </div>
      )}
    </div>
  );
}

/**
 * Silhueta pequena, sem eixos. Desde 2021, com o trecho antes da posse
 * apagado; com `referencia`, o recebido tracejado, como o gráfico grande.
 */
export function Faisca({
  datas,
  valores,
  altura = 40,
  cor = "var(--serie)",
  referencia = null,
}: {
  datas: string[];
  valores: (number | null)[];
  altura?: number;
  cor?: string;
  referencia?: number | null;
}) {
  const posse = useContext(PosseContext);
  const L = 200;
  const n = valores.length;
  if (n < 2) return null;
  const presentes = [...valores.filter((v): v is number => v !== null), ...(referencia !== null ? [referencia] : [])];
  if (!presentes.length) return null;
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  const faixa = max - min || 1;
  const x = (i: number) => (i / (n - 1)) * L;
  const y = (v: number) => altura - 3 - ((v - min) / faixa) * (altura - 6);
  const iPosse = datas.findIndex((d) => d >= posse);

  return (
    <svg viewBox={`0 0 ${L} ${altura}`} className="block h-auto w-full" aria-hidden>
      {iPosse > 0 && <rect x={0} y={0} width={x(iPosse)} height={altura} fill="var(--faixa-a)" />}
      {referencia !== null && (
        <line x1={0} x2={L} y1={y(referencia)} y2={y(referencia)} stroke="var(--tinta-3)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      )}
      <path
        d={valores.map((v, i) => v === null ? "" : `${i && valores[i - 1] !== null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}
        fill="none"
        stroke={cor}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      {valores[n - 1] !== null && <circle cx={x(n - 1)} cy={y(valores[n - 1]!)} r={3} fill={cor} />}
    </svg>
  );
}
