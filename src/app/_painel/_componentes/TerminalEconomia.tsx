"use client";
import { opcaoCompartilhada, textoCompartilhado } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import Image from "next/image";
import Link from "next/link";
import { Compartilhar } from "@/components/Compartilhar";
import { usePerfilPainel } from "./ContextoPerfil";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import { COR_BOM, COR_RUIM, corDoVeredito, GraficoTempo } from "@/components/GraficoTempo";
import { Retrato } from "@/components/Retrato";
import { CATEGORIAS, SERIES_UI_POR_ID, type Categoria } from "@/lib/registroSeries";
import { comSinal, numero, rotuloMandato, sentido, type Sentido } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";
import type { Benchmark, Direcao, Indicador } from "@/types/dados";

import { criarCsv, governosNoPeriodo, recortar, variacaoDesdeReferencia } from "../_dados/economiaModelo";
import type { Expectativa } from "../_dados/panoramaModelo";
import { recebidoNaLista, recebidoNoPainel, ritmoDesdeORecebido, type Recebido } from "../_dados/mandatoRecorte";
import type { DadosPainel, Governos, IndicadorMandato, Leitura, MandatoVisual, SerieEconomia, UF } from "../_dados/tipos";
import {
  corDoSentido,
  formatar,
  LADO_BOM,
  mudanca,
  naReferencia,
  recebido,
  referencia,
  reguaDeCor,
  rotuloDataDaSerie,
  tendencia,
  ultimoDado,
  mandatosNaSerie,
  vereditosPorMandato,
  type Regua,
} from "./formatos";
import { fraseDaLeitura, fraseDaSerie, ritmoNaRegua } from "./frases";
import { Faisca } from "./GraficoLinha";
import { PilulaVeredito, placarDoMandato, type ItemPlacar } from "./Placar";
import { Bloco, Opcoes, ROTULO } from "./Bloco";
import { NavTerminal } from "./NavTerminal";
import { Credito, EmpregoFormal, Orcamento } from "./PanoramaEconomia";
import {
  comoEntrou,
  corDoPartido,
  diaDoPeriodo,
  familiaDe,
  governoEm,
  logoDoPartido,
  mesAno,
  nomePartido,
  presidenteEm,
  rotuloPartido,
  semCorDePartido,
} from "./governos";
import { larguraTexto } from "./Mapa";
import { IdentidadePartido, Numero, Pilula } from "./PainelEconomia";

/**
 * A economia em detalhe: tudo o que a sala de cima resume, aberto de uma vez,
 * como um terminal.
 *
 * Continua a sala, não começa outra página: os mesmos halos da bandeira
 * atrás (fixos em `Painel`), e os painéis são o mesmo vidro da barra da
 * direita. A densidade é de terminal (cotações, gráfico, grades), mas
 * cada número diz de onde vem e a cor nunca anda sem texto.
 *
 * As peças conversam: a cotação escolhida vai para o gráfico e acende a linha
 * dela na grade; passar o ponteiro num governo da grade destaca o mandato no
 * gráfico; tocar num estado sobe para a sala com ele aberto.
 *
 * Com um estado escolhido na sala, o que existe por UF passa a ser dele: as
 * cotações, o gráfico (contra o Brasil e as outras 26, com os governadores
 * nas faixas) e o ritmo no mandato, que passa a comparar com o Brasil. O que
 * só existe para o país continua nacional e diz isso. Nos painéis que já são
 * de estados, ele fica marcado em ouro entre os outros.
 *
 * - Brasil agora: o resumo do que está embaixo. Cada série com o número de
 *   hoje, o que o governo recebeu na posse e a cor do mandato, a mesma do
 *   placar e do gráfico. Tocar põe a série no gráfico.
 * - Histórico: a série escolhida, no mandato ou desde o começo, com mínimo,
 *   máximo, média e o que o mercado espera. Cada governo numa cor só, contra
 *   o que recebeu. A bolsa é uma dessas séries.
 * - Este governo: o ritmo por ano, do que recebeu ao último dado, contra os 24 meses antes.
 * - Governo a governo: o ritmo de cada mandato desde 1995, com a posição
 *   entre os que têm o dado, e o Brasil contra o mundo (World Bank).
 * - Estados: as medidas por UF lado a lado, ordenáveis, com o partido de quem
 *   governa e a evolução da medida escolhida.
 * - Últimos dados, o mundo hoje e as fontes, com CSV.
 *
 * O meio ambiente (`TerminalAmbiente`) usa as mesmas peças, exportadas daqui:
 * `Cotacoes`, `Historico`, `Estados` e `Fontes`.
 */

/** Dois anos antes da posse, como as séries da sala. */

/** O período do gráfico: o mandato em curso ou a série inteira. */
type Faixa = "mandato" | "tudo";

const dia = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function baixar(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Quem estava na Presidência durante o período a que o dado se refere. */
function naPresidencia(s: SerieEconomia, data: string, mandatos: MandatoVisual[]): string {
  return governosNoPeriodo(data, s.mesesReferencia, mandatos)
    .map((p) => rotuloMandato(mandatos, p))
    .join(" e ");
}

function csvSerie(s: SerieEconomia, datas: string[], valores: (number | null)[], mandatos: MandatoVisual[]) {
  return criarCsv(
    ["referencia", "indicador", "valor", "unidade", "na_presidencia", "fonte", "entrou_no_banco"],
    datas.map((d, i) => [d, s.rotulo, valores[i], s.unidade, naPresidencia(s, d, mandatos), s.fonteUrl, s.coletadoEm]),
  );
}

/** Uma medida do mapa em CSV: todos os períodos, do Brasil, das regiões e das UFs. */
function csvLeitura(l: Leitura, dados: DadosPainel) {
  const territorios = [
    { nivel: "pais", codigo: "1", nome: "Brasil", valores: l.brasil },
    ...dados.regioes.map((r) => ({ nivel: "regiao", codigo: r.codigo, nome: r.nome, valores: l.regioes[r.codigo] ?? [] })),
    ...dados.ufs.map((u) => ({ nivel: "uf", codigo: u.codigo, nome: u.nome, valores: l.ufs[u.codigo] ?? [] })),
  ];
  return criarCsv(
    ["periodo", "nivel", "codigo_ibge", "territorio", "medida", "valor", "fonte", "entrou_no_banco"],
    l.periodos.flatMap((p, i) =>
      territorios.map((t) => [p.codigo, t.nivel, t.codigo, t.nome, l.titulo, t.valores[i] ?? null, l.fonteUrl ?? l.fonte, l.coletadoEm ?? null]),
    ),
  );
}

/** O nível de um indicador com a unidade dele: "R$ 1.540", "US$ 7.622", "13,6%". */
function nivelDe(v: number, unidade: string, simbolo?: string): string {
  if (simbolo === "R$") return `R$ ${numero(v, v >= 100 ? 0 : 2)}`;
  if (unidade.startsWith("US$")) return `US$ ${numero(v, 0)}`;
  if (unidade.includes("%")) return `${numero(v, 1)}%`;
  return numero(v, 1);
}

/** "+3,2% ao ano", "−0,9 pontos por ano": o % cola no número. */
const comUnidade = (v: number, unidade: string) => `${comSinal(v, 1)}${unidade.startsWith("%") ? "" : " "}${unidade}`;

interface Props {
  dados: DadosPainel;
  /** O governo atual inteiro, para o que compara todos os governos. */
  atual: DadosPainel;
  /** A série nacional no gráfico, escolhida aqui ou na barra da sala. */
  foco: string | undefined;
  setFoco: (id: string) => void;
  /** O estado escolhido na sala: os painéis que têm o dado por UF passam a ser dele. */
  sigla: string | null;
  /** A medida por estado no gráfico; `null` deixa o gráfico na série nacional. */
  leituraFoco: string | null;
  setLeituraFoco: (id: string | null) => void;
  aoSelecionarUf: (sigla: string) => void;
}

export function TerminalEconomia({ dados, atual, foco, setFoco, sigla, leituraFoco, setLeituraFoco, aoSelecionarUf }: Props) {
  const series = dados.economia.series.filter((s) => ultimoDado(s));
  const s = series.find((x) => x.id === foco) ?? series[0];
  const { mandatos } = dados.economia;
  // O governo sob o ponteiro na grade; o gráfico destaca o mandato dele. Tocar
  // no rosto fixa o destaque até tocar de novo.
  const [mandatoSob, setMandatoFoco] = useState<string | null>(null);
  const [mandatoFixo, setMandatoFixo] = useEstadoCompartilhavel<string | null>("comparar", null, v=>v===null||mandatos.some(m=>m.id===v));
  const mandatoFoco = mandatoSob ?? mandatoFixo;
  const [faixa, setFaixa] = useEstadoCompartilhavel<Faixa>("faixa", "mandato", opcaoCompartilhada(["mandato","tudo"]));
  // A família de partido acesa no painel dos governadores; a tabela apaga os outros.
  const [partidoFoco, setPartidoFoco] = useEstadoCompartilhavel<string | null>("partido", null, v=>v===null||textoCompartilhado(v));
  const origens = useMemo(() => new Set(dados.economia.series.filter((x) => ultimoDado(x)).map((x) => x.origem)), [dados.economia.series]);
  // O placar é a fonte das cores: o "Brasil agora", o gráfico e o ritmo
  // pintam o mandato em curso com o veredito dele, e nunca discordam.
  const placar = useMemo(() => {
    const itens = (({ grupos, mercado }) => [...grupos.flatMap((g) => g.itens), ...mercado])(placarDoMandato(dados));
    return {
      vereditos: new Map(itens.map((x) => [x.id, x.sentido] as const)),
      porId: new Map(itens.map((x) => [x.id, x] as const)),
      porSerie: new Map(itens.flatMap((x) => (x.serie ? [[x.serie.id, x] as const] : []))),
    };
  }, [dados]);
  const vereditos = placar.vereditos;
  // A grade compara todos os governos: fica inteira, e o mandato em curso nela é o de verdade.
  const placarDaGrade = useMemo(() => {
    if (dados.foco.emCurso) return placar.porId;
    const { grupos, mercado } = placarDoMandato(atual);
    return new Map([...grupos.flatMap((g) => g.itens), ...mercado].map((x) => [x.id, x] as const));
  }, [dados.foco.emCurso, atual, placar.porId]);

  if (!s) return null;
  const hoje = dados.hoje.slice(0, 10);
  const leituras = dados.leituras.economia;
  const uf = sigla ? (dados.ufs.find((u) => u.sigla === sigla) ?? null) : null;
  const lEstado = uf ? (leituras.find((l) => l.id === leituraFoco) ?? null) : null;
  const serieDaOrigem = (origem: string) => series.find((x) => x.origem === origem);
  const fraseDe = (x: SerieEconomia) =>
    fraseDaSerie(x, {
      governo: mandatos.find((m) => m.id === dados.foco.id)?.nomeCurto,
      mudancaNoPlacar: placar.porSerie.get(x.id)?.mudanca,
      completa: atual.economia.series.find((c) => c.id === x.id),
      mandatos: atual.economia.mandatos,
      foco: dados.foco.id,
    });
  // Escolher uma série nacional tira o gráfico da medida do estado.
  const escolherSerie = (id: string) => {
    setFoco(id);
    setLeituraFoco(null);
  };
  const escolherNaGrade = (origem: string) => {
    const x = serieDaOrigem(origem);
    if (x) escolherSerie(x.id);
  };
  const ritmos = uf
    ? ritmosDoEstado(leituras, uf, lEstado?.id ?? null, setLeituraFoco)
    : ritmosDoPais(dados.economia.indicadores, series, (id) => recebidoNoPainel(dados, id), vereditos, s.origem, escolherNaGrade, (id) => Boolean(serieDaOrigem(id)));
  // Destacar um governo fora do trecho do gráfico abre a série inteira.
  const fixarMandato = (id: string) => {
    const m = mandatos.find((x) => x.id === id);
    setMandatoFixo(mandatoFixo === id ? null : id);
    if (m && !m.emCurso && mandatoFixo !== id) setFaixa("tudo");
  };

  return (
    <section className="terminal-tema relative -mx-3" aria-label="A economia em detalhe">
      <NavTerminal />
      <div className="relative mx-auto grid max-w-[1680px] grid-cols-12 gap-3 px-3 pb-8 pt-6 lg:px-5">
        {uf ? (
          <CotacoesEstado
            className="col-span-12"
            encerrado={!dados.foco.emCurso}
            uf={uf}
            ufs={dados.ufs}
            leituras={leituras}
            series={series}
            hoje={hoje}
            ativa={lEstado?.id ?? null}
            serieAtiva={lEstado ? null : s.id}
            aoEscolherLeitura={setLeituraFoco}
            aoEscolherSerie={escolherSerie}
          />
        ) : (
          <Cotacoes className="col-span-12" series={series} doPlacar={placar.porSerie} ativa={s.id} aoEscolher={escolherSerie} encerrado={!dados.foco.emCurso} fraseDe={fraseDe} />
        )}

        {uf && lEstado ? (
          <HistoricoEstado id="de-perto" className="col-span-12 xl:col-span-8" l={lEstado} uf={uf} dados={dados} aoSelecionarUf={aoSelecionarUf} />
        ) : (
          <Historico
            id="de-perto"
            className="col-span-12 xl:col-span-8"
            s={s}
            mandatos={mandatos}
            mandatoFoco={mandatoFoco}
            faixa={faixa}
            setFaixa={setFaixa}
            item={placar.porSerie.get(s.id)}
            expectativas={dados.economia.complemento.expectativas}
            hoje={hoje}
            frase={fraseDe(s)}
          />
        )}
        <div className="col-span-12 flex min-w-0 flex-col gap-3 xl:col-span-4">
          <EsteGoverno
            className="flex-1"
            ritmos={ritmos}
            detalhe={uf ? `${uf.nome} · média por ano` : "média por ano"}
            referencia={uf ? "Brasil, na mesma medida" : "24 meses antes da posse"}
            colunaReferencia={uf ? "Brasil" : "antes"}
          />
          {uf && <QuemGovernou className="flex-1" governos={dados.governos} uf={uf} hoje={hoje} />}
        </div>

        <GovernoAGoverno
          className="col-span-12"
          mandatos={atual.economia.mandatos}
          governos={dados.governos}
          porMandato={dados.economia.porMandato}
          benchmark={dados.economia.benchmarkPorMandato}
          ativa={s.origem}
          aoEscolher={escolherNaGrade}
          origens={origens}
          series={atual.economia.series.filter((x) => ultimoDado(x))}
          doPlacar={placarDaGrade}
          mandatoFixo={mandatoFixo ?? (dados.foco.emCurso ? null : dados.foco.id)}
          setMandatoFoco={setMandatoFoco}
          aoFixarMandato={fixarMandato}
          uf={uf}
        />

        <Estados className="col-span-12 xl:col-span-8" dados={dados} aoSelecionarUf={aoSelecionarUf} partidoFoco={partidoFoco} sigla={sigla} />
        {/* Ao lado dos estados, só o que tem a ver com eles e com o mundo:
            com três painéis a coluna passava da tabela e deixava um vão. */}
        <div className="col-span-12 flex min-w-0 flex-col gap-3 xl:col-span-4">
          <Governadores dados={dados} foco={partidoFoco} setFoco={setPartidoFoco} sigla={sigla} />
          <MundoHoje inicio={Number(dados.foco.posse.slice(0, 4))} className="flex-1" benchmark={dados.economia.benchmark} />
        </div>

        {/* Emprego, crédito e orçamento numa fileira só, do mesmo tamanho. */}
        <EmpregoFormal id="emprego-e-credito" className="col-span-12 md:col-span-6 xl:col-span-4" dados={dados} />
        <Credito className="col-span-12 md:col-span-6 xl:col-span-4" dados={dados} />
        <Orcamento className="col-span-12 xl:col-span-4" dados={dados} />

        {/* O que entrou de novo fica ao lado de onde cada dado vem. */}
        <Fontes className="col-span-12 xl:col-span-8" dados={dados} series={series} />
        {dados.foco.emCurso && <UltimosDados className="col-span-12 xl:col-span-4" dados={dados} series={series} aoEscolher={escolherSerie} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Brasil agora
// ---------------------------------------------------------------------------

/**
 * O resumo do que está embaixo: uma série por quadro, cada um o gráfico do
 * mandato em miniatura. O número de hoje, a mudança desde a posse numa pílula
 * com a cor do placar e, ao lado, o que o governo recebeu, para "4,6%" e
 * "−1,2 pts" não ficarem soltos. Medidas que já são em 12 meses (inflação,
 * PIB, renda) dizem isso no nome; a comparação é sempre com a posse.
 */
export function Cotacoes({
  series,
  doPlacar,
  ativa,
  aoEscolher,
  className,
  detalhe = "o último dado contra o que o governo recebeu na posse · toque para ver o gráfico",
  encerrado = false,
  fraseDe,
}: {
  series: SerieEconomia[];
  doPlacar: Map<string, ItemPlacar>;
  ativa: string;
  aoEscolher: (id: string) => void;
  className: string;
  detalhe?: string;
  /** Um governo que já acabou: o painel fala do fim dele, não de agora. */
  encerrado?: boolean;
  /** A frase que acompanha o recorte de cada série. */
  fraseDe?: (s: SerieEconomia) => string;
}) {
  return (
    <Bloco id="agora" titulo={encerrado ? "Brasil no fim do mandato" : "Brasil agora"} detalhe={detalhe} className={className}>
      <div role="radiogroup" aria-label="Série no gráfico" className="-mx-1 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-10">
        {series.map((x) => (
          <Cotacao key={x.id} s={x} item={doPlacar.get(x.id)} ativa={x.id === ativa} aoEscolher={() => aoEscolher(x.id)} frase={fraseDe?.(x)} />
        ))}
      </div>
    </Bloco>
  );
}

function Cotacao({ s, item, ativa, aoEscolher, frase }: { s: SerieEconomia; item: ItemPlacar | undefined; ativa: boolean; aoEscolher: () => void; frase?: string }) {
  const agora = ultimoDado(s)!;
  const antes = recebido(s);
  // Sem item no placar, a mesma conta dele; PIB e renda vêm do placar, que
  // mede o crescimento acumulado desde a posse.
  const dif = item ? { texto: item.mudanca, sentido: item.sentido } : antes ? mudanca(s, antes.valor, agora.valor) : null;
  const crescimento = s.formato === "pctsinal1";
  const cor = dif ? corDoVeredito(dif.sentido) : "var(--serie)";
  const faisca = recortar(s, antes?.data ?? s.datas[0], agora.data);
  return (
    <div className="grupo-cotacao relative min-w-0">
    <button
      type="button"
      role="radio"
      aria-checked={ativa}
      onClick={aoEscolher}
      aria-label={`${s.rotulo}: ${formatar(agora.valor, s.formato)} ${naReferencia(s, agora.data)}${
        dif ? `; ${crescimento ? "acumulado desde a posse" : "desde a posse"}, ${dif.texto}${dif.sentido !== "neutro" ? `, ${dif.sentido === "bom" ? "melhor" : "pior"}` : ""}` : ""
      }${antes && !crescimento ? `; na posse, ${formatar(antes.valor, s.formato)}` : ""}`}
      className={`w-full min-w-0 rounded-2xl px-3 pb-2 pt-2.5 text-left transition-colors ${ativa ? "vidro-lente" : "hover:bg-[var(--faixa-a)]"}`}
    >
      <span className="block truncate text-[11.5px] font-medium" style={{ color: ativa ? "var(--tinta)" : "var(--tinta-2)" }}>
        {s.rotulo}
      </span>
      <Numero texto={formatar(agora.valor, s.formato)} className="tabular mt-0.5 block text-[21px] font-bold leading-tight" />
      {/* A pílula é a mudança desde a posse, chapada na cor do placar; ao
          lado, o ponto de partida. PIB e renda já são variação: a pílula é o
          quanto cresceram no mandato. */}
      <span className="tabular mt-0.5 flex min-w-0 items-baseline gap-1.5 text-[10.5px]" style={{ color: "var(--tinta-3)" }} aria-hidden>
        {dif ? <PilulaVeredito texto={dif.texto} sentido={dif.sentido} className="shrink-0" /> : "—"}
        <span className="truncate">{crescimento ? "no mandato" : antes ? `na posse ${formatar(antes.valor, s.formato)}` : ""}</span>
      </span>
      <span className="mt-1.5 block">
        <Faisca
          datas={faisca.datas}
          valores={faisca.valores}
          altura={22}
          cor={cor}
          referencia={crescimento ? 0 : (antes?.valor ?? null)}
        />
      </span>
      <span className="tabular mt-1 block truncate text-[10px]" style={{ color: "var(--tinta-3)" }}>
        {referencia(s, agora.data)}
        {s.parcial ? ", parcial" : ""}
      </span>
    </button>
    <div className="compartilhar-metrica"><Compartilhar mensagem={frase??s.rotulo+": "+formatar(agora.valor,s.formato)+" · "+referencia(s,agora.data)} contexto={frase?"":undefined} ancora="de-perto" filtros={{"r.serie":s.id,"r.leitura":undefined,"r.faixa":undefined,"r.historico.tabela":undefined}} compacto/></div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Histórico da série escolhida
// ---------------------------------------------------------------------------

export function Historico({
  id,
  s,
  mandatos,
  mandatoFoco,
  faixa,
  setFaixa,
  item,
  expectativas,
  hoje,
  className,
  frase,
}: {
  id: string;
  s: SerieEconomia;
  mandatos: MandatoVisual[];
  mandatoFoco: string | null;
  faixa: Faixa;
  setFaixa: (f: Faixa) => void;
  /** O bloco da série no placar: o mandato em curso sai na cor dele. */
  item: ItemPlacar | undefined;
  expectativas: Expectativa[];
  hoje: string;
  className: string;
  /** A frase que acompanha o recorte; sem ela, o nome da série. */
  frase?: string;
}) {
  const [tabela, setTabela] = useEstadoCompartilhavel("historico.tabela", false, opcaoCompartilhada([true,false]));
  const inicio = s.cobertura.inicio ?? s.datas[0];
  const atual = mandatos.find((m) => m.emCurso);
  const posse = s.posse ?? atual?.inicio.slice(0, 7) ?? "2023-01";
  const opcoes: { id: Faixa; rotulo: string }[] = [
    { id: "mandato", rotulo: "Mandato" },
    ...(inicio < posse ? [{ id: "tudo" as const, rotulo: "Desde o início" }] : []),
  ];
  const f = opcoes.some((o) => o.id === faixa) ? faixa : "mandato";
  // O mandato começa no que o governo recebeu: o primeiro ponto é a régua.
  const desde = f === "mandato" ? (recebido(s)?.data ?? posse) : inicio;
  const pontos = recortar(s, desde, "9999-12");
  // Cada governo contra o que recebeu. O nome da régua vai num trecho só: no
  // mandato, o dele; desde o início, só o do governo que o leitor destacou na
  // grade (a legenda já diz o que é cada tracejado).
  const emDestaque = f === "mandato" ? atual?.id : mandatoFoco;
  const vereditos = vereditosPorMandato(
    s,
    mandatos,
    (id) => {
      if (id !== emDestaque) return null;
      const m = mandatos.find((x) => x.id === id);
      return m?.emCurso ? "recebido:" : m ? `${rotuloMandato(mandatos, m)} recebeu` : null;
    },
    item?.sentido,
  );
  const espera = esperaDoMercado(s, expectativas, hoje);

  const presentes = pontos.datas.flatMap((d, i) => (pontos.valores[i] === null ? [] : [{ d, v: pontos.valores[i]! }]));
  const menor = presentes.reduce((a, b) => (b.v < a.v ? b : a), presentes[0]);
  const maior = presentes.reduce((a, b) => (b.v > a.v ? b : a), presentes[0]);
  const media = presentes.reduce((a, b) => a + b.v, 0) / (presentes.length || 1);
  const ultimo = presentes.at(-1);
  const numeros: [string, string, string | null][] = [
    ["Último", formatar(ultimo?.v, s.formato), ultimo ? referencia(s, ultimo.d) : null],
    ["Mínimo", formatar(menor?.v, s.formato), menor ? referencia(s, menor.d) : null],
    ["Máximo", formatar(maior?.v, s.formato), maior ? referencia(s, maior.d) : null],
    ["Média do trecho", formatar(media, s.formato), `${presentes.length} ${s.frequencia === "trimestral" ? "trimestres" : s.frequencia === "ano-prodes" ? "anos" : "meses"}`],
  ];

  return (
    <Bloco
      id={id}
      titulo={s.rotulo}
      detalhe={s.fonte}
      className={className}
      mensagemCompartilhamento={frase}
      contextoCompartilhamento={frase ? "" : undefined}
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <Opcoes opcoes={opcoes} ativa={f} aoEscolher={setFaixa} rotulo="Período do gráfico" />
          <Opcoes
            opcoes={[
              { id: "grafico", rotulo: "Gráfico" },
              { id: "tabela", rotulo: "Tabela" },
            ]}
            ativa={tabela ? "tabela" : "grafico"}
            aoEscolher={(o) => setTabela(o === "tabela")}
            rotulo="Ver como"
          />
        </div>
      }
    >
      {tabela ? (
        <div className="max-h-[332px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0" style={{ background: "var(--superficie)", color: "var(--tinta-3)" }}>
              <tr>
                <th className="py-1.5 pr-3 font-medium">Referência</th>
                <th className="py-1.5 pr-3 font-medium">{s.rotulo}</th>
                <th className="py-1.5 font-medium">Na Presidência</th>
              </tr>
            </thead>
            <tbody>
              {pontos.datas
                .map((d, i) => ({ d, v: pontos.valores[i] }))
                .reverse()
                .map(({ d, v }) => (
                  <tr key={d} className="border-t" style={{ borderColor: "var(--borda)" }}>
                    <td className="tabular py-1 pr-3">{referencia(s, d)}</td>
                    <td className="tabular py-1 pr-3 font-medium">{v === null ? "sem dado" : formatar(v, s.formato)}</td>
                    <td className="py-1" style={{ color: "var(--tinta-2)" }}>
                      {naPresidencia(s, d, mandatos)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <GraficoTempo
          key={`${s.id}-${f}`}
          serie={{
            id: s.id,
            nome: s.rotulo,
            unidade: s.unidade,
            frequencia: s.frequencia,
            agregacao: null,
            datas: pontos.datas,
            valores: pontos.valores,
          }}
          presidentes={mandatos}
          destaque={mandatoFoco ?? atual?.id ?? null}
          altura={290}
          formatoValor={(v) => formatar(v, s.formato)}
          veredito={vereditos}
          projecao={espera?.projecao ?? null}
          rotuloData={rotuloDataDaSerie(s)}
        />
      )}
      {!tabela && vereditos.length > 0 && <LegendaVeredito encerrado={Boolean(s.posse)} zero={s.formato === "pctsinal1"} cada={f === "tudo"} />}

      <dl
        className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 ${espera ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}
        style={{ borderColor: "var(--borda)" }}
      >
        {numeros.map(([rotulo, valor, quando]) => (
          <div key={rotulo} className="min-w-0">
            <dt className={ROTULO} style={{ color: "var(--tinta-3)" }}>
              {rotulo}
            </dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <Numero texto={valor} className="tabular text-base font-bold" />
              {quando && (
                <span className="tabular text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                  {quando}
                </span>
              )}
            </dd>
          </div>
        ))}
        {espera && (
          <div className="min-w-0">
            <dt className={ROTULO} style={{ color: "var(--tinta-3)" }} title="Mediana da pesquisa Focus do Banco Central, que ouve bancos e consultorias toda semana">
              O mercado espera
            </dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <Numero texto={espera.valor} className="tabular text-base font-bold" />
              <span className="tabular text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                {espera.quando}
              </span>
            </dd>
            {espera.depois && (
              <dd className="tabular text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                {espera.depois}
              </dd>
            )}
          </div>
        )}
      </dl>

      {/* Quem faz o quê. O rosto no gráfico diz quem estava no cargo; estas
          linhas dizem quem mede e quem decide, para o leitor não ler o
          gráfico como placar do presidente. */}
      <div className="mt-3 grid gap-x-4 gap-y-2 border-t pt-3 text-[11px] leading-snug md:grid-cols-3" style={{ borderColor: "var(--borda)", color: "var(--tinta-2)" }}>
        {(
          [
            ["Quem mede", s.instituicoes.mede],
            ["Quem atua", s.instituicoes.atua],
            ["O que também pesa", s.instituicoes.contexto],
          ] as const
        ).map(([t, texto]) => (
          <p key={t}>
            <span className="font-semibold" style={{ color: "var(--tinta)" }}>
              {t}.{" "}
            </span>
            {texto}
          </p>
        ))}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        {s.calculo && <span>{`${s.calculo[0].toUpperCase()}${s.calculo.slice(1)}.`}</span>}
        <span>Estar no cargo não é ter causado o número.</span>
        {espera && (
          <a href={FOCUS_URL} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--serie)" }}>
            O que o mercado espera: pesquisa Focus, BCB ↗
          </a>
        )}
        {s.instituicoes.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--serie)" }}>
            {l.nome} ↗
          </a>
        ))}
        <button
          type="button"
          onClick={() => baixar(`${s.id}-${pontos.datas[0]}-a-${pontos.datas.at(-1)}.csv`, csvSerie(s, pontos.datas, pontos.valores, mandatos))}
          className="hover:underline"
          style={{ color: "var(--serie)" }}
        >
          Baixar este trecho (CSV)
        </button>
      </p>
    </Bloco>
  );
}

/**
 * A chave das cores do gráfico, numa linha: cada mandato leva uma cor só, e
 * contra o quê. Séries de crescimento vão pela média do mandato contra o
 * zero; as outras, pelo último dado contra o que o governo recebeu na posse.
 */
function LegendaVeredito({ zero, cada, encerrado }: { zero: boolean; cada: boolean; encerrado: boolean }) {
  const amostra = (cor: string) => <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: cor }} aria-hidden />;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--tinta-2)" }}>
      <span className="flex items-center gap-1.5">
        {amostra(COR_BOM)}
        {zero ? "cresceu, na média do mandato" : "terminou melhor do que recebeu"}
      </span>
      <span className="flex items-center gap-1.5">
        {amostra(COR_RUIM)}
        {zero ? "encolheu" : "terminou pior"}
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="4" aria-hidden>
          <line x1="0" x2="18" y1="2" y2="2" stroke="var(--tinta-2)" strokeWidth="1.2" strokeDasharray="4 3" />
        </svg>
        {zero ? "zero" : cada ? "o que cada governo recebeu na posse" : "o que o governo recebeu na posse"}
      </span>
      {!zero && !encerrado && <span style={{ color: "var(--tinta-3)" }}>O mandato em curso conta até o último dado.</span>}
    </p>
  );
}

// ---------------------------------------------------------------------------
// O que o mercado espera
// ---------------------------------------------------------------------------

const FOCUS_URL = "https://dadosabertos.bcb.gov.br/dataset/expectativas-mercado";

/**
 * A pergunta da pesquisa Focus que corresponde a cada série. Só inflação e
 * dólar medem a mesma coisa que a série (a inflação de 12 meses em dezembro,
 * a média de dezembro) e viram ponto no gráfico. A Selic do Focus é a meta,
 * não a efetiva; o PIB é o do ano, não o do trimestre: esses ficam só no número.
 */
const ESPERA: Record<string, { indicador: string; noGrafico: boolean; quando: (ano: string) => string }> = {
  inflacao12m: { indicador: "IPCA", noGrafico: true, quando: (a) => `no fim de ${a}` },
  cambio: { indicador: "Câmbio", noGrafico: true, quando: (a) => `média de dez/${a}` },
  selic: { indicador: "Selic", noGrafico: false, quando: (a) => `meta no fim de ${a}` },
  pib: { indicador: "PIB Total", noGrafico: false, quando: (a) => `no ano de ${a}` },
};

function esperaDoMercado(s: SerieEconomia, lista: Expectativa[], hoje: string) {
  const e = ESPERA[s.id];
  if (!e) return null;
  const ano = hoje.slice(0, 4);
  const doAno = (a: string) => lista.find((x) => x.indicador === e.indicador && x.ano === a);
  const p = doAno(ano);
  if (!p) return null;
  const seguinte = doAno(String(Number(ano) + 1));
  const ultimo = ultimoDado(s);
  const mes = `${ano}-12`;
  return {
    valor: formatar(p.mediana, s.formato),
    quando: e.quando(ano),
    depois: seguinte ? `${seguinte.ano}: ${formatar(seguinte.mediana, s.formato)}` : null,
    projecao:
      e.noGrafico && ultimo && ultimo.data < mes
        ? { mes, valor: p.mediana, rotulo: `mercado espera ${formatar(p.mediana, s.formato)}` }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Este governo: o ritmo no mandato contra o de antes
// ---------------------------------------------------------------------------

const ordemSerie = (id: string) => SERIES_UI_POR_ID[id]?.ordem ?? 99;
const POSSE_ATUAL = "2023-01";

/** Nome, barra, no mandato, referência: as mesmas colunas em todas as linhas, para o zero ficar num fio só. */
const COLUNAS_RITMO = "grid grid-cols-[8.4rem_minmax(0,1fr)_4.9rem_2.8rem] items-center gap-x-2";

/** Uma linha do ritmo: a média por ano no mandato e a referência tracejada. */
export interface Ritmo {
  id: string;
  rotulo: string;
  /** O grupo da linha, quando não é a unidade: todos dividem a mesma escala. */
  grupo?: string;
  v: number;
  /** No país, o ritmo nos 24 meses antes da posse; num estado, o do Brasil na mesma medida. */
  referencia: number | null;
  /** Pontos por ano; senão, % ao ano. */
  pontos: boolean;
  sentido: Sentido;
  /** A leitura por escrito, para o balão. */
  leitura: string | null;
  ativa: boolean;
  aoEscolher?: () => void;
}

/**
 * Parte do recebido, como o placar: pela série, onde há, e sem ela (ou em PIB e renda,
 * que já são crescimento) pelo último dado do governo anterior. Medida que começa neste
 * governo fica no indicador dele. A cor de cada barra é o veredito do placar, não o sinal
 * do ritmo: a Selic sem lado bom fica em cinza.
 */
function ritmosDoPais(
  indicadores: Indicador[],
  series: SerieEconomia[],
  recebidoDe: (serieId: string) => Recebido | null,
  vereditos: Map<string, Sentido>,
  ativa: string | null,
  aoEscolher: (origem: string) => void,
  temSerie: (origem: string) => boolean,
): Ritmo[] {
  return indicadores
    .filter((i) => SERIES_UI_POR_ID[i.serieId] && i.serieId !== "salario_minimo")
    .sort((a, b) => ordemSerie(a.serieId) - ordemSerie(b.serieId))
    .flatMap((i) => {
      const ui = SERIES_UI_POR_ID[i.serieId];
      const s = series.find((x) => x.origem === i.serieId);
      const r = s ? ritmoNaRegua(s, s.posse ?? POSSE_ATUAL) : null;
      const doIndicador = r ? null : ritmoDesdeORecebido(recebidoDe(i.serieId), i);
      const v = r?.v ?? doIndicador?.v ?? i.variacaoAnualizada;
      if (v === null) return [];
      // Os 24 meses antes da posse já não tocam o mandato: o indicador serve.
      const referencia = r ? r.referencia : i.tendenciaPrevia;
      return [
        {
          id: i.serieId,
          rotulo: ui.rotulo,
          v,
          referencia,
          pontos: r?.pontos ?? doIndicador?.pontos ?? i.unidadeAnualizada === "p.p./ano",
          sentido: vereditos.get(i.serieId) ?? (ui.semDirecao ? "neutro" : sentido(v, i.direcao)),
          leitura: referencia !== null ? tendencia(v, referencia) : null,
          ativa: i.serieId === ativa,
          aoEscolher: temSerie(i.serieId) ? () => aoEscolher(i.serieId) : undefined,
        },
      ];
    });
}

/** Quantos períodos a medida tem por ano: trimestre, mês ou ano. */
function periodosPorAno(l: Leitura): number {
  const c = l.periodos[0]?.codigo ?? "";
  return /^\d{6}$/.test(c) ? 4 : /^\d{4}-\d{2}$/.test(c) ? 12 : 1;
}

/** De `a` para `b` por ano: taxas em pontos divididos pelos anos; preços e valores em % composto. */
function porAno(a: number, b: number, anos: number, pontos: boolean): number | null {
  if (anos <= 0) return null;
  if (pontos) return (b - a) / anos;
  return a > 0 ? ((b / a) ** (1 / anos) - 1) * 100 : null;
}

/**
 * O ritmo com os números do estado, do que o governo recebeu (fim de 2022) ao
 * último dado. A referência é o Brasil na mesma medida, e não o "antes da
 * posse": as séries por UF começam em 2021, e esse trecho mediria a volta da
 * pandemia, não o rumo que o estado já levava.
 */
function ritmosDoEstado(leituras: Leitura[], uf: UF, ativa: string | null, aoEscolher: (id: string) => void): Ritmo[] {
  return leituras.flatMap((l): Ritmo[] => {
    const r = l.indiceRecebido;
    const p = l.periodos.length - 1;
    if (r === null || p <= r) return [];
    const pontos = emPontos(l);
    const anos = (p - r) / periodosPorAno(l);
    const ritmo = (s: (number | null)[] | undefined) => {
      const a = s?.[r];
      const b = s?.[p];
      return a == null || b == null ? null : porAno(a, b, anos, pontos);
    };
    const v = ritmo(l.ufs[uf.codigo]);
    if (v === null) return [];
    const brasil = ritmo(l.brasil);
    const pts = (x: number) => `${comSinal(x, 1)}${pontos ? " pts" : "%"} por ano`;
    return [
      {
        id: l.id,
        rotulo: curto(l),
        v,
        referencia: brasil,
        pontos,
        sentido: sentido(Math.round(v * 10) / 10, l.direcao ?? "neutro"),
        leitura: brasil === null ? null : `${uf.sigla} ${pts(v)}; Brasil ${pts(brasil)}`,
        ativa: l.id === ativa,
        aoEscolher: () => aoEscolher(l.id),
      },
    ];
  });
}

/**
 * O ritmo por ano de cada indicador no mandato, desenhado como as barras por
 * partido da sala: barra grossa saindo de um zero comum, ponta arredondada, o
 * valor à direita. A referência é o traço tracejado, como a linha do Brasil lá
 * em cima.
 */
export function EsteGoverno({
  ritmos,
  detalhe,
  referencia,
  colunaReferencia,
  className,
}: {
  ritmos: Ritmo[];
  detalhe: string;
  /** O que o traço tracejado é, na legenda. */
  referencia: string;
  /** O título curto da coluna da referência. */
  colunaReferencia: string;
  className: string;
}) {
  const porTema = ritmos.some((r) => r.grupo);
  const grupos = porTema
    ? [...new Set(ritmos.map((r) => r.grupo ?? ""))].map((g) => ({ id: g, titulo: g, lista: ritmos.filter((r) => (r.grupo ?? "") === g) }))
    : [
        { id: "pct", titulo: "Em % ao ano", lista: ritmos.filter((r) => !r.pontos) },
        { id: "pts", titulo: "Em pontos por ano", lista: ritmos.filter((r) => r.pontos) },
      ].filter((g) => g.lista.length > 0);
  // Agrupadas por tema, as linhas têm a mesma unidade: a mesma escala deixa comparar um grupo com o outro.
  const escala = porTema ? Math.max(...ritmos.flatMap((r) => [Math.abs(r.v), Math.abs(r.referencia ?? 0)]), 0.1) : undefined;

  return (
    <Bloco titulo="Ritmo no mandato" detalhe={detalhe} className={`flex flex-col ${className}`} corpo="flex flex-1 flex-col">
      <p className="-mt-1 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "var(--tinta-3)" }}>
        {(
          [
            ["var(--mapa-melhor)", "melhorou"],
            ["var(--mapa-pior)", "piorou"],
            ["var(--mapa-estavel)", "sem lado bom"],
          ] as const
        ).map(([cor, rotulo]) => (
          <span key={rotulo} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-3.5 rounded-r-full" style={{ background: cor }} />
            {rotulo}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-3 border-l-[1.5px] border-dashed" style={{ borderColor: "var(--tinta)" }} />
          {referencia}
        </span>
      </p>
      {grupos.map((g) => (
        <GrupoRitmo key={g.id} titulo={g.titulo} lista={g.lista} colunaReferencia={colunaReferencia} escala={escala} />
      ))}
      <p className="mt-auto pt-3 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Passe o ponteiro numa linha para ler a comparação.
      </p>
    </Bloco>
  );
}

function GrupoRitmo({ titulo, lista, colunaReferencia, escala }: { titulo: string; lista: Ritmo[]; colunaReferencia: string; escala?: number }) {
  // Uma escala por grupo: pontos e porcentagens não dividem o mesmo eixo.
  const max = escala ?? Math.max(...lista.flatMap((r) => [Math.abs(r.v), Math.abs(r.referencia ?? 0)]), 0.1);
  return (
    <div className="mt-3 first:mt-0">
      <div className={`${COLUNAS_RITMO} px-2 pb-1`} aria-hidden>
        <span className={ROTULO} style={{ color: "var(--tinta-3)" }}>
          {titulo}
        </span>
        <span className="tabular flex justify-between text-[9.5px]" style={{ color: "var(--tinta-3)" }}>
          <span>{comSinal(-max, max < 3 ? 1 : 0)}</span>
          <span>0</span>
          <span>{comSinal(max, max < 3 ? 1 : 0)}</span>
        </span>
        <span className="text-right text-[10px]" style={{ color: "var(--tinta-3)" }}>
          no mandato
        </span>
        <span className="text-right text-[10px]" style={{ color: "var(--tinta-3)" }}>
          {colunaReferencia}
        </span>
      </div>
      <ul>
        {lista.map((r) => (
          <LinhaRitmo key={r.id} r={r} max={max} colunaReferencia={colunaReferencia} />
        ))}
      </ul>
    </div>
  );
}

function LinhaRitmo({ r, max, colunaReferencia }: { r: Ritmo; max: number; colunaReferencia: string }) {
  const barra = r.sentido === "bom" ? "var(--mapa-melhor)" : r.sentido === "ruim" ? "var(--mapa-pior)" : "var(--mapa-estavel)";
  const pos = (x: number) => 50 + (Math.max(-max, Math.min(max, x)) / max) * 48;
  const unidade = r.pontos ? " pontos por ano" : "% ao ano";
  const texto = `${r.rotulo}: ${comSinal(r.v, 1)}${unidade} no mandato${r.sentido !== "neutro" ? ` (${r.sentido === "bom" ? "melhor" : "pior"})` : ""}${r.referencia !== null ? `; ${colunaReferencia}, ${comSinal(r.referencia, 1)}` : ""}${r.leitura ? `. ${r.leitura}` : ""}`;

  const conteudo = (
    <>
      <span className="truncate text-[12.5px]" style={{ fontWeight: r.ativa ? 650 : 500, color: "var(--tinta)" }}>
        {r.rotulo}
      </span>
      <span className="relative h-[30px]" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px" style={{ background: "var(--grade)" }} />
        <span
          className={`absolute top-1/2 h-2.5 -translate-y-1/2 ${r.v >= 0 ? "rounded-r-full" : "rounded-l-full"}`}
          style={{ left: `${Math.min(50, pos(r.v))}%`, width: `${Math.max(Math.abs(pos(r.v) - 50), 0.8)}%`, background: barra }}
        />
        {r.referencia !== null && (
          <span
            className="absolute top-1/2 h-[18px] -translate-y-1/2 border-l-[1.5px] border-dashed"
            style={{ left: `${pos(r.referencia)}%`, borderColor: "var(--tinta)" }}
          />
        )}
      </span>
      <span className="tabular whitespace-nowrap text-right text-[12.5px] font-semibold" style={{ color: "var(--tinta)" }}>
        {comSinal(r.v, 1)}
        {r.sentido !== "neutro" && (
          <span className="ml-1 text-[9.5px] font-medium" style={{ color: corDoSentido(r.sentido) }}>
            {r.sentido === "bom" ? "melhor" : "pior"}
          </span>
        )}
      </span>
      <span className="tabular text-right text-[11px]" style={{ color: "var(--tinta-3)" }}>
        {r.referencia === null ? "—" : comSinal(r.referencia, 1)}
      </span>
    </>
  );
  return (
    <li title={r.leitura ?? undefined}>
      {r.aoEscolher ? (
        <button
          type="button"
          onClick={r.aoEscolher}
          aria-pressed={r.ativa}
          aria-label={texto}
          className={`${COLUNAS_RITMO} w-full rounded-md px-2 text-left transition-colors duration-150 ${r.ativa ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
        >
          {conteudo}
        </button>
      ) : (
        <div role="group" aria-label={texto} className={`${COLUNAS_RITMO} px-2`}>
          {conteudo}
        </div>
      )}
    </li>
  );
}

/**
 * Quem governou o estado desde 1995, uma linha por pessoa no cargo sem
 * interrupção, com os partidos na ordem. O governo de agora vai em ouro, como
 * tudo o que está escolhido.
 */
function QuemGovernou({ governos, uf, hoje, className }: { governos: Governos; uf: UF; hoje: string; className: string }) {
  const faixas: { inicio: string; fim: string | null; nome: string; partidos: (string | null)[]; como: string }[] = [];
  for (const t of governos.ufs[uf.sigla] ?? []) {
    const ultima = faixas.at(-1);
    if (ultima && ultima.nome === t.nome && ultima.fim === t.inicio) {
      ultima.fim = t.fim;
      if (ultima.partidos.at(-1) !== t.partido) ultima.partidos.push(t.partido);
    } else {
      faixas.push({ inicio: t.inicio, fim: t.fim, nome: t.nome, partidos: [t.partido], como: comoEntrou(t) });
    }
  }
  const lista = [...faixas].reverse();
  return (
    <Bloco titulo={`Quem governou ${uf.sigla}`} detalhe={`desde ${faixas[0]?.inicio.slice(0, 4) ?? "1995"}`} className={className}>
      <ul>
        {lista.map((f) => {
          const agora = f.fim === null || f.fim > hoje;
          return (
            <li
              key={f.inicio}
              className={`grid grid-cols-[4.6rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1 ${agora ? "linha-escolhida" : ""}`}
              title={`${f.nome}: ${mesAno(f.inicio)} a ${agora ? "hoje" : mesAno(f.fim!)} · ${f.como}`}
            >
              <span className="tabular text-[11px]" style={{ color: "var(--tinta-3)" }}>
                {f.inicio.slice(0, 4)}–{agora ? "hoje" : f.fim!.slice(0, 4)}
              </span>
              <span className="truncate text-[12.5px]" style={{ fontWeight: agora ? 650 : 500 }}>
                {f.nome}
              </span>
              <span className="flex shrink-0 gap-0.5">
                {f.partidos.map((p, i) => (
                  <Pilula key={`${p}-${i}`} governos={governos} sigla={p} />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// Governo a governo
// ---------------------------------------------------------------------------

/** O que a grade compara, na ordem da narrativa do site. O mínimo nominal fica fora (ver `registroSeries`). */
const LINHAS_GRADE = [
  "salario_minimo_real",
  "ipca",
  "selic",
  "juros_real",
  "cambio",
  "desemprego",
  "massa_renda_real",
  "pib_volume",
  "pib_per_capita",
  "divida_bruta_pib",
  "divida_liquida_pib",
  "pobreza",
  "gini",
];

/** O World Bank mede igual para todos os países: é o que permite pôr o Brasil contra o mundo em cada mandato. */
const MUNDO: { id: string; rotulo: string; direcao: Direcao }[] = [
  { id: "NY.GDP.MKTP.KD.ZG", rotulo: "Crescimento do PIB", direcao: "maior_melhor" },
  { id: "FP.CPI.TOTL.ZG", rotulo: "Inflação", direcao: "menor_melhor" },
  { id: "SL.UEM.TOTL.ZS", rotulo: "Desemprego (OIT)", direcao: "menor_melhor" },
];
const REGIOES: [string, string][] = [
  ["BRA", "Brasil"],
  ["LCN", "América Latina e Caribe"],
  ["MIC", "Países de renda média"],
  ["WLD", "Mundo"],
];

interface Celula {
  /** O que mudou desde a posse, no idioma da medida: "−1,2 pts", "+12,5%". */
  texto: string | null;
  sentido: Sentido;
  /** A comparação por escrito, para o balão. */
  leitura: string | null;
  /** O ritmo por ano, que vai no balão com a posição entre os governos. */
  ritmo: number | null;
  parcial: boolean;
  detalhe: React.ReactNode;
}
interface LinhaGrade {
  id: string;
  grupo: string;
  rotulo: string;
  /** O que a célula mede: "pts", "%", "% no mandato". */
  unidade: string;
  /** A unidade do ritmo do balão: "% ao ano", "pontos por ano". */
  unidadeRitmo: string;
  direcao: Direcao;
  /** A série do banco, quando há uma série nacional para abrir no gráfico. */
  origem?: string;
  celulas: Celula[];
  /** A posição de cada mandato no ritmo (0 é o melhor) e quantos têm o dado. */
  posicao: (number | null)[];
  n: number;
}

/**
 * A posição de cada mandato entre os que têm o dado, do melhor (0) ao pior.
 * Vai só no balão: a cor da grade é a régua do placar, não o ranking.
 */
function posicoes(valores: (number | null)[], direcao: Direcao): (number | null)[] {
  if (direcao === "neutro") return valores.map(() => null);
  const ordem = valores
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null)
    .sort((a, b) => (direcao === "maior_melhor" ? b.v - a.v : a.v - b.v));
  const saida: (number | null)[] = valores.map(() => null);
  ordem.forEach((x, k) => (saida[x.i] = k));
  return saida;
}

type TrechoSerie = ReturnType<typeof mandatosNaSerie>[number];

/**
 * Uma célula com a régua do placar e do gráfico: o último dado do mandato
 * contra o que ele recebeu na posse.
 *
 * - Mandato em curso: o número do placar, igual em toda a aba.
 * - Com série nacional: a mesma conta que pinta o gráfico (`mandatosNaSerie`).
 *   PIB e renda já são variação: a célula diz quanto cresceram no mandato e a
 *   cor é a do gráfico, a média contra o zero.
 * - Sem série (pobreza, Gini, dívida líquida, PIB per capita): o primeiro e o
 *   último dado do mandato no banco, como o placar faz com eles.
 */
function celulaDaRegua(
  i: IndicadorMandato | null,
  s: SerieEconomia | undefined,
  t: TrechoSerie | undefined,
  item: ItemPlacar | undefined,
  direcao: Direcao,
  recebeu: Recebido | null,
): Pick<Celula, "texto" | "sentido" | "leitura"> {
  const vazia = { texto: null, sentido: "neutro" as const, leitura: null };
  if (item) return { texto: item.mudanca, sentido: item.sentido, leitura: item.leitura };
  const pelosNiveis = (pts: boolean) => {
    // O recebido, como no placar; quem não tem governo anterior com o dado parte do primeiro dele.
    const de = recebeu?.valor ?? i?.valorInicial ?? null;
    if (!i || de === null || i.valorFinal === null || i.cobertura === "indisponivel" || de === 0) return null;
    const v = Math.round((pts ? i.valorFinal - de : (i.valorFinal / de - 1) * 100) * 10) / 10;
    return { v, texto: v === 0 ? "igual" : `${comSinal(v, 1)}${pts ? " pts" : "%"}` };
  };
  if (s) {
    if (!t) return vazia;
    if (s.formato === "pctsinal1") {
      const n = pelosNiveis(false);
      return n ? { texto: n.texto, sentido: t.sentido, leitura: `${n.v >= 0 ? "Cresceu" : "Encolheu"} ${numero(Math.abs(n.v), 1)}% no mandato.` } : vazia;
    }
    const d = mudanca(s, t.recebeu, t.ultimo);
    return {
      texto: d?.texto ?? null,
      sentido: direcao === "neutro" ? "neutro" : t.sentido,
      leitura: `Recebeu ${formatar(t.recebeu, s.formato)}; ${t.emCurso ? "está em" : "terminou em"} ${formatar(t.ultimo, s.formato)}.`,
    };
  }
  if (!i || !["nivel_pct", "nivel_moeda", "indice"].includes(i.tipo)) return vazia;
  const n = pelosNiveis(i.tipo === "nivel_pct");
  return n ? { texto: n.texto, sentido: sentido(n.v, direcao), leitura: null } : vazia;
}

/** As linhas da grade: as séries do banco e, no fim, o Brasil contra o mundo. */
function linhasDaGrade(
  ordem: MandatoVisual[],
  porMandato: Record<string, IndicadorMandato[]>,
  benchmark: Record<string, Benchmark[]>,
  origens: Set<string>,
  series: SerieEconomia[],
  doPlacar: Map<string, ItemPlacar>,
): LinhaGrade[] {
  const comPosicao = (ln: Omit<LinhaGrade, "posicao" | "n">): LinhaGrade => {
    const ritmos = ln.celulas.map((c) => c.ritmo);
    return { ...ln, posicao: posicoes(ritmos, ln.direcao), n: ln.celulas.filter((c) => c.texto !== null).length };
  };
  const daSerie = LINHAS_GRADE.flatMap((id): LinhaGrade[] => {
    const ui = SERIES_UI_POR_ID[id];
    const inds = ordem.map((m) => porMandato[m.id]?.find((i) => i.serieId === id) ?? null);
    // A unidade vem de um mandato com o dado: os sem dado não a têm.
    const exemplo = inds.find((i) => i?.unidadeAnualizada) ?? inds.find((i) => i !== null);
    if (!ui || !exemplo || inds.every((i) => i?.variacaoAnualizada == null)) return [];
    const direcao = LADO_BOM[id] ?? (ui.semDirecao ? "neutro" : exemplo.direcao);
    const s = series.find((x) => x.origem === id);
    const trechos = new Map((s ? mandatosNaSerie(s, ordem) : []).map((t) => [t.id, t] as const));
    const crescimento = s ? s.formato === "pctsinal1" : exemplo.tipo === "indice" || id === "pib_per_capita";
    const emPts = s ? !crescimento && s.formato !== "reais0" && s.formato !== "reais2" : exemplo.tipo === "nivel_pct";
    const nivelVisivel = exemplo.tipo === "nivel_pct" || exemplo.tipo === "nivel_moeda";
    return [
      comPosicao({
        id,
        grupo: CATEGORIAS[ui.categoria as Categoria],
        rotulo: ui.rotulo,
        unidade: crescimento ? "% no mandato" : emPts ? "pts" : "%",
        unidadeRitmo: (s && !crescimento ? emPts : exemplo.unidadeAnualizada === "p.p./ano") ? "pontos por ano" : "% ao ano",
        direcao,
        origem: origens.has(id) ? id : undefined,
        celulas: inds.map((i, k) => ({
          ...celulaDaRegua(i, s, trechos.get(ordem[k].id), ordem[k].emCurso ? doPlacar.get(id) : undefined, direcao, recebidoNaLista(inds, k)),
          // A régua do ritmo é uma só na linha: sem base nesse governo fica sem número, e não
          // entra na posição com outra unidade.
          ritmo:
            s && !crescimento
              ? ((t) => (t ? (ritmoNaRegua(s, t.desde, t.ate)?.v ?? null) : null))(trechos.get(ordem[k].id))
              : i
                ? (ritmoDesdeORecebido(recebidoNaLista(inds, k), i)?.v ?? i.variacaoAnualizada)
                : null,
          parcial: i?.cobertura === "parcial",
          detalhe: i ? (
            <>
              {!s && nivelVisivel && (recebidoNaLista(inds, k)?.valor ?? i.valorInicial) !== null && i.valorFinal !== null && (
                <span className="block">
                  De {nivelDe(recebidoNaLista(inds, k)?.valor ?? i.valorInicial!, i.unidade, ui.simbolo)} a {nivelDe(i.valorFinal, i.unidade, ui.simbolo)}
                </span>
              )}
              {i.cobertura === "parcial" && i.fracaoMandatoCoberta !== null && (
                <span className="block">Dado cobre {Math.round(i.fracaoMandatoCoberta * 100)}% do mandato</span>
              )}
              {i.cobertura === "indisponivel" && <span className="block">{i.ressalva ?? "Sem dado nesta série para o mandato"}</span>}
            </>
          ) : (
            "Sem dado nesta série para o mandato"
          ),
        })),
      }),
    ];
  });
  // Contra o mundo não há "o que recebeu": verde é o Brasil melhor que a
  // média mundial no mandato, vermelho, pior.
  const doMundo = MUNDO.map((ind) =>
    comPosicao({
      id: ind.id,
      grupo: "Contra o mundo (World Bank)",
      rotulo: `${ind.rotulo}: Brasil − mundo`,
      unidade: "pts",
      unidadeRitmo: "pontos, média anual",
      direcao: ind.direcao,
      celulas: ordem.map((m) => {
        const b = benchmark[m.id]?.filter((x) => x.indicadorWb === ind.id) ?? [];
        const media = (r: string) => b.find((x) => x.regiao === r)?.mediaPeriodo ?? null;
        const brasil = media("BRA");
        const mundo = media("WLD");
        const anos = b[0]?.nAnos ?? 0;
        const v = brasil !== null && mundo !== null ? Math.round((brasil - mundo) * 10) / 10 : null;
        return {
          texto: v === null ? null : v === 0 ? "igual" : `${comSinal(v, 1)} pts`,
          sentido: v === null ? "neutro" : sentido(v, ind.direcao),
          leitura: v === null ? null : `${v === 0 ? "Igual à" : sentido(v, ind.direcao) === "bom" ? "Melhor que a" : "Pior que a"} média mundial no mandato.`,
          ritmo: v,
          parcial: m.emCurso,
          detalhe: (
            <>
              {REGIOES.map(([r, nome]) => (
                <span key={r} className="flex justify-between gap-3">
                  <span>{nome}</span>
                  <span className="tabular font-semibold">{media(r) === null ? "—" : `${numero(media(r), 1)}%`}</span>
                </span>
              ))}
              <span className="mt-1 block">
                Média de {anos} {anos === 1 ? "ano" : "anos"}
              </span>
            </>
          ),
        };
      }),
    }),
  );
  return [...daSerie, ...doMundo];
}

/** A largura da coluna dos rótulos; a faixa que acende o mandato começa depois dela. */
const ROTULOS = "15.5rem";

/**
 * Cada mandato com a régua do placar e do gráfico: o último dado dele contra
 * o que recebeu na posse, num bloco chapado verde ou vermelho. A linha de um
 * indicador conta, de relance, quais governos entregaram melhor do que
 * receberam. O ritmo por ano e a posição entre os governos ficam no balão.
 *
 * O ponteiro corre a grade sem renderizar a tabela de novo. Ela é memorizada
 * e os cliques chegam por delegação; a linha acende por CSS e a coluna é uma
 * faixa só, que desliza por `--k`. O destaque do mandato no gráfico vai numa
 * transição, que o React deixa para depois enquanto o ponteiro anda.
 */
function GovernoAGoverno({
  mandatos,
  governos,
  porMandato,
  benchmark,
  ativa,
  aoEscolher,
  origens,
  series,
  doPlacar,
  mandatoFixo,
  setMandatoFoco,
  aoFixarMandato,
  uf,
  className,
}: {
  mandatos: MandatoVisual[];
  governos: Governos;
  porMandato: Record<string, IndicadorMandato[]>;
  benchmark: Record<string, Benchmark[]>;
  ativa: string;
  aoEscolher: (origem: string) => void;
  /** As séries nacionais que o gráfico sabe abrir. */
  origens: Set<string>;
  /** As séries do gráfico: a grade pinta cada mandato com a mesma conta. */
  series: SerieEconomia[];
  /** Os blocos do placar por indicador: o mandato em curso sai igual a eles. */
  doPlacar: Map<string, ItemPlacar>;
  mandatoFixo: string | null;
  setMandatoFoco: (id: string | null) => void;
  aoFixarMandato: (id: string) => void;
  uf: UF | null;
  className: string;
}) {
  const perfil=usePerfilPainel();
  const caixa = useRef<HTMLDivElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  // A célula sob o ponteiro: `l` é a linha, nula no cabeçalho.
  const sob = useRef<{ k: number; l: number | null } | null>(null);
  const [dica, setDica] = useState<{ k: number; l: number; x: number; y: number } | null>(null);
  const ordem = useMemo(() => [...mandatos].sort((a, b) => a.inicio.localeCompare(b.inicio)), [mandatos]);
  const linhas = useMemo(
    () => linhasDaGrade(ordem, porMandato, benchmark, origens, series, doPlacar),
    [ordem, porMandato, benchmark, origens, series, doPlacar],
  );
  const kFixo = ordem.findIndex((m) => m.id === mandatoFixo);
  useEffect(()=>{if(new URLSearchParams(location.search).get("painel")==="governo-a-governo"&&mandatoFixo){[...caixa.current?.querySelectorAll<HTMLButtonElement>("button[data-mandato]")??[]].find(b=>b.dataset.mandato===mandatoFixo)?.scrollIntoView({block:"nearest",inline:"center"});}},[mandatoFixo]);

  const apagar = () => {
    if (!sob.current) return;
    sob.current = null;
    faixa.current?.removeAttribute("data-acesa");
    setDica(null);
    startTransition(() => setMandatoFoco(null));
  };

  const acender = (alvo: EventTarget) => {
    const el = alvo instanceof Element ? alvo.closest<HTMLElement>("[data-k]") : null;
    const c = caixa.current;
    // No rótulo da linha ou no nome do grupo, a coluna fica acesa e o balão sai.
    if (!el || !c) {
      if (sob.current) sob.current = { k: sob.current.k, l: null };
      setDica(null);
      return;
    }
    const k = Number(el.dataset.k);
    const l = el.dataset.l === undefined ? null : Number(el.dataset.l);
    const antes = sob.current;
    if (antes?.k === k && antes.l === l) return;
    sob.current = { k, l };
    const f = faixa.current;
    if (f) {
      // Acendendo do nada, a faixa nasce na coluna; de uma coluna a outra, desliza.
      if (!antes) {
        f.style.transition = "none";
        f.style.setProperty("--k", String(k));
        void f.offsetWidth;
        f.style.transition = "";
      } else {
        f.style.setProperty("--k", String(k));
      }
      f.setAttribute("data-acesa", "");
    }
    if (l === null) {
      setDica(null);
    } else {
      const cr = c.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = Math.min(Math.max(r.left - cr.left + r.width / 2, 136), cr.width - 136);
      setDica({ k, l, x, y: r.bottom - cr.top + 4 });
    }
    if (antes?.k !== k) startTransition(() => setMandatoFoco(ordem[k].id));
  };

  const tocar = (e: React.MouseEvent) => {
    const b = e.target instanceof Element ? e.target.closest<HTMLElement>("button[data-origem], button[data-mandato]") : null;
    if (b?.dataset.origem) aoEscolher(b.dataset.origem);
    else if (b?.dataset.mandato) aoFixarMandato(b.dataset.mandato);
  };

  const tabela = useMemo(() => {
    let grupoAnterior = "";
    return (
      <table className="relative w-full table-fixed border-separate text-[12px]" style={{ borderSpacing: 0 }}>
        <colgroup>
          <col style={{ width: ROTULOS }} />
          {ordem.map((m) => (
            <col key={m.id} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="text-left align-bottom">
              <span className="sr-only">Indicador</span>
            </th>
            {ordem.map((m, k) => (
              <th key={m.id} scope="col" data-k={k} className="px-1 pb-3 align-bottom font-normal">
                <button
                  type="button"
                  data-mandato={m.id}
                  style={perfil?.pessoaId===m.pessoaId?{background:"var(--faixa-ativa)",outline:"1px solid var(--ouro-forte,var(--serie))"}:undefined}
                  aria-pressed={mandatoFixo === m.id}
                  className="flex w-full flex-col items-center gap-1.5 rounded-lg pt-2"
                  title={`${m.nome} · ${m.inicio.slice(0, 4)}–${m.emCurso ? "hoje" : m.fim.slice(0, 4)}. Toque para fixar o destaque no gráfico.`}
                >
                  <Retrato presidente={m} tamanho="p" />
                  <span className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
                    <LogosDoMandato governos={governos} partido={m.partido} />
                    <span className="whitespace-nowrap text-[12px] font-semibold leading-none" style={{ color: "var(--tinta)" }}>
                      {rotuloMandato(mandatos, m)}
                    </span>
                  </span>
                  <span className="tabular text-[10.5px] leading-none" style={{ color: "var(--tinta-3)" }}>
                    {m.inicio.slice(2, 4)}–{m.emCurso ? "hoje" : m.fim.slice(2, 4)}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.flatMap((ln, l) => {
            const ativaLinha = ln.origem !== undefined && ln.origem === ativa;
            const linhasDaVez: React.ReactNode[] = [];
            if (ln.grupo !== grupoAnterior) {
              grupoAnterior = ln.grupo;
              linhasDaVez.push(
                <tr key={`grupo-${ln.grupo}`}>
                  <th colSpan={ordem.length + 1} scope="colgroup" className={`${ROTULO} px-2 pb-1 pt-4 text-left font-medium`} style={{ color: "var(--tinta-3)" }}>
                    {ln.grupo}
                  </th>
                </tr>,
              );
            }
            linhasDaVez.push(
              <tr key={ln.id}>
                <th scope="row" className="p-0 text-left font-normal">
                  {ln.origem ? (
                    <button
                      type="button"
                      data-origem={ln.origem}
                      aria-pressed={ativaLinha}
                      className={`flex h-[34px] w-full items-center gap-2 rounded-l-[10px] px-2 text-left ${ativaLinha ? "linha-escolhida" : ""}`}
                      title="Ver no gráfico"
                    >
                      <RotuloLinha ln={ln} ativa={ativaLinha} />
                    </button>
                  ) : (
                    <span className="flex h-[34px] items-center gap-2 px-2">
                      <RotuloLinha ln={ln} ativa={false} />
                    </span>
                  )}
                </th>
                {ln.celulas.map((c, k) => {
                  const m = ordem[k];
                  const pintada = c.texto !== null && c.sentido !== "neutro";
                  return (
                    <td
                      key={m.id}
                      data-k={k}
                      data-l={l}
                      tabIndex={0}
                      className="h-[34px] px-[3px] py-[2px] text-center align-middle outline-offset-[-2px]"
                      aria-label={`${rotuloMandato(mandatos, m)}, ${ln.rotulo}: ${c.texto ?? "sem dado"}${pintada ? `, ${c.sentido === "bom" ? "melhor" : "pior"} que na posse` : ""}`}
                    >
                      {c.texto === null ? (
                        <span style={{ color: "var(--tinta-3)", opacity: 0.6 }}>—</span>
                      ) : (
                        // Chapada como os blocos do placar: a cor é o veredito.
                        <span
                          className="valor-mandato tabular"
                          data-veredito={pintada ? c.sentido : undefined}
                          style={
                            pintada
                              ? { background: corDoVeredito(c.sentido), color: "var(--placar-texto, #fff)" }
                              : { color: "var(--tinta-2)" }
                          }
                        >
                          <span className="font-semibold">
                            {c.texto}
                            {c.parcial ? <span style={{ opacity: 0.75 }}>*</span> : null}
                          </span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>,
            );
            return linhasDaVez;
          })}
        </tbody>
      </table>
    );
  }, [ordem, linhas, mandatos, governos, ativa, mandatoFixo, perfil]);

  return (
    <Bloco
      id="governo-a-governo"
      titulo="Governo a governo"
      contextoCompartilhamento=""
      mensagemCompartilhamento={mandatoFixo?`A economia no governo ${mandatos.find(m=>m.id===mandatoFixo)?.nomeCurto??""} (${mandatos.find(m=>m.id===mandatoFixo)?.inicio.slice(0,4)??""}) contra os outros: inflação, desemprego, dólar, dívida e mais, com a mesma régua. Compare:`:"A economia governo a governo: inflação, desemprego, dólar, dívida e mais, com a mesma régua. Compare:"}
      detalhe={
        uf
          ? `ritmo por ano · do país, mesmo com ${uf.sigla} escolhido: por estado os dados começam em 2021`
          : "cada governo contra o que recebeu na posse"
      }
      className={className}
      acao={<LegendaRegua />}
      lustroFixo
    >
      <div
        ref={caixa}
        className="relative"
        onPointerOver={(e) => acender(e.target)}
        onPointerLeave={apagar}
        onFocus={(e) => acender(e.target)}
        onBlur={(e) => {
          if (!caixa.current?.contains(e.relatedTarget as Node | null)) apagar();
        }}
        onClick={tocar}
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "thin" }}>
          <div
            className="grade-mandatos relative min-w-[980px]"
            style={{ "--rotulos": ROTULOS, "--n": ordem.length } as React.CSSProperties}
          >
            {kFixo >= 0 && <div aria-hidden className="faixa-mandato" data-fixa="" style={{ "--k": kFixo } as React.CSSProperties} />}
            <div ref={faixa} aria-hidden className="faixa-mandato" data-sob="" />
            {tabela}
          </div>
        </div>
        {dica && <DicaCelula dica={dica} linhas={linhas} ordem={ordem} mandatos={mandatos} />}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Cada célula é o último dado do mandato contra o que ele recebeu na posse, a régua do placar e do gráfico; PIB, PIB per capita e
        massa de renda dizem quanto cresceram no mandato. Contra o mundo, verde é o Brasil melhor que a média mundial. Juros ficam sem cor;
        dólar caindo é verde. O ritmo por ano e a posição entre os governos ficam no balão. * Mandato incompleto no dado. O desemprego da
        PNAD começa em 2012; o da OIT cobre todos. Estar no cargo não é ter causado o número.
      </p>
    </Bloco>
  );
}

/** A logo do partido ao lado do nome (duas quando o presidente trocou de partido no mandato); sem logo, a pílula. */
function LogosDoMandato({ governos, partido }: { governos: Governos; partido: string | null }) {
  return (
    <>
      {(partido ?? "")
        .split("/")
        .filter(Boolean)
        .map((p) => {
          const logo = logoDoPartido(p);
          return logo ? (
            <Image
              key={p}
              src={logo}
              alt={rotuloPartido(governos, p, true)}
              title={nomePartido(governos, p)}
              width={24}
              height={18}
              unoptimized
              data-logo-partido={p}
              className="h-[18px] w-6 object-contain"
            />
          ) : (
            <Pilula key={p} governos={governos} sigla={p} />
          );
        })}
    </>
  );
}

/** O balão da célula: o veredito por escrito, o ritmo com a posição e o que explica o dado. Chapado, sem vidro. */
function DicaCelula({
  dica,
  linhas,
  ordem,
  mandatos,
}: {
  dica: { k: number; l: number; x: number; y: number };
  linhas: LinhaGrade[];
  ordem: MandatoVisual[];
  mandatos: MandatoVisual[];
}) {
  const ln = linhas[dica.l];
  const c = ln.celulas[dica.k];
  const r = ln.posicao[dica.k];
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-30 w-max min-w-[11rem] max-w-[16rem] -translate-x-1/2 rounded-lg border px-3 py-2 text-[11.5px] leading-snug shadow-sm"
      style={{ left: dica.x, top: dica.y, background: "var(--superficie)", borderColor: "var(--borda)" }}
    >
      <span className="block font-semibold">
        {rotuloMandato(mandatos, ordem[dica.k])} · {ln.rotulo}
      </span>
      <span className="tabular block">
        {c.texto ?? "Sem dado"}
        {c.texto !== null && c.sentido !== "neutro" && ` · ${c.sentido === "bom" ? "melhor" : "pior"} que na posse`}
      </span>
      {c.leitura && <span className="block">{c.leitura}</span>}
      {c.ritmo !== null && (
        <span className="tabular mt-1 block" style={{ color: "var(--tinta-2)" }}>
          Ritmo: {comUnidade(c.ritmo, ln.unidadeRitmo)}
          {r !== null && ` · ${r + 1}º de ${ln.posicao.filter((x) => x !== null).length}`}
        </span>
      )}
      <span className="mt-1 block" style={{ color: "var(--tinta-2)" }}>
        {c.detalhe}
      </span>
    </div>
  );
}

function RotuloLinha({ ln, ativa }: { ln: LinhaGrade; ativa: boolean }) {
  return (
    <>
      <span className="min-w-0 truncate text-[12px] font-medium" style={{ fontWeight: ativa ? 650 : undefined }}>
        {ln.rotulo}
      </span>
      <span className="ml-auto shrink-0 text-[10px]" style={{ color: "var(--tinta-3)" }}>
        {ln.unidade.replace(" por ano", "/ano").replace("pontos", "pts").replace(", média anual", "")}
        {ln.direcao !== "neutro" && ln.n < ln.celulas.length ? ` · ${ln.n} gov.` : ""}
      </span>
    </>
  );
}

/** A chave da grade: as mesmas duas cores do placar. */
function LegendaRegua() {
  return (
    <span className="inline-flex items-center gap-3 text-[11px]" style={{ color: "var(--tinta-2)" }}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm" style={{ background: COR_BOM }} aria-hidden />
        melhor que na posse
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-3.5 rounded-sm" style={{ background: COR_RUIM }} aria-hidden />
        pior
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

const CURTO: Record<string, string> = {
  "Subutilização da força de trabalho": "Subutilização",
  "Inadimplência das famílias": "Inadimplência",
  "PIB por habitante": "PIB por hab.",
};
const curto = (l: Leitura) => l.tituloCurto ?? CURTO[l.titulo] ?? l.titulo;
const emPontos = (l: Leitura) => l.formato.startsWith("pct") || l.formato === "pp1";

/** O número em cima de cada classe da rampa: claro nas escuras, escuro nas claras (`--mapa-N-texto`, `--desmate-N-texto`). */
export const tintaNaClasse = (c: number | null, rampa = "mapa") => (c === null ? "var(--tinta-3)" : `var(--${rampa}-${c + 1}-texto)`);

/**
 * Os estados lado a lado em cada medida, em dois modos, como o mapa:
 *
 * - Desde a posse (o padrão): cada estado contra o que tinha na posse, num
 *   bloco chapado verde ou vermelho, a régua do placar e da grade. Bate o olho
 *   e vê onde melhorou e onde piorou.
 * - Hoje: o último dado, na rampa azul do mapa, para comparar os estados.
 *
 * A faixa no fim é a evolução da medida escolhida, com um traço na posse.
 */
export function Estados({
  dados,
  leituras = dados.leituras.economia,
  aoSelecionarUf,
  partidoFoco,
  sigla,
  className,
}: {
  dados: DadosPainel;
  /** As colunas; sem cor de veredito as que não têm lado (`direcao: "neutro"`). */
  leituras?: Leitura[];
  aoSelecionarUf: (sigla: string) => void;
  partidoFoco: string | null;
  /** O estado escolhido na sala, marcado em ouro entre os outros. */
  sigla: string | null;
  className: string;
}) {
  const [modo, setModo] = useEstadoCompartilhavel<"posse" | "hoje">("estados.modo", "posse", opcaoCompartilhada(["posse","hoje"]));
  const [ordem, setOrdem] = useEstadoCompartilhavel<{ id: string; desc: boolean }>("estados.ordem", { id: leituras[0]?.id ?? "", desc: true }, v=>!!v&&typeof v==="object"&&"id" in v&&leituras.some(l=>l.id===v.id)&&"desc" in v&&typeof v.desc==="boolean");
  const posse = modo === "posse";
  // Desde a posse, só as medidas que têm o dado da posse: uma coluna inteira
  // de "—" não diz nada. Em "Hoje" entram todas.
  const colunas = posse ? leituras.filter((l) => l.indiceRecebido !== null && l.periodos.length > 1) : leituras;
  const ativa = colunas.find((l) => l.id === ordem.id) ?? colunas[0];
  // A faixa da evolução usa a régua de todos os períodos, como o mapa; as
  // células comparam os estados no último dado, senão o desemprego de hoje
  // caía inteiro nas duas classes mais escuras.
  const reguas = useMemo(
    () => new Map(leituras.map((l) => [l.id, reguaDeCor(Object.values(l.ufs).flat(), l.escala, l.rampa ?? "mapa")])),
    [leituras],
  );
  const reguasHoje = useMemo(
    () =>
      new Map(
        leituras.map((l) => [l.id, reguaDeCor(Object.values(l.ufs).map((v) => v[l.periodos.length - 1] ?? null), l.escala, l.rampa ?? "mapa")]),
      ),
    [leituras],
  );
  const hoje = dados.hoje.slice(0, 10);
  if (!ativa) return null;

  const ultimo = (l: Leitura) => l.periodos.length - 1;
  // Desde a posse: o último dado contra o da posse, em pontos para taxas e
  // em % para reais, arredondado como aparece.
  const delta = (l: Leitura, s: (number | null)[] | undefined) => {
    if (l.indiceRecebido === null || l.periodos.length < 2) return null;
    const d = variacaoDesdeReferencia(s, l.indiceRecebido, ultimo(l), emPontos(l));
    return d === null ? null : Math.round(d * 10) / 10;
  };
  // O número que a célula mostra no modo escolhido; a ordem segue ele.
  const numeroDe = (l: Leitura, s: (number | null)[] | undefined) => (posse ? delta(l, s) : (s?.[ultimo(l)] ?? null));
  const linhas = [...dados.ufs].sort((a, b) => {
    const va = numeroDe(ativa, ativa.ufs[a.codigo]);
    const vb = numeroDe(ativa, ativa.ufs[b.codigo]);
    if (va === null) return 1;
    if (vb === null) return -1;
    return ordem.desc ? vb - va : va - vb;
  });
  const ordenar = (id: string) => setOrdem((o) => (o.id === id ? { id, desc: !o.desc } : { id, desc: true }));

  const celula = (l: Leitura, s: (number | null)[] | undefined) => {
    if (posse) {
      const d = delta(l, s);
      const sent = d === null ? "neutro" : sentido(d, l.direcao ?? "neutro");
      const pintada = sent !== "neutro";
      return (
        <td key={l.id} className="p-0">
          {/* Chapada como a grade e o placar: a cor é o veredito. */}
          <span
            className="tabular flex h-[22px] items-center justify-end rounded-[5px] px-1.5 text-[11.5px] font-semibold"
            style={
              d === null
                ? { color: "var(--tinta-3)" }
                : pintada
                  ? { background: corDoVeredito(sent), color: "var(--placar-texto, #fff)" }
                  : { background: "var(--faixa-a)", color: "var(--tinta-2)" }
            }
          >
            {d === null ? "—" : d === 0 ? "igual" : `${comSinal(d, 1)}${emPontos(l) ? " pts" : "%"}`}
          </span>
        </td>
      );
    }
    const v = s?.[ultimo(l)] ?? null;
    const r = reguasHoje.get(l.id)!;
    const c = r.classe(v);
    return (
      <td key={l.id} className="p-0">
        <span
          className="tabular flex h-[22px] items-center justify-end rounded-[5px] px-1.5 text-[11.5px] font-semibold"
          style={{ background: v === null ? "transparent" : r.cor(v), color: tintaNaClasse(c, r.rampa) }}
        >
          {v === null ? "—" : formatar(v, l.formato)}
        </span>
      </td>
    );
  };

  return (
    <Bloco
      id="estados"
      titulo="Estados"
      detalhe={posse ? "cada estado contra o que tinha na posse" : "último dado de cada medida"}
      className={className}
      acao={
        <Opcoes
          opcoes={[
            { id: "posse", rotulo: "Desde a posse" },
            { id: "hoje", rotulo: dados.foco.emCurso ? "Hoje" : "No fim" },
          ]}
          ativa={modo}
          aoEscolher={setModo}
          rotulo="O que a tabela mostra"
        />
      }
    >
      <div className="-mx-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <table className="tabela-estados w-full min-w-[760px] border-separate text-left text-[12px]" style={{ borderSpacing: "3px 2px" }}>
          <thead>
            <tr className="align-bottom">
              <th className="w-6 pb-1 text-[10px] font-normal" style={{ color: "var(--tinta-3)" }}>
                #
              </th>
              <th className="pb-1 font-normal">
                <span className="sr-only">Estado</span>
              </th>
              <th className="pb-1 text-left text-[10px] font-normal" style={{ color: "var(--tinta-3)" }}>
                {dados.foco.emCurso ? "Governo hoje" : "Governo no fim"}
              </th>
              {colunas.map((l) => {
                const aqui = l.id === ativa.id;
                return (
                  <th key={l.id} className="pb-1 text-right font-normal" aria-sort={aqui ? (ordem.desc ? "descending" : "ascending") : undefined}>
                    <button
                      type="button"
                      onClick={() => ordenar(l.id)}
                      className="ml-auto block rounded-md px-1 text-right hover:bg-[var(--faixa-a)]"
                      title={`${l.titulo}: ${l.descricao}`}
                    >
                      <span className="block text-[11.5px] leading-tight" style={{ color: aqui ? "var(--tinta)" : "var(--tinta-2)", fontWeight: aqui ? 650 : 500 }}>
                        {curto(l)} {aqui ? (ordem.desc ? "↓" : "↑") : ""}
                      </span>
                      <span className="tabular block text-[10px]" style={{ color: "var(--tinta-3)" }}>
                        {posse && l.indiceRecebido !== null ? `desde ${l.periodos[l.indiceRecebido].rotulo}` : l.periodos.at(-1)?.rotulo}
                      </span>
                    </button>
                  </th>
                );
              })}
              {ativa.periodos.length > 1 && (
                <th className="w-[22%] pb-1 text-left text-[10px] font-normal" style={{ color: "var(--tinta-3)" }}>
                  {curto(ativa)}, {ativa.periodos[0].rotulo} → {ativa.periodos.at(-1)!.rotulo}
                  <br />
                  traço: posse
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td />
              <th scope="row" className="pr-2 text-[12px] font-semibold">
                Brasil
              </th>
              <td />
              {colunas.map((l) => celula(l, l.brasil))}
              {ativa.periodos.length > 1 && (
                <td className="px-1">
                  <Evolucao l={ativa} regua={reguas.get(ativa.id)!} s={ativa.brasil} />
                </td>
              )}
            </tr>
            {linhas.map((u, k) => {
              const partido = governoEm(dados.governos, u.sigla, hoje)?.partido ?? null;
              const apagado = partidoFoco !== null && familiaDe(dados.governos, partido) !== partidoFoco;
              return (
                <tr
                  key={u.codigo}
                  className="cursor-pointer transition-opacity duration-200 [&:hover>*]:bg-[var(--faixa-a)]"
                  style={{ opacity: apagado ? 0.3 : 1 }}
                  data-escolhido={u.sigla === sigla || undefined}
                  onClick={() => aoSelecionarUf(u.sigla)}
                >
                  <td className="tabular rounded-l-md text-center text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                    {numeroDe(ativa, ativa.ufs[u.codigo]) === null ? "" : k + 1}
                  </td>
                  <th scope="row" className="whitespace-nowrap rounded-md pr-2 font-normal">
                    <button type="button" onClick={(e) => { e.stopPropagation(); aoSelecionarUf(u.sigla); }} className="text-left hover:underline" title={`Abrir ${u.nome} no mapa`}>
                      <span className="mr-1.5 text-[12px] font-semibold">{u.sigla}</span>
                      <span className="text-[11px]" style={{ color: "var(--tinta-2)" }}>
                        {u.nome}
                      </span>
                    </button>
                  </th>
                  <td className="rounded-md">
                    {partido !== null && <IdentidadePartido governos={dados.governos} sigla={partido} />}
                  </td>
                  {colunas.map((l) => celula(l, l.ufs[u.codigo]))}
                  {ativa.periodos.length > 1 && (
                    <td className="rounded-md px-1">
                      <Evolucao l={ativa} regua={reguas.get(ativa.id)!} s={ativa.ufs[u.codigo]} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Bloco>
  );
}

/** A medida período a período numa faixa só, na régua do mapa, com um traço na posse. */
function Evolucao({ l, regua, s }: { l: Leitura; regua: Regua; s: (number | null)[] | undefined }) {
  return (
    <svg viewBox={`0 0 ${l.periodos.length} 1`} preserveAspectRatio="none" className="block h-3.5 w-full overflow-hidden rounded-[3px]" aria-hidden>
      {l.periodos.map((p, i) => (
        <rect key={p.codigo} x={i} y={0} width={1.02} height={1} fill={regua.cor(s?.[i] ?? null)} />
      ))}
      {l.indicePosse !== null && <rect x={l.indicePosse - 0.06} y={0} width={0.12} height={1} fill="var(--tinta)" />}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Com um estado escolhido
// ---------------------------------------------------------------------------

/**
 * A posição do estado entre as UFs com dado no período, como a sala escreve:
 * "3º maior" ou "12º menor", pelo lado mais perto dele.
 */
function posicaoEntreUfs(l: Leitura, ufs: UF[], codigo: string, i: number): { texto: string; total: number } | null {
  const v = l.ufs[codigo]?.[i];
  if (v == null) return null;
  const vs = ufs.map((u) => l.ufs[u.codigo]?.[i]).filter((x): x is number => x != null && Number.isFinite(x));
  const maior = vs.filter((x) => x > v).length + 1;
  const menor = vs.filter((x) => x < v).length + 1;
  return { texto: maior <= menor ? `${maior}º maior` : `${menor}º menor`, total: vs.length };
}

/** O mês de cada período, para a faísca marcar a posse no mesmo lugar das séries nacionais. */
const mesesDe = (l: Leitura, hoje: string) => l.periodos.map((p) => diaDoPeriodo(p, hoje).slice(0, 7));

/**
 * "Brasil agora" com um estado escolhido: as medidas que existem por UF, com o
 * Brasil e a posição do estado ao lado. Inflação, juros, dólar e dívida só
 * existem para o país e ficam numa linha embaixo, que ainda abre o gráfico.
 */
function CotacoesEstado({
  encerrado,
  uf,
  ufs,
  leituras,
  series,
  hoje,
  ativa,
  serieAtiva,
  aoEscolherLeitura,
  aoEscolherSerie,
  className,
}: {
  uf: UF;
  ufs: UF[];
  leituras: Leitura[];
  series: SerieEconomia[];
  hoje: string;
  ativa: string | null;
  serieAtiva: string | null;
  aoEscolherLeitura: (id: string) => void;
  aoEscolherSerie: (id: string) => void;
  className: string;
  encerrado: boolean;
}) {
  return (
    <Bloco id="agora" titulo={`${uf.nome} ${encerrado ? "no fim do mandato" : "agora"}`} detalhe={`variação desde ${rotuloDoRecebido(leituras)} · Brasil e posição entre os 27`} className={className}>
      <div role="radiogroup" aria-label={`Medida ${uf.deNome} no gráfico`} className="-mx-1 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5">
        {leituras.map((l) => (
          <CotacaoEstado key={l.id} l={l} uf={uf} ufs={ufs} hoje={hoje} ativa={l.id === ativa} aoEscolher={() => aoEscolherLeitura(l.id)} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--borda)" }}>
        <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
          Só existem para o país:
        </span>
        {series.map((s) => {
          const u = ultimoDado(s)!;
          const escolhida = s.id === serieAtiva;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => aoEscolherSerie(s.id)}
              aria-pressed={escolhida}
              className={`rounded-md px-1.5 py-0.5 text-[11.5px] ${escolhida ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
              style={{ color: "var(--tinta-2)" }}
            >
              {s.rotulo}{" "}
              <strong className="tabular" style={{ color: "var(--tinta)" }}>
                {formatar(u.valor, s.formato)}
              </strong>
            </button>
          );
        })}
      </div>
    </Bloco>
  );
}

function CotacaoEstado({
  l,
  uf,
  ufs,
  hoje,
  ativa,
  aoEscolher,
}: {
  l: Leitura;
  uf: UF;
  ufs: UF[];
  hoje: string;
  ativa: boolean;
  aoEscolher: () => void;
}) {
  const p = l.periodos.length - 1;
  const s = l.ufs[uf.codigo] ?? [];
  const v = s[p] ?? null;
  const brasil = l.brasil[p] ?? null;
  const d = l.indiceRecebido !== null && p > 0 ? variacaoDesdeReferencia(s, l.indiceRecebido, p, emPontos(l)) : null;
  const sent = d === null ? "neutro" : sentido(Math.round(d * 10) / 10, l.direcao ?? "neutro");
  const cor = corDoSentido(sent);
  const posicao = posicaoEntreUfs(l, ufs, uf.codigo, p);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={ativa}
      onClick={aoEscolher}
      aria-label={`${l.titulo} ${uf.emNome}: ${formatar(v, l.formato)}; Brasil ${formatar(brasil, l.formato)}`}
      className={`min-w-0 rounded-2xl px-3 pb-2 pt-2.5 text-left transition-colors ${ativa ? "vidro-lente" : "hover:bg-[var(--faixa-a)]"}`}
    >
      <span className="block truncate text-[11.5px] font-medium" style={{ color: ativa ? "var(--tinta)" : "var(--tinta-2)" }}>
        {curto(l)}
      </span>
      <Numero texto={formatar(v, l.formato)} className="tabular mt-0.5 block text-[21px] font-bold leading-tight" />
      <span className="tabular block truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        {d !== null && Math.round(d * 10) !== 0 ? (
          <>
            <strong style={{ color: cor ?? "var(--tinta-2)" }}>{emPontos(l) ? `${comSinal(d, 1)} pts` : `${comSinal(d, 1)}%`}</strong>
            {sent !== "neutro" && <span style={{ color: cor }}> {sent === "bom" ? "melhor" : "pior"}</span>}
          </>
        ) : d !== null ? (
          "igual ao recebido"
        ) : (
          l.periodos[p]?.rotulo
        )}
      </span>
      <span className="mt-1.5 block">
        {l.periodos.length > 1 && <Faisca datas={mesesDe(l, hoje)} valores={s} altura={20} cor={cor ?? "var(--serie)"} />}
      </span>
      <span className="tabular mt-1 block truncate text-[10px]" style={{ color: "var(--tinta-3)" }}>
        Brasil {formatar(brasil, l.formato)}
        {posicao && ` · ${posicao.texto} de ${posicao.total}`}
      </span>
    </button>
  );
}

/** Marcas "redondas" de eixo: passo de 1, 2, 2,5 ou 5 vezes uma potência de dez. */
function marcasEixo(min: number, max: number, alvo = 4): number[] {
  const bruto = (max - min) / alvo || Math.abs(max) || 1;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((x) => x >= bruto) ?? bruto;
  const ini = Math.floor(min / passo) * passo;
  const lista: number[] = [];
  for (let v = ini; v <= max + passo * 0.999; v += passo) lista.push(Math.round(v * 1e6) / 1e6);
  return lista.length > 1 ? lista : [ini, ini + passo];
}

/**
 * A medida do estado ao longo do tempo, contra os outros: a linha dele em
 * azul, o Brasil tracejado e as outras 26 UFs em cinza bem claro por trás. As
 * faixas são os governadores, com o partido. Passar o ponteiro mostra o
 * período, os dois valores e a posição do estado entre as UFs.
 */
function GraficoEstado({ l, uf, ufs, governos, hoje, altura = 300 }: { l: Leitura; uf: UF; ufs: UF[]; governos: Governos; hoje: string; altura?: number }) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const n = l.periodos.length;
  const dias = l.periodos.map((p) => diaDoPeriodo(p, hoje));
  const serie = l.ufs[uf.codigo] ?? [];
  const outras = ufs.filter((u) => u.codigo !== uf.codigo).map((u) => l.ufs[u.codigo] ?? []);
  const todos = [...outras.flat(), ...serie, ...l.brasil].filter((v): v is number => v != null && Number.isFinite(v));
  if (n < 2 || todos.length < 2) {
    return (
      <p className="py-10 text-center text-[12px]" style={{ color: "var(--tinta-3)" }}>
        Esta medida tem um período só ({l.periodos[0]?.extenso}); não há linha no tempo.
      </p>
    );
  }

  const M = { topo: 26, dir: 92, base: 26, esq: 52 };
  const L = Math.max(10, largura - M.esq - M.dir);
  const A = altura - M.topo - M.base;
  const t0 = Date.parse(dias[0]);
  const t1 = Date.parse(dias[n - 1]);
  const xDia = (d: string) => M.esq + Math.min(1, Math.max(0, (Date.parse(d) - t0) / (t1 - t0 || 1))) * L;
  const x = (i: number) => xDia(dias[i]);
  const marcas = marcasEixo(Math.min(...todos), Math.max(...todos));
  const y0 = marcas[0];
  const y1 = marcas.at(-1)!;
  const y = (v: number) => M.topo + A - ((v - y0) / (y1 - y0 || 1)) * A;
  const caminho = (s: (number | null)[]) =>
    s.map((v, i) => (v == null ? "" : `${i === 0 || s[i - 1] == null ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");

  // Uma faixa por pessoa no cargo sem interrupção, dentro da janela da série.
  const faixas: { inicio: string; fim: string; nome: string; partidos: (string | null)[] }[] = [];
  for (const t of governos.ufs[uf.sigla] ?? []) {
    const fim = t.fim ?? hoje;
    if (fim <= dias[0] || t.inicio > dias[n - 1]) continue;
    const ultima = faixas.at(-1);
    if (ultima && ultima.nome === t.nome && ultima.fim === t.inicio) {
      ultima.fim = fim;
      if (ultima.partidos.at(-1) !== t.partido) ultima.partidos.push(t.partido);
    } else {
      faixas.push({ inicio: t.inicio, fim, nome: t.nome, partidos: [t.partido] });
    }
  }

  const ultimo = serie.reduce<number>((k, v, i) => (v != null ? i : k), -1);
  const anos: number[] = [];
  for (let a = Number(dias[0].slice(0, 4)) + 1; `${a}-01-01` <= dias[n - 1]; a++) anos.push(a);

  // Os rótulos do fim não podem encavalar: o do Brasil desce ou sobe.
  const yEstado = ultimo >= 0 ? y(serie[ultimo]!) : null;
  const vBrasil = l.brasil[n - 1];
  let yBrasil = vBrasil != null ? y(vBrasil) : null;
  if (yEstado !== null && yBrasil !== null && Math.abs(yBrasil - yEstado) < 14) yBrasil = yEstado + (yBrasil >= yEstado ? 14 : -14);

  const mover = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let melhor = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(melhor) - px)) melhor = i;
    setFoco(melhor);
  };
  const pf = foco === null ? null : posicaoEntreUfs(l, ufs, uf.codigo, foco);

  return (
    <div ref={ref} className="relative">
      {largura > 0 && (
        <svg
          width={largura}
          height={altura}
          className="block touch-none"
          role="img"
          aria-label={`${l.titulo} ${uf.emNome}, no Brasil e nas outras UFs, de ${l.periodos[0].extenso} a ${l.periodos[n - 1].extenso}`}
          onPointerMove={mover}
          onPointerLeave={() => setFoco(null)}
        >
          {faixas.map((f, k) => {
            const a = Math.max(M.esq, xDia(f.inicio));
            const b = Math.min(M.esq + L, xDia(f.fim));
            const rotulo = `${f.nome} · ${f.partidos.map((p) => rotuloPartido(governos, p, true)).join(" → ")}`;
            return (
              <g key={f.inicio}>
                <title>{`${f.nome} (${f.partidos.map((p) => rotuloPartido(governos, p)).join(", depois ")}): ${mesAno(f.inicio)} a ${f.fim >= hoje ? "hoje" : mesAno(f.fim)}`}</title>
                <rect x={a} y={M.topo} width={Math.max(0, b - a)} height={A} fill={k % 2 ? "var(--faixa-a)" : "transparent"} />
                {a > M.esq + 1 && <line x1={a} x2={a} y1={M.topo - 18} y2={M.topo + A} stroke="var(--grade)" />}
                {b - a > larguraTexto(rotulo, 11) + 12 && (
                  <text x={a + 6} y={M.topo - 9} fill="var(--tinta-2)" style={{ fontSize: 11 }}>
                    {rotulo}
                  </text>
                )}
              </g>
            );
          })}
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.esq} x2={M.esq + L} y1={y(m)} y2={y(m)} stroke="var(--grade)" strokeOpacity={0.7} />
              <text x={M.esq - 8} y={y(m)} textAnchor="end" dominantBaseline="central" fill="var(--tinta-3)" className="tabular" style={{ fontSize: 11 }}>
                {formatar(m, l.formato)}
              </text>
            </g>
          ))}
          {anos.map((a) => (
            <text key={a} x={xDia(`${a}-01-01`)} y={M.topo + A + 17} textAnchor="middle" fill="var(--tinta-3)" className="tabular" style={{ fontSize: 11 }}>
              {a}
            </text>
          ))}
          {outras.map((s, k) => (
            <path key={k} d={caminho(s)} fill="none" stroke="var(--tinta-3)" strokeOpacity={0.18} strokeWidth={1} />
          ))}
          <path d={caminho(l.brasil)} fill="none" stroke="var(--tinta-2)" strokeWidth={1.6} strokeDasharray="4 3" />
          <path d={caminho(serie)} fill="none" stroke="var(--serie)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {yEstado !== null && (
            <>
              <circle cx={x(ultimo)} cy={yEstado} r={3.5} fill="var(--serie)" stroke="var(--superficie)" strokeWidth={1.5} />
              <text x={x(ultimo) + 9} y={yEstado} dominantBaseline="central" fill="var(--tinta)" className="tabular" style={{ fontSize: 12, fontWeight: 650 }}>
                {uf.sigla} {formatar(serie[ultimo], l.formato)}
              </text>
            </>
          )}
          {yBrasil !== null && (
            <text x={M.esq + L + 9} y={yBrasil} dominantBaseline="central" fill="var(--tinta-3)" className="tabular" style={{ fontSize: 11.5 }}>
              Brasil {formatar(vBrasil, l.formato)}
            </text>
          )}
          {foco !== null && (
            <g pointerEvents="none">
              <line x1={x(foco)} x2={x(foco)} y1={M.topo} y2={M.topo + A} stroke="var(--tinta-3)" strokeOpacity={0.6} />
              {l.brasil[foco] != null && <circle cx={x(foco)} cy={y(l.brasil[foco]!)} r={3} fill="var(--superficie)" stroke="var(--tinta-2)" strokeWidth={1.5} />}
              {serie[foco] != null && <circle cx={x(foco)} cy={y(serie[foco]!)} r={4} fill="var(--serie)" stroke="var(--superficie)" strokeWidth={1.5} />}
            </g>
          )}
        </svg>
      )}
      {foco !== null && (
        <div
          role="status"
          className="vidro pointer-events-none absolute z-10 rounded-xl px-3 py-2 text-[11.5px] leading-snug"
          style={{ left: Math.min(x(foco) + 12, largura - 190), top: M.topo }}
        >
          <span className="block font-semibold">{l.periodos[foco].extenso}</span>
          <span className="tabular flex justify-between gap-4">
            <span>{uf.sigla}</span>
            <strong>{formatar(serie[foco], l.formato)}</strong>
          </span>
          <span className="tabular flex justify-between gap-4" style={{ color: "var(--tinta-2)" }}>
            <span>Brasil</span>
            <span>{formatar(l.brasil[foco], l.formato)}</span>
          </span>
          {pf && (
            <span className="mt-0.5 block" style={{ color: "var(--tinta-3)" }}>
              {pf.texto} entre {pf.total} UFs
            </span>
          )}
        </div>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--tinta-3)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-[2.5px] w-4 rounded-full" style={{ background: "var(--serie)" }} />
          {uf.nome}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-[1.5px] border-dashed" style={{ borderColor: "var(--tinta-2)" }} />
          Brasil
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-px w-4" style={{ background: "var(--tinta-3)", opacity: 0.4 }} />
          as outras {ufs.length - 1} UFs
        </span>
        <span>faixas: quem governava {uf.deNome}</span>
      </p>
    </div>
  );
}

/**
 * As UFs no último dado, da maior para a menor: o estado escolhido em ouro, o
 * Brasil tracejado. Barras a partir do zero, como manda barra. Tocar numa
 * barra troca de estado.
 */
function RankingUfs({ l, uf, ufs, i, aoSelecionarUf }: { l: Leitura; uf: UF; ufs: UF[]; i: number; aoSelecionarUf: (sigla: string) => void }) {
  const linhas = ufs
    .flatMap((u) => {
      const v = l.ufs[u.codigo]?.[i];
      return v == null ? [] : [{ u, v }];
    })
    .sort((a, b) => b.v - a.v);
  if (linhas.length < 2) return null;
  const br = l.brasil[i] ?? null;
  const max = Math.max(...linhas.map((x) => x.v), br ?? 0) || 1;
  const altura = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  return (
    <figure className="mt-3 border-t pt-3" style={{ borderColor: "var(--borda)" }}>
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 text-[11px]" style={{ color: "var(--tinta-3)" }}>
        <span>
          Entre as {linhas.length} UFs · {l.periodos[i].rotulo}, da maior para a menor
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="w-4 border-t-[1.5px] border-dashed" style={{ borderColor: "var(--tinta-2)" }} />
          Brasil {formatar(br, l.formato)}
        </span>
      </figcaption>
      <div className="relative flex h-24 items-end gap-[3px]">
        {br !== null && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-[1.5px] border-dashed" style={{ bottom: altura(br), borderColor: "var(--tinta-2)" }} />
        )}
        {linhas.map(({ u, v }) => {
          const esse = u.codigo === uf.codigo;
          return (
            <button
              key={u.codigo}
              type="button"
              onClick={() => aoSelecionarUf(u.sigla)}
              title={`${u.nome}: ${formatar(v, l.formato)}`}
              aria-label={`${u.nome}: ${formatar(v, l.formato)}${esse ? " (escolhido)" : ". Abrir no mapa"}`}
              aria-current={esse || undefined}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              <span
                className="block w-full rounded-t-[4px] transition-colors group-hover:opacity-80"
                style={{ height: altura(v), background: esse ? "var(--ouro)" : "color-mix(in srgb, var(--serie) 26%, transparent)" }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px]" aria-hidden>
        {linhas.map(({ u }) => {
          const esse = u.codigo === uf.codigo;
          return (
            <span
              key={u.codigo}
              className="min-w-0 flex-1 text-center text-[9px] leading-none"
              style={{ color: esse ? "var(--tinta)" : "var(--tinta-3)", fontWeight: esse ? 700 : 400 }}
            >
              {u.sigla}
            </span>
          );
        })}
      </div>
    </figure>
  );
}

/** O gráfico grande com um estado escolhido: a medida dele contra o Brasil e as outras UFs. */
function HistoricoEstado({
  id,
  l,
  uf,
  dados,
  aoSelecionarUf,
  className,
}: {
  id: string;
  l: Leitura;
  uf: UF;
  dados: DadosPainel;
  aoSelecionarUf: (sigla: string) => void;
  className: string;
}) {
  const hoje = dados.hoje.slice(0, 10);
  const s = l.ufs[uf.codigo] ?? [];
  const presentes = s.flatMap((v, i) => (v == null ? [] : [{ i, v }]));
  const menor = presentes.reduce((a, b) => (b.v < a.v ? b : a), presentes[0]);
  const maior = presentes.reduce((a, b) => (b.v > a.v ? b : a), presentes[0]);
  const ultimo = presentes.at(-1);
  const posicao = ultimo ? posicaoEntreUfs(l, dados.ufs, uf.codigo, ultimo.i) : null;
  const numeros: [string, string, string | null][] = [
    ["Último", formatar(ultimo?.v, l.formato), ultimo ? l.periodos[ultimo.i].rotulo : null],
    ["Brasil", formatar(ultimo ? l.brasil[ultimo.i] : null, l.formato), posicao ? `${uf.sigla}: ${posicao.texto} de ${posicao.total}` : null],
    ["Mínimo", formatar(menor?.v, l.formato), menor ? l.periodos[menor.i].rotulo : null],
    ["Máximo", formatar(maior?.v, l.formato), maior ? l.periodos[maior.i].rotulo : null],
  ];
  return (
    <Bloco id={id} titulo={`${curto(l)} ${uf.emNome}`} detalhe={l.fonte} className={className} contextoCompartilhamento="" mensagemCompartilhamento={fraseDaLeitura(l, uf, ultimo?.i ?? l.periodos.length - 1, dados.economia.mandatos.find((m) => m.id === dados.foco.id)?.nomeCurto, posicao ? `${posicao.texto} entre ${posicao.total} UFs` : "")}>
      <GraficoEstado l={l} uf={uf} ufs={dados.ufs} governos={dados.governos} hoje={hoje} />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-4" style={{ borderColor: "var(--borda)" }}>
        {numeros.map(([rotulo, valor, quando]) => (
          <div key={rotulo} className="min-w-0">
            <dt className={ROTULO} style={{ color: "var(--tinta-3)" }}>
              {rotulo}
            </dt>
            <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <Numero texto={valor} className="tabular text-base font-bold" />
              {quando && (
                <span className="tabular text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                  {quando}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {ultimo && <RankingUfs l={l} uf={uf} ufs={dados.ufs} i={ultimo.i} aoSelecionarUf={aoSelecionarUf} />}
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[10.5px]" style={{ borderColor: "var(--borda)", color: "var(--tinta-3)" }}>
        <span>{l.descricao}</span>
        {l.calculo && <span>{`${l.calculo[0].toUpperCase()}${l.calculo.slice(1)}.`}</span>}
        <span>Estar no cargo não é ter causado o número.</span>
        {l.fonteUrl && (
          <a href={l.fonteUrl} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--serie)" }}>
            {l.fonte} ↗
          </a>
        )}
        <button type="button" onClick={() => baixar(`${l.id}-por-estado.csv`, csvLeitura(l, dados))} className="hover:underline" style={{ color: "var(--serie)" }}>
          Baixar a medida por estado (CSV)
        </button>
      </p>
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// Últimos dados, o mundo hoje e as fontes
// ---------------------------------------------------------------------------

/** Quantos estados cada partido governa hoje. Passar o ponteiro acende os estados dele na tabela. */
function Governadores({
  dados,
  foco,
  setFoco,
  sigla,
}: {
  dados: DadosPainel;
  foco: string | null;
  setFoco: (f: string | null) => void;
  sigla: string | null;
}) {
  const g = dados.governos;
  const hoje = dados.hoje.slice(0, 10);
  const grupos = new Map<string, { sigla: string | null; ufs: string[] }>();
  for (const u of dados.ufs) {
    const p = governoEm(g, u.sigla, hoje)?.partido ?? null;
    const f = familiaDe(g, p);
    const x = grupos.get(f) ?? { sigla: p, ufs: [] };
    x.ufs.push(u.sigla);
    grupos.set(f, x);
  }
  const lista = [...grupos.entries()].sort((a, b) => b[1].ufs.length - a[1].ufs.length);
  const max = lista[0]?.[1].ufs.length ?? 1;
  const presidente = presidenteEm(g, hoje);
  const doPresidente = presidente?.partido ? grupos.get(familiaDe(g, presidente.partido))?.ufs.length ?? 0 : 0;
  return (
    <Bloco
      titulo="Governadores por partido"
      detalhe="hoje"
    >
      <ul onPointerLeave={() => setFoco(null)}>
        {lista.map(([f, x]) => (
          <li key={f}>
            <button
              type="button"
              onPointerEnter={() => setFoco(f)}
              onFocus={() => setFoco(f)}
              onBlur={() => setFoco(null)}
              onClick={() => setFoco(foco === f ? null : f)}
              aria-pressed={foco === f}
              className={`grid w-full grid-cols-[6.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-opacity duration-200 ${sigla && x.ufs.includes(sigla) ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
              style={{ opacity: foco !== null && foco !== f ? 0.4 : 1 }}
            >
              <span className="min-w-0">
                <IdentidadePartido governos={g} sigla={x.sigla} />
              </span>
              <span className="min-w-0">
                <span
                  className="block h-2 rounded-full"
                  style={{
                    width: `${(x.ufs.length / max) * 100}%`,
                    background: semCorDePartido(x.sigla) ? "var(--grade)" : corDoPartido(g, x.sigla),
                  }}
                />
                <span className="mt-0.5 block truncate text-[10px]" style={{ color: "var(--tinta-3)" }}>
                  {x.ufs.map((s, i) => (
                    <span key={s} style={s === sigla ? { color: "var(--tinta)", fontWeight: 700 } : undefined}>
                      {i ? " " : ""}
                      {s}
                    </span>
                  ))}
                </span>
              </span>
              <span className="tabular text-right text-[13px] font-semibold">{x.ufs.length}</span>
            </button>
          </li>
        ))}
      </ul>
      {presidente?.partido && presidente.partido !== "SEM" && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2 text-[11px]" style={{ borderColor: "var(--borda)", color: "var(--tinta-2)" }}>
          Presidente <strong style={{ color: "var(--tinta)" }}>{presidente.curto}</strong>
          <Pilula governos={g} sigla={presidente.partido} />· {doPresidente} {doPresidente === 1 ? "governador" : "governadores"} do mesmo partido
        </p>
      )}
    </Bloco>
  );
}

function UltimosDados({
  dados,
  series,
  aoEscolher,
  className = "",
}: {
  dados: DadosPainel;
  series: SerieEconomia[];
  aoEscolher: (id: string) => void;
  className?: string;
}) {
  const lista = [...dados.novidades].sort((a, b) => b.registradoEm.localeCompare(a.registradoEm)).slice(0, 8);
  return (
    <Bloco titulo="Últimos dados" detalhe="30 dias" className={className}>
      {lista.length ? (
        <ul>
          {lista.map((n) => {
            const s = series.find((x) => x.origem === n.serieId);
            return (
              <li key={`${n.serieId}-${n.data}`} className="border-b last:border-b-0" style={{ borderColor: "var(--borda)" }}>
                <button
                  type="button"
                  disabled={!s}
                  onClick={() => s && aoEscolher(s.id)}
                  className="flex w-full items-baseline gap-3 rounded-md px-1 py-1.5 text-left enabled:hover:bg-[var(--faixa-a)]"
                >
                  <span className="tabular w-11 shrink-0 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                    {dia(n.registradoEm).slice(0, 5)}
                  </span>
                  <span className="min-w-0 text-[12px] leading-snug">{n.texto}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px]" style={{ color: "var(--tinta-2)" }}>
          Nenhum dado novo nos últimos 30 dias.
        </p>
      )}
    </Bloco>
  );
}

/** O período que o governo recebeu, na primeira medida que o tem: "4º tri 22". */
const rotuloDoRecebido = (leituras: Leitura[]) => {
  const l = leituras.find((x) => x.indiceRecebido !== null);
  return l ? l.periodos[l.indiceRecebido!].rotulo : "a posse";
};

function MundoHoje({ benchmark, inicio, className = "" }: { benchmark: Benchmark[]; inicio: number; className?: string }) {
  const anos = Math.max(0, ...benchmark.map((x) => x.nAnos));
  return (
    <Bloco
      titulo="Brasil e o mundo"
      detalhe={`média de ${inicio} a ${inicio - 1 + anos} · World Bank`}
      className={`flex flex-col ${className}`}
      corpo="flex flex-1 flex-col"
    >
      <div className="grid flex-1 content-around gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
        {MUNDO.map((ind) => {
          const linhas = REGIOES.flatMap(([r, nome]) => {
            const x = benchmark.find((b) => b.indicadorWb === ind.id && b.regiao === r);
            return x ? [{ r, nome, v: x.mediaPeriodo }] : [];
          });
          const max = Math.max(...linhas.map((l) => Math.abs(l.v ?? 0)), 0.1);
          // Contra o mundo, a régua da grade: verde é o Brasil melhor que a média mundial.
          const br = linhas.find((l) => l.r === "BRA")?.v ?? null;
          const wld = linhas.find((l) => l.r === "WLD")?.v ?? null;
          const d = br !== null && wld !== null ? Math.round((br - wld) * 10) / 10 : null;
          return (
            <div key={ind.id} className="min-w-0">
              <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-[12px] font-semibold">
                {ind.rotulo}
                {d !== null && (
                  <span className="flex items-baseline gap-1.5 text-[10.5px] font-normal" style={{ color: "var(--tinta-3)" }}>
                    <PilulaVeredito texto={d === 0 ? "igual" : `${comSinal(d, 1)} pts`} sentido={sentido(d, ind.direcao)} />
                    contra o mundo
                  </span>
                )}
              </p>
              <ul className="mt-1 space-y-1">
                {linhas.map((l) => (
                  <li key={l.r} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.6rem] items-center gap-2 text-[11px]">
                    <span className="truncate" style={{ fontWeight: l.r === "BRA" ? 650 : 400, color: l.r === "BRA" ? "var(--tinta)" : "var(--tinta-2)" }}>
                      {l.r === "BRA" ? "Brasil" : l.r === "LCN" ? "Am. Latina" : l.r === "MIC" ? "Renda média" : "Mundo"}
                    </span>
                    <span className="h-1.5 rounded-full" style={{ background: "var(--grade)" }}>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(Math.abs(l.v ?? 0) / max) * 100}%`, background: l.r === "BRA" ? "var(--serie)" : "var(--tinta-3)" }}
                      />
                    </span>
                    <span className="tabular text-right font-semibold">{l.v === null ? "—" : `${numero(l.v, 1)}%`}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Bloco>
  );
}

export function Fontes({
  dados,
  series,
  leituras = dados.leituras.economia,
  className,
}: {
  dados: DadosPainel;
  series: SerieEconomia[];
  leituras?: Leitura[];
  className: string;
}) {
  const { mandatos } = dados.economia;
  const itens = [
    ...series.map((s) => ({
      id: `serie-${s.id}`,
      nome: s.rotulo,
      fonte: s.fonte,
      url: s.fonteUrl,
      trecho: `${s.cobertura.inicio ? referencia(s, s.cobertura.inicio) : "—"} a ${s.cobertura.fim ? referencia(s, s.cobertura.fim) : "—"}`,
      coleta: s.coletadoEm,
      csv: () => baixar(`${s.id}.csv`, csvSerie(s, s.datas, s.valores, mandatos)),
    })),
    ...leituras.map((l) => ({
      id: `estados-${l.id}`,
      nome: `${l.titulo}, por estado`,
      fonte: l.fonte,
      url: l.fonteUrl,
      trecho: l.periodos.length > 1 ? `${l.periodos[0].rotulo} a ${l.periodos.at(-1)!.rotulo}` : l.periodos[0]?.rotulo ?? "—",
      coleta: l.coletadoEm ?? null,
      csv: () => baixar(`${l.id}-por-estado.csv`, csvLeitura(l, dados)),
    })),
  ];
  return (
    <Bloco
      id="fontes"
      titulo="Fontes e dados"
      detalhe="CSV com fonte e data de coleta"
      className={className}
      acao={
        <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
          Ponto e vírgula, vírgula decimal ·{" "}
          <Link href="/metodologia" className="hover:underline" style={{ color: "var(--serie)" }}>
            metodologia
          </Link>
          .
        </span>
      }
    >
      <ul className="grid min-w-0 grid-cols-1 gap-x-6 md:grid-cols-2">
        {itens.map((x) => (
          <li key={x.id} className="flex items-center gap-3 border-b py-1.5" style={{ borderColor: "var(--borda)" }}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium">{x.nome}</span>
              <span className="tabular block truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                {x.url ? (
                  <a href={x.url} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--serie)" }}>
                    {x.fonte} ↗
                  </a>
                ) : (
                  x.fonte
                )}{" "}
                · {x.trecho} · coleta {dia(x.coleta)}
              </span>
            </span>
            <button
              type="button"
              onClick={x.csv}
              className="vidro-lente shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              aria-label={`Baixar ${x.nome} em CSV`}
            >
              CSV
            </button>
          </li>
        ))}
      </ul>
    </Bloco>
  );
}
