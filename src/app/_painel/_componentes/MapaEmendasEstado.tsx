"use client";

import { useMemo } from "react";
import type { MunicipioEmenda } from "../_dados/emendasParlamentarModelo";
import { useMalhaMunicipal } from "./municipiosAmbiente";
import { formatar, titulo } from "./formatos";
import t from "./TerminalParlamentar.module.css";

/** Quantos municípios ganham o pulso e o número da posição. */
const DESTAQUES = 5;

type Ponto = { x: number; y: number };

/** Caixa e centro de um contorno da malha (só M/L/Z absolutos, em coordenadas do mapa nacional). */
function medir(d: string) {
  const n = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, a = 0, cx = 0, cy = 0;
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = n[i], y = n[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (i + 3 < n.length) { const c = x * n[i + 3] - n[i + 2] * y; a += c; cx += (x + n[i + 2]) * c; cy += (y + n[i + 3]) * c; }
  }
  const centro: Ponto = Math.abs(a) > 1e-6 ? { x: cx / (3 * a), y: cy / (3 * a) } : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  // Contorno com ilhas pode jogar o centroide para fora: fica no centro da caixa.
  if (centro.x < x0 || centro.x > x1 || centro.y < y0 || centro.y > y1) { centro.x = (x0 + x1) / 2; centro.y = (y0 + y1) / 2; }
  return { x0, y0, x1, y1, centro };
}

/**
 * Onde cada "1º", "2º"… fica em volta do seu ponto, relativo a ele. Na ordem da posição, cada
 * rótulo tenta em cima, à direita, à esquerda, embaixo e nas diagonais, e fica no primeiro lugar
 * que não cobre outro rótulo nem o núcleo de outro destaque: cidades vizinhas no topo do ranking
 * deixam de empilhar os números.
 */
function posicionarRotulos(centros: Ponto[], r: number, fonte: number) {
  const meiaL = fonte * 0.75, meiaA = fonte * 0.55, dist = r * 2.6, lado = dist + meiaL - fonte * 0.35;
  const tentativas: Ponto[] = [
    { x: 0, y: -dist }, { x: lado, y: 0 }, { x: -lado, y: 0 }, { x: 0, y: dist },
    { x: lado, y: -dist }, { x: -lado, y: -dist }, { x: lado, y: dist }, { x: -lado, y: dist },
  ];
  const caixas: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const cobre = (c: { x0: number; y0: number; x1: number; y1: number }, proprio: number) =>
    caixas.some(o => c.x0 < o.x1 && c.x1 > o.x0 && c.y0 < o.y1 && c.y1 > o.y0)
    || centros.some((p, j) => j !== proprio && p.x + r * 1.6 > c.x0 && p.x - r * 1.6 < c.x1 && p.y + r * 1.6 > c.y0 && p.y - r * 1.6 < c.y1);
  return centros.map((p, i) => {
    const caixa = (o: Ponto) => ({ x0: p.x + o.x - meiaL, y0: p.y + o.y - meiaA, x1: p.x + o.x + meiaL, y1: p.y + o.y + meiaA });
    const escolha = tentativas.find(o => !cobre(caixa(o), i)) ?? tentativas[0];
    caixas.push(caixa(escolha));
    return escolha;
  });
}

/**
 * O estado do parlamentar com os municípios que receberam emendas pintados pelo valor (mais
 * escuro, mais dinheiro) e os maiores destinos pulsando, numerados como na tabela. Passar o
 * ponteiro numa linha da tabela ou no mapa acende o mesmo município nos dois.
 */
export function MapaEmendasEstado({ uf, linhas, medida, foco, aoFocar }: {
  uf: string;
  linhas: MunicipioEmenda[];
  medida: "destinado" | "pago" | "previsto";
  foco: string | null;
  aoFocar: (codigo: string | null) => void;
}) {
  const malha = useMalhaMunicipal();
  const valor = (m: MunicipioEmenda) => m[medida] ?? 0;
  const previsao = medida === "previsto";

  const desenho = useMemo(() => {
    if (!malha) return null;
    const formas = malha.filter(m => m.uf === uf).map(m => ({ ...m, ...medir(m.d) }));
    if (!formas.length) return null;
    const x0 = Math.min(...formas.map(f => f.x0)), y0 = Math.min(...formas.map(f => f.y0));
    const x1 = Math.max(...formas.map(f => f.x1)), y1 = Math.max(...formas.map(f => f.y1));
    const lado = Math.max(x1 - x0, y1 - y0);
    return { formas, caixa: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, folga: lado * 0.06, escala: lado / 100 };
  }, [malha, uf]);

  const porCodigo = useMemo(() => new Map(linhas.map(m => [m.codigo, m])), [linhas]);
  const ranking = useMemo(() => linhas.filter(m => valor(m) > 0).sort((a, b) => valor(b) - valor(a)), [linhas, medida]); // eslint-disable-line react-hooks/exhaustive-deps
  const posicao = useMemo(() => new Map(ranking.map((m, i) => [m.codigo, i])), [ranking]);
  const maximo = ranking.length ? valor(ranking[0]) : 0;
  const total = ranking.reduce((s, m) => s + valor(m), 0);

  if (!desenho) return <div className={t.mapaEmendas} aria-busy={!malha}><div className={t.mapaEmendasVazio}>{malha ? "Mapa indisponível para este estado." : ""}</div></div>;

  const { formas, caixa, folga, escala } = desenho;
  const viewBox = `${caixa.x - folga} ${caixa.y - folga} ${caixa.w + 2 * folga} ${caixa.h + 2 * folga}`;
  const destaques = ranking.slice(0, DESTAQUES).map(m => ({ m, f: formas.find(f => f.codigo === m.codigo) })).filter(d => d.f);
  const focado = foco ? porCodigo.get(foco) : undefined;
  const leitura = focado ?? ranking[0];
  const cor = (v: number) => `color-mix(in srgb, var(--cor-emendas) ${Math.round(28 + 72 * Math.sqrt(v / (maximo || 1)))}%, var(--superficie))`;
  const r = escala * 1.1;
  const rotulos = posicionarRotulos(destaques.map(d => d.f!.centro), r, escala * 3.6);

  return <figure className={t.mapaEmendas}>
    <svg viewBox={viewBox} role="img" aria-label={`Mapa de valores ${previsao ? "previstos em planos aprovados ou legados" : medida === "destinado" ? "destinados" : "pagos"} por município. ${ranking.slice(0, 3).map((m, i) => `${i + 1}º ${titulo(m.nome)}`).join(", ")}.`}
      onMouseLeave={() => aoFocar(null)}>
      <g className={t.mapaEmendasBase}>
        {formas.map(f => {
          const m = porCodigo.get(f.codigo);
          const v = m ? valor(m) : 0;
          const i = posicao.get(f.codigo);
          return <path key={f.codigo} d={f.d} data-recebeu={v > 0 ? "" : undefined} data-foco={foco === f.codigo ? "" : undefined}
            style={v > 0 ? { fill: cor(v), animationDelay: `${Math.min(i ?? 0, 30) * 40}ms` } : undefined}
            onMouseEnter={m ? () => aoFocar(f.codigo) : undefined}><title>{titulo(f.nome)}{m ? ` · ${m[medida] == null ? "Valor não informado" : formatar(v, "reaiscurto")}${previsao ? " previsto" : ""}` : ""}</title></path>;
        })}
      </g>
      {focado && (() => { const f = formas.find(x => x.codigo === focado.codigo); return f ? <path className={t.mapaEmendasContorno} d={f.d} /> : null; })()}
      <g aria-hidden="true">
        {destaques.map(({ m, f }, i) => <g key={m.codigo} transform={`translate(${f!.centro.x} ${f!.centro.y})`} className={t.mapaEmendasPulso}
          style={{ "--atraso": `${i * 0.45}s` } as React.CSSProperties}>
          <circle r={r * 3.2} className={t.mapaEmendasOnda} />
          <circle r={r * 3.2} className={t.mapaEmendasOnda} data-segunda="" />
          <circle r={r * (i === 0 ? 1.6 : 1.25)} className={t.mapaEmendasNucleo} />
          <text x={rotulos[i].x} y={rotulos[i].y} fontSize={escala * 3.6} dominantBaseline="central" className={t.mapaEmendasRotulo}>{i + 1}º</text>
        </g>)}
      </g>
    </svg>
    {(leitura || previsao) && <figcaption className={t.mapaEmendasLeitura} aria-live="polite">
      {leitura && <>
      <span>{posicao.has(leitura.codigo) ? `${posicao.get(leitura.codigo)! + 1}º · ` : ""}{titulo(leitura.nome)}</span>
      <strong>{leitura[medida] == null ? "Não informado" : formatar(valor(leitura), "reaiscurto")}</strong>
      <span>{total > 0 && leitura[medida] != null ? `${formatar(valor(leitura) / total * 100, "pct0")} do ${medida} com município` : `Valor ${medida}`} · {formatar(ranking.length, "inteiro")} de {formatar(formas.length, "inteiro")} municípios</span>
      </>}
      {previsao && <p className={t.nota}>{ranking.length ? "Previsão de planos aprovados ou legados, por município citado no objeto ou beneficiário municipal. Totais compartilhados e meros endereços ficam fora do mapa. Não comprova aplicação financeira no município nem entrega."
        : "Nenhuma parcela prevista de plano aprovado ou legado tem município identificável neste recorte. Isso não significa valor zero destinado."}</p>}
    </figcaption>}
  </figure>;
}
