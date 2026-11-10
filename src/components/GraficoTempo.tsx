"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

import { Retrato } from "@/components/Retrato";
import { mesLegivel, numero, rotuloMandato } from "@/lib/formatar";
import { useDesenho } from "@/lib/useDesenho";
import { useVisivel } from "@/lib/useVisivel";
import type { Presidente, Serie } from "@/types/dados";

/**
 * A linha de 31 anos com as faixas de mandato ao fundo.
 *
 * SVG à mão em vez de Recharts porque este gráfico precisa se reenquadrar
 * conforme o leitor rola — destacar um mandato, mudar de série, anotar um
 * ponto — e uma biblioteca de gráficos declarativa atrapalha mais do que ajuda
 * nesse tipo de controle.
 *
 * Regras de dataviz honradas aqui: série única em uma cor só (sem legenda, o
 * título nomeia a série), faixas de mandato como lavagem neutra alternada (não
 * cor por partido), grade em fio sólido e recuado (nunca tracejado), rótulo
 * direto apenas nos extremos, e tooltip que enriquece sem ser o único caminho
 * para o valor — a tabela ao fim da página é a versão acessível de tudo.
 */

/**
 * O trecho julgado de um gráfico, um mandato: de `desde` a `ate`, ele leva uma
 * cor só, verde se terminou melhor do que recebeu e vermelho se pior. A faixa
 * do mandato, a linha e a área até `referencia` saem nessa cor. Fora de todo
 * trecho, a linha fica cinza.
 *
 * Uma cor por mandato, e não por ponto: pintar cada mês pelo lado da
 * referência partia o mesmo governo em verde e vermelho, e o leitor não
 * sabia dizer, de relance, se ele foi bem ou mal.
 */
export interface Veredito {
  referencia: number;
  direcao: "maior_melhor" | "menor_melhor";
  /** AAAA-MM (ou AAAA-MM-DD): onde o trecho julgado começa, a posse. */
  desde: string;
  /** AAAA-MM: a posse seguinte, onde o trecho acaba; sem ela, vai até o fim. */
  ate?: string | null;
  /** Nome da linha de referência ("recebido: 7,9%"); sem ele, só o traço. */
  rotulo?: string | null;
  /**
   * O veredito do mandato, quando quem chama já o tem (o do placar, para as
   * cores baterem). Sem ele, o último ponto do trecho contra a referência.
   */
  sentido?: "bom" | "ruim" | "neutro";
}

/** Verde e vermelho do placar no protótipo; fora dele, os do site. */
export const COR_BOM = "var(--placar-bom, var(--bom))";
export const COR_RUIM = "var(--placar-ruim, var(--ruim))";

/** A cor de um veredito; sem lado, cinza. */
export const corDoVeredito = (s: "bom" | "ruim" | "neutro") => (s === "bom" ? COR_BOM : s === "ruim" ? COR_RUIM : "var(--tinta-3)");

/** O veredito de um trecho sem um dado de fora: o último ponto contra a referência. */
export function sentidoDoTrecho(v: Veredito, ultimo: number): "bom" | "ruim" | "neutro" {
  if (v.sentido) return v.sentido;
  if (ultimo === v.referencia) return "neutro";
  return (ultimo > v.referencia) === (v.direcao === "maior_melhor") ? "bom" : "ruim";
}

interface Props {
  /** `null` é mês sem dado: a linha se interrompe em vez de ligar as pontas. */
  serie: Omit<Serie, "valores"> & { valores: (number | null)[] };
  presidentes: Pick<Presidente, "id" | "nome" | "nomeCurto" | "mandato" | "inicio" | "fim">[];
  /** Valor com unidade na legenda do ponto ("4,6%", "R$ 1.621"). */
  formatoValor?: (v: number) => string;
  /** Mandato em foco; os demais recuam. `null` mostra todos iguais. */
  destaque?: string | null;
  /** Recorta o eixo do tempo a um mandato. */
  recorte?: string | null;
  altura?: number;
  /** Largura medida pelo contêiner, para manter os rótulos legíveis no celular. */
  largura?: number;
  /**
   * Pinta o trecho desde a posse contra uma referência (ver `Veredito`). Uma
   * lista pinta um trecho por governo, cada um contra o que recebeu.
   */
  veredito?: Veredito | Veredito[] | null;
  /**
   * Onde o mercado espera que a série esteja num mês à frente (a mediana da
   * pesquisa Focus): um ponto vazado no fim de um pontilhado, para não se
   * confundir com dado medido.
   */
  projecao?: { mes: string; valor: number; rotulo: string } | null;
  /** A data no balão e na legenda, quando não é o mês ("PRODES 2025"). */
  rotuloData?: (mes: string) => string;
}

const MARGEM = { topo: 24, dir: 16, baixo: 34, esq: 52 };
const COMPACTO = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** `AAAA-MM` → número contínuo, para posicionar no eixo. */
function tempo(mes: string): number {
  const [a, m] = mes.split("-").map(Number);
  return a + (m - 1) / 12;
}

/**
 * Marcas de eixo em valores redondos.
 *
 * Dividir o intervalo em cinco partes iguais produzia rótulos como 1.765 e
 * 1.424, que o leitor não consegue usar como referência. Aqui o passo é
 * arredondado para 1, 2, 2,5 ou 5 vezes uma potência de dez.
 */
function marcasRedondas(min: number, max: number, alvo = 5): number[] {
  const bruto = (max - min) / alvo;
  if (!Number.isFinite(bruto) || bruto <= 0) return [min];
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / mag;
  const passo = (norm >= 5 ? 10 : norm >= 2.5 ? 5 : norm >= 2 ? 2.5 : norm >= 1 ? 2 : 1) * mag;

  const marcas: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v <= max + 1e-9; v += passo) {
    marcas.push(Math.round(v / passo) * passo || 0);
  }
  return marcas;
}

export function GraficoTempo({
  serie,
  presidentes,
  destaque = null,
  recorte = null,
  altura = 340,
  largura = 1000,
  formatoValor = (v) => numero(v),
  veredito = null,
  projecao = null,
  rotuloData = mesLegivel,
}: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  // A linha se desenha quando o gráfico entra na tela. Animar fora dela seria
  // trabalho perdido, e o leitor chegaria depois do fim, vendo só o resultado.
  const { ref: refFigura, visivel } = useVisivel<HTMLElement>();
  const refTraco = useDesenho<SVGPathElement>(visivel, 1200);

  const L = Math.max(300, largura);
  const A = altura;

  const pontos = useMemo(
    () =>
      serie.datas.map((d, i) => ({
        mes: d,
        t: tempo(d),
        v: serie.valores[i],
      })),
    [serie],
  );

  const janela = useMemo(() => {
    if (!recorte) return null;
    const p = presidentes.find((x) => x.id === recorte);
    if (!p) return null;
    return { t0: tempo(p.inicio.slice(0, 7)), t1: tempo(p.fim.slice(0, 7)) };
  }, [recorte, presidentes]);

  const visiveis = useMemo(
    () =>
      janela
        ? pontos.filter((p) => p.t >= janela.t0 && p.t <= janela.t1)
        : pontos,
    [pontos, janela],
  );

  // Os trechos julgados que aparecem na janela. Cada um começa no último ponto
  // antes da posse (o que o governo recebeu), para a área nascer com largura
  // zero ali, e acaba no último ponto antes da posse seguinte, de onde o
  // próximo parte: a linha não se quebra na troca de governo.
  const trechos = useMemo(
    () =>
      (veredito ? [veredito].flat() : []).flatMap((v) => {
        const i = visiveis.findIndex((p) => p.mes >= v.desde.slice(0, 7));
        if (i < 0) return [];
        const j = v.ate ? visiveis.findIndex((p) => p.mes >= v.ate!.slice(0, 7)) : -1;
        const pts = visiveis
          .slice(Math.max(0, i - 1), j < 0 ? visiveis.length : j)
          .filter((p): p is (typeof visiveis)[number] & { v: number } => p.v !== null);
        return pts.length < 2 ? [] : [{ v, pts }];
      }),
    [veredito, visiveis],
  );

  const escala = useMemo(() => {
    if (visiveis.length === 0) return null;
    // A projeção estica o eixo até o mês dela.
    const ts = [...visiveis.map((p) => p.t), ...(projecao ? [tempo(projecao.mes)] : [])];
    // As referências e a projeção entram na escala: têm que aparecer.
    const vs = [
      ...visiveis.flatMap((p) => (p.v === null ? [] : [p.v])),
      ...trechos.map((t) => t.v.referencia),
      ...(projecao ? [projecao.valor] : []),
    ];
    if (!vs.length) return null;
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    let v0 = Math.min(...vs);
    let v1 = Math.max(...vs);
    // Uma folga de 8% impede que o extremo encoste na borda do gráfico.
    const folga = (v1 - v0) * 0.08 || Math.abs(v1 || 1) * 0.1;
    v0 -= folga;
    v1 += folga;

    // O eixo NÃO é ancorado no zero.
    //
    // Barra precisa começar no zero porque a área da barra é a mensagem; linha
    // não, porque a mensagem é a forma da variação. Num índice de PIB com base
    // 1995 = 100, o zero nem existe como referência — forçá-lo jogava toda a
    // série na metade de cima e achatava justamente a recessão que a seção
    // está apontando. O eixo fica sempre rotulado, então o corte é explícito.
    //
    // A exceção é quando a série cruza o zero: aí a linha do zero é uma
    // fronteira real (entrou em queda) e precisa aparecer.
    if (v0 < 0 && v1 > 0) {
      const maior = Math.max(Math.abs(v0), Math.abs(v1));
      v0 = Math.min(v0, -maior * 0.1);
      v1 = Math.max(v1, maior * 0.1);
    }

    const x = (t: number) =>
      MARGEM.esq + ((t - t0) / (t1 - t0 || 1)) * (L - MARGEM.esq - MARGEM.dir);
    const y = (v: number) =>
      A - MARGEM.baixo - ((v - v0) / (v1 - v0 || 1)) * (A - MARGEM.topo - MARGEM.baixo);
    return { x, y, t0, t1, v0, v1 };
  }, [visiveis, A, L, trechos, projecao]);

  if (!escala || visiveis.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded border text-sm"
        style={{
          height: altura,
          borderColor: "var(--borda)",
          color: "var(--tinta-3)",
        }}
      >
        Sem dados para este período.
      </div>
    );
  }

  const { x, y, t0, t1, v0, v1 } = escala;
  const fronteira = (data: string) => tempo(data.slice(0, 7));

  // Lacuna quebra a linha: um "M" recomeça o traço depois do mês sem dado.
  const caminho = visiveis
    .map((p, i) =>
      p.v === null
        ? ""
        : `${i === 0 || visiveis[i - 1].v === null ? "M" : "L"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`,
    )
    .join(" ");

  const ticksY = marcasRedondas(v0, v1);
  // Casas decimais pelo passo entre marcas, não pela magnitude do valor: um
  // eixo de 0 a 200 de 50 em 50 mostrava "0,00" e "50,00".
  const passoY = ticksY.length > 1 ? Math.abs(ticksY[1] - ticksY[0]) : 1;
  const casasY = passoY >= 10 ? 0 : passoY >= 1 ? 1 : 2;

  const julgados = trechos.map(({ v, pts }) => {
    const yRef = y(v.referencia);
    const linha = pts.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");
    const x0 = x(pts[0].t);
    const x1 = x(pts[pts.length - 1].t);
    const area = `${linha} L${x1.toFixed(2)},${yRef.toFixed(2)} L${x0.toFixed(2)},${yRef.toFixed(2)} Z`;
    const sentido = sentidoDoTrecho(v, pts[pts.length - 1].v);
    // A faixa do mandato vai da posse à posse seguinte, sem a fresta de um
    // mês entre o fim de um e o começo do outro.
    const faixa0 = x(Math.max(tempo(v.desde.slice(0, 7)), t0));
    const faixa1 = v.ate ? x(Math.min(tempo(v.ate.slice(0, 7)), t1)) : L - MARGEM.dir;
    return {
      linha,
      area,
      yRef,
      x0,
      // O traço do último governo vai até a borda; os outros param na troca.
      x1: v.ate ? x1 : L - MARGEM.dir,
      faixa0,
      faixa1,
      tFinal: pts[pts.length - 1].t,
      rotulo: v.rotulo ?? null,
      sentido,
      cor: corDoVeredito(sentido),
    };
  });

  const presentes = visiveis.filter((p): p is typeof p & { v: number } => p.v !== null);
  if (!presentes.length) return <p className="py-12 text-center">Sem dados para este período.</p>;
  const primeiro = presentes[0];
  const ultimo = presentes[presentes.length - 1];
  const doUltimo = julgados.findLast((j) => j.tFinal === ultimo.t);
  const selecionado = hover !== null ? visiveis[hover] : null;
  const alvo = selecionado?.v != null ? (selecionado as typeof ultimo) : null;
  const selecionarPonto = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * L;
    const t = t0 + ((px - MARGEM.esq) / (L - MARGEM.esq - MARGEM.dir)) * (t1 - t0);
    let melhor = 0, dist = Infinity;
    visiveis.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < dist) { dist = d; melhor = i; }
    });
    setHover(melhor);
  };

  // Rostos alinhados ao eixo do tempo, em HTML sobre o SVG.
  //
  // Em HTML e não em <image> dentro do SVG para poder usar o otimizador de
  // imagem do Next: nove fotos originais somariam quase 600 KB, o que
  // arruinaria o carregamento no celular. As posições usam a mesma escala `x`
  // do gráfico, então nunca saem do lugar.
  // Todos os rostos ficam na MESMA linha, sempre.
  //
  // Mandatos curtos (Dilma 2 com 1a8m, Temer com 2a4m) têm faixa mais estreita
  // que o próprio retrato. A primeira solução empurrava os que colidiam para
  // uma segunda fileira, e o resultado era pior que o problema: a foto descia,
  // saía do alinhamento dos outros oito e parecia defeito.
  //
  // Aqui os que colidem são afastados na horizontal. O retrato deixa de ficar
  // exatamente sobre o centro do mandato, mas o desvio é de poucos pontos
  // percentuais e a faixa colorida embaixo continua marcando o período real.
  const GAP_MINIMO_PCT = 7;

  const faixas: { p: (typeof presidentes)[number]; meio: number }[] = [];

  for (const p of presidentes) {
    const pt0 = Math.max(fronteira(p.inicio), t0);
    const pt1 = Math.min(fronteira(p.fim), t1);
    if (pt1 <= pt0) continue;
    faixas.push({ p, meio: ((x(pt0) + x(pt1)) / 2 / L) * 100 });
  }

  // Passada da esquerda para a direita empurrando quem ficou perto demais...
  for (let i = 1; i < faixas.length; i++) {
    const minimo = faixas[i - 1].meio + GAP_MINIMO_PCT;
    if (faixas[i].meio < minimo) faixas[i].meio = minimo;
  }
  // ...e uma de volta, caso o empurrão tenha jogado o último para fora.
  const LIMITE_DIREITO = 97;
  for (let i = faixas.length - 1; i > 0; i--) {
    const maximo = (faixas[i]?.meio ?? LIMITE_DIREITO) - GAP_MINIMO_PCT;
    if (i === faixas.length - 1 && faixas[i].meio > LIMITE_DIREITO) {
      faixas[i].meio = LIMITE_DIREITO;
    }
    if (faixas[i - 1].meio > maximo) faixas[i - 1].meio = maximo;
  }

  return (
    <figure className="m-0" ref={refFigura}>
      {!recorte && faixas.length > 0 && (
        <div className="relative mb-1 h-8">
          {faixas.map(({ p, meio }) => (
            <span
              key={p.id}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${meio}%`, transition: "left 400ms" }}
              title={`${p.nome} · ${p.inicio.slice(0, 4)}–${p.fim.slice(0, 4)}`}
            >
              <Retrato
                presidente={p}
                tamanho="p"
                numeroMandato={p.mandato}
                apagado={Boolean(destaque) && destaque !== p.id}
                prioridade
              />
            </span>
          ))}
        </div>
      )}

      <p id={`${id}-ajuda`} className="sr-only">Passe o mouse ou toque no gráfico para consultar cada referência. Com o teclado, use as setas para navegar, Home e End para os extremos e Escape para fechar a legenda.</p>
      <div className="relative">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        className="w-full touch-pan-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--serie)]"
        style={{ height: "auto" }}
        role="img"
        tabIndex={0}
        aria-describedby={`${id}-ajuda`}
        aria-label={`${serie.nome} de ${rotuloData(primeiro.mes)} a ${rotuloData(ultimo.mes)}`}
        onPointerMove={selecionarPonto}
        onPointerDown={selecionarPonto}
        onPointerLeave={(e) => { if (e.pointerType !== "touch" && document.activeElement !== e.currentTarget) setHover(null); }}
        onPointerCancel={() => setHover(null)}
        onFocus={() => setHover(h => h ?? 0)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)) return;
          e.preventDefault();
          if (e.key === "Escape") setHover(null);
          else if (e.key === "Home") setHover(0);
          else if (e.key === "End") setHover(visiveis.length - 1);
          else setHover(h => Math.max(0, Math.min(visiveis.length - 1, (h ?? 0) + (e.key === "ArrowRight" ? 1 : -1))));
        }}
      >
        <defs>
          <clipPath id={`${id}-area`}>
            <rect
              x={MARGEM.esq}
              y={MARGEM.topo}
              width={L - MARGEM.esq - MARGEM.dir}
              height={A - MARGEM.topo - MARGEM.baixo}
            />
          </clipPath>
        </defs>
        <rect x={MARGEM.esq} y={MARGEM.topo} width={L - MARGEM.esq - MARGEM.dir} height={A - MARGEM.topo - MARGEM.baixo} fill="transparent" />

        {/* Faixas de mandato: lavagem neutra alternada. A identidade vem do
            rótulo, não da cor — pintar partido seria opinião disfarçada. */}
        <g clipPath={`url(#${id}-area)`}>
          {presidentes.map((p, i) => {
            const pt0 = Math.max(fronteira(p.inicio), t0);
            const pt1 = Math.min(fronteira(p.fim), t1);
            if (pt1 <= pt0) return null;
            const ativo = destaque === p.id;
            return (
              <rect
                key={p.id}
                x={x(pt0)}
                y={MARGEM.topo}
                width={Math.max(x(pt1) - x(pt0), 0)}
                height={A - MARGEM.topo - MARGEM.baixo}
                fill={
                  ativo
                    ? "var(--faixa-ativa)"
                    : i % 2 === 0
                      ? "var(--faixa-a)"
                      : "var(--faixa-b)"
                }
                style={{ transition: "fill 400ms" }}
              />
            );
          })}
        </g>

        {/* Grade: fio sólido e recuado, nunca tracejado. */}
        {ticksY.map((v, i) => (
          <g key={i}>
            <line
              x1={MARGEM.esq}
              x2={L - MARGEM.dir}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--grade)"
              strokeWidth={1}
            />
            <text
              x={MARGEM.esq - 8}
              y={y(v) + 4}
              textAnchor="end"
              fontSize={13}
              fill="var(--tinta-3)"
              className="tabular"
            >
              {/* "175 mil" e não "175.000": seis dígitos não cabem na margem. */}
              {Math.abs(v) >= 10000 ? COMPACTO.format(v) : numero(v, casasY)}
            </text>
          </g>
        ))}

        {/* Rótulos de mandato sobre o eixo do tempo */}
        {!recorte &&
          presidentes.map((p) => {
            const pt0 = Math.max(fronteira(p.inicio), t0);
            const pt1 = Math.min(fronteira(p.fim), t1);
            if (pt1 - pt0 < 1.2) return null; // curto demais para caber texto
            const cx = (x(pt0) + x(pt1)) / 2;
            return (
              <text
                key={p.id}
                x={cx}
                y={A - MARGEM.baixo + 16}
                textAnchor="middle"
                fontSize={12}
                fill={destaque === p.id ? "var(--tinta)" : "var(--tinta-3)"}
                fontWeight={destaque === p.id ? 600 : 400}
                style={{ transition: "fill 400ms" }}
              >
                {rotuloMandato(presidentes, p)}
              </text>
            );
          })}

        {/* Linha de base */}
        <line
          x1={MARGEM.esq}
          x2={L - MARGEM.dir}
          y1={A - MARGEM.baixo}
          y2={A - MARGEM.baixo}
          stroke="var(--eixo)"
          strokeWidth={1}
        />

        {/* A série: uma cor, traço fino. O desenho progressivo vem de
            `useDesenho`, que mede o caminho em vez de confiar no `pathLength`. */}
        <path
          d={caminho}
          fill="none"
          stroke={julgados.length ? "var(--tinta-3)" : "var(--serie)"}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          clipPath={`url(#${id}-area)`}
          ref={refTraco}
        />

        {/* Os mandatos julgados, cada um numa cor só: a faixa, a área entre a
            linha e o que ele recebeu, e a linha. Entram depois que o traço
            termina de se desenhar. */}
        {julgados.length > 0 && (
          <g
            clipPath={`url(#${id}-area)`}
            pointerEvents="none"
            style={{ opacity: visivel ? 1 : 0, transition: "opacity 400ms ease-out 900ms" }}
          >
            {julgados.map((j, k) => (
              <g key={k}>
                {j.sentido !== "neutro" && (
                  <rect
                    x={j.faixa0}
                    y={MARGEM.topo}
                    width={Math.max(0, j.faixa1 - j.faixa0)}
                    height={A - MARGEM.topo - MARGEM.baixo}
                    fill={j.cor}
                    fillOpacity={0.09}
                  />
                )}
                <path d={j.area} fill={j.cor} fillOpacity={j.sentido === "neutro" ? 0.08 : 0.2} />
                <line x1={j.x0} x2={j.x1} y1={j.yRef} y2={j.yRef} stroke="var(--tinta-2)" strokeWidth={1.2} strokeDasharray="6 5" />
                {j.rotulo && (
                  // O contorno na cor do fundo deixa o rótulo legível quando a linha passa por ele.
                  <text
                    x={j.x0 + 6}
                    y={j.yRef - 7}
                    fontSize={12}
                    fill="var(--tinta-2)"
                    stroke="var(--superficie)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    className="tabular"
                  >
                    {j.rotulo}
                  </text>
                )}
                <path d={j.linha} fill="none" stroke={j.cor} strokeWidth={2.5} strokeLinejoin="round" />
              </g>
            ))}
          </g>
        )}

        {/* Rótulo direto só nos extremos, nunca um número por ponto. O ponto
            entra depois que a linha termina de se desenhar. */}
        <circle
          cx={x(ultimo.t)}
          cy={y(ultimo.v)}
          r={4}
          fill={doUltimo ? doUltimo.cor : "var(--serie)"}
          style={{
            opacity: visivel ? 1 : 0,
            transition: "opacity 300ms ease-out 1000ms",
          }}
        />

        {projecao && (
          <g pointerEvents="none" style={{ opacity: visivel ? 1 : 0, transition: "opacity 300ms ease-out 1100ms" }}>
            <line
              x1={x(ultimo.t)}
              y1={y(ultimo.v)}
              x2={x(tempo(projecao.mes))}
              y2={y(projecao.valor)}
              stroke="var(--tinta-2)"
              strokeWidth={1.6}
              strokeDasharray="2 4"
              strokeLinecap="round"
            />
            <circle cx={x(tempo(projecao.mes))} cy={y(projecao.valor)} r={4.5} fill="var(--superficie)" stroke="var(--tinta-2)" strokeWidth={1.8} />
            <text
              x={x(tempo(projecao.mes)) - 8}
              y={y(projecao.valor) + (projecao.valor >= ultimo.v ? -12 : 20)}
              textAnchor="end"
              fontSize={12}
              fill="var(--tinta-2)"
              stroke="var(--superficie)"
              strokeWidth={3}
              strokeLinejoin="round"
              paintOrder="stroke"
              className="tabular"
            >
              {projecao.rotulo}
            </text>
          </g>
        )}

        {alvo && (
          <g pointerEvents="none">
            <line
              x1={x(alvo.t)}
              x2={x(alvo.t)}
              y1={MARGEM.topo}
              y2={A - MARGEM.baixo}
              stroke="var(--eixo)"
              strokeWidth={1}
            />
            <circle
              cx={x(alvo.t)}
              cy={y(alvo.v)}
              r={5}
              fill="var(--serie)"
              stroke="var(--superficie)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {selecionado && <div role="tooltip" className="pointer-events-none absolute rounded-xl p-3 text-sm" style={{
        left: `clamp(8px, calc(${x(selecionado.t) / L * 100}% - 100px), calc(100% - 208px))`,
        top: alvo ? `clamp(8px, calc(${y(alvo.v) / A * 100}% - 80px), calc(100% - 88px))` : "8px",
        width: 200, maxWidth: "calc(100% - 16px)", background: "var(--superficie)", color: "var(--tinta)",
        boxShadow: "0 4px 16px rgba(0,0,0,.18)", fontVariantNumeric: "tabular-nums",
      }}><span className="block" style={{color:"var(--tinta-2)"}}>{rotuloData(selecionado.mes)}</span><strong className="mt-1 block font-semibold">{alvo ? formatoValor(alvo.v) : "Sem dados publicados"}</strong></div>}
      </div>

      <figcaption
        aria-live="polite"
        aria-atomic="true"
        className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
        style={{ color: "var(--tinta-2)" }}
      >
        <span>
          {alvo ? (
            <>
              <span className="tabular font-semibold" style={{ color: "var(--tinta)" }}>
                {formatoValor(alvo.v)}
              </span>{" "}
              <span style={{ color: "var(--tinta-2)" }}>em {rotuloData(alvo.mes)}</span>
            </>
          ) : selecionado ? (
            <>Sem dados publicados em {rotuloData(selecionado.mes)}</>
          ) : (
            <>{serie.nome} · {serie.unidade}</>
          )}
        </span>
        <span style={{ color: "var(--tinta-3)" }}>
          {rotuloData(primeiro.mes)} a {rotuloData(ultimo.mes)}
          {serie.agregacao ? ` · ${serie.agregacao}` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
