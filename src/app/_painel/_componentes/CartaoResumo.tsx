"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { DESTINOS } from "@/components/Compartilhar";
import type { Sentido } from "@/lib/formatar";

import type { LinhaResumo } from "../_dados/resumoModelo";
import type { ItemPlacar } from "./placarModelo";
import s from "./AbaResumo.module.css";

/**
 * O card do resumo para redes sociais: uma imagem com o governo e os números dele,
 * em Feed (4:5) ou Stories (9:16), para baixar ou mandar direto ao Instagram e ao
 * WhatsApp. É desenhado aqui, num canvas, com os números que a página já mostra:
 * as fotos dos governadores são webp, que o gerador de imagem do servidor não lê, e
 * este card não é a capa do link (a capa continua sendo a das metatags).
 *
 * Mesma régua da página: verde e vermelho só para melhorou e piorou desde a posse;
 * orçamento, dívida e pessoal ficam neutros; o Brasil vai ao lado no estado; e o
 * rodapé diz que mudança durante um governo não prova que ele a causou.
 */

export interface FichaCartao {
  rotulo: string;
  valor: string;
  /** O último valor antes da posse, já escrito. */
  antes: string | null;
  mudanca: string | null;
  sentido: Sentido;
  nota: string;
  /** O Brasil no mesmo período, já escrito pelo resumo: "Brasil −26%". */
  brasil?: string | null;
  /** Uma segunda linha de texto, quando não há valor antes da posse para mostrar. */
  resto?: string;
}

export interface DadosCartao {
  /** "Governo de São Paulo" ou "Governo federal". */
  esfera: string;
  /** "2023–2026 · em curso". */
  periodo: string;
  nome: string;
  partido: string | null;
  logo: string | null;
  foto: string | null;
  bandeira: string | null;
  placarRotulo: string;
  bons: number;
  ruins: number;
  iguais: number;
  contraBrasil: string | null;
  /**
   * Embaixo do placar, o que o governo divide com a outra esfera ("Com os estados",
   * "Com a União"): uma linha por área, um quadradinho por medida, como no site.
   */
  divididas?: { titulo: string; itens: { nome: string; bons: number; ruins: number; iguais: number }[] } | null;
  fichas: FichaCartao[];
  fontes: string;
  /** Parte do nome do arquivo: "sp-2023-2026". */
  arquivo: string;
}

const ROTULO_CURTO: Record<string, [string, string]> = {
  "fiscal-divida": ["Dívida líquida", "% da receita corrente líquida"],
  "fiscal-pessoal": ["Gasto com pessoal", "% da receita líquida, 12 meses"],
};

/** Uma linha do resumo vira ficha; sem o valor de agora, fica fora do card. */
export function fichaDaLinha(l: LinhaResumo): FichaCartao | null {
  if (l.para === null) return null;
  const curto = ROTULO_CURTO[l.id];
  const ideb = l.id.startsWith("ideb");
  return {
    rotulo: curto?.[0] ?? (ideb ? `Ideb · ${l.nome.toLowerCase()}` : l.nome),
    valor: l.para,
    antes: l.de,
    mudanca: l.mudanca,
    sentido: l.mudanca === null ? "neutro" : l.sentido,
    nota: curto?.[1] ?? (ideb ? "posição entre 27 redes" : l.detalhe),
    brasil: l.brasil,
  };
}

/** Um item do placar da economia: a leitura dele ("Recebeu 5,8% em dez/2022. Em set/2026, 4,6%.") vira as duas linhas de baixo. */
export function fichaDoItem(i: ItemPlacar): FichaCartao {
  const [primeira, ...demais] = i.leitura.split(/(?<=\.)\s+/).map((x) => x.replace(/\.$/, ""));
  return { rotulo: i.rotulo, valor: i.agora, antes: null, mudanca: i.mudanca, sentido: i.sentido, nota: primeira ?? "", resto: demais[0] };
}

// --- Desenho -------------------------------------------------------------------

type Formato = "feed" | "stories";
const TAMANHO: Record<Formato, { w: number; h: number }> = { feed: { w: 1080, h: 1350 }, stories: { w: 1080, h: 1920 } };
const COR = {
  plano: "#f8fafd",
  tinta: "#263746",
  tinta2: "#46586a",
  tinta3: "#5f6e7b",
  grade: "#dde4ea",
  bom: "#2e795b",
  ruim: "#a3473a",
  ouro: "#d7b45b",
  serie: "#285c84",
  vidro: "rgba(255,255,255,0.8)",
};
const HOST_PADRAO = "desempenhodogoverno.com.br";

interface Imagens {
  foto: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  bandeira: HTMLImageElement | null;
}

function carregarImagem(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((ok) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** O vidro do site: branco translúcido, fio branco e uma sombra curta. */
function vidro(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  ctx.shadowColor = "rgba(38,55,70,0.10)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 6;
  retangulo(ctx, x, y, w, h, r);
  ctx.fillStyle = COR.vidro;
  ctx.fill();
  ctx.restore();
  retangulo(ctx, x, y, w, h, r);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A marca do site, a mesma da capa do link. */
function marca(ctx: CanvasRenderingContext2D, x: number, y: number, escala: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);
  retangulo(ctx, 0, 0, 64, 54, 13);
  ctx.fillStyle = "#15934d";
  ctx.fill();
  ctx.fillStyle = "#f3cb38";
  ctx.fill(new Path2D("M6 27 32 6 58 27 32 48Z"));
  ctx.beginPath();
  ctx.arc(32, 27, 13, 0, Math.PI * 2);
  ctx.fillStyle = "#285c84";
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.stroke(new Path2D("M20 23Q33 21 44 32"));
  ctx.restore();
}

export function desenharCartao(canvas: HTMLCanvasElement, d: DadosCartao, formato: Formato, img: Imagens, familia: string, link: string) {
  const { w: W, h: H } = TAMANHO[formato];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const stories = formato === "stories";
  const fonte = (peso: number, tam: number) => {
    ctx.font = `${peso} ${tam}px ${familia}`;
  };
  const largura = (t: string) => ctx.measureText(t).width;
  /** O maior tamanho, entre `max` e `min`, em que o texto cabe em uma linha. */
  const caber = (t: string, peso: number, max: number, min: number, espaco: number) => {
    for (let tam = max; tam > min; tam -= 1) {
      fonte(peso, tam);
      if (largura(t) <= espaco) return tam;
    }
    fonte(peso, min);
    return min;
  };
  /** Quebra em linhas; a última leva reticências se não couber. */
  const quebrar = (t: string, espaco: number, maxLinhas: number) => {
    const palavras = t.split(/\s+/).filter(Boolean);
    const linhas: string[] = [];
    let atual = "";
    for (const p of palavras) {
      const tentativa = atual ? `${atual} ${p}` : p;
      if (largura(tentativa) <= espaco || !atual) atual = tentativa;
      else {
        linhas.push(atual);
        atual = p;
      }
    }
    if (atual) linhas.push(atual);
    if (linhas.length > maxLinhas) {
      const cortadas = linhas.slice(0, maxLinhas);
      let ultima = cortadas[maxLinhas - 1];
      while (ultima.length > 1 && largura(`${ultima}…`) > espaco) ultima = ultima.slice(0, -1);
      cortadas[maxLinhas - 1] = `${ultima.trimEnd()}…`;
      return cortadas;
    }
    return linhas;
  };
  const texto = (t: string, x: number, y: number, cor: string, alinhar: CanvasTextAlign = "left") => {
    ctx.fillStyle = cor;
    ctx.textAlign = alinhar;
    ctx.fillText(t, x, y);
    ctx.textAlign = "left";
  };
  /** Pílula da mudança: chapada no veredito, neutra em cinza. Devolve a largura. */
  const pilula = (t: string, xDireita: number, yMeio: number, sentido: Sentido, tam: number) => {
    fonte(700, tam);
    const pw = largura(t) + tam * 1.1;
    const ph = tam * 1.62;
    retangulo(ctx, xDireita - pw, yMeio - ph / 2, pw, ph, ph / 2);
    ctx.fillStyle = sentido === "bom" ? COR.bom : sentido === "ruim" ? COR.ruim : "rgba(38,55,70,0.08)";
    ctx.fill();
    ctx.textBaseline = "middle";
    texto(t, xDireita - pw / 2, yMeio + 1, sentido === "neutro" ? COR.tinta2 : "#ffffff", "center");
    ctx.textBaseline = "alphabetic";
    return pw;
  };

  ctx.textBaseline = "alphabetic";
  // Fundo: o plano do painel e as duas ondas da capa do link.
  ctx.fillStyle = COR.plano;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.scale(W / 1200, (W / 1200) * (stories ? 1.5 : 1.15));
  ctx.fillStyle = "#d3e3d8";
  ctx.fill(new Path2D("M0 0H1200V78C1020 190 855 6 670 72S250 154 0 42Z"));
  ctx.fillStyle = "#c8d8e6";
  ctx.fill(new Path2D("M745 0H1200V180C1060 208 882 151 745 0Z"));
  ctx.restore();
  ctx.save();
  ctx.translate(0, H);
  ctx.scale(W / 1200, -(W / 1200) * 0.8);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#dbe7df";
  ctx.fill(new Path2D("M0 0H1200V50C1000 120 760 20 560 70S200 110 0 40Z"));
  ctx.restore();

  // No stories, o Instagram cobre o alto e a base da tela: as margens guardam esse espaço.
  const M = stories ? 64 : 52;
  const topo = stories ? 120 : 46;
  const base = stories ? 150 : 42;
  const larguraUtil = W - 2 * M;
  let y = topo;

  // Marca.
  const hMarca = 76;
  vidro(ctx, M, y, larguraUtil, hMarca, 26);
  marca(ctx, M + 22, y + (hMarca - 41) / 2, 0.76);
  fonte(700, 28);
  texto("Desempenho do Governo", M + 22 + 49 + 16, y + hMarca / 2 + 10, COR.tinta);
  fonte(500, 21);
  texto("Resumo do governo", M + larguraUtil - 24, y + hMarca / 2 + 8, COR.tinta2, "right");
  y += hMarca + (stories ? 16 : 20);

  // Cabeça: retrato, quem é e o placar.
  const divididas = (d.divididas?.itens ?? []).filter((a) => a.bons + a.ruins + a.iguais);
  // O placar (100) e o "contra o Brasil" (26), o título das divididas (42) e uma linha de 30 por área.
  const hPlacar = divididas.length ? 100 + (d.contraBrasil ? 26 : 0) + 42 + divididas.length * 30 + 20 : 0;
  const hCab = divididas.length ? (stories ? 212 + hPlacar : Math.max(206, 24 + hPlacar)) : stories ? 362 : 206;
  vidro(ctx, M, y, larguraUtil, hCab, 30);
  const pad = 26;
  const diam = stories ? 150 : 138;
  const cx = M + pad + diam / 2;
  const cy = stories ? y + pad + diam / 2 + 4 : y + hCab / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, diam / 2 + 9, 0, Math.PI * 2);
  ctx.fillStyle = COR.ouro;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, diam / 2 + 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, diam / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "#e9eef2";
  ctx.fillRect(cx - diam / 2, cy - diam / 2, diam, diam);
  if (img.foto) {
    // Como o object-fit: cover do site, com o rosto no terço de cima.
    const r = Math.max(diam / img.foto.naturalWidth, diam / img.foto.naturalHeight);
    const fw = img.foto.naturalWidth * r;
    const fh = img.foto.naturalHeight * r;
    ctx.drawImage(img.foto, cx - fw / 2, cy - diam / 2 - (fh - diam) * 0.3, fw, fh);
  } else if (img.bandeira) {
    const r = Math.max(diam / img.bandeira.naturalWidth, diam / img.bandeira.naturalHeight);
    ctx.drawImage(img.bandeira, cx - (img.bandeira.naturalWidth * r) / 2, cy - (img.bandeira.naturalHeight * r) / 2, img.bandeira.naturalWidth * r, img.bandeira.naturalHeight * r);
  }
  ctx.restore();

  // O placar ocupa a direita no feed e uma faixa embaixo no stories.
  const larguraPlacar = stories ? larguraUtil - 2 * pad : 290;
  const xTexto = M + pad + diam + 34;
  const larguraNome = stories ? M + larguraUtil - pad - xTexto : M + larguraUtil - pad - larguraPlacar - 30 - xTexto;
  const yNome = stories ? y + pad + 4 : y + (hCab - 134) / 2;
  let xs = xTexto;
  if (img.bandeira && img.foto) {
    const bh = 24;
    const bw = (img.bandeira.naturalWidth / Math.max(1, img.bandeira.naturalHeight)) * bh || 34;
    ctx.drawImage(img.bandeira, xs, yNome + 6, bw, bh);
    retangulo(ctx, xs, yNome + 6, bw, bh, 3);
    ctx.strokeStyle = "rgba(38,55,70,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    xs += bw + 10;
  }
  const sobre = `${d.esfera} · ${d.periodo}`;
  const espacoSobre = M + larguraUtil - pad - xs - (stories ? 0 : larguraPlacar + 30);
  caber(sobre, 500, 22, 17, espacoSobre);
  texto(quebrar(sobre, espacoSobre, 1)[0], xs, yNome + 26, COR.tinta2);
  const tamNome = caber(d.nome, 700, stories ? 60 : 50, 34, larguraNome);
  const linhasNome = quebrar(d.nome, larguraNome, 2);
  linhasNome.forEach((l, i) => texto(l, xTexto, yNome + 30 + tamNome + i * tamNome * 1.08, COR.tinta));
  const yPartido = yNome + 30 + tamNome + (linhasNome.length - 1) * tamNome * 1.08 + 18;
  if (d.partido) {
    let xp = xTexto;
    const lh = 40;
    if (img.logo) {
      const lw = Math.min(110, (img.logo.naturalWidth / Math.max(1, img.logo.naturalHeight)) * lh || lh);
      ctx.drawImage(img.logo, xp, yPartido, lw, lh);
      xp += lw + 12;
    }
    fonte(500, 22);
    texto(quebrar(d.partido, larguraNome - (xp - xTexto), 1)[0], xp, yPartido + lh / 2 + 8, COR.tinta2);
  }

  const xPlacar = stories ? M + pad : M + larguraUtil - pad - larguraPlacar;
  const yPlacar = stories ? y + 212 : divididas.length ? y + 24 : y + (hCab - 140) / 2;
  if (!stories) {
    ctx.beginPath();
    ctx.moveTo(xPlacar - 26, y + 26);
    ctx.lineTo(xPlacar - 26, y + hCab - 26);
    ctx.strokeStyle = "rgba(38,55,70,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(M + pad, yPlacar - 22);
    ctx.lineTo(M + larguraUtil - pad, yPlacar - 22);
    ctx.strokeStyle = "rgba(38,55,70,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  caber(d.placarRotulo, 500, 20, 16, larguraPlacar);
  texto(d.placarRotulo, xPlacar, yPlacar + 18, COR.tinta3);
  const julgadas = d.bons + d.ruins + d.iguais;
  if (julgadas) {
    let xn = xPlacar;
    const numeros: [number, string, string][] = [
      [d.bons, d.bons === 1 ? "melhorou" : "melhoraram", COR.bom],
      [d.ruins, d.ruins === 1 ? "piorou" : "pioraram", COR.ruim],
      ...(d.iguais ? [[d.iguais, d.iguais === 1 ? "igual" : "iguais", COR.tinta3] as [number, string, string]] : []),
    ];
    for (const [n, rot, cor] of numeros) {
      fonte(700, 46);
      texto(String(n), xn, yPlacar + 70, cor);
      xn += largura(String(n)) + 8;
      fonte(500, 20);
      texto(rot, xn, yPlacar + 70, cor);
      xn += largura(rot) + 22;
    }
    // A barra do placar, como no site.
    const yb = yPlacar + 88;
    const larguraBarra = larguraPlacar;
    let xb = xPlacar;
    const segs: [number, string][] = [[d.bons, COR.bom], [d.iguais, COR.grade], [d.ruins, COR.ruim]];
    const vao = 4;
    const util = larguraBarra - vao * (segs.filter(([n]) => n > 0).length - 1);
    for (const [n, cor] of segs) {
      if (!n) continue;
      const sw = (n / julgadas) * util;
      retangulo(ctx, xb, yb, sw, 12, 6);
      ctx.fillStyle = cor;
      ctx.fill();
      xb += sw + vao;
    }
    if (d.contraBrasil) {
      caber(d.contraBrasil, 500, 19, 15, larguraPlacar);
      texto(quebrar(d.contraBrasil, larguraPlacar, 1)[0], xPlacar, yb + 38, COR.tinta2);
    }
  } else {
    fonte(500, 20);
    quebrar("Ainda sem medida com dado antes e depois da posse.", larguraPlacar, 2).forEach((l, i) => texto(l, xPlacar, yPlacar + 56 + i * 26, COR.tinta2));
  }
  if (divididas.length) {
    let yd = yPlacar + (julgadas ? 88 + 12 + (d.contraBrasil ? 26 : 0) : 110) + 34;
    fonte(600, 15);
    texto((d.divididas?.titulo ?? "").toUpperCase(), xPlacar, yd, COR.tinta3);
    yd += 8;
    const lado = 14;
    const vaoQ = 4;
    for (const a of divididas) {
      const cores = [...Array(a.bons).fill(COR.bom), ...Array(a.iguais).fill(COR.grade), ...Array(a.ruins).fill(COR.ruim)] as string[];
      const larguraQ = cores.length * (lado + vaoQ) - vaoQ;
      let xq = xPlacar + larguraPlacar - larguraQ;
      for (const cor of cores) {
        retangulo(ctx, xq, yd + 9, lado, lado, 3);
        ctx.fillStyle = cor;
        ctx.fill();
        xq += lado + vaoQ;
      }
      caber(a.nome, 500, 20, 16, larguraPlacar - larguraQ - 14);
      texto(a.nome, xPlacar, yd + 22, COR.tinta2);
      yd += 30;
    }
  }
  y += hCab + (stories ? 16 : 20);

  // Rodapé.
  const hRodape = 64;
  const yRodape = H - base - hRodape;

  // Fichas: três colunas no feed, duas no stories; o convite ocupa duas casas.
  const colunas = stories ? 2 : 3;
  const vaoF = 16;
  const disponivel = yRodape - 18 - y;
  const hMin = stories ? 160 : 182;
  const maxLinhas = Math.max(1, Math.floor((disponivel + vaoF) / (hMin + vaoF)));
  const fichas = d.fichas.slice(0, maxLinhas * colunas - 2);
  const linhasGrade = Math.ceil((fichas.length + 2) / colunas);
  const hF = Math.min(stories ? 230 : 236, (disponivel - (linhasGrade - 1) * vaoF) / linhasGrade);
  const wF = (larguraUtil - (colunas - 1) * vaoF) / colunas;
  const padF = 22;

  fichas.forEach((f, i) => {
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    const x = M + col * (wF + vaoF);
    const yF = y + lin * (hF + vaoF);
    vidro(ctx, x, yF, wF, hF, 24);
    const dentro = wF - 2 * padF;
    // Rótulo: uma linha se couber em 20px, senão duas.
    const tamRot = caber(f.rotulo, 600, 22, 19, dentro);
    const linhasRot = largura(f.rotulo) <= dentro ? [f.rotulo] : quebrar(f.rotulo, dentro, 2);
    linhasRot.forEach((l, k) => texto(l, x + padF, yF + padF + tamRot + k * (tamRot + 5), COR.tinta2));
    const yValor = yF + padF + tamRot + (linhasRot.length - 1) * (tamRot + 5) + (stories ? 56 : 58);
    let pw = 0;
    if (f.mudanca) pw = pilula(f.mudanca, x + wF - padF, yValor - 17, f.sentido, stories ? 22 : 21);
    caber(f.valor, 700, 48, 26, dentro - pw - 12);
    texto(f.valor, x + padF, yValor, COR.tinta);
    // Embaixo: o valor antes da posse; depois, o que a medida é e o Brasil no mesmo período.
    const linhaA = f.antes ? `antes da posse: ${f.antes}` : f.nota;
    const linhaB = (f.antes ? [f.brasil, f.nota] : [f.brasil, f.resto]).filter(Boolean).join(" · ");
    let ys = yValor + (stories ? 30 : 32);
    caber(linhaA, 500, 19, 16, dentro);
    texto(quebrar(linhaA, dentro, 1)[0], x + padF, ys, COR.tinta2);
    ys += stories ? 24 : 25;
    if (linhaB && ys < yF + hF - 8) {
      caber(linhaB, 500, 18, 15, dentro);
      texto(quebrar(linhaB, dentro, 1)[0], x + padF, ys, COR.tinta3);
    }
  });

  // O convite para o site: duas casas (no stories, a linha inteira).
  {
    const i = fichas.length;
    const col = i % colunas;
    const lin = Math.floor(i / colunas);
    const span = col === colunas - 1 ? colunas : 2;
    const x = col === colunas - 1 ? M : M + col * (wF + vaoF);
    const yC = col === colunas - 1 ? y + (lin + 1) * (hF + vaoF) : y + lin * (hF + vaoF);
    const wC = span * wF + (span - 1) * vaoF;
    // O azul da marca em degradê, com as ondas da capa bem de leve por dentro.
    ctx.save();
    ctx.shadowColor = "rgba(29,69,102,0.28)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    retangulo(ctx, x, yC, wC, hF, 24);
    const fundo = ctx.createLinearGradient(x, yC, x + wC, yC + hF);
    fundo.addColorStop(0, "#2f6a96");
    fundo.addColorStop(1, "#1d4566");
    ctx.fillStyle = fundo;
    ctx.fill();
    ctx.restore();
    ctx.save();
    retangulo(ctx, x, yC, wC, hF, 24);
    ctx.clip();
    ctx.translate(x + wC * 0.25, yC + hF * 0.42);
    ctx.scale(wC / 1200, (wC / 1200) * 1.1);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = "#d3e3d8";
    ctx.fill(new Path2D("M0 0H1200V78C1020 190 855 6 670 72S250 154 0 42Z"));
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#c8d8e6";
    ctx.fill(new Path2D("M745 0H1200V180C1060 208 882 151 745 0Z"));
    ctx.restore();
    retangulo(ctx, x + 1, yC + 1, wC - 2, hF - 2, 23);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // A seta à direita; o texto, centrado na altura: chamada, domínio e o caminho em ouro.
    const raio = stories ? 30 : 28;
    const xSeta = x + wC - 30 - raio;
    const ySeta = yC + hF / 2;
    ctx.beginPath();
    ctx.arc(xSeta, ySeta, raio, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(xSeta - 10, ySeta);
    ctx.lineTo(xSeta + 10, ySeta);
    ctx.moveTo(xSeta + 2, ySeta - 8);
    ctx.lineTo(xSeta + 10, ySeta);
    ctx.lineTo(xSeta + 2, ySeta + 8);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.lineCap = "butt";

    const barra = link.indexOf("/");
    const dominio = barra < 0 ? link : link.slice(0, barra);
    const caminho = barra < 0 ? "" : link.slice(barra);
    const espaco = xSeta - raio - 24 - (x + 30);
    const tamChamada = caber("Veja cada número, com a fonte e o histórico", 500, 20, 15, espaco);
    const tamDominio = caber(dominio, 700, stories ? 36 : 32, 20, espaco);
    fonte(600, 24);
    const tamCaminho = caminho ? caber(caminho, 600, 24, 15, espaco) : 0;
    const alturaBloco = tamChamada + 14 + tamDominio + (caminho ? 10 + tamCaminho : 0);
    let yt = yC + (hF - alturaBloco) / 2;
    yt += tamChamada;
    fonte(500, tamChamada);
    texto("Veja cada número, com a fonte e o histórico", x + 30, yt - 2, "rgba(255,255,255,0.74)");
    yt += 14 + tamDominio;
    fonte(700, tamDominio);
    texto(dominio, x + 30, yt - 3, "#ffffff");
    if (caminho) {
      yt += 10 + tamCaminho;
      fonte(600, tamCaminho);
      texto(quebrar(caminho, espaco, 1)[0], x + 30, yt - 2, "#e2c57a");
    }
  }

  // Rodapé: a ressalva e as fontes.
  ctx.beginPath();
  ctx.moveTo(M, yRodape + 4);
  ctx.lineTo(M + larguraUtil, yRodape + 4);
  ctx.strokeStyle = "#d9e3e8";
  ctx.lineWidth = 2;
  ctx.stroke();
  fonte(600, 20);
  texto("Mudança durante um governo não prova que ele a causou.", M, yRodape + 36, COR.tinta);
  fonte(500, 18);
  texto(quebrar(`Fontes: ${d.fontes}`, larguraUtil, 1)[0], M, yRodape + 62, COR.tinta3);
}

// --- Diálogo -------------------------------------------------------------------

/**
 * Os destinos da imagem. Pelo navegador, nenhum aplicativo recebe imagem por link: no
 * celular, todos abrem o menu do aparelho com o arquivo; no computador, a imagem é baixada
 * e, onde existe, a conversa ou o post abrem com o texto pronto, para só anexar.
 */
interface DestinoCartao {
  id: "instagram" | "whatsapp" | "x" | "baixar" | "mais";
  nome: string;
  onde: string;
  /** A cor do disco; `marca` é a cor sólida que tinge a bolha da prévia. */
  cor: string;
  marca: string;
  tinta?: string;
  icone: ReactNode;
  dica: { toque: string; mesa: string };
  /** No computador: o endereço que abre depois de baixar a imagem. */
  abrir?: (texto: string, url: string) => string;
}

const ICONE = (d: string, tamanho = 24) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);
const porId = (id: string) => DESTINOS.find((d) => d.id === id)!;

const DESTINOS_CARTAO: DestinoCartao[] = [
  {
    id: "instagram",
    nome: "Instagram",
    onde: "no Instagram",
    cor: "radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%)",
    marca: "#d62976",
    icone: (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5.2" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    ),
    dica: {
      toque: "Abre o menu do aparelho: escolha o Instagram, no Feed ou nos Stories. A legenda vai copiada.",
      mesa: "O Instagram não recebe imagem pelo navegador: baixamos a imagem e copiamos a legenda.",
    },
  },
  {
    id: "whatsapp",
    nome: "WhatsApp",
    onde: "no WhatsApp",
    cor: porId("whatsapp").cor,
    marca: porId("whatsapp").cor,
    icone: ICONE(porId("whatsapp").glifo, 26),
    dica: {
      toque: "Abre o menu do aparelho: escolha o WhatsApp. A imagem vai com a legenda.",
      mesa: "Baixa a imagem e abre a conversa com a legenda pronta: é só anexar.",
    },
    abrir: (texto) => "https://api.whatsapp.com/send?text=" + encodeURIComponent(texto),
  },
  {
    id: "x",
    nome: "X",
    onde: "no X",
    cor: porId("x").cor,
    marca: porId("x").cor,
    tinta: porId("x").tinta,
    icone: ICONE(porId("x").glifo, 19),
    dica: {
      toque: "Abre o menu do aparelho: escolha o X. A legenda vai copiada.",
      mesa: "Baixa a imagem e abre o post com a frase e o link: é só anexar.",
    },
    // A legenda inteira passa do limite do X: vai a frase e o link.
    abrir: (texto, url) => "https://twitter.com/intent/tweet?text=" + encodeURIComponent(texto) + "&url=" + encodeURIComponent(url),
  },
  {
    id: "baixar",
    nome: "Baixar",
    onde: "no arquivo",
    cor: "var(--serie)",
    marca: "var(--serie)",
    icone: (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11m-5-5 5 5 5-5" />
        <path d="M5 19h14" />
      </svg>
    ),
    dica: { toque: "Salva a imagem no aparelho, para postar quando quiser.", mesa: "Salva a imagem no computador, para postar quando quiser." },
  },
  {
    id: "mais",
    nome: "Mais",
    onde: "em outros aplicativos",
    cor: porId("mais").cor,
    marca: "var(--serie)",
    tinta: porId("mais").tinta,
    icone: ICONE(porId("mais").glifo, 22),
    dica: { toque: "Abre o menu de compartilhamento do aparelho, com a imagem.", mesa: "Abre o menu de compartilhamento do aparelho, com a imagem." },
  },
];

const NOTA_CARTAO = "A imagem não tem link clicável: o endereço vai na legenda.";

export function CartaoResumo({
  dados,
  caminho,
  frase,
  extras,
}: {
  dados: DadosCartao;
  /** O caminho do resumo deste governo: "/?uf=SP". */
  caminho: string;
  /** A frase do placar, a mesma do botão Compartilhar. */
  frase: string;
  /** Fichas que chegam depois, quando o diálogo abre (a dívida, do Tesouro). */
  extras?: () => Promise<FichaCartao[]>;
}) {
  const id = useId();
  const gatilho = useRef<HTMLButtonElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined);
  const relogioSaida = useRef<ReturnType<typeof setTimeout>>(undefined);
  // O arquivo fica pronto assim que o desenho termina: no iPhone, o menu de compartilhar
  // só abre se for chamado no próprio toque, sem esperar a imagem ser gerada.
  const arquivo = useRef<File | null>(null);
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [formato, setFormato] = useState<Formato>("feed");
  const [maisFichas, setMaisFichas] = useState<FichaCartao[] | null>(null);
  const [pronto, setPronto] = useState(false);
  const [aviso, setAviso] = useState("");
  const [feito, setFeito] = useState<"baixada" | "legenda" | null>(null);
  const [alvo, setAlvo] = useState(DESTINOS_CARTAO[0]);
  const [texto, setTexto] = useState("");
  // No celular os destinos abrem o menu do aparelho; no computador, baixam a imagem.
  const [toque, setToque] = useState(false);
  const [podeArquivo, setPodeArquivo] = useState(false);

  const host = typeof window === "undefined" || /^(localhost|127\.|\d+\.\d+\.\d+\.\d+)/.test(window.location.hostname) ? HOST_PADRAO : window.location.host.replace(/^www\./, "");
  const link = `${host}${caminho}`;
  const url = `https://${link}`;
  const legenda = `${frase}\n\nCada número, com a fonte: ${url}\n\nFontes: ${dados.fontes}. Mudança durante um governo não prova que ele a causou.`;
  const esperando = Boolean(extras) && maisFichas === null;
  const { w: W, h: H } = TAMANHO[formato];
  const nomeArquivo = `resumo-${dados.arquivo}-${formato}.png`;

  useEffect(() => {
    const d = dialogo.current;
    if (aberto && d && !d.open) d.showModal();
  }, [aberto]);
  useEffect(
    () => () => {
      clearTimeout(relogio.current);
      clearTimeout(relogioSaida.current);
    },
    [],
  );

  // As fichas que dependem de outra consulta chegam uma vez por abertura; sem elas, o card sai assim mesmo.
  useEffect(() => {
    if (!aberto || !extras || maisFichas) return;
    let vivo = true;
    const limite = new Promise<FichaCartao[]>((ok) => setTimeout(() => ok([]), 12000));
    Promise.race([extras().catch(() => []), limite]).then((f) => vivo && setMaisFichas(f));
    return () => {
      vivo = false;
    };
  }, [aberto, extras, maisFichas]);

  useEffect(() => {
    if (!aberto || esperando || !canvas.current) return;
    let vivo = true;
    setPronto(false);
    (async () => {
      const familia = getComputedStyle(document.querySelector("main") ?? document.body).fontFamily || "system-ui, sans-serif";
      await Promise.all([document.fonts.load(`400 20px ${familia}`), document.fonts.load(`600 20px ${familia}`)]).catch(() => undefined);
      const [foto, logo, bandeira] = await Promise.all([carregarImagem(dados.foto), carregarImagem(dados.logo), carregarImagem(dados.bandeira)]);
      if (!vivo || !canvas.current) return;
      desenharCartao(canvas.current, { ...dados, fichas: [...dados.fichas, ...(maisFichas ?? [])] }, formato, { foto, logo, bandeira }, familia, link);
      arquivo.current = null;
      canvas.current.toBlob((b) => {
        if (!vivo) return;
        arquivo.current = b ? new File([b], `resumo-${dados.arquivo}-${formato}.png`, { type: "image/png" }) : null;
        setPronto(Boolean(b));
      }, "image/png");
    })();
    return () => {
      vivo = false;
    };
  }, [aberto, esperando, dados, maisFichas, formato, link]);

  const abrir = () => {
    const tocavel = matchMedia("(pointer: coarse)").matches;
    let arquivos = false;
    try {
      arquivos = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "teste.png", { type: "image/png" })] });
    } catch {
      /* Sem o menu do aparelho, os destinos baixam a imagem. */
    }
    setToque(tocavel && arquivos);
    setPodeArquivo(arquivos);
    setMaisFichas(null);
    setAviso("");
    setFeito(null);
    setSaindo(false);
    setAlvo(DESTINOS_CARTAO[0]);
    setTexto(legenda);
    setAberto(true);
  };
  const encerrar = () => {
    clearTimeout(relogioSaida.current);
    setAberto(false);
    setSaindo(false);
    gatilho.current?.focus({ preventScroll: true });
  };
  const fechar = () => {
    if (saindo) return;
    setSaindo(true);
    relogioSaida.current = setTimeout(() => {
      dialogo.current?.close();
      encerrar();
    }, 160);
  };
  const avisar = (t: string, qual: "baixada" | "legenda" | null = null) => {
    clearTimeout(relogio.current);
    setAviso(t);
    setFeito(qual);
    relogio.current = setTimeout(() => {
      setAviso("");
      setFeito(null);
    }, 3600);
  };
  const legendaAtual = texto.trim() || legenda;
  const baixar = (mensagem = "Imagem baixada.") => {
    const f = arquivo.current;
    if (!f) return avisar("A imagem ainda está sendo montada.");
    const endereco = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = endereco;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(endereco), 2000);
    avisar(mensagem, "baixada");
  };
  const copiarLegenda = (mensagem = "Legenda copiada.") =>
    navigator.clipboard.writeText(legendaAtual).then(
      () => avisar(mensagem, "legenda"),
      () => avisar("Não deu para copiar sozinho: copie a legenda da caixa acima."),
    );
  /** O menu do aparelho com a imagem; sai no mesmo toque, com a legenda copiada junto. */
  const menuDoAparelho = () => {
    const f = arquivo.current;
    if (!f) return avisar("A imagem ainda está sendo montada.");
    navigator.clipboard?.writeText(legendaAtual).catch(() => undefined);
    navigator.share({ files: [f], text: legendaAtual }).then(
      () => avisar("Pronto. A legenda está copiada para colar no post.", "legenda"),
      (e: Error) => {
        if (e.name !== "AbortError") baixar("O menu não abriu: baixei a imagem. Use Copiar legenda.");
      },
    );
  };
  const enviar = (d: DestinoCartao) => {
    if (d.id === "mais" || (toque && d.id !== "baixar")) return menuDoAparelho();
    if (d.id === "baixar") return baixar();
    if (d.id === "instagram") {
      baixar();
      void copiarLegenda("Imagem baixada e legenda copiada: poste pelo app do Instagram.");
      return;
    }
    baixar(d.id === "x" ? "Imagem baixada: anexe no post que abriu." : "Imagem baixada: anexe na conversa que abriu.");
    if (d.abrir) window.open(d.abrir(d.id === "x" ? frase : legendaAtual, url), "_blank", "noopener,noreferrer");
  };

  const destinos = DESTINOS_CARTAO.filter((d) => d.id !== "mais" || podeArquivo);
  const marca = { "--marca": alvo.marca } as CSSProperties;

  return (
    <>
      <button
        ref={gatilho}
        type="button"
        className="compartilhar-gatilho"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        title="Imagem para Instagram e WhatsApp"
        onClick={abrir}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <circle cx="9" cy="9.5" r="1.8" />
          <path d="m20.5 15.5-4.8-4.8L6 20.5" />
        </svg>
        <span>Imagem</span>
      </button>
      {aberto &&
        createPortal(
          <div className="painel-governo compartilhar-portal">
            <dialog
              ref={dialogo}
              id={id}
              aria-labelledby={`${id}-titulo`}
              className={`compartilhar-dialogo ${s.dialogoCartao}`}
              data-saindo={saindo || undefined}
              onCancel={(e) => {
                e.preventDefault();
                fechar();
              }}
              onClose={encerrar}
              onKeyDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) fechar();
              }}
            >
              <div className="vidro compartilhar-menu" style={marca}>
                <div className="compartilhar-rolagem">
                  <header className="compartilhar-topo">
                    <h2 id={`${id}-titulo`}>Compartilhar imagem</h2>
                    <button type="button" aria-label="Fechar" onClick={fechar}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <path d="m6 6 12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </header>

                  {/* No computador, a imagem à esquerda e o resto na lateral; no celular, um embaixo do outro. */}
                  <div className={s.cartaoGrade}>
                    <figure className="compartilhar-previa">
                      <figcaption>
                        <span>Como fica {alvo.onde}</span>
                        <span>
                          {W}×{H}
                        </span>
                      </figcaption>
                      <div className="compartilhar-bolha">
                        <div className={s.cartaoQuadro} data-formato={formato}>
                          <canvas ref={canvas} className={s.cartaoCanvas} data-pronto={pronto || undefined} role="img" aria-label={`Card de ${dados.nome}, ${dados.esfera}, ${dados.periodo}`} />
                          {(!pronto || esperando) && <span className={s.cartaoCarregando}>Montando a imagem…</span>}
                        </div>
                      </div>
                    </figure>

                    <div className={s.cartaoLado}>
                      <div className={`${s.esferas} ${s.formatoCartao}`} role="group" aria-label="Formato da imagem">
                        {(["feed", "stories"] as const).map((f) => (
                          <button key={f} type="button" className={s.esfera} aria-pressed={formato === f} onClick={() => setFormato(f)}>
                            {f === "feed" ? "Feed 4:5" : "Stories 9:16"}
                          </button>
                        ))}
                      </div>

                      <figure className={`compartilhar-previa ${s.cartaoLegenda}`}>
                        <figcaption>
                          <span>Legenda do post</span>
                          {texto !== legenda && (
                            <button type="button" onClick={() => setTexto(legenda)}>
                              Voltar à original
                            </button>
                          )}
                        </figcaption>
                        <div className="compartilhar-bolha">
                          <label className="compartilhar-frase">
                            <span className="sr-only">Legenda que acompanha a imagem</span>
                            <textarea value={texto} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setTexto(e.currentTarget.value)} rows={3} maxLength={1200} placeholder="Escreva a legenda do post" />
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                              <path d="m13.5 6.5 4 4" />
                            </svg>
                          </label>
                        </div>
                      </figure>

                      <div className="compartilhar-destinos" role="group" aria-label="Enviar para">
                        {destinos.map((d, i) => {
                          const estilo = { "--cor": d.cor, "--cor-tinta": d.tinta ?? "#fff", "--i": i } as CSSProperties;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              className="compartilhar-destino"
                              style={estilo}
                              disabled={!pronto || esperando}
                              onPointerEnter={() => setAlvo(d)}
                              onFocus={() => setAlvo(d)}
                              onClick={() => enviar(d)}
                            >
                              <span className="compartilhar-disco">{d.icone}</span>
                              <span>{d.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="compartilhar-dica">{toque ? alvo.dica.toque : alvo.dica.mesa}</p>

                      <div className="compartilhar-link" data-copiado={feito === "baixada" || undefined}>
                        <span className="compartilhar-url" title={nomeArquivo}>
                          <strong>{nomeArquivo}</strong>
                        </span>
                        <button type="button" className="botao-liquido compartilhar-copiar" disabled={!pronto || esperando} onClick={() => baixar()}>
                          {feito === "baixada" ? (
                            <>
                              <svg className="compartilhar-visto" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                              Baixada
                            </>
                          ) : (
                            <>Baixar imagem</>
                          )}
                        </button>
                      </div>
                      <div className="compartilhar-rodape">
                        <p data-aviso={aviso ? true : undefined}>
                          <span role="status">{aviso}</span>
                          {!aviso && NOTA_CARTAO}
                        </p>
                        <button type="button" onClick={() => copiarLegenda()}>
                          {feito === "legenda" ? "Copiada" : "Copiar legenda"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </dialog>
          </div>,
          document.body,
        )}
    </>
  );
}
