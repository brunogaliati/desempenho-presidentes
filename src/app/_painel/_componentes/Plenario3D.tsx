"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { miniaturaParlamentar } from "../_dados/fotoParlamentar";
import { montarPlenario } from "../_dados/plenarioModelo";
import { Segmentos } from "./Vidro";
import estilos from "./Plenario3D.module.css";

/**
 * Maquete do plenário desenhada em canvas, sem biblioteca 3D.
 *
 * Cada quadro projeta caixas (bancadas, cadeiras, a Mesa) com uma câmera em
 * órbita e pinta do fundo para a frente. Só desenha quando algo muda: giro,
 * filtro, ponteiro ou tema. Fotos e cartão aparecem acima das cadeiras.
 */

type Vista = "plenario" | "mesa" | "planta";
type Angulos = { az: number; el: number };
const VISTAS: Record<Vista, Angulos> = {
  plenario: { az: 0, el: 0.62 },
  mesa: { az: Math.PI, el: 0.46 },
  planta: { az: 0, el: 1.5 },
};
const OPCOES_VISTA: { id: Vista | "livre"; rotulo: string }[] = [
  { id: "plenario", rotulo: "Plenário" },
  { id: "mesa", rotulo: "Da Mesa" },
  { id: "planta", rotulo: "Planta" },
];
/** Em tela estreita a maquete sobra em altura: a câmera sobe para aproveitá-la. */
const angulosDaVista = (v: Vista, largura: number): Angulos => v === "plenario" && largura < 640 ? { az: 0, el: 0.95 } : VISTAS[v];
const EL_MIN = 0.3;
const EL_MAX = 1.52;
const INTRO_MS = 1500;

export interface Assento {
  id: number;
  nome: string;
  partido: string;
  /** Cor CSS do partido (aceita `var()` e `light-dark()`). */
  cor: string;
}

interface Motor {
  pedir(): void;
  posicionarCartao(): void;
  irPara(alvo: Angulos, ms: number): void;
  girar(az: number, el: number): void;
}

type RGBA = [number, number, number, number];

const limitar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const suave = (t: number) => 1 - (1 - t) ** 3;
const salto = (t: number) => { const c = 1.6; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const diferencaAngular = (de: number, para: number) => {
  const d = (para - de) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map(p => p[0] ?? "").join("").toLocaleUpperCase("pt-BR");

// Luz fixa no mundo, vinda do alto e da galeria: girar muda o sombreado.
const LUZ = (() => { const v = [0.32, 0.58, 0.86]; const m = Math.hypot(...v); return v.map(x => x / m); })();
const sombreado = (nx: number, ny: number, nz: number) => 0.6 + 0.44 * Math.max(0, nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2]);

export function Plenario3D({ casa, assentos, destaque, realce, escolhido, fotos, cartaoId, cartaoFixo, cartao, rotulo, aoApontar, aoEscolher, compacta = false, camera = null }: {
  casa: "deputados" | "senadores";
  /** Na ordem das cadeiras: da esquerda para a direita de quem olha da galeria. */
  assentos: Assento[];
  /** `null` quando não há filtro. */
  destaque: Set<number> | null;
  /** Partido em pré-visualização (legenda sob o ponteiro). */
  realce: string | null;
  escolhido: number | null;
  /** Mostrar retratos acima das cadeiras em destaque. */
  fotos: boolean;
  cartaoId: number | null;
  cartaoFixo: boolean;
  cartao: ReactNode;
  rotulo: string;
  aoApontar: (id: number | null) => void;
  aoEscolher: (id: number | null) => void;
  /** Miniatura (o palco do Resumo): sem os botões de ângulo e sem a dica de girar. */
  compacta?: boolean;
  /** Para onde a câmera vai, quando quem usa conduz um passeio; `null` deixa onde está. */
  camera?: Angulos | null;
}) {
  const palco = useRef<HTMLDivElement>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const sonda = useRef<HTMLSpanElement>(null);
  const cartaoEl = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [vista, setVista] = useState<Vista | "livre">("plenario");
  const [girou, setGirou] = useState(false);
  const modelo = useMemo(() => montarPlenario(assentos.length), [assentos.length]);
  const atual = useRef({ casa, assentos, destaque, realce, escolhido, fotos, cartaoId, aoApontar, aoEscolher });

  useLayoutEffect(() => {
    atual.current = { casa, assentos, destaque, realce, escolhido, fotos, cartaoId, aoApontar, aoEscolher };
    motor.current?.posicionarCartao();
    motor.current?.pedir();
  });

  useEffect(() => {
    const palcoEl = palco.current;
    const canvas = tela.current;
    const sondaEl = sonda.current;
    if (!palcoEl || !canvas || !sondaEl) return;
    const ctx = canvas.getContext("2d");
    const amostra = document.createElement("canvas");
    amostra.width = amostra.height = 1;
    const pincelAmostra = amostra.getContext("2d", { willReadFrequently: true });
    if (!ctx || !pincelAmostra) return;

    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    const { cadeiras, fileiras, largura: L, raioExterno: RE, alturaTopo } = modelo;
    const N = cadeiras.length;
    let desligado = false;

    // ── Cores: lidas do CSS (tema claro/escuro) e sombreadas com cache ──────
    const cores: RGBA[] = [];
    const indiceCor = new Map<string, number>();
    const cacheTom = new Map<number, string>();
    let sombra = "rgba(0,0,0,.15)";
    const ler = (css: string): RGBA => {
      sondaEl.style.color = "";
      sondaEl.style.color = css;
      const calculada = getComputedStyle(sondaEl).color;
      pincelAmostra.clearRect(0, 0, 1, 1);
      pincelAmostra.fillStyle = "#000";
      pincelAmostra.fillStyle = calculada;
      pincelAmostra.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = pincelAmostra.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const corIndice = (css: string) => {
      let i = indiceCor.get(css);
      if (i === undefined) { i = cores.length; cores.push(ler(css)); indiceCor.set(css, i); }
      return i;
    };
    const TOKENS = ["--p3-piso", "--p3-carpete", "--p3-base", "--p3-bancada", "--p3-madeira", "--p3-parede", "--p3-acento", "--tinta", "--tinta-2", "--superficie"] as const;
    const [PISO, CARPETE, BASE, BANCADA, MADEIRA, PAREDE, ACENTO, TINTA, TINTA2, SUPERFICIE] = TOKENS.map(t => corIndice(`var(${t})`));
    const resolverCores = () => {
      for (const [css, i] of indiceCor) cores[i] = ler(css);
      cacheTom.clear();
      sondaEl.style.color = "var(--p3-sombra)";
      sombra = getComputedStyle(sondaEl).color;
    };
    const tom = (ci: number, k = 1, mistura = -1, t = 0): string => {
      const kq = Math.round(limitar(k, 0.4, 1.3) * 50);
      const tq = mistura < 0 ? 0 : Math.round(limitar(t, 0, 1) * 20);
      const chave = ((ci * 64 + (tq ? mistura : 0)) * 21 + tq) * 66 + kq;
      let s = cacheTom.get(chave);
      if (s) return s;
      let [r, g, b] = cores[ci];
      if (tq) {
        const m = cores[mistura], f = tq / 20;
        r += (m[0] - r) * f; g += (m[1] - g) * f; b += (m[2] - b) * f;
      }
      const kk = kq / 50;
      if (kk <= 1) { r *= kk; g *= kk; b *= kk; } else { r += (255 - r) * (kk - 1); g += (255 - g) * (kk - 1); b += (255 - b) * (kk - 1); }
      s = `rgb(${r | 0},${g | 0},${b | 0})`;
      cacheTom.set(chave, s);
      return s;
    };
    const alfa = (ci: number, a: number) => { const [r, g, b] = cores[ci]; return `rgba(${r},${g},${b},${a})`; };

    // ── Ligação cadeira ↔ pessoa (refeita se a lista mudar) ────────────────
    let assentosVistos: Assento[] | null = null;
    const corDe = new Int16Array(N);
    const indice = new Map<number, number>();
    const rotuloFoto: string[] = [];
    const sincronizar = () => {
      const lista = atual.current.assentos;
      if (lista === assentosVistos) return;
      assentosVistos = lista;
      indice.clear();
      for (let i = 0; i < N; i++) {
        const a = lista[i];
        if (!a) continue;
        indice.set(a.id, i);
        corDe[i] = corIndice(a.cor);
        rotuloFoto[i] = iniciais(a.nome);
      }
    };

    // ── Estado animado por cadeira e projeções do último quadro ────────────
    const ergue = new Float32Array(N);
    const apaga = new Float32Array(N);
    const retrato = new Float32Array(N);
    const atraso = new Float32Array(N);
    for (let i = 0; i < N; i++) atraso[i] = (i / Math.max(1, N)) * 650 + cadeiras[i].fileira * 28;
    const px = new Float32Array(N), py = new Float32Array(N), pTopo = new Float32Array(N), pr = new Float32Array(N), pz = new Float32Array(N);
    const fx = new Float32Array(N), fy = new Float32Array(N), fr = new Float32Array(N), fz = new Float32Array(N);
    let comFoto: number[] = [];
    let apontado = -1;
    let escolhidoIdx = -1;
    let cartaoIdx = -1;
    let primeiro = true;

    // ── Câmera ──────────────────────────────────────────────────────────────
    const semMovimento = reduzir.matches;
    const inicial = angulosDaVista("plenario", palcoEl.clientWidth);
    const cam: Angulos = semMovimento ? { ...inicial } : { az: -0.5, el: 1.22 };
    let transicao: { de: Angulos; para: Angulos; t0: number; ms: number } | null = semMovimento ? null : { de: { ...cam }, para: { ...inicial }, t0: performance.now() + 120, ms: INTRO_MS };
    const introT0 = semMovimento ? -Infinity : performance.now() + 120;
    let giro = 0;
    const alvo = { x: 0, y: RE * 0.32, z: 0.4 };
    const dist = RE * 2.5 + 6;
    let CX = 0, CY = 0, CZ = 0, RX = 0, RY = 0, UX = 0, UY = 0, UZ = 0, FX = 0, FY = 0, FZ = 0, ESC = 1, OX = 0, OY = 0;
    let W = 0, H = 0, dpr = 1;

    // Pontos que precisam caber na tela, de qualquer ângulo.
    const RP = RE + 0.8, YF = -3.3, RPAREDE = 2.95, APAREDE = 0.32;
    // O painel atrás da Mesa acompanha o tamanho do plenário.
    const ALTURA_PAREDE = Math.min(2.05, 0.8 + RE * 0.13);
    const limites: number[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = (Math.PI * k) / 8;
      limites.push(RP * Math.cos(a), RP * Math.sin(a), -0.35, RP * Math.cos(a), RP * Math.sin(a), 0);
      limites.push(RE * Math.cos(a), RE * Math.sin(a), alturaTopo + 2.2);
    }
    limites.push(-RP, YF, -0.35, RP, YF, -0.35, -RP, YF, 0, RP, YF, 0, 0, -RPAREDE, ALTURA_PAREDE + 0.3);

    const prepararCamera = () => {
      const ce = Math.cos(cam.el), se = Math.sin(cam.el), ca = Math.cos(cam.az), sa = Math.sin(cam.az);
      CX = alvo.x + dist * sa * ce; CY = alvo.y + dist * ca * ce; CZ = alvo.z + dist * se;
      FX = -sa * ce; FY = -ca * ce; FZ = -se;
      RX = -ca; RY = sa;
      UX = -sa * se; UY = -ca * se; UZ = ce;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < limites.length; i += 3) {
        const vx = limites[i] - CX, vy = limites[i + 1] - CY, vz = limites[i + 2] - CZ;
        const zc = vx * FX + vy * FY + vz * FZ;
        const sx = (vx * RX + vy * RY) / zc, sy = -(vx * UX + vy * UY + vz * UZ) / zc;
        if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
      }
      // No celular os botões de vista ficam embaixo; no resto, no canto de cima, onde a maquete não chega.
      const lado = W < 640 ? 4 : 16, topo = W < 640 ? 8 : 14, base = W < 640 ? 52 : 18;
      ESC = Math.min((W - 2 * lado) / (x1 - x0), (H - topo - base) / (y1 - y0));
      OX = lado + (W - 2 * lado) / 2 - ESC * (x0 + x1) / 2;
      OY = topo + (H - topo - base) / 2 - ESC * (y0 + y1) / 2;
    };

    // ── Primitivas ─────────────────────────────────────────────────────────
    const P = new Float64Array(64);
    const proj = (x: number, y: number, z: number, k: number) => {
      const vx = x - CX, vy = y - CY, vz = z - CZ;
      const zc = vx * FX + vy * FY + vz * FZ;
      P[2 * k] = OX + ESC * (vx * RX + vy * RY) / zc;
      P[2 * k + 1] = OY - ESC * (vx * UX + vy * UY + vz * UZ) / zc;
      return zc;
    };
    const profundidade = (x: number, y: number, z: number) => (x - CX) * FX + (y - CY) * FY + (z - CZ) * FZ;
    const quad = (a: number, b: number, c: number, d: number, cor: string, emenda = false) => {
      ctx.beginPath();
      ctx.moveTo(P[2 * a], P[2 * a + 1]); ctx.lineTo(P[2 * b], P[2 * b + 1]);
      ctx.lineTo(P[2 * c], P[2 * c + 1]); ctx.lineTo(P[2 * d], P[2 * d + 1]);
      ctx.closePath();
      ctx.fillStyle = cor;
      ctx.fill();
      // Superfícies grandes viram vários pedaços; o traço da mesma cor fecha as frestas.
      if (emenda) { ctx.strokeStyle = cor; ctx.lineWidth = 0.8; ctx.stroke(); }
    };
    const CANTOS = [-1, -1, 1, -1, 1, 1, -1, 1];
    /**
     * Caixa orientada: tangente (tx, ty), normal (ty, −tx). Desenha só as faces voltadas para a câmera
     * e, em `faces`, só as que podem aparecer: bits 1 −n, 2 +t, 4 +n, 8 −t, 16 topo.
     */
    const caixa = (cx: number, cy: number, tx: number, ty: number, hw: number, hd: number, z0: number, z1: number, ci: number, mistura = -1, t = 0, contorno = false, faces = 31) => {
      const nx = ty, ny = -tx;
      for (let k = 0; k < 4; k++) {
        const a = CANTOS[2 * k] * hw, b = CANTOS[2 * k + 1] * hd;
        const x = cx + a * tx + b * nx, y = cy + a * ty + b * ny;
        proj(x, y, z0, k); proj(x, y, z1, k + 4);
      }
      if (contorno) { ctx.lineWidth = 1.6; ctx.lineJoin = "round"; }
      for (let k = 0; k < 4; k++) {
        if (!(faces & (1 << k))) continue;
        const mx = k === 0 ? -nx : k === 1 ? tx : k === 2 ? nx : -tx;
        const my = k === 0 ? -ny : k === 1 ? ty : k === 2 ? ny : -ty;
        const ext = k % 2 ? hw : hd;
        if ((CX - (cx + mx * ext)) * mx + (CY - (cy + my * ext)) * my <= 0) continue;
        quad(k, (k + 1) % 4, ((k + 1) % 4) + 4, k + 4, tom(ci, sombreado(mx, my, 0), mistura, t));
        if (contorno) { ctx.strokeStyle = tom(TINTA); ctx.stroke(); }
      }
      if (faces & 16 && CZ > z1) {
        quad(4, 5, 6, 7, tom(ci, sombreado(0, 0, 1), mistura, t));
        if (contorno) { ctx.strokeStyle = tom(TINTA); ctx.stroke(); }
      }
    };
    const halo = (x: number, y: number, z: number, raio: number, ci: number) => {
      ctx.beginPath();
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        proj(x + raio * Math.cos(a), y + raio * Math.sin(a), z, 0);
        if (k) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]);
      }
      ctx.closePath();
      ctx.fillStyle = alfa(ci, 0.3);
      ctx.fill();
      ctx.strokeStyle = alfa(ci, 0.9);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    // ── Peças fixas: piso, degraus, Mesa e painel ──────────────────────────
    const contornoPiso: [number, number][] = [];
    for (let k = 0; k <= 28; k++) { const a = (Math.PI * k) / 28; contornoPiso.push([RP * Math.cos(a), RP * Math.sin(a)]); }
    contornoPiso.push([-RP, YF], [RP, YF]);
    const piso = () => {
      const n = contornoPiso.length;
      // Sombra da maquete na página.
      ctx.save();
      ctx.shadowColor = sombra;
      ctx.shadowBlur = Math.max(16, ESC * 0.02);
      ctx.shadowOffsetY = Math.max(6, ESC * 0.008);
      ctx.beginPath();
      contornoPiso.forEach(([x, y], k) => { proj(x, y, -0.35, 0); if (k) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]); });
      ctx.closePath();
      ctx.fillStyle = tom(BASE);
      ctx.fill();
      ctx.restore();
      for (let k = 0; k < n; k++) {
        const [x0, y0] = contornoPiso[k], [x1, y1] = contornoPiso[(k + 1) % n];
        const ex = y1 - y0, ey = -(x1 - x0), m = Math.hypot(ex, ey) || 1;
        if ((CX - (x0 + x1) / 2) * ex + (CY - (y0 + y1) / 2) * ey <= 0) continue;
        proj(x0, y0, -0.35, 0); proj(x1, y1, -0.35, 1); proj(x1, y1, 0, 2); proj(x0, y0, 0, 3);
        quad(0, 1, 2, 3, tom(BASE, sombreado(ex / m, ey / m, 0)), true);
      }
      ctx.beginPath();
      contornoPiso.forEach(([x, y], k) => { proj(x, y, 0, 0); if (k) ctx.lineTo(P[0], P[1]); else ctx.moveTo(P[0], P[1]); });
      ctx.closePath();
      ctx.fillStyle = tom(PISO, sombreado(0, 0, 1));
      ctx.fill();
    };

    const blocos: { f: number; a0: number; a1: number }[] = [];
    fileiras.forEach((f, i) => {
      const k = Math.max(6, Math.ceil(f.raio * 2.4));
      for (let j = 0; j < k; j++) blocos.push({ f: i, a0: (Math.PI * j) / k, a1: (Math.PI * (j + 1)) / k });
    });
    const ordemBlocos = blocos.map((_, i) => i);
    const profBlocos = new Float64Array(blocos.length);
    const ultimoDaFileira = (b: { a1: number }) => Math.abs(b.a1 - Math.PI) < 1e-9;
    const bloco = (b: { f: number; a0: number; a1: number }) => {
      const f = fileiras[b.f];
      const ultimo = b.f === fileiras.length - 1;
      const piso0 = b.f === 0 ? 0 : fileiras[b.f - 1].z;
      const c0 = Math.cos(b.a0), s0 = Math.sin(b.a0), c1 = Math.cos(b.a1), s1 = Math.sin(b.a1);
      const am = (b.a0 + b.a1) / 2, cm = Math.cos(am), sm = Math.sin(am);
      const listra = b.f % 2 ? 0.965 : 1;
      // Espelho do degrau, do lado da Mesa.
      if ((CX - f.interno * cm) * -cm + (CY - f.interno * sm) * -sm > 0) {
        proj(f.interno * c0, f.interno * s0, piso0, 0); proj(f.interno * c1, f.interno * s1, piso0, 1);
        proj(f.interno * c1, f.interno * s1, f.z, 2); proj(f.interno * c0, f.interno * s0, f.z, 3);
        quad(0, 1, 2, 3, tom(CARPETE, sombreado(-cm, -sm, 0) * 0.94), true);
      }
      // Costas da arquibancada.
      if (ultimo && (CX - f.externo * cm) * cm + (CY - f.externo * sm) * sm > 0) {
        proj(f.externo * c0, f.externo * s0, 0, 0); proj(f.externo * c1, f.externo * s1, 0, 1);
        proj(f.externo * c1, f.externo * s1, f.z, 2); proj(f.externo * c0, f.externo * s0, f.z, 3);
        quad(0, 1, 2, 3, tom(BASE, sombreado(cm, sm, 0)), true);
      }
      // Pontas da arquibancada, vistas de trás da Mesa.
      if (CY < 0 && (b.a0 === 0 || ultimoDaFileira(b))) {
        const x = b.a0 === 0 ? 1 : -1;
        proj(x * f.interno, 0, 0, 0); proj(x * f.externo, 0, 0, 1); proj(x * f.externo, 0, f.z, 2); proj(x * f.interno, 0, f.z, 3);
        quad(0, 1, 2, 3, tom(BASE, sombreado(0, -1, 0)), true);
      }
      proj(f.interno * c0, f.interno * s0, f.z, 0); proj(f.interno * c1, f.interno * s1, f.z, 1);
      proj(f.externo * c1, f.externo * s1, f.z, 2); proj(f.externo * c0, f.externo * s0, f.z, 3);
      quad(0, 1, 2, 3, tom(CARPETE, sombreado(0, 0, 1) * listra), true);
    };

    type Peca = { cx: number; cy: number; hw: number; hd: number; z0: number; z1: number; cor: number; vies?: number };
    const pecasMesa: Peca[] = [
      { cx: 0, cy: -0.5, hw: 2.2, hd: 0.95, z0: 0, z1: 0.3, cor: BANCADA, vies: 2 },
      { cx: 0, cy: -0.75, hw: 1.8, hd: 0.3, z0: 0.3, z1: 0.92, cor: MADEIRA },
      ...[-2, -1, 0, 1, 2].map(k => ({ cx: k * 0.62, cy: -1.3, hw: 0.17, hd: 0.12, z0: 0.3, z1: 1.08, cor: ACENTO })),
      { cx: 0, cy: 0.9, hw: 0.36, hd: 0.2, z0: 0, z1: 0.98, cor: MADEIRA },
    ];
    const SEGMENTOS_PAREDE = 12;
    const parede = (j: number) => {
      const a0 = Math.PI + APAREDE + ((Math.PI - 2 * APAREDE) * j) / SEGMENTOS_PAREDE;
      const a1 = Math.PI + APAREDE + ((Math.PI - 2 * APAREDE) * (j + 1)) / SEGMENTOS_PAREDE;
      const am = (a0 + a1) / 2, cm = Math.cos(am), sm = Math.sin(am);
      // Só a face voltada para o plenário: de trás, o painel some e não tapa a Mesa.
      if ((CX - RPAREDE * cm) * -cm + (CY - RPAREDE * sm) * -sm <= 0) return;
      const x0 = RPAREDE * Math.cos(a0), y0 = RPAREDE * Math.sin(a0), x1 = RPAREDE * Math.cos(a1), y1 = RPAREDE * Math.sin(a1);
      proj(x0, y0, 0, 0); proj(x1, y1, 0, 1); proj(x1, y1, ALTURA_PAREDE, 2); proj(x0, y0, ALTURA_PAREDE, 3);
      quad(0, 1, 2, 3, tom(PAREDE, sombreado(-cm, -sm, 0)), true);
      proj(x0, y0, ALTURA_PAREDE, 0); proj(x1, y1, ALTURA_PAREDE, 1); proj(x1, y1, ALTURA_PAREDE + 0.27, 2); proj(x0, y0, ALTURA_PAREDE + 0.27, 3);
      quad(0, 1, 2, 3, tom(ACENTO, sombreado(-cm, -sm, 0)), true);
    };

    // ── Cadeira com bancada ────────────────────────────────────────────────
    let agoraQuadro = 0;
    const surgir = (i: number) => {
      const t = (agoraQuadro - introT0 - atraso[i]) / 520;
      return t >= 1 ? 1 : t <= 0 ? 0 : salto(t);
    };
    const pontas = new Uint8Array(N).fill(1 | 4 | 16);
    for (let i = 0; i < N; i++) {
      const c = cadeiras[i];
      const vizinho = (j: number) => cadeiras.some(o => o.fileira === c.fileira && Math.abs(o.angulo - (c.angulo + j * c.vao)) < c.vao * 0.25);
      if (!vizinho(1)) pontas[i] |= 2;
      if (!vizinho(-1)) pontas[i] |= 8;
    }
    const cadeira = (i: number) => {
      const c = cadeiras[i];
      const e = surgir(i);
      if (e <= 0.02) { pr[i] = 0; return; }
      const cos = Math.cos(c.angulo), sin = Math.sin(c.angulo);
      const tx = -sin, ty = cos;
      const z = c.z, lev = ergue[i];
      const foco = i === apontado || i === escolhidoIdx;
      const ci = corDe[i], dim = apaga[i];
      if (foco) halo(c.x, c.y, z + 0.01, 0.5, ci);
      const rb = c.raio - 0.3;
      const fora = (CX - c.x) * cos + (CY - c.y) * sin > 0;
      // A bancada é contínua: as laterais só aparecem na ponta de cada setor, e o assento parado
      // fica escondido entre a bancada e o encosto, então basta o tampo.
      const bancada = () => caixa(rb * cos, rb * sin, tx, ty, rb * c.vao / 2 - 0.004, 0.09, z, z + 0.44 * e, BANCADA, -1, 0, false, pontas[i]);
      const assento = () => caixa(c.x, c.y, tx, ty, L / 2, 0.13, z + lev, z + lev + 0.26 * e, ci, CARPETE, dim, foco, lev > 0.02 || e < 1 ? 31 : 16);
      const rc = c.raio + 0.1;
      const encosto = () => caixa(rc * cos, rc * sin, tx, ty, L / 2, 0.045, z + lev + 0.26 * e, z + lev + 0.84 * e, ci, CARPETE, dim, foco);
      if (fora) { bancada(); assento(); encosto(); } else { encosto(); assento(); bancada(); }
      proj(c.x, c.y, z + lev + 0.5 * e, 8);
      px[i] = P[16]; py[i] = P[17];
      pz[i] = profundidade(c.x, c.y, z + lev + 0.5 * e);
      proj(rc * cos, rc * sin, z + lev + 0.84 * e, 8);
      pTopo[i] = P[17];
      pr[i] = Math.max(5, (ESC * L * 0.75) / pz[i]);
    };

    // ── Retratos acima das cadeiras ────────────────────────────────────────
    const fotosCarregadas = new Map<number, HTMLCanvasElement | null>();
    const recortar = (img: HTMLImageElement) => {
      const t = document.createElement("canvas");
      t.width = t.height = 112;
      const c = t.getContext("2d");
      if (!c) return null;
      const lado = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - lado) / 2;
      const sy = img.naturalHeight > img.naturalWidth ? Math.min(img.naturalHeight - lado, img.naturalHeight * 0.05) : 0;
      c.beginPath(); c.arc(56, 56, 56, 0, Math.PI * 2); c.clip();
      c.drawImage(img, sx, sy, lado, lado, 0, 0, 112, 112);
      return t;
    };
    const carregarFoto = (id: number) => {
      if (fotosCarregadas.has(id)) return;
      fotosCarregadas.set(id, null);
      const src = miniaturaParlamentar(atual.current.casa, id);
      if (!src) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { if (desligado) return; fotosCarregadas.set(id, recortar(img)); pedir(); };
      img.src = src;
    };
    const retratos = () => {
      comFoto = [];
      for (let i = 0; i < N; i++) if (retrato[i] >= 0.02 && pr[i] > 0 && surgir(i) > 0.6) comFoto.push(i);
      const maior = comFoto.length > 30 ? 18 : 24;
      for (const i of comFoto) {
        const c = cadeiras[i];
        const z = c.z + ergue[i] + 0.84 + 0.62 + (c.fileira % 2) * 0.34;
        fz[i] = proj(c.x, c.y, z, 0);
        fx[i] = P[0]; fy[i] = P[1];
        fr[i] = limitar((ESC * 0.3) / fz[i], 9, maior) * Math.min(1, surgir(i));
      }
      comFoto.sort((a, b) => fz[b] - fz[a]);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const i of comFoto) {
        const t = retrato[i];
        const r = fr[i] * (t >= 1 ? 1 : salto(t));
        const x = fx[i], y = fy[i];
        const a = assentosVistos?.[i];
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.strokeStyle = alfa(TINTA, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px[i], pTopo[i]); ctx.lineTo(x, y + r); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = tom(corDe[i]); ctx.fill();
        const imagem = a ? fotosCarregadas.get(a.id) : null;
        if (imagem) ctx.drawImage(imagem, x - r, y - r, 2 * r, 2 * r);
        else {
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = tom(SUPERFICIE); ctx.fill();
          ctx.fillStyle = tom(TINTA2);
          ctx.font = `600 ${Math.max(8, r * 0.7) | 0}px system-ui, sans-serif`;
          ctx.fillText(rotuloFoto[i] ?? "", x, y + 0.5);
        }
        if (i === apontado) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.strokeStyle = tom(TINTA); ctx.lineWidth = 1.6; ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    };

    // ── Quadro ─────────────────────────────────────────────────────────────
    const itens: number[] = [];
    const profItens: number[] = [];
    const MESA0 = N, PAREDE0 = N + pecasMesa.length, TOTAL_ITENS = PAREDE0 + SEGMENTOS_PAREDE;
    for (let i = 0; i < TOTAL_ITENS; i++) { itens.push(i); profItens.push(0); }

    const pintar = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!W || !H) return;
      prepararCamera();
      piso();
      for (let k = 0; k < blocos.length; k++) {
        const b = blocos[k], f = fileiras[b.f];
        const am = (b.a0 + b.a1) / 2, rm = (f.interno + f.externo) / 2;
        profBlocos[k] = profundidade(rm * Math.cos(am), rm * Math.sin(am), f.z / 2);
      }
      ordemBlocos.sort((a, b) => profBlocos[b] - profBlocos[a]);
      for (const k of ordemBlocos) bloco(blocos[k]);

      for (let i = 0; i < N; i++) { const c = cadeiras[i]; profItens[i] = profundidade(c.x, c.y, c.z + 0.4); }
      pecasMesa.forEach((p, j) => { profItens[MESA0 + j] = profundidade(p.cx, p.cy, (p.z0 + p.z1) / 2) + (p.vies ?? 0); });
      for (let j = 0; j < SEGMENTOS_PAREDE; j++) {
        const am = Math.PI + APAREDE + ((Math.PI - 2 * APAREDE) * (j + 0.5)) / SEGMENTOS_PAREDE;
        profItens[PAREDE0 + j] = profundidade(RPAREDE * Math.cos(am), RPAREDE * Math.sin(am), 1);
      }
      itens.sort((a, b) => profItens[b] - profItens[a]);
      for (const k of itens) {
        if (k < MESA0) cadeira(k);
        else if (k < PAREDE0) { const p = pecasMesa[k - MESA0]; caixa(p.cx, p.cy, 1, 0, p.hw, p.hd, p.z0, p.z1, p.cor); }
        else parede(k - PAREDE0);
      }
      retratos();
    };

    const atualizarCadeiras = (dt: number) => {
      sincronizar();
      const p = atual.current;
      escolhidoIdx = p.escolhido == null ? -1 : indice.get(p.escolhido) ?? -1;
      cartaoIdx = p.cartaoId == null ? -1 : indice.get(p.cartaoId) ?? -1;
      const passo = semMovimento || reduzir.matches || primeiro ? 1 : 1 - Math.exp(-dt / 110);
      primeiro = false;
      let mexendo = false;
      for (let i = 0; i < N; i++) {
        const a = assentosVistos?.[i];
        if (!a) continue;
        const ativo = !p.destaque || p.destaque.has(a.id);
        const doRealce = p.realce != null && a.partido === p.realce;
        const alvoApaga = p.realce != null ? (doRealce ? 0 : 0.8) : ativo ? 0 : 0.86;
        const alvoErgue = i === apontado || i === escolhidoIdx ? 0.36 : doRealce ? 0.22 : p.destaque && ativo ? 0.12 : 0;
        const alvoRetrato = p.fotos && ativo && i !== cartaoIdx && (p.realce == null || doRealce) ? 1 : 0;
        if (alvoRetrato) carregarFoto(a.id);
        const da = alvoApaga - apaga[i], de = alvoErgue - ergue[i], dr = alvoRetrato - retrato[i];
        apaga[i] += Math.abs(da) < 0.004 ? da : da * passo;
        ergue[i] += Math.abs(de) < 0.004 ? de : de * passo;
        retrato[i] += Math.abs(dr) < 0.004 ? dr : dr * Math.min(1, passo * 0.8);
        if (apaga[i] !== alvoApaga || ergue[i] !== alvoErgue || retrato[i] !== alvoRetrato) mexendo = true;
      }
      return mexendo;
    };

    let pedido = 0;
    let ultimo = 0;
    const quadro = (agora: number) => {
      pedido = 0;
      agoraQuadro = agora;
      const dt = ultimo ? Math.min(64, agora - ultimo) : 16;
      ultimo = agora;
      let continuar = false;
      if (transicao) {
        const t = limitar((agora - transicao.t0) / transicao.ms, 0, 1);
        const e = suave(t);
        cam.az = transicao.de.az + diferencaAngular(transicao.de.az, transicao.para.az) * e;
        cam.el = transicao.de.el + (transicao.para.el - transicao.de.el) * e;
        if (t < 1) continuar = true; else transicao = null;
      } else if (giro && !arrasto) {
        cam.az += giro * dt;
        giro *= Math.exp(-dt / 380);
        if (Math.abs(giro) < 0.00003) giro = 0; else continuar = true;
      }
      if (atualizarCadeiras(dt)) continuar = true;
      if (agora - introT0 < INTRO_MS + 200) continuar = true;
      pintar();
      posicionarCartao();
      if (continuar) pedir(); else ultimo = 0;
    };
    function pedir() { if (!pedido && !desligado) pedido = requestAnimationFrame(quadro); }

    function posicionarCartao() {
      const el = cartaoEl.current;
      if (!el) return;
      sincronizar();
      const id = atual.current.cartaoId;
      const i = id == null ? -1 : indice.get(id) ?? -1;
      if (i < 0 || !W || pr[i] === 0) { el.style.visibility = "hidden"; return; }
      const w = el.offsetWidth, h = el.offsetHeight;
      const x = limitar(px[i] - w / 2, 4, Math.max(4, W - w - 4));
      let y = pTopo[i] - h - 16;
      const abaixo = y < 2;
      if (abaixo) y = py[i] + pr[i] + 14;
      el.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`;
      el.style.setProperty("--seta", `${Math.round(limitar(px[i] - x, 18, w - 18))}px`);
      el.dataset.abaixo = String(abaixo);
      el.style.visibility = "visible";
    }

    // ── Ponteiro, toque e teclado ──────────────────────────────────────────
    const inativo = (i: number) => {
      const p = atual.current, a = assentosVistos?.[i];
      return !a || (p.destaque != null && !p.destaque.has(a.id));
    };
    /** Cadeira sob o ponto; no toque, `folga` aceita a mais próxima dentro desse raio. */
    const acertar = (mx: number, my: number, folga = 0) => {
      for (let k = comFoto.length - 1; k >= 0; k--) {
        const i = comFoto[k];
        if ((mx - fx[i]) ** 2 + (my - fy[i]) ** 2 <= (fr[i] + 3) ** 2) return i;
      }
      let melhor = -1, perto = Infinity, vizinha = -1, menor = folga * folga;
      for (let i = 0; i < N; i++) {
        if (pr[i] === 0 || inativo(i)) continue;
        const dx = mx - px[i], dy = my - py[i], d = dx * dx + dy * dy, r = pr[i] * 1.25;
        if (d <= r * r && pz[i] < perto) { melhor = i; perto = pz[i]; }
        if (d < menor) { vizinha = i; menor = d; }
      }
      return melhor >= 0 ? melhor : vizinha;
    };
    const apontar = (i: number) => {
      if (i === apontado) return;
      apontado = i;
      canvas.dataset.alvo = String(i >= 0);
      atual.current.aoApontar(i >= 0 ? assentosVistos?.[i]?.id ?? null : null);
      pedir();
    };
    const sairDaVista = () => setVista("livre");

    let arrasto: { id: number; x: number; y: number; az: number; el: number; movido: boolean; toque: boolean; t: number; ux: number } | null = null;
    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
    const aoBaixar = (e: PointerEvent) => {
      if (e.button !== 0) return;
      arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, az: cam.az, el: cam.el, movido: false, toque: e.pointerType !== "mouse", t: e.timeStamp, ux: e.clientX };
      giro = 0;
    };
    const aoMover = (e: PointerEvent) => {
      if (arrasto && arrasto.id === e.pointerId) {
        const dx = e.clientX - arrasto.x, dy = e.clientY - arrasto.y;
        if (!arrasto.movido && Math.hypot(dx, dy) > 6) {
          arrasto.movido = true;
          try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
          canvas.dataset.arrastando = "true";
          transicao = null;
          apontar(-1);
          sairDaVista();
          setGirou(true);
        }
        if (arrasto.movido) {
          const k = 2.8 / Math.max(360, W);
          cam.az = arrasto.az + dx * k;
          if (!arrasto.toque) cam.el = limitar(arrasto.el + dy * k, EL_MIN, EL_MAX);
          const dt = e.timeStamp - arrasto.t;
          if (dt > 0) giro = limitar(giro * 0.6 + (((e.clientX - arrasto.ux) * k) / dt) * 0.4, -0.0028, 0.0028);
          arrasto.t = e.timeStamp;
          arrasto.ux = e.clientX;
          pedir();
        }
        return;
      }
      if (e.pointerType === "mouse") { const [mx, my] = local(e); apontar(acertar(mx, my)); }
    };
    const aoSoltar = (e: PointerEvent) => {
      if (!arrasto || arrasto.id !== e.pointerId) return;
      const clique = !arrasto.movido && e.type === "pointerup";
      const inercia = arrasto.movido && e.type === "pointerup" && !reduzir.matches && e.timeStamp - arrasto.t < 90;
      if (!inercia) giro = 0;
      arrasto = null;
      canvas.dataset.arrastando = "false";
      if (clique) {
        const [mx, my] = local(e);
        const i = acertar(mx, my, e.pointerType === "mouse" ? 0 : 20);
        atual.current.aoEscolher(i >= 0 ? assentosVistos?.[i]?.id ?? null : null);
        if (e.pointerType !== "mouse") apontar(-1);
      }
      pedir();
    };
    const aoSair = () => { if (!arrasto) apontar(-1); };
    canvas.addEventListener("pointerdown", aoBaixar);
    canvas.addEventListener("pointermove", aoMover);
    canvas.addEventListener("pointerup", aoSoltar);
    canvas.addEventListener("pointercancel", aoSoltar);
    canvas.addEventListener("pointerleave", aoSair);

    // ── Tamanho, tema e ciclo de vida ──────────────────────────────────────
    const medir = () => {
      W = palcoEl.clientWidth;
      H = palcoEl.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (pedido) cancelAnimationFrame(pedido);
      quadro(performance.now());
    };
    const observadorTamanho = new ResizeObserver(medir);
    observadorTamanho.observe(palcoEl);
    const trocarTema = () => { resolverCores(); pedir(); };
    const observadorTema = new MutationObserver(trocarTema);
    observadorTema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const esquemaEscuro = window.matchMedia("(prefers-color-scheme: dark)");
    esquemaEscuro.addEventListener("change", trocarTema);
    const aoReduzir = () => { if (reduzir.matches) { transicao = null; giro = 0; } pedir(); };
    reduzir.addEventListener("change", aoReduzir);
    resolverCores();
    sincronizar();

    motor.current = {
      pedir,
      posicionarCartao,
      irPara(para, ms) {
        giro = 0;
        if (reduzir.matches || ms <= 0) { transicao = null; cam.az = para.az; cam.el = para.el; }
        else transicao = { de: { ...cam }, para: { az: para.az, el: limitar(para.el, EL_MIN, EL_MAX) }, t0: performance.now(), ms };
        pedir();
      },
      girar(az, el) {
        sairDaVista();
        const base = transicao?.para ?? cam;
        this.irPara({ az: base.az + az, el: limitar(base.el + el, EL_MIN, EL_MAX) }, 260);
      },
    };

    return () => {
      desligado = true;
      if (pedido) cancelAnimationFrame(pedido);
      motor.current = null;
      observadorTamanho.disconnect();
      observadorTema.disconnect();
      esquemaEscuro.removeEventListener("change", trocarTema);
      reduzir.removeEventListener("change", aoReduzir);
      canvas.removeEventListener("pointerdown", aoBaixar);
      canvas.removeEventListener("pointermove", aoMover);
      canvas.removeEventListener("pointerup", aoSoltar);
      canvas.removeEventListener("pointercancel", aoSoltar);
      canvas.removeEventListener("pointerleave", aoSair);
    };
  }, [modelo]);

  // O passeio de fora: a câmera desliza até o ângulo pedido (sem movimento, salta).
  const camAz = camera?.az, camEl = camera?.el;
  useEffect(() => {
    if (camAz === undefined || camEl === undefined) return;
    motor.current?.irPara({ az: camAz, el: camEl }, 1700);
  }, [camAz, camEl]);

  const escolherVista = (v: Vista | "livre") => {
    if (v === "livre") return;
    setVista(v);
    motor.current?.irPara(angulosDaVista(v, palco.current?.clientWidth ?? 1000), 900);
  };
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) {
      if (e.key === "Escape" && cartaoFixo) { aoEscolher(null); palco.current?.focus(); }
      return;
    }
    const passos: Record<string, [number, number]> = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, 0.14], ArrowDown: [0, -0.14] };
    const passo = passos[e.key];
    if (passo) { e.preventDefault(); setGirou(true); motor.current?.girar(...passo); return; }
    if (e.key === "Escape" && escolhido != null) { e.preventDefault(); aoEscolher(null); }
  };

  return <div ref={palco} className={estilos.palco} data-casa={casa} data-compacta={compacta || undefined} tabIndex={0} role="group" aria-roledescription="maquete 3D" aria-label={`${rotulo} Use as setas do teclado para girar.`} onKeyDown={teclas}>
    <span ref={sonda} className={estilos.sonda} aria-hidden="true" />
    <canvas ref={tela} className={estilos.tela} aria-hidden="true" />
    <div className={estilos.vistas}>
      <Segmentos opcoes={OPCOES_VISTA} ativo={vista} aoEscolher={escolherVista} rotulo="Ângulo da maquete" classeBotao="px-3 py-1" />
    </div>
    <p className={estilos.dica} data-escondida={girou} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
        <span className={estilos.dicaPonteiro}>Arraste para girar · clique numa cadeira</span>
        <span className={estilos.dicaToque}>Deslize para girar · toque numa cadeira</span>
    </p>
    <div ref={cartaoEl} className={estilos.cartao} data-fixo={cartaoFixo} style={{ visibility: "hidden" }}>{cartao}</div>
  </div>;
}
