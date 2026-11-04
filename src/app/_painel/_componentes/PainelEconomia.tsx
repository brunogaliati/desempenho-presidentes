"use client";
import { Compartilhar } from "@/components/Compartilhar";
import { usePerfilPainel } from "./ContextoPerfil";
import { opcaoCompartilhada, inteiroCompartilhado } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { comSinal, corDaMudanca, numero, sentido } from "@/lib/formatar";
import type { Sentido } from "@/lib/formatar";

import { compararUf, reguaComparacao, variacaoDesdeReferencia } from "../_dados/economiaModelo";
import { Abrir, MOVIMENTO } from "./Abrir";
import type {
  AbaId,
  DadosPainel,
  Formato,
  Governos,
  Leitura,
  TrechoGoverno,
  TrechoPresidente,
  UF,
} from "../_dados/tipos";
import {
  corDoSentido,
  formatar,
  pessoas,
  reaisCurto,
  reguaDeCor,
} from "./formatos";
import { Faisca } from "./GraficoLinha";
import {
  chavePartido,
  comoEntrou,
  corDoPartido,
  diaDoPeriodo,
  familiaDe,
  governoEm,
  inicioDoPeriodo,
  inicioNoCargo,
  logoDoPartido,
  mesAno,
  nomePartido,
  partidoNoIntervalo,
  presidenteEm,
  rotuloPartido,
  semCorDePartido,
  tintaDoPartido,
} from "./governos";
import { larguraTexto, Mapa, type Moldura } from "./Mapa";
import { Placar, placarDaEconomia } from "./Placar";
import { Legenda, ReguaTempo } from "./Regua";
import { RetratoGovernador } from "./RetratoGovernador";
import { ABAS } from "./Topo";

/**
 * A sala de um tema (a economia, o meio ambiente): o Brasil num olhar.
 * `SalaDoTema` recebe as medidas por estado e o placar do tema;
 * `PainelEconomia` é a sala com os da economia.
 *
 * O mapa fica solto na tela, sem moldura e sem satélite nem mar: só o
 * Brasil, chapado, sobre o fundo claro com os halos da bandeira. Em volta
 * dele: no canto esquerdo, o número do momento e, embaixo, o que só existe
 * para o país inteiro (inflação, juros, dólar); à direita, uma barra de vidro
 * com as medidas por estado e os indicadores nacionais. A página abre só com isso. Tocar
 * numa medida ou num estado abre a barra com o detalhe, e o mapa recua para
 * dar lugar. Escolher um estado aproxima o mapa dele, com os vizinhos em
 * volta, e o satélite de fundo aproxima junto.
 *
 * O mapa não é só cor. Sobre cada estado vai o que a pergunta pede: uma seta
 * do que mudou desde a posse, um minigráfico da evolução ou o círculo do
 * tamanho da economia. A cor continua sendo a medida; o desenho acrescenta o
 * tempo ou o tamanho, para que um olhar diga onde está pior e para onde vai.
 *
 * Quem governa entra junto, sem modo próprio, mas sem pintar o mapa: a cor é
 * sempre a medida, e abre em "desde a posse", verde onde melhorou e vermelho
 * onde piorou, a mesma língua do placar da barra. Pintado por partido, o
 * vermelho do PT e o verde de outros partidos brigavam com o placar. Ao lado
 * da sigla de cada estado vai a logo do partido, a mesma da barra e da
 * legenda, e a legenda lista os partidos. Na barra, a medida aberta vira uma barra por partido
 * (a mediana dos estados dele; o que mudou desde a posse conta para quem
 * governou a maior parte do tempo), com o melhor e o pior em destaque. Tocar
 * num partido, ou no do presidente na legenda, acende os estados dele no
 * mapa. A pergunta "variou mais sob qual partido?" se lê sem trocar de tela.
 *
 * Os modos (desde a posse, valor, evolução) ficam no topo da legenda: mudam o
 * que a legenda explica, e não se confundem com as abas do topo.
 */

type Modo = "mudanca" | "valor" | "evolucao" | "tamanho";
/** Estados acesos no mapa; `chave` diz quem acendeu (um partido, o presidente). */
type Realce = { chave: string; ufs: Set<string> };
type Glifo = (u: UF, x: number, y: number, naEtiqueta: boolean) => React.ReactNode;

const ROTULO_MODO: Record<Modo, string> = {
  mudanca: "Desde a posse",
  valor: "Valor",
  evolucao: "Evolução",
  tamanho: "Tamanho da economia",
};

function modosDe(l: Leitura): Modo[] {
  if (l.tamanho) return ["tamanho", "valor"];
  if (l.periodos.length > 1 && l.indiceRecebido !== null) return ["mudanca", "valor", "evolucao"];
  if (l.periodos.length > 1) return ["valor", "evolucao"];
  return ["valor"];
}

/**
 * A cor de um partido no quadradinho da legenda: a dele, um pouco recolhida no
 * fundo. Não confirmado fica sem cor.
 */
const corPartidoMapa = (g: Governos, sigla: string | null) =>
  sigla === null ? "var(--grade)" : `color-mix(in srgb, ${corDoPartido(g, sigla)} 72%, var(--plano))`;

/** Taxas mudam em pontos; preços e valores, em %. */
const emPontos = (l: Leitura) => l.formato.startsWith("pct") || l.formato === "pp1";

/** Diferença entre o período escolhido e o que o governo recebeu. */
function desdeAPosse(l: Leitura, s: (number | null)[] | undefined, periodo: number): number | null {
  return variacaoDesdeReferencia(s, l.indiceRecebido, periodo, emPontos(l));
}

function textoMudanca(l: Leitura, d: number, curto = false): string {
  return emPontos(l) ? `${comSinal(d, 1)}${curto ? "" : " pts"}` : `${comSinal(d, 0)}%`;
}

const sentidoDe = (l: Leitura, d: number): Sentido => sentido(Math.round(d * 10) / 10, l.direcao ?? "neutro");

/** "o maior do país", "3º maior entre 27 UFs", "2º menor entre 27 UFs". */
function lugarNoPais(l: Leitura, u: UF, periodo: number, ufs: UF[]): string {
  const c = compararUf(l, u.codigo, periodo, ufs.map((x) => x.codigo));
  if (!c || c.total < 2) return "";
  if (c.empatados === c.total) return `mesmo valor nas ${c.total} UFs com dado`;
  const maior = c.maior <= c.menor;
  const pos = maior ? c.maior : c.menor;
  const lado = maior ? "maior" : "menor";
  return `${pos}º ${lado} entre ${c.total} UFs${c.empatados > 1 ? " (empatado)" : ""}`;
}

/**
 * Número com a unidade mais leve: "5,4" cheio e "%" menor, "R$" discreto. O
 * olho lê o valor primeiro; a unidade fica para quem procura.
 */
export function Numero({ texto, className = "" }: { texto: string; className?: string }) {
  const m = texto.match(/^(R\$\s)?([+\-−]?[\d.,]+)(%|\s(?:pts|mi|bi|tri|mil|km²))?$/);
  if (!m) return <span className={className}>{texto}</span>;
  const leve = { color: "var(--tinta-2)" };
  return (
    <span className={className}>
      {m[1] && (
        <span className="mr-[0.22em] text-[0.62em] font-semibold" style={leve}>
          R$
        </span>
      )}
      {m[2]}
      {m[3] && (
        <span className="ml-[0.08em] text-[0.62em] font-semibold" style={leve}>
          {m[3].trim()}
        </span>
      )}
    </span>
  );
}

/** O que muda de um tema para outro na sala. */
export interface TemaDaSala {
  id: AbaId;
  /** As medidas por estado do mapa, na ordem do passeio da manchete. */
  leituras: Leitura[];
  /** A aba Brasil da barra: o placar do tema. */
  placar: React.ReactNode;
  /** "Economia no Brasil": o nome da sala para leitor de tela. */
  rotulo: string;
  /** "Indicadores da economia": o nome da barra. */
  rotuloIndicadores: string;
}

interface Props {
  dados: DadosPainel;
  tema: TemaDaSala;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  aoTrocarAba: (a: AbaId) => void;
}

/** Largura da barra da direita: fechada, só a lista; aberta, com o detalhe. */
const LARGURA = { fechada: "15.5rem", aberta: "22rem" };

/** Sombra curta de atlas impresso; não colore as classes dos indicadores. */
const SOMBRA = "drop-shadow(0 8px 12px var(--atlas-sombra))";

/** A chegada: o continente se aproxima, como quem desce do espaço. */
const CHEGADA = "animate-[aproximar_1.6s_cubic-bezier(.16,1,.3,1)_both]";

/**
 * O zoom num estado deixa os vizinhos à vista, para não perder onde se está.
 * O lado mínimo segura os estados pequenos (DF, SE) longe de virarem a tela
 * inteira.
 */
const MOLDURA: Moldura = { folga: 0.3, minimo: 220 };

/** O fim da lista da barra some aos poucos em vez de cortar seco. */
const ESMAECER = "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)";

/** A sala da economia: as medidas por estado e o placar do mandato. */
export function PainelEconomia({
  aoEscolherSerie,
  aoFocarSerie,
  ...props
}: Omit<Props, "tema"> & {
  /** "Histórico completo" de um indicador do país: desce até o gráfico dele. */
  aoEscolherSerie: (id: string) => void;
  /** Abrir um indicador do país na barra: o gráfico de baixo acompanha, sem rolar. */
  aoFocarSerie: (id: string) => void;
}) {
  const { grupos, fileiras } = placarDaEconomia(props.dados);
  return (
    <SalaDoTema
      // O período e a medida na régua são de um mandato: trocar de mandato recomeça a sala.
      key={props.dados.foco.id}
      {...props}
      tema={{
        id: "economia",
        leituras: props.dados.leituras.economia,
        placar: <Placar grupos={grupos} fileiras={fileiras} aoFocar={aoFocarSerie} aoVerHistorico={aoEscolherSerie} />,
        rotulo: "Economia no Brasil",
        rotuloIndicadores: "Indicadores da economia",
      }}
    />
  );
}

export function SalaDoTema({ dados, tema, sigla, setSigla, aoTrocarAba }: Props) {
  const leituras = tema.leituras;
  const [id, setId] = useEstadoCompartilhavel("mapa.indicador", leituras[0]?.id, opcaoCompartilhada(leituras.map(l=>l.id)));
  const leitura = leituras.find((l) => l.id === id) ?? leituras[0];
  const [historico, setHistorico] = useEstadoCompartilhavel("mapa.historico", false, opcaoCompartilhada([true,false]));
  const [periodoEscolhido, setPeriodo] = useEstadoCompartilhavel("mapa.periodo", leitura.periodos.length - 1, inteiroCompartilhado);
  // Abre em "desde a posse", como o placar; medida sem esse modo cai no primeiro que tiver.
  const [modoEscolhido, setModo] = useEstadoCompartilhavel<Modo>("mapa.modo", "mudanca", opcaoCompartilhada(modosDe(leitura)));
  const modos = modosDe(leitura);
  const modo = modos.includes(modoEscolhido) ? modoEscolhido : modos[0];
  const inicioPeriodo = modo === "mudanca" ? leitura.indiceRecebido ?? 0 : 0;
  // Fora da exploração, a data é sempre a última disponível da medida.
  const periodo = historico
    ? Math.max(inicioPeriodo, Math.min(periodoEscolhido, leitura.periodos.length - 1))
    : leitura.periodos.length - 1;
  const uf = dados.ufs.find((u) => u.sigla === sigla) ?? null;

  // Quem governava cada estado no período da régua (o dia do meio dele).
  const governos = dados.governos;
  const hoje = dados.hoje.slice(0, 10);
  const dia = diaDoPeriodo(leitura.periodos[periodo], hoje);
  const governoUf = useMemo(
    () => new Map(dados.ufs.map((u) => [u.sigla, governoEm(governos, u.sigla, dia)])),
    [governos, dados.ufs, dia],
  );
  const presidente = presidenteEm(governos, dia);
  // Passar o ponteiro num partido (na barra, ou o do presidente na legenda)
  // acende os estados dele no mapa.
  const [realce, setRealce] = useState<Realce | null>(null);
  // A legenda do pé da coluna começa recolhida: o mapa já mostra a pílula de cada partido.
  const [legendaAberta, setLegendaAberta] = useState(false);

  // Abre com o mapa e pouca coisa em volta; o detalhe vem quando se toca numa
  // medida ou num estado. Estado escolhido sempre abre a barra.
  const [abertaEscolhida, setAberta] = useEstadoCompartilhavel("mapa.detalhe", sigla !== null, opcaoCompartilhada([true,false]));
  const [painelIndicadores, setPainelIndicadores] = useEstadoCompartilhavel<"estados" | "brasil">("mapa.painel", sigla ? "estados" : "brasil", opcaoCompartilhada(["estados","brasil"]));
  const aberta = abertaEscolhida || uf !== null || painelIndicadores === "brasil";

  // O último estado visto fica na tela enquanto a ficha dele se fecha.
  const [ufVista, setUfVista] = useState(uf);
  if (uf && uf !== ufVista) setUfVista(uf);

  // Trocar de medida no zoom (a cor é a medida) reprocessa o mapa: um instante
  // fora de foco e sem cor, e ele volta com as cores novas. Sem estado
  // escolhido a cor é o partido e não muda: só os números trocam, num
  // esmaecer curto.
  const mapa = useRef<HTMLDivElement>(null);
  const leituraVista = useRef(leitura.id);
  useEffect(() => {
    if (leituraVista.current === leitura.id) return;
    leituraVista.current = leitura.id;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const curva = "cubic-bezier(.16,1,.3,1)";
    if (uf === null) {
      mapa.current
        ?.querySelectorAll(".mapa-rotulos")
        .forEach((g) => g.animate([{ opacity: 0, filter: "blur(3px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 700, easing: curva }));
      return;
    }
    mapa.current?.animate([{ filter: "blur(6px) saturate(0) brightness(1.5)" }, { filter: "none" }], {
      duration: 800,
      easing: curva,
    });
  }, [leitura.id, uf]);

  // A manchete passeia sozinha pelas medidas até a pessoa escolher uma; o
  // número troca rolando os algarismos (`NumeroRolante`).
  const [alternar, setAlternar] = useState(true);
  useEffect(()=>{if(new URLSearchParams(location.search).has("r.mapa.indicador"))setAlternar(false);},[]);
  const [pausa, setPausa] = useState(false);

  const regua = useMemo(() => reguaDeCor(Object.values(leitura.ufs).flat(), leitura.escala, leitura.rampa ?? "mapa"), [leitura]);

  // Troca o que o mapa mostra. A manchete troca só isto; a barra também abre o detalhe.
  const trocarLeitura = (l: Leitura) => {
    if (l.id === leitura.id) return;
    setId(l.id);
    setRealce(null);
    const novosModos = modosDe(l);
    const novoModo = novosModos.includes(modoEscolhido) ? modoEscolhido : novosModos[0];
    setPeriodo(historico && novoModo === "mudanca" ? l.indiceRecebido ?? 0 : l.periodos.length - 1);
  };
  const escolher = (l: Leitura) => {
    setAlternar(false);
    if (l.id === leitura.id) {
      // Tocar de novo na medida aberta fecha o detalhe; com estado escolhido, fica.
      setAberta(!aberta || uf !== null);
      return;
    }
    trocarLeitura(l);
    setAberta(true);
  };
  const selecionar = (s: string | null) => {
    setSigla(s);
    if (s) {
      setPainelIndicadores("estados");
      setAberta(true);
    }
  };
  const fechar = () => {
    setSigla(null);
    setAberta(false);
    setPainelIndicadores("estados");
  };

  // --- O desenho sobre cada estado ------------------------------------------

  const r = leitura.indiceRecebido;
  const comSetas = modo === "mudanca" && r !== null;
  // De que partido é o que o mapa mostra. Em "desde a posse", do que governou
  // cada estado a maior parte do tempo desde a posse: a mudança é dele. Nos
  // outros modos, do de quem governava no período. Pílula, barra por partido
  // e balão usam o mesmo.
  const posse =
    comSetas && periodo > r ? inicioDoPeriodo(leitura.periodos[leitura.indicePosse ?? r + 1], hoje) : null;
  const partidoUf = useMemo(
    () =>
      new Map(
        dados.ufs.map((u) => [
          u.sigla,
          posse
            ? partidoNoIntervalo(governos, u.sigla, posse, dia)
            : { partido: governoUf.get(u.sigla)?.partido ?? null, trocas: null },
        ]),
      ),
    [dados.ufs, governos, governoUf, posse, dia],
  );
  const coresMudanca = comSetas && leitura.direcao !== undefined && leitura.direcao !== "neutro";
  // O passeio só roda no país inteiro, com a barra nos indicadores do Brasil e
  // sem o histórico aberto; pausa com o ponteiro na coluna ou no mapa.
  const ciclo = leituras.filter((l) => modosDe(l).includes(modo));
  const passeando = alternar && uf === null && !historico && painelIndicadores === "brasil" && ciclo.length > 1;
  const avancar = () => {
    const i = ciclo.findIndex((l) => l.id === leitura.id);
    trocarLeitura(ciclo[(i + 1) % ciclo.length]);
  };
  // A primeira troca vem logo, para a pessoa notar que a manchete passeia;
  // depois, a cada 5 s. O tempo recomeça a cada troca e a cada pausa. Quem
  // pediu menos movimento não vê a manchete trocar sozinha.
  const avancarAgora = useRef(avancar);
  avancarAgora.current = avancar;
  const trocas = useRef(0);
  useEffect(() => {
    if (!passeando || pausa) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const relogio = window.setTimeout(() => {
      trocas.current += 1;
      avancarAgora.current();
    }, trocas.current === 0 ? 3200 : 5000);
    return () => window.clearTimeout(relogio);
  }, [passeando, pausa, leitura.id]);
  const pausar = {
    onPointerEnter: () => setPausa(true),
    onPointerLeave: () => setPausa(false),
  };
  // O melhor e o pior partido na medida, para a manchete (os mesmos da barra).
  const partidos = useMemo(
    () => agruparPorPartido(leitura, posse !== null ? r : null, periodo, dados.ufs, partidoUf),
    [leitura, posse, r, periodo, dados.ufs, partidoUf],
  );
  const deltas = new Map(dados.ufs.map((u) => [u.codigo, desdeAPosse(leitura, leitura.ufs[u.codigo], periodo)]));
  const maiorDelta = Math.max(0, ...[...deltas.values()].map((d) => Math.abs(d ?? 0)));

  let glifo: Glifo | undefined;
  if (comSetas) {
    glifo = (u, x, y, pequena) => {
      const d = deltas.get(u.codigo);
      if (d === null || d === undefined) return null;
      return (
        <Seta
          x={x}
          y={y}
          delta={d}
          maior={maiorDelta}
          cor={corDoSentido(sentidoDe(leitura, d)) ?? "var(--tinta)"}
          texto={textoMudanca(leitura, d, true)}
          pequena={pequena}
        />
      );
    };
  } else if (modo === "evolucao") {
    glifo = (u, x, y, pequena) => (
      <MiniLinha
        x={x}
        y={y}
        valores={leitura.ufs[u.codigo] ?? []}
        periodo={periodo}
        posse={leitura.indicePosse}
        pequena={pequena}
      />
    );
  } else if (modo === "tamanho" && leitura.tamanho) {
    const t = leitura.tamanho;
    glifo = (u, x, y, pequena) => {
      const v = t.ufs[u.codigo];
      return v ? <Rotulo x={x} y={y} texto={reaisCurto(v)} pequena={pequena} /> : null;
    };
  }
  const tamanho = modo === "tamanho" ? leitura.tamanho : undefined;
  // Governo federal: os estados governados pelo partido do presidente do período.
  const familiaPresidente = presidente?.partido && presidente.partido !== "SEM" ? familiaDe(governos, presidente.partido) : null;
  const mesmoPartido = familiaPresidente
    ? dados.ufs.filter((u) => familiaDe(governos, governoUf.get(u.sigla)?.partido ?? null) === familiaPresidente)
    : [];
  const camada = tamanho ? (escala: number) => <Bolhas ufs={dados.ufs} tamanho={tamanho} escala={escala} /> : undefined;
  // Partido não confirmado fica sem etiqueta no mapa; o balão diz por quê.
  const marca = (u: UF) => {
    const s = partidoUf.get(u.sigla)?.partido ?? null;
    if (s === null) return null;
    return {
      texto: rotuloPartido(governos, s, true),
      nome: nomePartido(governos, s),
      logo: logoDoPartido(s),
    };
  };

  const p = leitura.periodos[periodo];
  const explicacao =
    modo === "mudanca"
      ? comSetas && r !== null
        ? `${leitura.periodos[r].rotulo} → ${p.rotulo} · ${emPontos(leitura) ? "p.p." : "%"}.${coresMudanca ? (uf ? " Cor: melhora ou piora, sem indicar magnitude." : " Setas: verde melhorou, vermelho piorou.") : ""}`
        : null
      : modo === "evolucao"
        ? `${leitura.periodos[0].rotulo}–${leitura.periodos.at(-1)!.rotulo} · escala por UF · tracejado: posse.`
        : modo === "tamanho" && leitura.tamanho
          ? `Área dos círculos: ${leitura.tamanho.titulo}.`
          : null;
  const trocarModo = (m: Modo) => {
    if (m === modo) return;
    setModo(m);
    setRealce(null);
    if (historico && m === "mudanca") setPeriodo(leitura.indiceRecebido ?? 0);
  };
  const alternarHistorico = () => {
    setHistorico(!historico);
    setPeriodo(leitura.periodos.length - 1);
    setRealce(null);
  };

  // Na tela larga, mapa, modos e régua ocupam o vão entre a coluna da
  // esquerda e a barra, e recuam junto quando ela abre.
  const vao = `lg:left-[19.5rem] lg:right-[calc(var(--largura)+2.5rem)] lg:transition-[right] ${MOVIMENTO}`;

  return (
    <section
      id="mapa-economia"
      className="sala-tema relative -mx-3 -mt-3 overflow-hidden"
      aria-label={tema.rotulo}
    >
      <div
        className="relative mx-auto flex max-w-[1680px] flex-col gap-4 px-3 py-4 lg:block lg:h-[calc(100dvh-var(--altura-cabecalho,4rem))] lg:min-h-[600px] lg:p-0"
        style={
          {
            "--largura": aberta ? LARGURA.aberta : LARGURA.fechada,
          } as React.CSSProperties
        }
      >
        {/* A esquerda, de cima para baixo: a manchete (a medida, o número, o
            período); embaixo, menores, as pontas por estado e por partido; no
            pé, como ler o mapa (os modos, a legenda, o presidente, o
            histórico). Assim o mapa fica com a altura toda do palco. Os indicadores e comparações estão
            no painel único da direita; no celular a legenda vem após o mapa. */}
        <div
          data-coluna-resumo
          className="contents lg:absolute lg:bottom-6 lg:left-6 lg:top-6 lg:z-10 lg:flex lg:w-[17rem] lg:flex-col lg:gap-6"
          {...pausar}
          onFocus={() => setPausa(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setPausa(false);
          }}
        >
          <Destaque
            key={uf?.sigla ?? "BR"}
            leitura={leitura}
            periodo={periodo}
            uf={uf}
            ufs={dados.ufs}
            hoje={hoje}
            leituras={leituras}
            aoTrocarLeitura={(l) => {
              setAlternar(false);
              trocarLeitura(l);
            }}
          />
          {!uf && (
            <PontasDaMedida
              key={`pontas-${leitura.id}`}
              l={leitura}
              periodo={periodo}
              ufs={dados.ufs}
              governos={governos}
              partidos={partidos}
              desdePosse={posse !== null}
              realce={realce}
              setRealce={setRealce}
              aoSelecionarUf={selecionar}
            />
          )}
          {/* Fechado, o cartão é uma linha: os modos, o histórico e a legenda.
              Aberto, cresce para cima, sem empurrar a manchete. */}
          <div className="controle-mapa vidro order-4 w-full rounded-2xl px-2 py-2 lg:order-last lg:mt-auto">
            <div className="flex flex-wrap items-center gap-1">
              <div className="min-w-0 flex-1 lg:basis-full">
                <ModosDoMapa modos={modos} ativo={modo} aoEscolher={trocarModo} />
              </div>
              {(leitura.periodos.length > 1 || historico) && (
                <button
                  onClick={alternarHistorico}
                  aria-pressed={historico}
                  aria-label={historico ? "Fechar histórico" : "Explorar histórico"}
                  title={historico ? "Fechar histórico" : "Explorar histórico"}
                  className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--faixa-a)]"
                  style={{ color: historico ? "var(--serie)" : "var(--tinta-2)" }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setLegendaAberta(!legendaAberta)}
                aria-expanded={legendaAberta}
                aria-label={legendaAberta ? "Esconder a legenda" : "Mostrar a legenda"}
                title="Legenda"
                className="controle-mapa-legenda flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 hover:bg-[var(--faixa-a)] lg:ml-auto"
                style={{ color: "var(--tinta-2)" }}
              >
                <span>Legenda</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="transition-transform duration-200" style={{ transform: legendaAberta ? undefined : "rotate(180deg)" }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
            <Abrir aberto={legendaAberta}>
            <div className="mt-1.5 border-t pt-2" style={{ borderColor: "var(--borda)" }}>
            {coresMudanca ? (
              <div className="text-xs" data-legenda>
                <p className="font-semibold">{leitura.titulo}: desde a posse</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1" style={{ color: "var(--tinta-2)" }}>
                  {[["melhor", "Melhorou"], ["estavel", "Estável"], ["pior", "Piorou"], ["sem-dado", "Sem comparação"]].map(([cor, rotulo]) => (
                    <span key={cor} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-2.5 w-3 rounded-sm" style={{ background: cor === "sem-dado" ? "var(--grade)" : `var(--mapa-${cor})` }} />
                      {rotulo}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <Legenda
                titulo={leitura.titulo}
                exemplo={false}
                formato={leitura.formato}
                escala={leitura.escala}
                regua={regua}
              />
            )}
            <LegendaPartidos
              governos={governos}
              partidoUf={partidoUf}
              desdePosse={posse !== null}
              realce={realce}
              setRealce={setRealce}
            />
            {explicacao && (
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--tinta-2)" }}>
                {explicacao}
              </p>
            )}
            {presidente && (
              <LinhaPresidente
                governos={governos}
                presidente={presidente}
                estados={mesmoPartido}
                aceso={realce?.chave === "presidente"}
                setRealce={setRealce}
              />
            )}
            <p className="tabular mt-1.5 border-t pt-1.5 text-[10px]" style={{ borderColor: "var(--borda)", color: "var(--tinta-3)" }}>
              {historico ? "Período" : "Último dado"} · {p.rotulo}
            </p>
            </div>
            </Abrir>
          </div>
        </div>

        {/* No celular a altura segue a largura (o Brasil é quase quadrado). Na
            tela larga o mapa vai de cima a baixo do palco e só sobe para dar
            lugar à régua do tempo, quando ela abre. */}
        <div
          ref={mapa}
          {...pausar}
          className={`order-3 h-[82vw] max-h-[560px] lg:absolute lg:top-5 lg:h-auto lg:max-h-none ${historico ? "lg:bottom-28" : "lg:bottom-5"} ${CHEGADA} ${vao}`}
          style={{ transition: "bottom 520ms cubic-bezier(.22,1,.36,1), right 500ms cubic-bezier(.22,1,.36,1)" }}
          aria-label={`Mapa: ${leitura.titulo}`}
        >
          <Mapa
            atlas
            sombra={SOMBRA}
            ufs={dados.ufs}
            largura={dados.mapa.largura}
            altura={dados.mapa.altura}
            leitura={leitura}
            periodo={periodo}
            regua={regua}
            selecionada={uf}
            aoSelecionar={selecionar}
            formasMunicipais={null}
            dadosMunicipais={null}
            camadaMunicipal={null}
            moldura={MOLDURA}
            vizinhosNoZoom
            glifo={glifo}
            camada={camada}
            chegada
            apagarOutros
            opacidadePreenchimento={0.94}
            espessuraContorno={0.7}
            corUf={coresMudanca ? (u) => corDaMudanca(deltas.get(u.codigo) ?? null, leitura.direcao ?? "neutro") : undefined}
            marca={marca}
            realce={realce?.ufs ?? null}
            detalhe={(u) => (
              <QuemGovernava
                governos={governos}
                uf={u}
                trecho={governoUf.get(u.sigla) ?? null}
                trocas={partidoUf.get(u.sigla)?.trocas ?? null}
              />
            )}
          />
        </div>

        <div
          className={`economia-controles order-4 flex flex-col lg:absolute lg:bottom-5 ${vao}`}
          data-historico={historico}
        >
          {leitura.periodos.length > 1 && (
            <div className="economia-historico w-full min-w-0" inert={!historico} aria-hidden={!historico}>
              <div className="min-h-0 overflow-hidden">
                <div className="economia-historico-conteudo vidro rounded-2xl px-3 py-2">
                  <ReguaTempo key={modo} leitura={leitura} periodo={periodo} setPeriodo={setPeriodo} inicio={inicioPeriodo} ativo={historico} />
                </div>
              </div>
            </div>
          )}
        </div>

        <aside
          className={`vidro order-5 animate-[entrar-lado_.6s_ease-out_.1s_backwards] rounded-3xl p-2 lg:absolute lg:right-5 lg:top-5 lg:z-20 lg:flex lg:max-h-[calc(100%-2.5rem)] lg:w-[var(--largura)] lg:flex-col lg:transition-[width] ${MOVIMENTO}`}
          aria-label={tema.rotuloIndicadores}
          data-painel-indicadores={painelIndicadores}
        >
          <div className="flex items-center gap-2 px-3 pb-1 pt-1.5">
            <div className="flex min-w-0 items-center gap-4" role="group" aria-label="Grupo de indicadores">
              {([['brasil', 'Brasil'], ['estados', 'Estados']] as const).map(([id, titulo]) => (
                <button
                  key={id}
                  onClick={() => { setPainelIndicadores(id); setRealce(null); }}
                  aria-pressed={painelIndicadores === id}
                  className="min-h-9 whitespace-nowrap border-b-2 text-xs font-semibold transition-colors"
                  style={{ color: painelIndicadores === id ? "var(--tinta)" : "var(--tinta-3)", borderColor: painelIndicadores === id ? "var(--serie)" : "transparent" }}
                >
                  {titulo}
                </button>
              ))}
            </div>
            <button
              onClick={fechar}
              aria-label="Fechar o detalhe"
              tabIndex={aberta ? 0 : -1}
              aria-hidden={!aberta}
              className={`ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity duration-300 hover:bg-[var(--faixa-a)] ${aberta ? "opacity-100" : "pointer-events-none opacity-0"}`}
              style={{ color: "var(--tinta-2)" }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><path d="m6 6 12 12M6 18 18 6" /></svg>
            </button>
          </div>

          <div
            className="min-h-0 flex-1 overflow-y-auto pb-5"
            style={{
              scrollbarWidth: "none",
              maskImage: ESMAECER,
              WebkitMaskImage: ESMAECER,
            }}
          >
            {painelIndicadores === "brasil" ? (
              tema.placar
            ) : <>
            <Abrir aberto={uf !== null}>
              {ufVista && (
                <>
                <button
                  onClick={() => selecionar(null)}
                  aria-label="Voltar para o Brasil"
                  className="mx-3 mb-1 inline-flex min-h-8 items-center gap-1.5 rounded-md text-[11px] font-medium hover:underline"
                  style={{ color: "var(--tinta-2)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m10 5-7 7 7 7M3 12h18" /></svg>
                  Todos os estados
                </button>
                <CabecalhoEstado
                  dados={dados}
                  uf={ufVista}
                  aoSelecionar={selecionar}
                  governo={governoUf.get(ufVista.sigla) ?? null}
                  quando={p.rotulo}
                />
                </>
              )}
            </Abrir>

            <ul className={uf ? "space-y-0" : "space-y-1"} role="radiogroup" aria-label="Medida no mapa">
              {leituras.map((l) => (
                <ItemLeitura
                  key={l.id}
                  l={l}
                  ativo={l.id === leitura.id}
                  aberto={aberta}
                  compacto={aberta && !uf && l.id !== leitura.id}
                  periodo={l.id === leitura.id ? periodo : l.periodos.length - 1}
                  uf={uf}
                  ufs={dados.ufs}
                  aoEscolher={() => escolher(l)}
                  aoSelecionarUf={selecionar}
                  grafico={l.id === leitura.id && ufVista ? (
                    <SerieComGovernos governos={governos} uf={ufVista} l={l} periodo={periodo} hoje={hoje} />
                  ) : undefined}
                  porPartido={
                    l.id === leitura.id && !uf ? (
                      <PorPartido
                        l={l}
                        desdePosse={posse !== null}
                        periodo={periodo}
                        ufs={dados.ufs}
                        governos={governos}
                        partidoUf={partidoUf}
                        realce={realce}
                        setRealce={setRealce}
                        aoSelecionarUf={selecionar}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ul>

            <Abrir aberto={uf !== null}>
              {ufVista && (
                <HistoricoGovernos governos={governos} uf={ufVista} />
              )}
              {ufVista && (
                <div className="px-3 pb-2 pt-3">
                  <p
                    className="mono text-[10px] font-medium uppercase tracking-[0.14em]"
                    style={{ color: "var(--tinta-3)" }}
                  >
                    {ufVista.nome} nas outras abas
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ABAS.filter((a) => a.id !== tema.id && !a.indisponivel).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => aoTrocarAba(a.id)}
                        className="vidro-lente rounded-full px-3 py-1 text-xs"
                      >
                        {a.rotulo} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Abrir>
            </>}
          </div>
        </aside>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Em volta do mapa
// ---------------------------------------------------------------------------

/**
 * A manchete do mapa, no canto: o número grande do
 * Brasil (ou do estado escolhido), o que mudou desde a posse numa pílula e,
 * embaixo, o estado de valor mais alto e o de mais baixo.
 * Troca de medida ou de estado e ela entra de novo, de baixo para cima.
 */
function Destaque({
  leitura: l,
  periodo,
  uf,
  ufs,
  hoje,
  leituras,
  aoTrocarLeitura,
}: {
  leitura: Leitura;
  periodo: number;
  uf: UF | null;
  ufs: UF[];
  hoje: string;
  /** As medidas por estado que o mapa sabe mostrar, para trocar ali mesmo. */
  leituras: Leitura[];
  aoTrocarLeitura: (l: Leitura) => void;
}) {
  const perfil=usePerfilPainel();
  const serie = uf ? l.ufs[uf.codigo] : l.brasil;
  const d = desdeAPosse(l, serie, periodo);
  const sent = d !== null ? sentidoDe(l, d) : "neutro";
  const cor = corDoSentido(sent);
  const r = l.indiceRecebido;
  const lugar = uf ? lugarNoPais(l, uf, periodo, ufs) : "";
  // A forma da medida até o período da régua, com a posse marcada.
  const meses = l.periodos.slice(0, periodo + 1).map((pp) => diaDoPeriodo(pp, "").slice(0, 7));
  // Dado anual de dois anos atrás (o PIB por estado) diz que é o último que
  // existe, para não parecer que a página parou em 2023.
  const dia = diaDoPeriodo(l.periodos[periodo], hoje);
  const antigo = Date.parse(hoje) - Date.parse(dia) > 400 * 864e5;

  return (
    <div className="order-1 animate-[subir_.5s_ease-out_backwards]" data-destaque={l.id}>
            <h1 className="titulo-painel">{perfil?`Economia no governo ${perfil.nome}`:"Economia"}</h1>
      <p className="mono text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--serie)" }}>
        {uf ? uf.nome : "Brasil"}
      </p>
      <div className="flex items-center justify-between gap-2"><SeletorMedida atual={l} leituras={leituras} uf={uf} aoTrocar={aoTrocarLeitura} /><Compartilhar mensagem={l.titulo+" · "+(uf?.nome??"Brasil")} ancora="mapa-economia" compacto/></div>
      {/* Alturas fixas: a manchete passeia pelas medidas e nada embaixo dela pode pular. */}
      <div className="mt-2 flex h-11 items-end gap-3">
        <p className="manchete shrink-0 text-4xl font-bold leading-none xl:text-[2.75rem]">
          <NumeroRolante texto={formatar(serie?.[periodo] ?? null, l.formato)} />
        </p>
        {meses.length > 2 && (
          <span key={`faisca-${l.id}`} className="mb-1 min-w-0 flex-1 animate-[aparecer_.5s_ease-out_backwards]">
            <Faisca datas={meses} valores={(serie ?? []).slice(0, periodo + 1)} altura={30} cor={cor ?? "var(--serie)"} />
          </span>
        )}
      </div>
      <p className="tabular mt-1.5 h-4 truncate text-xs" style={{ color: "var(--tinta-3)" }}>
        {l.periodos[periodo]?.extenso}
        {antigo && " · último dado publicado"}
        {uf && ` · Brasil ${formatar(l.brasil[periodo], l.formato)}`}
      </p>
      <div className="mt-2.5 h-6">
      {d !== null && r !== null && (
        <p
          key={`mudanca-${l.id}`}
          className="inline-flex max-w-full animate-[aparecer_.5s_ease-out_backwards] items-baseline gap-x-1.5 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs"
          style={{
            background: `color-mix(in srgb, ${cor ?? "var(--tinta-3)"} 8%, transparent)`,
            color: cor ?? "var(--tinta-2)",
          }}
        >
          <strong className="tabular">{textoMudanca(l, d)}</strong>
          <span style={{ color: "var(--tinta-2)" }}>desde {l.periodos[r].rotulo}</span>
          {sent !== "neutro" && <span className="font-medium">· {sent === "bom" ? "melhor" : "pior"}</span>}
        </p>
      )}
      </div>
      {lugar && (
        <p className="mt-2 text-sm" style={{ color: "var(--tinta-2)" }}>
          {`${lugar[0].toUpperCase()}${lugar.slice(1)}.`}
        </p>
      )}
    </div>
  );
}

/** O rótulo pequeno de cada bloco da coluna: "Estados", "Partidos". */
const ROTULO_BLOCO = "mono text-[10px] font-medium uppercase tracking-[0.14em]";

/**
 * Embaixo da manchete, menor e separado dela: as pontas da medida em dois
 * blocos com nome, para não misturar estado com partido. Estados com a
 * bandeira; partidos com a logo e quantos estados entram na mediana. Em
 * "desde a posse" as duas pontas são o que mais melhorou e o que mais piorou,
 * como no mapa; nos outros modos, o maior e o menor valor.
 */
function PontasDaMedida({
  l,
  periodo,
  ufs,
  governos,
  partidos,
  desdePosse,
  realce,
  setRealce,
  aoSelecionarUf,
}: {
  l: Leitura;
  periodo: number;
  ufs: UF[];
  governos: Governos;
  partidos: LinhaDoPartido[];
  desdePosse: boolean;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
  aoSelecionarUf: (sigla: string) => void;
}) {
  const avalia = l.direcao !== undefined && l.direcao !== "neutro";
  const valor = (u: UF) => (desdePosse ? desdeAPosse(l, l.ufs[u.codigo], periodo) : l.ufs[u.codigo]?.[periodo] ?? null);
  const texto = (v: number) => (desdePosse ? textoMudanca(l, v) : formatar(v, l.formato));
  const melhorPrimeiro = (a: number, b: number) => (desdePosse && l.direcao === "menor_melhor" ? a - b : b - a);
  const ordem = ufs
    .map((u) => ({ u, v: valor(u) }))
    .filter((x): x is { u: UF; v: number } => x.v !== null)
    .sort((a, b) => melhorPrimeiro(a.v, b.v));
  const comparaveis = partidos.filter((ln) => classePartido(ln) === 0);
  const [rotuloA, rotuloB] = desdePosse && avalia ? ["Melhor", "Pior"] : ["Maior", "Menor"];
  const [rotuloPa, rotuloPb] = avalia ? ["Melhor", "Pior"] : ["Maior", "Menor"];
  if (ordem.length < 2) return null;

  return (
    <div className="order-1 animate-[aparecer_.45s_ease-out_backwards]" data-pontas={l.id}>
      <section aria-label={`Estados nas pontas: ${l.titulo}`}>
        <p className={ROTULO_BLOCO} style={{ color: "var(--tinta-3)" }}>
          Estados{desdePosse ? " · desde a posse" : ""}
        </p>
        <ul className="mt-1">
          {(
            [
              [rotuloA, ordem[0]],
              [rotuloB, ordem.at(-1)!],
            ] as const
          ).map(([rotulo, { u, v }]) => (
            <li key={rotulo} className="flex items-center gap-2 py-[5px] text-[12.5px]">
              <span className="w-12 shrink-0 text-[11px]" style={{ color: "var(--tinta-3)" }}>
                {rotulo}
              </span>
              <Image
                src={`/painel/bandeiras/${u.sigla.toLowerCase()}.svg`}
                alt=""
                aria-hidden
                width={21}
                height={14}
                className="h-3.5 w-[21px] shrink-0 rounded-[2px] object-cover"
                style={{ boxShadow: "0 0 0 1px var(--borda)" }}
              />
              <button onClick={() => aoSelecionarUf(u.sigla)} className="min-w-0 flex-1 truncate text-left font-medium hover:underline">
                {u.nome}
              </button>
              <span className="tabular shrink-0" style={{ color: "var(--tinta-2)" }}>
                {texto(v)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {/* O bloco fica mesmo sem partido comparável, para a coluna não encolher. */}
      <section className="mt-3 min-h-[5.25rem] border-t pt-2.5" style={{ borderColor: "var(--borda)" }} aria-label={`Partidos nas pontas: ${l.titulo}`}>
        <p className={ROTULO_BLOCO} style={{ color: "var(--tinta-3)" }}>
          Partidos · mediana dos estados
        </p>
        {comparaveis.length < 2 ? (
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--tinta-3)" }}>
            Nenhum partido governa dois estados com dado.
          </p>
        ) : (
          <ul className="mt-1">
            {(
              [
                [rotuloPa, comparaveis[0]],
                [rotuloPb, comparaveis.at(-1)!],
              ] as const
            ).map(([rotulo, ln]) => (
              <LinhaPartidoPonta key={rotulo} rotulo={rotulo} ln={ln} governos={governos} texto={texto} realce={realce} setRealce={setRealce} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Um partido nas pontas: logo e sigla, quantos estados, a mediana; o ponteiro acende os estados no mapa. */
function LinhaPartidoPonta({
  rotulo,
  ln,
  governos,
  texto,
  realce,
  setRealce,
}: {
  rotulo: string;
  ln: LinhaDoPartido;
  governos: Governos;
  texto: (v: number) => string;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
}) {
  const { aceso, eventos } = useAcenderPartido(ln, realce, setRealce);
  return (
    <li>
      <button
        type="button"
        {...eventos}
        aria-pressed={aceso}
        className="flex w-full items-center gap-2 rounded-md py-[5px] text-left text-[12.5px]"
        title={`${nomePartido(governos, ln.sigla)}: ${ln.ps.map((pt) => pt.u.sigla).join(", ")}. Mediana dos estados.`}
      >
        <span className="w-12 shrink-0 text-[11px]" style={{ color: "var(--tinta-3)" }}>
          {rotulo}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <IdentidadePartido governos={governos} sigla={ln.sigla} />
          <span className="truncate text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {ln.ps.length} estados
          </span>
        </span>
        <span className="tabular shrink-0" style={{ color: "var(--tinta-2)", fontWeight: aceso ? 650 : undefined }}>
          {texto(ln.med)}
        </span>
      </button>
    </li>
  );
}

/**
 * O número troca como o relógio do iPhone ou um placar de virar: cada
 * algarismo que muda sobe e some, e o novo entra por baixo, um depois do
 * outro; os que não mudam ficam parados. Os algarismos casam pela direita,
 * como numa conta. A unidade ("R$", "%") vem como em `Numero`, mais leve.
 * Na primeira pintura não há anterior, então nada rola.
 */
export function NumeroRolante({ texto: bruto }: { texto: string }) {
  // "sem dado" não é número: rolando dígito a dígito, perdia o espaço.
  const texto = bruto === "sem dado" ? "—" : bruto;
  const [agora, setAgora] = useState(texto);
  const [antes, setAntes] = useState<string | null>(null);
  const [vez, setVez] = useState(0);
  if (texto !== agora) {
    setAntes(agora);
    setAgora(texto);
    setVez(vez + 1);
  }
  const partes = (t: string) => {
    const m = t.match(/^(R\$\s)?([+\-−]?[\d.,]+)(%|\s(?:pts|mi|bi|tri|mil|km²))?$/);
    return m ? { pre: Boolean(m[1]), corpo: m[2], suf: m[3]?.trim() ?? "" } : { pre: false, corpo: t, suf: "" };
  };
  const a = partes(agora);
  const n = a.corpo.length;
  const velho = antes === null ? null : partes(antes).corpo.padStart(n, " ").slice(-n);
  const leve = { color: "var(--tinta-2)" };
  let ordem = 0;

  return (
    <span className="inline-flex items-baseline">
      <span className="sr-only">{agora}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {a.pre && (
          <span className="mr-[0.22em] text-[0.62em] font-semibold" style={leve}>
            R$
          </span>
        )}
        {[...a.corpo].map((c, i) => {
          const v = velho?.[i];
          const muda = velho !== null && v !== c;
          const atraso = muda ? `${ordem++ * 45}ms` : undefined;
          return (
            // A chave é a casa contada da direita: unidade com unidade, dezena com dezena.
            <span key={n - i} className="digito">
              <span key={muda ? `novo-${vez}` : "parado"} className={muda ? "digito-entra" : undefined} style={{ animationDelay: atraso }}>
                {c}
              </span>
              {muda && v && v !== " " && (
                <span key={`velho-${vez}`} className="digito-sai" style={{ animationDelay: atraso }}>
                  {v}
                </span>
              )}
            </span>
          );
        })}
        {a.suf && (
          <span className="ml-[0.08em] text-[0.62em] font-semibold" style={leve}>
            {a.suf}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * O nome da medida na manchete é também o seletor dela: as cinco medidas por
 * estado, com o valor do Brasil (ou do estado escolhido) ao lado. Trocar aqui
 * muda o mapa sem abrir a barra nem rolar a página; a barra continua tendo o
 * detalhe de cada uma.
 */
function SeletorMedida({
  atual,
  leituras,
  uf,
  aoTrocar,
}: {
  atual: Leitura;
  leituras: Leitura[];
  uf: UF | null;
  aoTrocar: (l: Leitura) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useId();

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const fora = (e: PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const valor = (l: Leitura) => {
    const i = l.periodos.length - 1;
    return formatar((uf ? l.ufs[uf.codigo]?.[i] : l.brasil[i]) ?? null, l.formato);
  };

  return (
    <div
      ref={raiz}
      className="relative mt-1 min-w-0 flex-1"
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          e.stopPropagation();
          setAberto(false);
          raiz.current?.querySelector<HTMLElement>("button")?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? lista : undefined}
        aria-label={`Medida no mapa: ${atual.titulo}. Trocar de medida`}
        className="-ml-1.5 inline-flex max-w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-left text-[15px] font-semibold leading-tight hover:bg-[var(--faixa-a)]"
      >
        <span key={atual.id} className="palavra-entra truncate">
          {atual.titulo}
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 transition-transform duration-200"
          style={{ color: "var(--tinta-3)", transform: aberto ? "rotate(180deg)" : undefined }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        <div
          id={lista}
          role="listbox"
          aria-label="Medida no mapa"
          className="mandato-opcoes vidro absolute left-0 top-[calc(100%+6px)] z-40 w-[18rem] rounded-2xl p-1.5"
        >
          {leituras.map((l) => {
            const escolhida = l.id === atual.id;
            return (
              <button
                key={l.id}
                type="button"
                role="option"
                aria-selected={escolhida}
                onClick={() => {
                  aoTrocar(l);
                  setAberto(false);
                }}
                className={`flex w-full items-baseline justify-between gap-3 rounded-xl px-2.5 py-2 text-left ${escolhida ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px]" style={{ fontWeight: escolhida ? 650 : 500 }}>
                    {l.titulo}
                  </span>
                  <span className="tabular block text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                    {uf ? uf.sigla : "Brasil"} · {l.periodos.at(-1)?.rotulo}
                  </span>
                </span>
                <Numero texto={valor(l)} className="tabular shrink-0 text-[15px] font-bold" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * A legenda da cor do mapa sem estado escolhido: um quadradinho por partido,
 * com quantos estados ele governa. Por cima de um partido, os estados dele
 * acendem no mapa, como na barra.
 */
function LegendaPartidos({
  governos,
  partidoUf,
  desdePosse,
  realce,
  setRealce,
}: {
  governos: Governos;
  partidoUf: Map<string, { partido: string | null; trocas: string | null }>;
  desdePosse: boolean;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
}) {
  const grupos = new Map<string, { sigla: string | null; ufs: string[] }>();
  for (const [uf, { partido }] of partidoUf) {
    const k = chavePartido(partido);
    const g = grupos.get(k) ?? { sigla: partido, ufs: [] };
    g.ufs.push(uf);
    grupos.set(k, g);
  }
  const fim = (x: string | null) => (x === null ? 2 : x === "SEM" ? 1 : 0);
  const lista = [...grupos.entries()].sort(([, a], [, b]) => fim(a.sigla) - fim(b.sigla) || b.ufs.length - a.ufs.length);
  return (
    <div className="mt-2 text-xs" data-legenda-partidos>
      <p className="font-semibold">Quem governa</p>
      {desdePosse && (
        <p className="text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
          o que governou mais tempo desde a posse
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1" style={{ color: "var(--tinta-2)" }}>
        {lista.map(([k, g]) => (
          <ChipPartido key={k} chave={k} governos={governos} sigla={g.sigla} ufs={g.ufs} realce={realce} setRealce={setRealce} />
        ))}
      </div>
    </div>
  );
}

function ChipPartido({
  chave,
  governos,
  sigla,
  ufs,
  realce,
  setRealce,
}: {
  chave: string;
  governos: Governos;
  sigla: string | null;
  ufs: string[];
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
}) {
  const id = `partido:${chave}`;
  const aceso = realce?.chave === id;
  const eventos = useAcender(aceso, () => setRealce({ chave: id, ufs: new Set(ufs) }), () => setRealce(null));
  const cor = corPartidoMapa(governos, sigla);
  return (
    <button
      type="button"
      {...eventos}
      aria-pressed={aceso}
      title={`${nomePartido(governos, sigla)}: ${ufs.join(", ")}`}
      className="inline-flex items-center gap-1 rounded-md"
      style={{ fontWeight: aceso ? 650 : undefined, color: aceso ? "var(--tinta)" : undefined }}
    >
      <span aria-hidden className="h-2.5 w-3 rounded-sm" style={{ background: cor, boxShadow: "inset 0 0 0 1px var(--borda)" }} />
      {rotuloPartido(governos, sigla, true)}
      <span className="tabular" style={{ color: "var(--tinta-3)" }}>
        {ufs.length}
      </span>
    </button>
  );
}

/**
 * O estado contra o Brasil numa medida: a régua com as 27 UFs de pano de
 * fundo, quanto acima ou abaixo e a posição no país.
 */
function ContraBrasil({ l, uf, periodo, ufs }: { l: Leitura; uf: UF; periodo: number; ufs: UF[] }) {
  const c = compararUf(l, uf.codigo, periodo, ufs.map((u) => u.codigo));
  const casas = l.formato === "reais2" || l.formato === "pct2" ? 2 : l.formato === "reais0" || l.formato === "inteiro" ? 0 : 1;
  const diferenca = c?.diferenca == null ? null : Math.round(c.diferenca * 10 ** casas) / 10 ** casas;
  const cor = diferenca === null ? undefined : corDoSentido(sentido(diferenca, l.direcao ?? "neutro"));
  return (
    <>
      <ReguaEstado
        valor={c?.valor ?? null}
        brasil={c?.brasil ?? l.brasil[periodo] ?? null}
        contexto={ufs.filter((u) => u.codigo !== uf.codigo).map((u) => l.ufs[u.codigo]?.[periodo] ?? null)}
        formato={l.formato}
        sigla={uf.sigla}
        cor={cor}
      />
      <span className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] leading-snug">
        <span className="tabular" style={{ color: "var(--tinta-3)" }}>
          Brasil {formatar(c?.brasil ?? l.brasil[periodo] ?? null, l.formato)} · {l.periodos[periodo]?.rotulo}
        </span>
        {diferenca !== null && (
          <span className="tabular font-medium" style={{ color: cor ?? "var(--tinta-2)" }}>
            {diferenca === 0 ? "Igual ao Brasil" : `${emPontos(l) ? `${numero(Math.abs(diferenca), casas)} p.p.` : formatar(Math.abs(diferenca), l.formato)} ${diferenca < 0 ? "abaixo" : "acima"}`}
          </span>
        )}
        {!c && <span style={{ color: "var(--tinta-2)" }}>Sem dado estadual</span>}
      </span>
    </>
  );
}

function ReguaEstado({ valor, brasil, contexto, formato, sigla, cor }: {
  valor: number | null;
  brasil: number | null;
  contexto: (number | null)[];
  formato: Formato;
  sigla: string;
  cor?: string;
}) {
  const r = reguaComparacao(valor, brasil, contexto);
  if (r.estado === null && r.brasil === null) {
    return <span className="my-3 block text-xs" style={{ color: "var(--tinta-3)" }}>Sem dados para comparar neste período.</span>;
  }
  return (
    <span
      className="relative block h-4"
      role="img"
      aria-label={`${sigla}: ${formatar(valor, formato)}. Brasil: ${formatar(brasil, formato)}. Pontos indicam as demais UFs. Escala de ${formatar(r.minimo, formato)} a ${formatar(r.maximo, formato)}.`}
      title={`Escala de ${formatar(r.minimo, formato)} a ${formatar(r.maximo, formato)}`}
      data-regua-comparacao
    >
      <span className="absolute inset-y-0 left-1 right-1" aria-hidden>
        <span className="absolute inset-x-0 top-[7px] h-0.5 rounded-full" style={{ background: "var(--grade)" }} />
        {contexto.map((v, i) => v !== null && Number.isFinite(v) ? (
          <span
            key={i}
            data-marcador-outra-uf
            className="absolute top-[6px] h-1 w-1 -translate-x-1/2 rounded-full opacity-50 transition-[left] duration-500 motion-reduce:transition-none"
            style={{ left: `${((v - r.minimo) / (r.maximo - r.minimo)) * 100}%`, background: "var(--tinta-3)" }}
          />
        ) : null)}
        {r.estado !== null && r.brasil !== null && (
          <span className="absolute top-[7px] h-0.5 rounded-full opacity-50 transition-[left,width] duration-500 motion-reduce:transition-none" style={{ left: `${Math.min(r.estado, r.brasil)}%`, width: `${Math.abs(r.estado - r.brasil)}%`, background: cor ?? "var(--tinta-2)" }} />
        )}
        {r.brasil !== null ? (
          <span className="absolute top-px h-3.5 w-0.5 -translate-x-1/2 transition-[left] duration-500 motion-reduce:transition-none" data-marcador-brasil style={{ left: `${r.brasil}%`, background: "var(--tinta-3)" }} />
        ) : null}
        {r.estado !== null && (
          <span className="absolute top-[3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full transition-[left] duration-500 motion-reduce:transition-none" data-marcador-uf style={{ left: `${r.estado}%`, background: cor ?? "var(--tinta-2)" }} />
        )}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Barra da direita
// ---------------------------------------------------------------------------

function ItemLeitura({
  l,
  ativo,
  aberto,
  compacto,
  periodo,
  uf,
  ufs,
  aoEscolher,
  aoSelecionarUf,
  porPartido,
  grafico,
}: {
  l: Leitura;
  ativo: boolean;
  aberto: boolean;
  /** Com o detalhe de outra medida aberto, esta fica numa linha só. */
  compacto: boolean;
  periodo: number;
  uf: UF | null;
  ufs: UF[];
  aoEscolher: () => void;
  aoSelecionarUf: (sigla: string) => void;
  /** A medida por partido de quem governa, no lugar das pontas. */
  porPartido?: React.ReactNode;
  grafico?: React.ReactNode;
}) {
  const [detalhes, setDetalhes] = useState(false);
  useEffect(() => setDetalhes(false), [uf?.sigla, ativo]);
  const serie = uf ? l.ufs[uf.codigo] : l.brasil;
  const v = serie?.[periodo] ?? null;
  const d = desdeAPosse(l, serie, periodo);
  const sent = d !== null ? sentidoDe(l, d) : "neutro";
  const cor = corDoSentido(sent);

  return (
    <li
      className={`relative rounded-2xl transition-shadow duration-300 ${ativo ? "vidro-lente" : "hover:bg-[var(--faixa-a)]"}`}
    >
      <button
        role="radio"
        aria-checked={ativo}
        onClick={aoEscolher}
        className={`block w-full rounded-2xl px-3 text-left transition-[padding] ${MOVIMENTO} ${compacto || uf ? "py-1.5" : "py-2"}`}
        data-leitura-botao={l.id}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] leading-snug" style={{ fontWeight: ativo ? 650 : 500 }}>
            {l.titulo}
          </span>
          <Numero texto={formatar(v, l.formato)} className={`manchete tabular shrink-0 font-bold ${uf ? "text-base leading-tight" : "text-lg"}`} />
        </span>
        <Abrir aberto={!compacto} como="span">
          {!uf && <span className="tabular block text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>{l.periodos[periodo]?.rotulo}</span>}
          {uf && <ContraBrasil l={l} uf={uf} periodo={periodo} ufs={ufs} />}
          {!uf && d !== null && l.indiceRecebido !== null && (
            <span className="tabular block text-[11px] leading-snug" style={{ color: "var(--tinta-2)" }}>
              <strong style={{ color: cor ?? "var(--tinta)" }}>{textoMudanca(l, d)}</strong> desde{" "}
              {l.periodos[l.indiceRecebido].rotulo}
              {sent !== "neutro" && <span style={{ color: cor }}> ({sent === "bom" ? "melhor" : "pior"})</span>}
            </span>
          )}
        </Abrir>
      </button>

      {uf && ativo && aberto && (
        <button
          type="button"
          aria-expanded={detalhes}
          onClick={() => setDetalhes(!detalhes)}
          className="mx-3 mb-1 inline-flex min-h-7 items-center gap-1 rounded-md text-[11px] font-medium hover:underline"
          style={{ color: "var(--tinta-2)" }}
        >
          Detalhes
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`transition-transform duration-300 motion-reduce:transition-none ${detalhes ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}

      <Abrir aberto={ativo && aberto && (!uf || detalhes)}>
        <div className="px-3 pb-3">
          {uf && grafico && <div className="mb-3">{grafico}</div>}
          {uf && lugarNoPais(l, uf, periodo, ufs) && (
            <p className="mb-1 text-[11px]" style={{ color: "var(--tinta-2)" }}>{lugarNoPais(l, uf, periodo, ufs)}.</p>
          )}
          {uf && d !== null && l.indiceRecebido !== null && (
            <p className="tabular mb-2 text-[11px] leading-snug" style={{ color: "var(--tinta-2)" }}>
              <strong style={{ color: cor ?? "var(--tinta)" }}>{textoMudanca(l, d)}</strong> desde {l.periodos[l.indiceRecebido].rotulo}
              {sent !== "neutro" && <span style={{ color: cor }}> ({sent === "bom" ? "melhor" : "pior"})</span>}
            </p>
          )}
          <p className="text-xs leading-snug" style={{ color: "var(--tinta-2)" }}>
            {l.descricao}
          </p>
          {!uf && (porPartido ?? <Pontas l={l} periodo={periodo} ufs={ufs} aoSelecionarUf={aoSelecionarUf} />)}
          <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
            {l.calculo ? `${l.calculo[0].toUpperCase()}${l.calculo.slice(1)}. ` : ""}
            Fonte:{" "}
            {l.fonteUrl ? (
              <a
                href={l.fonteUrl}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
                style={{ color: "var(--serie)" }}
              >
                {l.fonte} ↗
              </a>
            ) : (
              l.fonte
            )}
            .
          </p>
        </div>
      </Abrir>
    </li>
  );
}

/** As três maiores e as três menores, clicáveis como o mapa. */
function Pontas({
  l,
  periodo,
  ufs,
  aoSelecionarUf,
}: {
  l: Leitura;
  periodo: number;
  ufs: UF[];
  aoSelecionarUf: (sigla: string) => void;
}) {
  const linhas = ufs
    .map((u) => ({ u, v: l.ufs[u.codigo]?.[periodo] ?? null }))
    .filter((x): x is { u: UF; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  if (linhas.length < 6) return null;
  const lista = (titulo: string, itens: typeof linhas) => (
    <div>
      <p className="text-[11px] font-medium" style={{ color: "var(--tinta-3)" }}>
        {titulo}
      </p>
      <ol>
        {itens.map(({ u, v }) => (
          <li key={u.sigla}>
            <button
              onClick={() => aoSelecionarUf(u.sigla)}
              className="flex w-full items-baseline justify-between gap-2 py-0.5 text-left text-xs hover:underline"
              title={u.nome}
            >
              <span className="min-w-0 truncate">{u.nome}</span>
              <span className="tabular shrink-0 whitespace-nowrap font-semibold">{formatar(v, l.formato)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="mt-2 grid grid-cols-2 gap-3">
      {lista("Maiores", linhas.slice(0, 3))}
      {lista("Menores", linhas.slice(-3).reverse())}
    </div>
  );
}

function CabecalhoEstado({
  dados,
  uf,
  aoSelecionar,
  governo,
  quando,
}: {
  dados: DadosPainel;
  uf: UF;
  aoSelecionar: (s: string | null) => void;
  /** Quem governava no período da régua. */
  governo: TrechoGoverno | null;
  quando: string;
}) {
  const ordem = [...dados.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const i = ordem.findIndex((u) => u.sigla === uf.sigla);
  const anterior = ordem[(i - 1 + ordem.length) % ordem.length];
  const proximo = ordem[(i + 1) % ordem.length];
  const botao = (rotulo: string, aoClicar: () => void, proximo: boolean) => (
    <button
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--faixa-a)]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={proximo ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} /></svg>
    </button>
  );
  return (
    <div className="px-3 pb-2 pt-1" data-ficha={uf.sigla}>
      <div className="flex items-start gap-3">
        <Image
        src={`/painel/bandeiras/${uf.sigla.toLowerCase()}.svg`}
        alt={`Bandeira ${uf.deNome}`}
        width={36}
        height={24}
        className="mt-0.5 h-6 w-9 shrink-0 rounded-sm object-contain"
        style={{ boxShadow: "0 0 0 1px var(--borda)" }}
      />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold leading-tight">{uf.nome}</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--tinta-2)" }}>
            {uf.regiao} · {pessoas(uf.populacao)} habitantes
          </p>
        </div>
      </div>
      {governo && (
          <p className="mt-2 flex items-center gap-2 text-[11px] leading-5" style={{ color: "var(--tinta-2)" }} data-governo={uf.sigla}>
            <RetratoGovernador uf={uf.sigla} nome={governo.nome} />
            <IdentidadePartido governos={dados.governos} sigla={governo.partido} />
            <span className="min-w-0">
              <span className="font-medium">{governo.nome}</span>
              <span style={{ color: "var(--tinta-3)" }}> · {quando}</span>
            </span>
          </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t pt-1.5" style={{ borderColor: "var(--borda)" }}>
        {/* Legenda das réguas de cada medida, logo abaixo. */}
        <p className="flex gap-3 text-[10px]" style={{ color: "var(--tinta-3)" }} aria-hidden>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--tinta-2)" }} />{uf.sigla}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5" style={{ background: "var(--tinta-3)" }} />Brasil</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full opacity-60" style={{ background: "var(--tinta-3)" }} />Demais UFs</span>
        </p>
        <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Navegar entre estados" style={{ color: "var(--tinta-2)" }}>
          {botao(`Estado anterior: ${anterior.nome}`, () => aoSelecionar(anterior.sigla), false)}
          {botao(`Próximo estado: ${proximo.nome}`, () => aoSelecionar(proximo.sigla), true)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desenhos sobre o mapa (unidades do viewBox, ~1185 × 1027)
// ---------------------------------------------------------------------------

/**
 * Seta do que mudou desde a posse: o comprimento é o tamanho da mudança, em
 * relação à maior do país; a cor diz melhor ou pior, e o número vai ao lado
 * para não depender só dela.
 */
function Seta({
  x,
  y,
  delta,
  maior,
  cor,
  texto,
  pequena,
}: {
  x: number;
  y: number;
  delta: number;
  maior: number;
  cor: string;
  texto: string;
  pequena: boolean;
}) {
  const k = maior > 0 ? Math.min(1, Math.abs(delta) / maior) : 0;
  const L = pequena ? 12 + 12 * k : 14 + 30 * k;
  const ax = x - (pequena ? 24 : 22);
  const h = pequena ? 7 : 9;
  const textoX = ax + h + 5;
  const rotulo = (
    <text
      x={textoX}
      y={y}
      dominantBaseline="central"
      fill="var(--tinta)"
      stroke="var(--plano)"
      strokeWidth={5}
      paintOrder="stroke"
      className="tabular"
      style={{ fontSize: pequena ? 19 : 21, fontWeight: 650 }}
    >
      {texto}
    </text>
  );

  if (Math.round(Math.abs(delta) * 10) === 0) {
    return (
      <g>
        <line x1={ax - h} x2={ax + h} y1={y} y2={y} stroke="var(--plano)" strokeWidth={9} strokeLinecap="round" />
        <line x1={ax - h} x2={ax + h} y1={y} y2={y} stroke="var(--tinta-2)" strokeWidth={4} strokeLinecap="round" />
        {rotulo}
      </g>
    );
  }

  const sobe = delta > 0;
  const ponta = sobe ? y - L / 2 : y + L / 2;
  const cauda = sobe ? y + L / 2 : y - L / 2;
  const base = sobe ? ponta + h : ponta - h;
  const cabeca = `M${ax - h},${base} L${ax},${ponta} L${ax + h},${base} Z`;
  return (
    <g>
      <line x1={ax} x2={ax} y1={cauda} y2={base} stroke="var(--plano)" strokeWidth={10} strokeLinecap="round" />
      <path d={cabeca} fill="var(--plano)" stroke="var(--plano)" strokeWidth={6} strokeLinejoin="round" />
      <line x1={ax} x2={ax} y1={cauda} y2={base} stroke={cor} strokeWidth={5} strokeLinecap="round" />
      <path d={cabeca} fill={cor} stroke={cor} strokeWidth={1.5} strokeLinejoin="round" />
      {rotulo}
    </g>
  );
}

/**
 * A série do estado num traço curto, na escala dele: mostra a forma (subiu,
 * caiu, voltou), não o nível, que já está na cor.
 */
function MiniLinha({
  x,
  y,
  valores,
  periodo,
  posse,
  pequena,
}: {
  x: number;
  y: number;
  valores: (number | null)[];
  periodo: number;
  posse: number | null;
  pequena: boolean;
}) {
  const presentes = valores.filter((v): v is number => v !== null);
  if (presentes.length < 2) return null;
  const w = pequena ? 66 : 88;
  const h = pequena ? 22 : 30;
  const n = valores.length;
  const min = Math.min(...presentes);
  const max = Math.max(...presentes);
  const X = (i: number) => x - w / 2 + (i / (n - 1)) * w;
  const Y = (v: number) => y + h / 2 - ((v - min) / (max - min || 1)) * h;
  const d = valores
    .map((v, i) =>
      v === null ? "" : `${i === 0 || valores[i - 1] === null ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`,
    )
    .join("");
  const vp = valores[periodo];
  return (
    <g>
      {!pequena && (
        <rect
          x={x - w / 2 - 6}
          y={y - h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={8}
          fill="var(--superficie)"
          fillOpacity={0.9}
        />
      )}
      {posse !== null && posse > 0 && (
        <line
          x1={X(posse)}
          x2={X(posse)}
          y1={y - h / 2 - 2}
          y2={y + h / 2 + 2}
          stroke="var(--tinta-3)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      )}
      <path d={d} fill="none" stroke="var(--tinta)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {vp !== null && vp !== undefined && (
        <circle cx={X(periodo)} cy={Y(vp)} r={5} fill="var(--serie)" stroke="var(--superficie)" strokeWidth={2} />
      )}
    </g>
  );
}

function Rotulo({ x, y, texto, pequena }: { x: number; y: number; texto: string; pequena: boolean }) {
  return (
    <text
      // Na etiqueta do litoral, o texto começa depois da sigla em vez de
      // centrar no espaço que sobra, que não cabe "R$ 102 bi".
      x={pequena ? x - 38 : x}
      y={y}
      textAnchor={pequena ? "start" : "middle"}
      dominantBaseline="central"
      fill="var(--tinta)"
      stroke="var(--plano)"
      strokeWidth={5}
      paintOrder="stroke"
      className="tabular"
      style={{ fontSize: pequena ? 18 : 20, fontWeight: 600 }}
    >
      {texto}
    </text>
  );
}

/** Círculos com área proporcional ao total: São Paulo é o maior. */
function Bolhas({ ufs, tamanho, escala }: { ufs: UF[]; tamanho: NonNullable<Leitura["tamanho"]>; escala: number }) {
  const itens = ufs
    .map((u) => ({ u, v: tamanho.ufs[u.codigo] ?? 0 }))
    .filter((i) => i.v > 0)
    .sort((a, b) => b.v - a.v);
  const max = itens[0]?.v ?? 1;
  return (
    <>
      {itens.map(({ u, v }) => (
        <circle
          key={u.sigla}
          cx={u.centro[0]}
          cy={u.centro[1]}
          r={Math.max(5, 95 * Math.sqrt(v / max)) * escala}
          fill="var(--tinta)"
          fillOpacity={0.12}
          stroke="var(--tinta)"
          strokeOpacity={0.6}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Quem governa
// ---------------------------------------------------------------------------

/** O quadradinho da cor do partido; vai sempre ao lado da sigla escrita. */
function Chip({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-3 shrink-0 rounded-sm"
      style={{ background: cor, boxShadow: "inset 0 0 0 1px var(--borda)" }}
    />
  );
}

/** A etiqueta do partido, igual à do mapa: a cor dele com a sigla dentro. */
export function Pilula({ governos, sigla }: { governos: Governos; sigla: string | null }) {
  const vazada = semCorDePartido(sigla);
  return (
    <span
      className="pilula"
      data-vazada={vazada || undefined}
      title={nomePartido(governos, sigla)}
      style={vazada ? undefined : { background: corDoPartido(governos, sigla), color: tintaDoPartido(governos, sigla) }}
    >
      {rotuloPartido(governos, sigla, true)}
    </span>
  );
}

/** Logo sem moldura, sempre acompanhada pela sigla legível. */
export function IdentidadePartido({ governos, sigla }: { governos: Governos; sigla: string | null }) {
  const logo = logoDoPartido(sigla);
  if (!logo) return <Pilula governos={governos} sigla={sigla} />;
  return (
    <span className="inline-flex shrink-0 items-center gap-1" title={nomePartido(governos, sigla)}>
      <Image
        src={logo}
        alt=""
        aria-hidden
        width={24}
        height={20}
        unoptimized
        data-logo-partido={sigla}
        className="h-5 w-6 p-0.5 object-contain"
      />
      <span className="text-[10px] font-semibold" style={{ color: "var(--tinta)" }}>{rotuloPartido(governos, sigla, true)}</span>
    </span>
  );
}

/**
 * O que o balão do mapa acrescenta: quem governava o estado no período e, em
 * "desde a posse", a troca de partido no caminho, que explica por que a
 * pílula do mapa pode não ser a do governador de hoje.
 */
function QuemGovernava({
  governos,
  uf,
  trecho,
  trocas,
}: {
  governos: Governos;
  uf: UF;
  trecho: TrechoGoverno | null;
  trocas: string | null;
}) {
  if (!trecho) {
    return <p className="mt-1" style={{ color: "var(--tinta-3)" }}>Governo não identificado neste período.</p>;
  }
  return (
    <p className="mt-1.5 border-t pt-1.5" style={{ borderColor: "var(--borda)" }}>
      <span className="flex items-center gap-1.5">
        <Pilula governos={governos} sigla={trecho.partido} />
        <span className="font-medium">{trecho.nome}</span>
      </span>
      <span className="block" style={{ color: "var(--tinta-2)" }}>
        {rotuloPartido(governos, trecho.partido)} · no cargo desde {mesAno(inicioNoCargo(governos, uf.sigla, trecho))}
      </span>
      {trocas && (
        <span className="mt-0.5 block" style={{ color: "var(--tinta-3)" }}>
          Desde a posse: {trocas}
        </span>
      )}
    </p>
  );
}

/**
 * Os modos do mapa, no topo da legenda: texto com um traço sob o escolhido.
 * A cápsula de vidro fica para as abas do topo, que são navegação.
 */
function ModosDoMapa({ modos, ativo, aoEscolher }: { modos: Modo[]; ativo: Modo; aoEscolher: (m: Modo) => void }) {
  return (
    <div className="modos-mapa" role="radiogroup" aria-label="O que desenhar sobre os estados">
      {modos.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={m === ativo} data-opcao={m} onClick={() => aoEscolher(m)}>
          {ROTULO_MODO[m]}
        </button>
      ))}
    </div>
  );
}

/**
 * Acende com o ponteiro do mouse por cima; no toque e no teclado, o clique
 * liga e desliga (no toque o "por cima" dura só o tempo do dedo na tela).
 */
function useAcender(aceso: boolean, acender: () => void, apagar: () => void) {
  const tipo = useRef<string | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      tipo.current = e.pointerType;
    },
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") acender();
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") apagar();
    },
    onClick: () => {
      if (tipo.current !== "mouse") (aceso ? apagar : acender)();
      tipo.current = null;
    },
    onBlur: () => {
      if (aceso) apagar();
    },
  };
}

/**
 * O governo federal na legenda: o presidente do período e o partido dele. Por
 * cima, acende no mapa os estados governados pelo mesmo partido.
 */
function LinhaPresidente({
  governos,
  presidente,
  estados,
  aceso,
  setRealce,
}: {
  governos: Governos;
  presidente: TrechoPresidente;
  estados: UF[];
  aceso: boolean;
  setRealce: (r: Realce | null) => void;
}) {
  const n = estados.length;
  const eventos = useAcender(
    aceso,
    () => n > 0 && setRealce({ chave: "presidente", ufs: new Set(estados.map((u) => u.sigla)) }),
    () => setRealce(null),
  );
  return (
    <button
      type="button"
      className="mt-1.5 flex w-full flex-wrap items-center gap-x-1.5 border-t pt-1.5 text-left text-[11px]"
      style={{ borderColor: "var(--borda)", color: "var(--tinta-2)" }}
      aria-pressed={aceso}
      data-presidente
      {...eventos}
    >
      <span>
        Presidente <strong style={{ color: "var(--tinta)" }}>{presidente.curto}</strong>
      </span>
      <Pilula governos={governos} sigla={presidente.partido} />
      <span style={{ color: "var(--tinta-3)" }}>
        {semCorDePartido(presidente.partido)
          ? ""
          : `· ${n === 0 ? "nenhum governador" : `${n} ${n === 1 ? "governador" : "governadores"}`} do ${rotuloPartido(governos, presidente.partido)}`}
      </span>
    </button>
  );
}

type Ponto = { u: UF; v: number; sigla: string | null; trocas: string | null };
type LinhaDoPartido = { chave: string; sigla: string | null; ps: Ponto[]; med: number };

/** Barra horizontal da base `x0` até `x1`, com a ponta do dado arredondada. */
function barra(x0: number, x1: number, y: number, h: number): string {
  const w = Math.abs(x1 - x0);
  if (w < 1) return `M${x0 - 1},${y - h / 2}h2v${h}h-2Z`;
  const r = Math.min(3, w);
  const s = x1 > x0 ? 1 : -1;
  return `M${x0},${y - h / 2}H${x1 - s * r}Q${x1},${y - h / 2} ${x1},${y - h / 2 + r}V${y + h / 2 - r}Q${x1},${y + h / 2} ${x1 - s * r},${y + h / 2}H${x0}Z`;
}

const FONTE_SIGLA = 9.5;
/** As siglas dos estados de um partido; com mais de quatro, só a conta. */
const siglasDoPartido = (ln: LinhaDoPartido) =>
  ln.ps.length > 4 ? `${ln.ps.length} estados` : ln.ps.map((pt) => pt.u.sigla).join(" ");

/**
 * Primeiro os partidos com dois estados ou mais (0), do melhor para o pior no
 * sentido da medida; depois os de um estado só (1); sem partido (2) e não
 * confirmado (3) por último.
 */
const classePartido = (ln: LinhaDoPartido) => (ln.sigla === null ? 3 : ln.sigla === "SEM" ? 2 : ln.ps.length < 2 ? 1 : 0);

/**
 * Os estados agrupados pelo partido de quem governa, com a mediana de cada
 * grupo: o valor no período ou, com `r`, o que mudou desde o recebido. É o
 * mesmo agrupamento para a barra por partido e para a manchete.
 */
function agruparPorPartido(
  l: Leitura,
  r: number | null,
  periodo: number,
  ufs: UF[],
  partidoUf: Map<string, { partido: string | null; trocas: string | null }>,
): LinhaDoPartido[] {
  const pontos: Ponto[] = ufs.flatMap((u) => {
    const v = r !== null ? desdeAPosse(l, l.ufs[u.codigo], periodo) : l.ufs[u.codigo]?.[periodo] ?? null;
    if (v === null) return [];
    const quem = partidoUf.get(u.sigla);
    return [{ u, v, sigla: quem?.partido ?? null, trocas: quem?.trocas ?? null }];
  });
  if (pontos.length < 3) return [];

  const grupos = new Map<string, Ponto[]>();
  for (const pt of pontos) grupos.set(chavePartido(pt.sigla), [...(grupos.get(chavePartido(pt.sigla)) ?? []), pt]);
  const mediana = (vs: number[]) => {
    const o = [...vs].sort((a, b) => a - b);
    const m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  };
  const melhorPrimeiro = (a: number, b: number) => (l.direcao === "menor_melhor" ? a - b : b - a);
  return [...grupos.entries()]
    .map(([chave, ps]) => ({ chave, sigla: ps[0].sigla, ps: [...ps].sort((a, b) => melhorPrimeiro(a.v, b.v)), med: mediana(ps.map((x) => x.v)) }))
    .sort((a, b) => classePartido(a) - classePartido(b) || melhorPrimeiro(a.med, b.med));
}

/**
 * A medida por partido de quem governa: uma barra por partido, do tamanho da
 * mediana dos estados dele, com as siglas desses estados ao lado. Em "desde a
 * posse" a barra é o que mudou, e cada estado conta para o partido que o
 * governou a maior parte desse tempo, o mesmo da pílula no mapa (a troca no
 * meio fica no balão). Em cima, o melhor e o pior partido com dois estados ou mais. Mostra
 * sob qual partido a medida andou melhor; não diz por quê. Por cima de um
 * partido, os estados dele acendem no mapa.
 */
function PorPartido({
  l,
  desdePosse,
  periodo,
  ufs,
  governos,
  partidoUf,
  realce,
  setRealce,
  aoSelecionarUf,
}: {
  l: Leitura;
  /** O que mudou desde a posse; falso no próprio período de referência, em que tudo é zero. */
  desdePosse: boolean;
  periodo: number;
  ufs: UF[];
  governos: Governos;
  /** O partido de cada estado, o mesmo da pílula no mapa. */
  partidoUf: Map<string, { partido: string | null; trocas: string | null }>;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
  aoSelecionarUf: (sigla: string) => void;
}) {
  const r = desdePosse ? l.indiceRecebido : null;
  const texto = (v: number) => (r !== null ? textoMudanca(l, v) : formatar(v, l.formato));

  const linhas = agruparPorPartido(l, r, periodo, ufs, partidoUf);
  if (linhas.length === 0) return null;
  const classe = classePartido;

  const comparaveis = linhas.filter((ln) => classe(ln) === 0);
  const resto = linhas.filter((ln) => classe(ln) > 0);
  const avalia = l.direcao !== undefined && l.direcao !== "neutro";
  const quando = r !== null ? `desde ${l.periodos[r].rotulo}` : `em ${l.periodos[periodo].rotulo}`;
  const brasil = r !== null ? desdeAPosse(l, l.brasil, periodo) : l.brasil[periodo] ?? null;

  // Colunas: logo e sigla do partido, siglas dos estados, barra e número. As duas
  // primeiras se ajustam ao texto mais longo, para sobrar barra.
  const W = 300;
  const PILULA = Math.max(36, ...linhas.map((ln) => larguraTexto(rotuloPartido(governos, ln.sigla, true), 10) + 12 + (logoDoPartido(ln.sigla) ? 24 : 0)));
  const SIGLAS = PILULA + 6;
  const ESQ = SIGLAS + Math.max(...linhas.map((ln) => larguraTexto(siglasDoPartido(ln), FONTE_SIGLA))) + 10;
  const DIR = Math.max(...linhas.map((ln) => larguraTexto(texto(ln.med), 10.5))) + 8;
  const TOPO = 16;
  const LINHA = 22;
  const SEPARACAO = 8;
  // A barra parte do zero: em "desde a posse", o que caiu vai para a esquerda.
  const vs = [0, ...linhas.map((ln) => ln.med), ...(brasil !== null ? [brasil] : [])];
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const x = (v: number) => ESQ + ((v - min) / (max - min || 1)) * (W - ESQ - DIR);

  // Os grupos fora dos destaques ficam separados só por espaço.
  let y = TOPO;
  const meios = linhas.map((ln, i) => {
    if (i > 0 && classe(ln) > 0 && classe(linhas[i - 1]) === 0) y += SEPARACAO;
    const meio = y + LINHA / 2;
    y += LINHA;
    return meio;
  });
  const H = y + 4;
  const xBrasil = brasil === null ? 0 : Math.min(W - DIR - 24, Math.max(ESQ + 24, x(brasil)));

  return (
    <figure className="mt-2" data-por-partido={r !== null ? "mudanca" : "valor"}>
      <figcaption className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
        <span className="font-medium" style={{ color: "var(--tinta-2)" }}>
          Por partido
        </span>{" "}
        · mediana {quando}
      </figcaption>
      {comparaveis.length >= 2 && (
        <div className="mt-1.5 grid grid-cols-2 gap-1.5" data-pontas-partido>
          <CartaoPartido rotulo={avalia ? "Melhor" : "Maior"} ln={comparaveis[0]} governos={governos} texto={texto} realce={realce} setRealce={setRealce} />
          <CartaoPartido rotulo={avalia ? "Pior" : "Menor"} ln={comparaveis.at(-1)!} governos={governos} texto={texto} realce={realce} setRealce={setRealce} />
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block w-full"
        role="group"
        aria-label={`${l.titulo} ${quando}: mediana dos estados de cada partido de quem governa`}
      >
        <g aria-hidden>
          <line x1={x(0)} x2={x(0)} y1={TOPO - 2} y2={H - 2} stroke="var(--tinta-3)" strokeOpacity={0.7} />
          {brasil !== null && (
            <>
              <line x1={x(brasil)} x2={x(brasil)} y1={TOPO - 2} y2={H - 2} stroke="var(--tinta-2)" strokeDasharray="2 3" />
              <text x={xBrasil} y={TOPO - 6} textAnchor="middle" className="tabular" fill="var(--tinta-3)" style={{ fontSize: 9.5 }}>
                Brasil {texto(brasil)}
              </text>
            </>
          )}
          {comparaveis.length > 0 && resto.length > 0 && (
            <line x1={0} x2={W} y1={meios[comparaveis.length] - LINHA / 2 - SEPARACAO / 2} y2={meios[comparaveis.length] - LINHA / 2 - SEPARACAO / 2} stroke="var(--borda)" />
          )}
        </g>
        {linhas.map((ln, i) => (
          <LinhaPartido
            key={ln.chave}
            ln={ln}
            y={meios[i]}
            base={x(0)}
            fim={x(ln.med)}
            largura={W}
            pilula={PILULA}
            siglas={SIGLAS}
            altura={LINHA}
            governos={governos}
            texto={texto}
            realce={realce}
            setRealce={setRealce}
            aoSelecionarUf={aoSelecionarUf}
          />
        ))}
      </svg>
      <details className="mt-1 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        <summary className="w-fit cursor-pointer py-1 hover:underline">Critérios</summary>
        <p className="mt-1">
          Mediana das UFs por partido do governador. Os destaques consideram partidos com pelo menos duas UFs.
          {r !== null && " Desde a posse, vale o partido que governou por mais tempo."}
          {" "}Comparação descritiva, sem atribuição de causa.
        </p>
      </details>
    </figure>
  );
}

/** Acende os estados de um partido no mapa enquanto o ponteiro está nele. */
function useAcenderPartido(ln: LinhaDoPartido, realce: Realce | null, setRealce: (r: Realce | null) => void) {
  const chave = `partido:${ln.chave}`;
  const aceso = realce?.chave === chave;
  const eventos = useAcender(
    aceso,
    () => setRealce({ chave, ufs: new Set(ln.ps.map((pt) => pt.u.sigla)) }),
    () => setRealce(null),
  );
  return { aceso, eventos };
}

/** O melhor (ou o pior) partido, em cima das barras: a resposta num olhar. */
function CartaoPartido({
  rotulo,
  ln,
  governos,
  texto,
  realce,
  setRealce,
}: {
  rotulo: string;
  ln: LinhaDoPartido;
  governos: Governos;
  texto: (v: number) => string;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
}) {
  const { aceso, eventos } = useAcenderPartido(ln, realce, setRealce);
  const cor = corDoPartido(governos, ln.sigla);
  return (
    <button
      type="button"
      aria-pressed={aceso}
      className="flex min-w-0 flex-col items-start rounded-xl px-2.5 py-1.5 text-left transition-shadow"
      style={{
        background: `color-mix(in srgb, ${cor} 13%, transparent)`,
        boxShadow: `inset 0 0 0 ${aceso ? 1.5 : 1}px ${aceso ? cor : "var(--borda)"}`,
      }}
      data-ponta-partido={rotulo}
      {...eventos}
    >
      <span className="mono text-[9.5px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--tinta-3)" }}>
        {rotulo}
      </span>
      <span className="mt-1 flex items-center gap-1.5">
        <IdentidadePartido governos={governos} sigla={ln.sigla} />
        <span className="tabular text-sm font-semibold">{texto(ln.med)}</span>
      </span>
      <span className="mt-0.5 truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        {ln.ps.map((pt) => pt.u.sigla).join(" · ")}
      </span>
    </button>
  );
}

function LinhaPartido({
  ln,
  y,
  base,
  fim,
  largura,
  pilula,
  siglas,
  altura,
  governos,
  texto,
  realce,
  setRealce,
  aoSelecionarUf,
}: {
  ln: LinhaDoPartido;
  y: number;
  base: number;
  fim: number;
  largura: number;
  pilula: number;
  siglas: number;
  altura: number;
  governos: Governos;
  texto: (v: number) => string;
  realce: Realce | null;
  setRealce: (r: Realce | null) => void;
  aoSelecionarUf: (sigla: string) => void;
}) {
  const { aceso, eventos } = useAcenderPartido(ln, realce, setRealce);
  const cor = corDoPartido(governos, ln.sigla);
  const vazada = semCorDePartido(ln.sigla);
  const logo = logoDoPartido(ln.sigla);
  const n = ln.ps.length;
  const estados = ln.ps.map((pt) => `${pt.u.sigla} ${texto(pt.v)}${pt.trocas ? ` (${pt.trocas})` : ""}`).join(" · ");
  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={aceso}
      aria-label={`${rotuloPartido(governos, ln.sigla)}: ${n} ${n === 1 ? "estado" : "estados"}, mediana ${texto(ln.med)}`}
      className="cursor-pointer outline-none"
      style={{ opacity: realce && !aceso ? 0.4 : 1, transition: "opacity 200ms ease-out" }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          eventos.onClick();
        }
      }}
      data-linha-partido={ln.chave}
      {...eventos}
    >
      <title>{`${nomePartido(governos, ln.sigla)}: ${estados}`}</title>
      <rect x={0} y={y - altura / 2} width={largura} height={altura} fill="transparent" />
      {logo ? (
        <>
          <image href={logo} x={2} y={y - 8} width={20} height={16} preserveAspectRatio="xMidYMid meet" aria-hidden pointerEvents="none" data-logo-partido={ln.sigla} />
          <text x={28} y={y + 0.5} dominantBaseline="central" fill="var(--tinta)" style={{ fontSize: 10, fontWeight: 650 }}>
            {rotuloPartido(governos, ln.sigla, true)}
          </text>
        </>
      ) : (
        <>
          <rect
            x={0.5}
            y={y - 8}
            width={pilula - 1}
            height={16}
            rx={8}
            fill={vazada ? "transparent" : cor}
            stroke={vazada ? "var(--tinta-3)" : "none"}
            strokeDasharray={ln.sigla === null ? "2 2" : undefined}
          />
          <text x={pilula / 2} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fill={tintaDoPartido(governos, ln.sigla)} style={{ fontSize: 10, fontWeight: 650 }}>
            {rotuloPartido(governos, ln.sigla, true)}
          </text>
        </>
      )}
      {/* As siglas dos estados; com mais de quatro, só a conta. Tocar numa abre o estado. */}
      <text x={siglas} y={y} dominantBaseline="central" fill="var(--tinta-2)" style={{ fontSize: FONTE_SIGLA, fontWeight: 500 }}>
        {n > 4
          ? siglasDoPartido(ln)
          : ln.ps.map((pt, i) => (
              <tspan
                key={pt.u.sigla}
                onClick={(e) => {
                  e.stopPropagation();
                  aoSelecionarUf(pt.u.sigla);
                }}
                data-sigla-partido={pt.u.sigla}
              >
                {`${i > 0 ? " " : ""}${pt.u.sigla}`}
              </tspan>
            ))}
      </text>
      <path d={barra(base, fim, y, 10)} fill={vazada ? "var(--partido-sem)" : cor} stroke={vazada ? "var(--tinta-3)" : "none"} strokeWidth={0.75} />
      <text x={largura} y={y} textAnchor="end" dominantBaseline="central" className="tabular" fill="var(--tinta)" style={{ fontSize: 10.5, fontWeight: 600 }}>
        {texto(ln.med)}
      </text>
    </g>
  );
}

/**
 * A série do estado na medida aberta, com quem governava por baixo: faixas
 * neutras, uma por pessoa no cargo, e o nome quando cabe. A cor do partido
 * fica no mapa e na lista; aqui o desenho é do tempo.
 */
function SerieComGovernos({
  governos,
  uf,
  l,
  periodo,
  hoje,
}: {
  governos: Governos;
  uf: UF;
  l: Leitura;
  periodo: number;
  hoje: string;
}) {
  const n = l.periodos.length;
  const dias = l.periodos.map((p) => diaDoPeriodo(p, hoje));
  const serie = l.ufs[uf.codigo] ?? [];
  const vs = [...serie, ...l.brasil].filter((v): v is number => v !== null);
  if (n < 2 || vs.length < 2) return null;

  const W = 300;
  const ESQ = 2;
  const DIR = 2;
  const TOPO = 4;
  const ALTO = 60;
  const FAIXA = 16;
  const H = TOPO + ALTO + 6 + FAIXA;
  const t0 = Date.parse(dias[0]);
  const t1 = Date.parse(dias[n - 1]);
  const xDia = (d: string) => ESQ + Math.min(1, Math.max(0, (Date.parse(d) - t0) / (t1 - t0 || 1))) * (W - ESQ - DIR);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const y = (v: number) => TOPO + ALTO - ((v - min) / (max - min || 1)) * ALTO;
  const caminho = (s: (number | null)[]) =>
    s
      .map((v, i) => (v === null ? "" : `${i === 0 || s[i - 1] === null ? "M" : "L"}${xDia(dias[i]).toFixed(1)},${y(v).toFixed(1)}`))
      .join("");

  // Uma faixa por pessoa no cargo sem interrupção, dentro da janela da série.
  const faixas: { inicio: string; fim: string; nome: string; partidos: string[] }[] = [];
  for (const t of governos.ufs[uf.sigla] ?? []) {
    const fim = t.fim ?? hoje;
    if (fim <= dias[0] || t.inicio > dias[n - 1]) continue;
    const rotulo = rotuloPartido(governos, t.partido);
    const ultima = faixas.at(-1);
    if (ultima && ultima.nome === t.nome && ultima.fim === t.inicio) {
      ultima.fim = fim;
      if (ultima.partidos.at(-1) !== rotulo) ultima.partidos.push(rotulo);
    } else {
      faixas.push({ inicio: t.inicio, fim, nome: t.nome, partidos: [rotulo] });
    }
  }
  const vp = serie[periodo];

  return (
    <figure className="mt-2" data-serie-governos>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label={`${l.titulo} ${uf.emNome} e no Brasil, de ${l.periodos[0].extenso} a ${l.periodos[n - 1].extenso}, com quem governava`}
      >
        {faixas.map((f, i) => {
          const a = Math.max(ESQ, xDia(f.inicio));
          const b = xDia(f.fim);
          return (
            <g key={f.inicio}>
              <title>{`${f.nome} (${f.partidos.join(", depois ")}): ${mesAno(f.inicio)} a ${f.fim >= hoje ? "hoje" : mesAno(f.fim)}`}</title>
              <rect x={a} y={TOPO} width={Math.max(0, b - a)} height={H - TOPO} fill={i % 2 ? "var(--faixa-a)" : "transparent"} />
              {a > ESQ + 1 && <line x1={a} x2={a} y1={TOPO} y2={H} stroke="var(--grade)" strokeOpacity={0.8} />}
              {b - a > f.nome.length * 5 + 6 && (
                <text x={a + 3} y={TOPO + ALTO + 6 + FAIXA / 2} dominantBaseline="central" fill="var(--tinta-2)" style={{ fontSize: 9.5 }}>
                  {f.nome}
                </text>
              )}
            </g>
          );
        })}
        <path d={caminho(l.brasil)} fill="none" stroke="var(--tinta-3)" strokeWidth={1.4} strokeDasharray="3 3" />
        <path d={caminho(serie)} fill="none" stroke="var(--serie)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {vp !== null && vp !== undefined && (
          <circle cx={xDia(dias[periodo])} cy={y(vp)} r={3.5} fill="var(--serie)" stroke="var(--plano)" strokeWidth={1.5} />
        )}
      </svg>
      <figcaption className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[10px]" style={{ color: "var(--tinta-3)" }}>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: "var(--serie)" }} />
          {uf.sigla}
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="w-3 border-t border-dashed" style={{ borderColor: "var(--tinta-3)" }} />
          Brasil
        </span>
        <span className="tabular">
          {l.titulo}: {formatar(min, l.formato)} a {formatar(max, l.formato)}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Quem governou o estado desde 1995: a série com as faixas de governo e a
 * lista de quem esteve no cargo, com partido, como chegou lá e a fonte.
 */
function HistoricoGovernos({
  governos,
  uf,
}: {
  governos: Governos;
  uf: UF;
}) {
  const lista = governos.ufs[uf.sigla] ?? [];
  const previsto = governos.previstos[uf.sigla];
  const recentes = [...lista].reverse();
  const link = (href: string, texto: string) => (
    <a href={href} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--serie)" }}>
      {texto} ↗
    </a>
  );
  return (
    <section className="px-3 pb-1 pt-3" aria-label={`Quem governou ${uf.nome}`} data-historico={uf.sigla}>
      <p className="mono text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--tinta-3)" }}>
        Quem governou {uf.nome} desde 1995
      </p>
      <ol className="mt-3 space-y-2">
        {previsto && (
          <li className="text-[11px] leading-snug" data-previsto>
            <span className="flex items-baseline gap-1.5">
              <Chip cor={corDoPartido(governos, previsto.partido)} />
              <span className="min-w-0 flex-1">
                <span className="font-medium" style={{ color: "var(--tinta)" }}>{previsto.nome}</span> ·{" "}
                {rotuloPartido(governos, previsto.partido)}
              </span>
              <span className="tabular shrink-0" style={{ color: "var(--tinta-3)" }}>
                posse {previsto.posse.split("-").reverse().join("/")}
              </span>
            </span>
            <span className="block pl-[18px]" style={{ color: "var(--tinta-3)" }}>
              {previsto.como === "reeleito" ? "reeleito" : "eleito"} em 2026, ainda não governa · {link(previsto.fonte, "TSE")}
            </span>
          </li>
        )}
        {recentes.map((t, i) => {
          const antes = recentes[i + 1];
          const mesmaPessoa = antes && antes.nome === t.nome && antes.fim === t.inicio;
          // Mesmo mandato, outro partido: o trecho só existe pela troca. Na mesma
          // família é o partido que mudou de nome ou se fundiu (PMDB e MDB).
          const troca = mesmaPessoa && antes.como === t.como && antes.eleicao === t.eleicao;
          const mesmoPartido = troca && familiaDe(governos, antes.partido) === familiaDe(governos, t.partido);
          // A nota de uma troca vale para os dois lados dela; aparece uma vez.
          const nota = t.nota && t.nota !== recentes[i - 1]?.nota ? t.nota : null;
          return (
            <li key={t.inicio} className="text-[11px] leading-snug" data-trecho={t.inicio}>
              <span className="flex items-baseline gap-1.5">
                <Chip cor={corDoPartido(governos, t.partido)} />
                <span className="min-w-0 flex-1">
                  <span className="font-medium" style={{ color: "var(--tinta)" }}>{t.nome}</span> ·{" "}
                  {rotuloPartido(governos, t.partido)}
                </span>
                <span className="tabular shrink-0" style={{ color: "var(--tinta-3)" }}>
                  {mesAno(t.inicio)}–{t.fim ? mesAno(t.fim) : "hoje"}
                </span>
              </span>
              <span className="block pl-[18px]" style={{ color: "var(--tinta-3)" }}>
                {mesmoPartido
                  ? `o partido virou ${rotuloPartido(governos, t.partido)}`
                  : troca
                    ? `mudou de partido${t.aproximado ? " (só o mês é conhecido)" : ""}`
                    : comoEntrou(t)}
                {t.eleitoPor && !troca && (t.como === "eleito" || t.como === "reeleito"
                  ? ` pelo ${rotuloPartido(governos, t.eleitoPor)}`
                  : `, eleito ${t.como === "vice_assumiu" ? "vice " : ""}pelo ${rotuloPartido(governos, t.eleitoPor)}`)}
                {" · "}
                {link(t.fonte, "cargo")}
                {t.fontePartido && t.fontePartido !== t.fonte && (
                  <>
                    {" · "}
                    {link(t.fontePartido, "partido")}
                  </>
                )}
              </span>
              {nota && (
                <span className="line-clamp-3 block pl-[18px]" style={{ color: "var(--tinta-3)" }} title={nota}>
                  {nota}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Partido de quem estava no cargo, que nem sempre é o da eleição. Vem de atos oficiais, listas históricas e
        reportagens com a data da troca; fica “não confirmado” quando a troca não foi localizada.
      </p>
    </section>
  );
}
