"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { FormaMunicipio, Formato, Leitura, Municipio, UF } from "../_dados/tipos";
import { formatar, pessoas, type Regua } from "./formatos";
import { Selo } from "./Selo";

/**
 * O Brasil por UF e, ao entrar num estado, por município.
 *
 * Os dois níveis estão na mesma projeção (`scripts/gerar-malhas.mjs`), então o
 * zoom é só uma troca de viewBox animada até a caixa do estado; os municípios
 * caem exatamente dentro do contorno. Os traços usam
 * `vector-effect: non-scaling-stroke` para não engrossarem com o zoom.
 *
 * Estados pequenos do litoral ganham uma etiqueta ao lado do mapa, ligada por
 * uma linha, com sigla e valor: no formato real do país eles somem, e a
 * etiqueta é ao mesmo tempo leitura e alvo de clique.
 *
 * A cor é sempre uma medida, nunca partido. Quem governa vai junto, como
 * símbolo ao lado da sigla (`marca`: logo sem moldura), e `realce` acende um grupo de estados, um
 * partido por exemplo, apagando os outros: a medida e o partido se leem ao
 * mesmo tempo.
 *
 * Além da cor, o mapa aceita um desenho por estado no lugar do número
 * (`glifo`: seta, minigráfico) e uma camada por cima de tudo (`camada`:
 * círculos). Quem desenha decide o que mostrar; o mapa só diz onde.
 */

export interface CamadaMunicipal {
  titulo: string;
  exemplo: boolean;
  formato: Formato;
  valor: (m: Municipio) => number | null;
  regua: Regua;
}

interface Props {
  ufs: UF[];
  largura: number;
  altura: number;
  leitura: Leitura;
  periodo: number;
  regua: Regua;
  selecionada: UF | null;
  aoSelecionar: (sigla: string | null) => void;
  formasMunicipais: FormaMunicipio[] | null;
  dadosMunicipais: Map<string, Municipio> | null;
  camadaMunicipal: CamadaMunicipal | null;
  /** Falso: escolher um estado só o destaca, sem aproximar o mapa. */
  zoom?: boolean;
  /**
   * Desenho no lugar do número de cada estado, centrado em (x, y). Nas
   * etiquetas do litoral (`naEtiqueta`) o espaço é menor: cerca de 70 × 30.
   */
  glifo?: (u: UF, x: number, y: number, naEtiqueta: boolean) => React.ReactNode;
  /**
   * Por cima dos estados e por baixo das siglas: círculos, por exemplo.
   * Recebe a escala do zoom (1 no país inteiro) para manter o tamanho na tela.
   */
  camada?: (escala: number) => React.ReactNode;
  /** Quanto de vizinhança o zoom mostra em volta do estado. */
  moldura?: Moldura;
  /**
   * Dentro de um estado, os vizinhos seguem com cor, sigla e número, só
   * apagados, em vez de virarem fundo cinza.
   */
  vizinhosNoZoom?: boolean;
  /** Filtro CSS de sombra do país inteiro; sai enquanto a câmera se move. */
  sombra?: string;
  /** Na primeira vez, os estados entram um a um, do centro para as bordas. */
  chegada?: boolean;
  /** Com um estado escolhido, os outros ficam quase transparentes. */
  apagarOutros?: boolean;
  opacidadePreenchimento?: number;
  espessuraContorno?: number;
  /** Cor temática opcional, também usada nas etiquetas dos estados pequenos. */
  corUf?: (u: UF) => string;
  /** Tratamento cartográfico da Economia, sem mudar a geometria ou a escala. */
  atlas?: boolean;
  /** Linhas a mais no balão do estado sob o ponteiro (quem governava, por exemplo). */
  detalhe?: (u: UF) => React.ReactNode;
  /**
   * Logo ao lado da sigla, sem fundo; nos estados pequenos, uma versão menor.
   * Nas chamadas do litoral, fica no fim da linha. `null`, nada.
   */
  marca?: (u: UF) => Marca | null;
  /** Estados em destaque; os outros apagam. `null`, nenhum destaque. */
  realce?: Set<string> | null;
}

/** Estados que viram etiqueta lateral, de cima para baixo no litoral. */
const CHAMADAS = ["RN", "PB", "PE", "AL", "SE", "ES", "RJ"];
// Medidas no viewBox, que costuma aparecer a ~45% do tamanho: a fonte de 24
// unidades sai com ~11 px na tela. Tamanhos menores ficavam ilegíveis.
const X_CHAMADA = 1022;
const LARGURA_CHAMADA = 150;
const ALTURA_CHAMADA = 40;
/**
 * O viewBox nacional estica à direita para caber as etiquetas e, depois
 * delas, a pílula do partido mais longa ("s/ partido").
 */
export const FOLGA_DIREITA = 280;
/** Abaixo desta área (unidades do viewBox) o rótulo não cabe dentro da UF. */
const AREA_ROTULO = 6000;
const AREA_SIGLA = 2000;
/** Com glifo, o limite é menor: Santa Catarina cabe uma seta, não um número. */
const AREA_GLIFO = 5000;
/** Goiás abraça o DF: o símbolo compacto evita cobrir a sigla do DF. */
const ETIQUETA_COMPACTA = ["GO"];

export type Marca = { texto: string; nome: string; logo: string | null };

/**
 * Largura aproximada de um texto curto em Geist, para pôr a pílula ao lado
 * da sigla sem medir o DOM. Erra por poucas unidades, e a sigla se ancora no
 * fim dela: o erro desloca o par, nunca encavala.
 */
export function larguraTexto(texto: string, tamanho: number): number {
  let w = 0;
  for (const c of texto) w += /[A-ZÁÃÉÍÓÚÇ]/.test(c) ? 0.68 : /[.,/ ijlrtf]/.test(c) ? 0.32 : 0.56;
  return w * tamanho;
}

const larguraMarca = (m: Marca, compacta = false) => m.logo ? (compacta ? 18 : 28) : larguraTexto(m.texto, 16);

/** Símbolo discreto, sem cápsula; sem partido continua escrito. */
function SimboloPartido({ m, x, y, compacta = false }: { m: Marca; x: number; y: number; compacta?: boolean }) {
  const w = larguraMarca(m, compacta);
  return (
    <g data-marca-partido>
      <title>{m.nome}</title>
      {m.logo ? (
        <image href={m.logo} x={x} y={y - w / 2} width={w} height={w} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x={x} y={y} dominantBaseline="central" style={{ fill: "var(--tinta-2)", stroke: "none", fontSize: 16, fontWeight: 500 }}>{m.texto}</text>
      )}
    </g>
  );
}

export type Caixa = [number, number, number, number];

/** Folga em volta do estado (fração do lado maior) e lado mínimo, no viewBox. */
export interface Moldura {
  folga: number;
  minimo: number;
}

const MOLDURA_JUSTA: Moldura = { folga: 0.08, minimo: 60 };

function caixaDoEstado([x0, y0, x1, y1]: Caixa, { folga, minimo }: Moldura): Caixa {
  const w = Math.max(x1 - x0, minimo);
  const h = Math.max(y1 - y0, minimo);
  const margem = Math.max(w, h) * folga;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [cx - w / 2 - margem, cy - h / 2 - margem, w + 2 * margem, h + 2 * margem];
}

/**
 * O viewBox do país inteiro ou do estado escolhido. Exportado para quem
 * desenha por baixo, numa camada à parte, acompanhar o mesmo zoom.
 */
export function enquadrar(uf: UF | null, largura: number, altura: number, moldura = MOLDURA_JUSTA): Caixa {
  return uf ? caixaDoEstado(uf.caixa, moldura) : [0, 0, largura + FOLGA_DIREITA, altura];
}

/**
 * Anima o viewBox até o alvo.
 *
 * Em aba oculta o `requestAnimationFrame` não dispara, e a animação ficaria
 * parada no meio. Por isso o salto direto quando a aba está oculta ou o leitor
 * pediu menos movimento, e um `setTimeout` que garante o estado final mesmo se
 * os quadros pararem no caminho.
 *
 * `alvo` precisa ser estável (useMemo): um array novo a cada render reinicia
 * a animação sem fim.
 */
export function useViewBox(alvo: Caixa) {
  const [vb, setVb] = useState<Caixa>(alvo);
  const atual = useRef<Caixa>(alvo);

  useEffect(() => {
    const de = atual.current;
    const fim = () => {
      atual.current = alvo;
      setVb(alvo);
    };
    const semMovimento =
      document.visibilityState === "hidden" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (semMovimento || de.every((v, i) => v === alvo[i])) {
      fim();
      return;
    }

    const DURACAO = 550;
    const t0 = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / DURACAO);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const v = de.map((x, i) => x + (alvo[i] - x) * e) as Caixa;
      atual.current = v;
      setVb(v);
      if (k < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    const garantia = window.setTimeout(fim, DURACAO + 150);
    return () => {
      cancelAnimationFrame(quadro);
      window.clearTimeout(garantia);
    };
  }, [alvo]);

  return vb;
}

type Foco = { tipo: "uf"; sigla: string } | { tipo: "municipio"; codigo: string } | null;

export function Mapa({
  ufs,
  largura,
  altura,
  leitura,
  periodo,
  regua,
  selecionada,
  aoSelecionar,
  formasMunicipais,
  dadosMunicipais,
  camadaMunicipal,
  zoom = true,
  glifo,
  camada,
  chegada = false,
  apagarOutros = false,
  opacidadePreenchimento = 1,
  espessuraContorno = 1.2,
  corUf,
  atlas = false,
  moldura,
  vizinhosNoZoom = false,
  sombra,
  detalhe,
  marca,
  realce = null,
}: Props) {
  const contornoId = useId();
  const sombraId = useId();
  const [foco, setFoco] = useState<Foco>(null);
  const [ponteiro, setPonteiro] = useState<{ x: number; y: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const [tela, setTela] = useState<{ w: number; h: number } | null>(null);

  // Primeira medida síncrona; o observador só refina (em aba oculta ele não
  // entrega nada).
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTela((t) => (t && t.w === r.width && t.h === r.height ? t : { w: r.width, h: r.height }));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const aproximado = zoom && selecionada !== null;
  const alvo = useMemo(
    () => enquadrar(aproximado ? selecionada : null, largura, altura, moldura),
    [aproximado, selecionada, largura, altura, moldura],
  );
  const vb = useViewBox(alvo);

  // Quanto o zoom aumenta: 1 no país inteiro, menos que 1 dentro de um estado.
  // Rótulos, desenhos e a orla multiplicam por ele e ficam do mesmo tamanho na
  // tela. Com `meet`, a escala é a do lado que limita.
  const pxPorUnidade = (b: Caixa) => (tela ? Math.min(tela.w / b[2], tela.h / b[3]) : 1 / b[2]);
  const k = pxPorUnidade([0, 0, largura + FOLGA_DIREITA, altura]) / pxPorUnidade(vb);
  const visivel = ([x, y]: [number, number]) =>
    x >= vb[0] && x <= vb[0] + vb[2] && y >= vb[1] && y <= vb[1] + vb[3];
  const emTorno = ([x, y]: [number, number], ampliar = 1) =>
    k * ampliar === 1 ? undefined : `translate(${x} ${y}) scale(${k * ampliar}) translate(${-x} ${-y})`;

  // Filtros (orla, sombras) são refeitos a cada quadro do zoom sobre a camada
  // inteira, que no atlas transborda e, aproximada, fica enorme: travavam a
  // animação. Só entram com a câmera parada, num esmaecer curto.
  const parado = vb.every((v, i) => v === alvo[i]);
  const surgirParado = { animation: "aparecer .25s ease-out" };

  // Na chegada, os estados entram do centro para as bordas, a partir do DF.
  const ordem = useMemo(() => {
    if (!chegada) return null;
    const meio = ufs.find((u) => u.sigla === "DF")?.centro ?? [largura / 2, altura / 2];
    const distancia = (u: UF) => Math.hypot(u.centro[0] - meio[0], u.centro[1] - meio[1]);
    return new Map([...ufs].sort((a, b) => distancia(a) - distancia(b)).map((u, i) => [u.sigla, i]));
  }, [chegada, ufs, largura, altura]);
  // Só na primeira vez: uma camada que entra depois (os círculos, os contornos
  // do modo de partidos) não espera a chegada de novo.
  const [chegou, setChegou] = useState(!chegada);
  useEffect(() => {
    if (chegou) return;
    const t = window.setTimeout(() => setChegou(true), 2600);
    return () => window.clearTimeout(t);
  }, [chegou]);
  const entrada = chegou ? undefined : { animation: "aparecer .6s ease-out 1.8s backwards" };

  const valorUf = (u: UF) => leitura.ufs[u.codigo]?.[periodo] ?? null;
  const texto = (v: number | null) => (leitura.id === "sem_dado_por_estado" ? "" : formatar(v, leitura.formato));
  const nacional = !aproximado;

  const chamadas = useMemo(() => {
    const lista = ufs
      .filter((u) => CHAMADAS.includes(u.sigla))
      .sort((a, b) => a.centro[1] - b.centro[1]);
    let y = -Infinity;
    return lista.map((u) => {
      y = Math.max(u.centro[1] - ALTURA_CHAMADA / 2, y + ALTURA_CHAMADA + 8);
      return { uf: u, y };
    });
  }, [ufs]);

  const ufFoco = foco?.tipo === "uf" ? ufs.find((u) => u.sigla === foco.sigla) ?? null : null;
  const munFoco =
    foco?.tipo === "municipio" ? dadosMunicipais?.get(foco.codigo) ?? null : null;

  const sobreUf = (u: UF) => ({
    onClick: () => aoSelecionar(selecionada?.sigla === u.sigla ? null : u.sigla),
    onPointerEnter: () => setFoco({ tipo: "uf", sigla: u.sigla }),
    onPointerLeave: () => setFoco((f) => (f?.tipo === "uf" && f.sigla === u.sigla ? null : f)),
  });

  return (
    <div
      ref={caixa}
      className={`relative h-full w-full ${atlas ? "mapa-atlas" : ""}`}
      data-leitura={leitura.id}
      data-uf-selecionada={selecionada?.sigla ?? "BR"}
      onPointerMove={(e) => {
        const r = caixa.current?.getBoundingClientRect();
        if (r) setPonteiro({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onPointerLeave={() => {
        setFoco(null);
        setPonteiro(null);
      }}
    >
      <svg
        viewBox={vb.join(" ")}
        preserveAspectRatio="xMidYMid meet"
        // No atlas o mapa transborda a caixa: aproximado, ele toma o palco
        // inteiro e passa por baixo do vidro.
        className={`block h-full w-full ${atlas ? "overflow-visible" : ""}`}
        style={
          sombra
            ? { filter: parado && nacional ? sombra : "none", transition: parado ? "filter .3s ease-out" : "none" }
            : undefined
        }
        role="group"
        aria-label={`Mapa do Brasil: ${leitura.titulo}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") aoSelecionar(null);
        }}
      >
        {atlas && parado && (
          <g style={surgirParado}>
            <defs>
              <filter id={contornoId} x="-2%" y="-2%" width="104%" height="104%" colorInterpolationFilters="sRGB">
                <feMorphology in="SourceAlpha" operator="dilate" radius={3 * k} result="expandido" />
                <feComposite in="expandido" in2="SourceAlpha" operator="out" result="orla" />
                <feFlood floodColor="var(--atlas-orla)" floodOpacity={0.8} />
                <feComposite in2="orla" operator="in" />
              </filter>
            </defs>
            <g filter={`url(#${contornoId})`} fill="var(--atlas-orla)" aria-hidden pointerEvents="none" data-contorno-brasil>
              {ufs.map((u) => <path key={u.sigla} d={u.d} />)}
            </g>
          </g>
        )}
        {vizinhosNoZoom && (
          <defs>
            <filter id={sombraId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
              <feDropShadow dx={0} dy={8 * k} stdDeviation={10 * k} floodColor="var(--atlas-elevacao)" floodOpacity={1} />
            </filter>
          </defs>
        )}
        {ufs.map((u) => {
          const v = valorUf(u);
          const escolhida = selecionada?.sigla === u.sigla;
          const cor = corUf?.(u) ?? regua.cor(v);
          // Dentro de um estado, os vizinhos ficam de contexto: apagados, mas
          // clicáveis, para pular de um estado ao outro sem voltar ao Brasil.
          const fundo = !nacional && !escolhida && !vizinhosNoZoom;
          // Com `vizinhosNoZoom` eles guardam a cor do dado, clareada no papel e
          // opaca: a transparência sobre o satélite virava um lilás turvo.
          const vizinho = !nacional && !escolhida && vizinhosNoZoom;
          // Com `apagarOutros`, o estado escolhido fica sozinho e os outros
          // deixam ver o que está por baixo.
          const apagada = apagarOutros && nacional && selecionada !== null && !escolhida;
          const fora = realce !== null && !realce.has(u.sigla) && !escolhida;
          const vez = ordem?.get(u.sigla);
          return (
            <path
              key={u.sigla}
              d={u.d}
              data-uf={u.sigla}
              role="button"
              tabIndex={0}
              aria-pressed={escolhida}
              aria-label={`${u.nome}: ${texto(v)}${leitura.exemplo ? " (exemplo)" : ""}`}
              className="cursor-pointer outline-none"
              vectorEffect="non-scaling-stroke"
              style={{
                fill: fundo
                  ? "var(--grade)"
                  : vizinho
                    ? `color-mix(in oklab, ${cor} var(--vizinho-tinta, 30%), var(--atlas-papel, var(--plano)))`
                    : cor,
                fillOpacity: fora
                  ? 0.22
                  : fundo
                    ? 0.55
                    : vizinho
                      ? 1
                      : apagada
                        ? (atlas ? "var(--mapa-opacidade-inativa, 0.3)" : 0.3)
                        : opacidadePreenchimento,
                stroke: vizinho ? "var(--atlas-papel, var(--plano))" : atlas ? "var(--atlas-divisa)" : "var(--plano)",
                strokeWidth: vizinho ? 1.2 : espessuraContorno,
                strokeLinejoin: "round",
                transition: "fill 350ms ease-out, fill-opacity 350ms ease-out",
                ...(vez !== undefined && {
                  animation: `surgir .8s cubic-bezier(.16,1,.3,1) ${(0.6 + vez * 0.04).toFixed(2)}s backwards`,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                }),
              }}
              onFocus={() => setFoco({ tipo: "uf", sigla: u.sigla })}
              onBlur={() => setFoco(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  aoSelecionar(escolhida ? null : u.sigla);
                }
              }}
              {...sobreUf(u)}
            />
          );
        })}

        {/* Municípios do estado escolhido, por cima do contorno dele. */}
        {aproximado &&
          selecionada &&
          formasMunicipais?.map((m) => {
            const dado = dadosMunicipais?.get(m.codigo) ?? null;
            const v = camadaMunicipal && dado ? camadaMunicipal.valor(dado) : null;
            const cor = camadaMunicipal
              ? camadaMunicipal.regua.cor(v)
              : regua.cor(valorUf(selecionada));
            const emFoco = foco?.tipo === "municipio" && foco.codigo === m.codigo;
            return (
              <path
                key={m.codigo}
                d={m.d}
                data-municipio={m.codigo}
                aria-hidden
                vectorEffect="non-scaling-stroke"
                style={{
                  fill: cor,
                  stroke: emFoco ? "var(--tinta)" : "var(--plano)",
                  strokeWidth: emFoco ? 1.6 : 0.5,
                  transition: "fill 350ms ease-out",
                }}
                onPointerEnter={() => setFoco({ tipo: "municipio", codigo: m.codigo })}
                onPointerLeave={() =>
                  setFoco((f) => (f?.tipo === "municipio" && f.codigo === m.codigo ? null : f))
                }
              />
            );
          })}

        {/* O escolhido de novo, por cima dos vizinhos e com sombra: sai do papel. */}
        {vizinhosNoZoom && !nacional && selecionada && (
          <>
            <path
              d={selecionada.d}
              aria-hidden
              pointerEvents="none"
              style={{ fill: corUf?.(selecionada) ?? regua.cor(valorUf(selecionada)), transition: "fill 350ms ease-out" }}
            />
            {parado && (
              <path
                d={selecionada.d}
                aria-hidden
                pointerEvents="none"
                filter={`url(#${sombraId})`}
                style={{ fill: corUf?.(selecionada) ?? regua.cor(valorUf(selecionada)), ...surgirParado }}
              />
            )}
          </>
        )}

        {ufFoco && ufFoco.sigla !== selecionada?.sigla && (
          <path
            d={ufFoco.d}
            fill="none"
            stroke={atlas ? "var(--atlas-rotulo-tinta)" : "var(--tinta-2)"}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {selecionada && (
          <path
            d={selecionada.d}
            fill="none"
            stroke={atlas ? "var(--ouro-forte, var(--atlas-rotulo-tinta))" : "var(--tinta)"}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}

        {camada && (
          <g aria-hidden pointerEvents="none" style={entrada}>
            {camada(k)}
          </g>
        )}

        {(nacional || vizinhosNoZoom) && (
          <g className="mapa-rotulos" aria-hidden pointerEvents="none" style={entrada}>
            {ufs
              .filter((u) => {
                // Área como aparece na tela: com zoom, estados pequenos ganham rótulo.
                const area = u.area / (k * k);
                if (nacional) return !CHAMADAS.includes(u.sigla) && (area >= AREA_SIGLA || u.sigla === "DF");
                return visivel(u.centro) && (area >= AREA_SIGLA || u.sigla === selecionada?.sigla);
              })
              .map((u) => {
                const area = u.area / (k * k);
                // No zoom, o escolhido ganha rótulo maior; os vizinhos, tinta
                // escura sobre o tom claro (ver `.mapa-atlas` no CSS).
                const vizinho = !nacional && u.sigla !== selecionada?.sigla ? true : undefined;
                const ampliar = !nacional && !vizinho ? 1.3 : 1;
                const apagado = realce !== null && !realce.has(u.sigla) && u.sigla !== selecionada?.sigla ? true : undefined;
                const comGlifo = glifo !== undefined && area >= AREA_GLIFO;
                const comValor = area >= AREA_ROTULO && !glifo;
                const fonte = u.sigla === "DF" ? 18 : atlas ? 23 : 25;
                const ySigla = u.centro[1] - (comGlifo ? 20 : comValor ? 12 : 0);
                // UF e símbolo centrados juntos; o valor mantém seu próprio eixo.
                const m = marca?.(u) ?? null;
                const compacta = area < AREA_ROTULO || ETIQUETA_COMPACTA.includes(u.sigla);
                const larguraSimbolo = m === null ? 0 : 6 + larguraMarca(m, compacta);
                const fimSigla = u.centro[0] + (larguraTexto(u.sigla, fonte) - larguraSimbolo) / 2;
                const tracado = { fill: "var(--tinta)", stroke: "var(--plano)", strokeWidth: 5, paintOrder: "stroke" } as const;
                return (
                  <g key={u.sigla} transform={emTorno(u.centro, ampliar)} data-apagado={apagado}>
                    <text
                      data-vizinho={vizinho}
                      x={fimSigla}
                      y={ySigla}
                      textAnchor="end"
                      dominantBaseline="central"
                      {...tracado}
                      style={{ fontSize: fonte, fontWeight: atlas ? 600 : 650 }}
                    >
                      {u.sigla}
                    </text>
                    {m && <SimboloPartido m={m} x={fimSigla + 6} y={ySigla} compacta={compacta} />}
                    {comGlifo && glifo(u, u.centro[0], u.centro[1] + 14, false)}
                    {comValor && (
                      <text
                        data-vizinho={vizinho}
                        x={u.centro[0]}
                        y={ySigla + 25}
                        textAnchor="middle"
                        dominantBaseline="central"
                        {...tracado}
                        className="tabular"
                        style={{ fontSize: atlas ? 25 : 21, fontWeight: atlas ? 700 : 500 }}
                      >
                        {texto(valorUf(u))}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        )}

        {nacional &&
          chamadas.map(({ uf: u, y }) => {
            const v = valorUf(u);
            return (
              <g
                key={u.sigla}
                className="cursor-pointer"
                style={{ ...entrada, opacity: realce !== null && !realce.has(u.sigla) ? 0.35 : 1, transition: "opacity 300ms ease-out" }}
                data-chamada={u.sigla}
                {...sobreUf(u)}
              >
                {atlas ? (
                  <>
                    <polyline
                      points={`${u.centro[0]},${u.centro[1]} ${X_CHAMADA - 22},${y + ALTURA_CHAMADA / 2} ${X_CHAMADA},${y + ALTURA_CHAMADA / 2}`}
                      fill="none"
                      stroke="var(--atlas-guia)"
                      strokeWidth={0.8}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                    <circle cx={u.centro[0]} cy={u.centro[1]} r={3.5} fill="var(--atlas-guia)" pointerEvents="none" />
                    <line x1={X_CHAMADA} x2={X_CHAMADA + LARGURA_CHAMADA} y1={y + ALTURA_CHAMADA - 2} y2={y + ALTURA_CHAMADA - 2} stroke="var(--atlas-guia)" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  </>
                ) : <line
                  x1={u.centro[0]}
                  y1={u.centro[1]}
                  x2={X_CHAMADA}
                  y2={y + ALTURA_CHAMADA / 2}
                  stroke="var(--eixo)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />}
                <rect
                  className="mapa-etiqueta"
                  x={X_CHAMADA}
                  y={y}
                  width={LARGURA_CHAMADA}
                  height={ALTURA_CHAMADA}
                  rx={atlas ? 3 : 8}
                  fill={atlas ? "transparent" : "var(--superficie)"}
                  stroke={foco?.tipo === "uf" && foco.sigla === u.sigla ? "var(--tinta)" : atlas ? "none" : "var(--borda)"}
                  vectorEffect="non-scaling-stroke"
                />
                <rect x={X_CHAMADA + 9} y={y + 11} width={atlas ? 4 : 18} height={18} rx={atlas ? 1 : 4} fill={corUf?.(u) ?? regua.cor(v)} />
                <text
                  x={X_CHAMADA + (atlas ? 23 : 35)}
                  y={y + ALTURA_CHAMADA / 2}
                  dominantBaseline="central"
                  fill="var(--tinta)"
                  className="tabular"
                  style={{ fontSize: 21 }}
                >
                  <tspan style={{ fontWeight: 650 }}>{u.sigla}</tspan>
                  {!glifo && <tspan style={atlas ? { fontWeight: 650 } : undefined}>{` ${texto(v)}`}</tspan>}
                </text>
                {glifo?.(u, X_CHAMADA + 106, y + ALTURA_CHAMADA / 2, true)}
                {(() => {
                  const m = marca?.(u);
                  // Depois do texto, que em reais passa da largura da etiqueta ("RN R$ 29.524").
                  const fimTexto = glifo ? 0 : X_CHAMADA + (atlas ? 23 : 35) + larguraTexto(`${u.sigla} ${texto(v)}`, 21) + 10;
                  return m ? <SimboloPartido m={m} x={Math.max(X_CHAMADA + LARGURA_CHAMADA + 6, fimTexto)} y={y + ALTURA_CHAMADA / 2} /> : null;
                })()}
              </g>
            );
          })}
      </svg>

      {ponteiro && (ufFoco || munFoco) && (
        <div
          role="status"
          className="pointer-events-none absolute z-30 max-w-[240px] rounded-lg border px-3 py-2 text-xs shadow-md"
          style={{
            left: Math.min(ponteiro.x + 14, (caixa.current?.clientWidth ?? 0) - 250),
            top: ponteiro.y + 14,
            background: "var(--superficie)",
            borderColor: "var(--borda)",
          }}
        >
          {ufFoco && !munFoco && (
            <>
              <p className="font-semibold">{ufFoco.nome}</p>
              <p className="tabular mt-0.5">
                {texto(valorUf(ufFoco))}
                {leitura.exemplo && <Selo />}
              </p>
              <p style={{ color: "var(--tinta-3)" }}>{leitura.periodos[periodo]?.extenso}</p>
              {detalhe?.(ufFoco)}
            </>
          )}
          {munFoco && (
            <>
              <p className="font-semibold">{munFoco.nome}</p>
              {camadaMunicipal && (
                <p className="tabular mt-0.5">
                  {formatar(camadaMunicipal.valor(munFoco), camadaMunicipal.formato)}
                  {camadaMunicipal.exemplo && <Selo />}
                  <span style={{ color: "var(--tinta-3)" }}> · {camadaMunicipal.titulo}</span>
                </p>
              )}
              <p style={{ color: "var(--tinta-3)" }}>{pessoas(munFoco.populacao)} habitantes</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
