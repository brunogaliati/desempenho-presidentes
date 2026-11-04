"use client";
import { opcaoCompartilhada } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { useMemo, useState } from "react";

import { COR_BOM, COR_RUIM, corDoVeredito } from "@/components/GraficoTempo";
import { Retrato } from "@/components/Retrato";
import { comSinal, numero, rotuloMandato, sentido, type Sentido } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";

import { cartaoDaSerie, RAMPA_DA_LENTE, textoVariacao, type Lente, type MunicipiosAmbiente } from "../_dados/ambienteMunicipal";
import { ritmoNoMandato } from "../_dados/mandatoRecorte";
import { criarCsv } from "../_dados/economiaModelo";
import type { DadosPainel, FocoMandato, MandatoVisual, MunicipioNacional, SerieEconomia } from "../_dados/tipos";
import { Bloco, Opcoes } from "./Bloco";
import { formatar, mandatosNaSerie, mudanca, recebido, referencia, reguaDeCor, tendencia, titulo, ultimoDado } from "./formatos";
import { NavTerminal } from "./NavTerminal";
import { Numero } from "./PainelEconomia";
import { PilulaVeredito, type ItemPlacar } from "./Placar";
import { linhaDaMedida, placarDoBioma, placarDoBrasilInteiro, type LinhaTerritorio, type PlacarAmbiente } from "./placarAmbiente";
import { Cotacoes, EsteGoverno, Estados, Fontes, Historico, tintaNaClasse, type Ritmo } from "./TerminalEconomia";

/**
 * O meio ambiente em detalhe: o mesmo vidro e a mesma régua do terminal da
 * economia, com os gráficos que este tema pede.
 *
 * - Brasil agora: as dez séries nacionais, com a fiscalização em cinza.
 * - Histórico da série escolhida e o ritmo no mandato, com as mesmas séries do
 *   "Brasil agora": a seleção é uma só nos três, como na economia.
 * - Os biomas lado a lado, no molde da tabela dos estados. O número abre no gráfico e
 *   acende o cartão; o cartão acende os biomas dele; o nome abre o bioma no mapa.
 * - O desmatamento desde 1988, uma barra por ano PRODES, cada governo numa cor
 *   contra o que recebeu: o gráfico clássico do tema.
 * - A temporada do fogo: o acumulado do ano contra os anos anteriores.
 * - As áreas protegidas: Terras Indígenas e Unidades de Conservação.
 * - Os municípios que mais desmatam, com o que o Ibama fez neles.
 * - Os estados e as fontes, com CSV.
 */

const SECOES = [
  { id: "agora", rotulo: "Agora" },
  { id: "de-perto", rotulo: "Histórico" },
  { id: "biomas", rotulo: "Biomas" },
  { id: "desmatamento", rotulo: "Desde 1988" },
  { id: "temporada", rotulo: "Temporada do fogo" },
  { id: "protegidas", rotulo: "Áreas protegidas" },
  { id: "municipios", rotulo: "Municípios" },
  { id: "estados", rotulo: "Estados" },
  { id: "fontes", rotulo: "Fontes" },
];

const NOME_BIOMA: Record<string, string> = {
  amazonia: "Amazônia",
  cerrado: "Cerrado",
  caatinga: "Caatinga",
  mata_atlantica: "Mata Atlântica",
  pampa: "Pampa",
  pantanal: "Pantanal",
};

interface Props {
  dados: DadosPainel;
  /** A série no gráfico, escolhida aqui ou no placar da sala. */
  foco: string | undefined;
  setFoco: (id: string) => void;
  placar: PlacarAmbiente;
  sigla: string | null;
  /** O governo atual inteiro: as barras por governo comparam todos, com o escolhido em destaque. */
  atual: DadosPainel;
  /** O bioma escolhido na sala: a lista de municípios acompanha. */
  bioma: string | null;
  formas: MunicipioNacional[] | null;
  municipal: MunicipiosAmbiente | null;
  aoSelecionarUf: (sigla: string) => void;
  aoSelecionarBioma: (id: string | null) => void;
  aoSelecionarMunicipio: (codigo: string) => void;
  /** Põe a série no gráfico e desce até ele. */
  aoVerSerie: (id: string) => void;
}

export function TerminalAmbiente({ dados, atual, foco, setFoco, placar, sigla, bioma, formas, municipal, aoSelecionarUf, aoSelecionarBioma, aoSelecionarMunicipio, aoVerSerie }: Props) {
  const { series, porBioma, fiscalizacao, focosMensais, focosParcial, protegidas } = dados.ambiente;
  const { mandatos } = dados.economia;
  const [faixa, setFaixa] = useEstadoCompartilhavel<"mandato" | "tudo">("faixa", "mandato", opcaoCompartilhada(["mandato","tudo"]));

  // Os biomas também abrem no gráfico de cima.
  const comFontes = useMemo(
    () => [...series, ...[protegidas?.ti ?? null, protegidas?.uc ?? null, ...porBioma.flatMap((b) => [b.prodes, b.focos])].filter((x): x is SerieEconomia => x !== null)],
    [series, porBioma, protegidas],
  );
  // O placar do bioma também abre as áreas protegidas dele no gráfico; essas não vão à lista de fontes.
  const todas = useMemo(
    () => [...comFontes, ...Object.values(protegidas?.porBioma ?? {}).flatMap((b) => [b.ti, b.uc]).filter((x): x is SerieEconomia => x !== null)],
    [comFontes, protegidas],
  );
  // O placar é a fonte das cores: o "Brasil agora" e o gráfico pintam o mandato em curso com o veredito dele.
  const porId = useMemo(
    () => new Map<string, ItemPlacar>([...placar.grupos.flatMap((g) => g.itens), ...placar.fileiras.flatMap((f) => f.itens)].filter((x) => !x.falta).map((x) => [x.id, x])),
    [placar],
  );
  const medidasPorUf = useMemo(() => [...dados.leituras.ambiente, ...fiscalizacao], [dados.leituras.ambiente, fiscalizacao]);

  const s = todas.find((x) => x.id === foco) ?? series[0];
  if (!s) return null;
  const hoje = dados.hoje.slice(0, 10);

  return (
    <section className="terminal-tema relative -mx-3" aria-label="O meio ambiente em detalhe">
      <NavTerminal secoes={SECOES} rotulo="Seções do meio ambiente" />
      <div className="relative mx-auto grid max-w-[1680px] grid-cols-12 gap-3 px-3 pb-8 pt-6 lg:px-5">
        <Cotacoes
          className="col-span-12"
          series={series}
          doPlacar={porId}
          ativa={cartaoDaSerie(s.id)}
          aoEscolher={setFoco}
          encerrado={!dados.foco.emCurso}
          detalhe="o último dado contra o que o governo recebeu na posse · a fiscalização fica sem cor · toque para ver o gráfico"
        />

        <Historico
          id="de-perto"
          className="col-span-12 xl:col-span-8"
          s={s}
          mandatos={mandatos}
          mandatoFoco={null}
          faixa={faixa}
          setFaixa={setFaixa}
          item={porId.get(s.id)}
          expectativas={[]}
          hoje={hoje}
        />
        <EsteGoverno
          className="col-span-12 xl:col-span-4"
          ritmos={ritmosDoAmbiente(series, porId, s.id, setFoco)}
          detalhe="% por ano, em média"
          referencia="24 meses antes da posse"
          colunaReferencia="antes"
        />

        <Biomas className="col-span-12" dados={dados} municipal={municipal} foco={s.id} bioma={bioma} aoVerSerie={aoVerSerie} aoSelecionarBioma={aoSelecionarBioma} />

        <BarrasDesmatamento className="col-span-12" dados={atual} mandatos={atual.economia.mandatos} foco={dados.foco} />

        {focosMensais && (
          <TemporadaFogo className="col-span-12 xl:col-span-7" meses={focosMensais.meses} valores={focosMensais.brasil} parcial={focosParcial} anoRecebido={dados.foco.anoRecebido} />
        )}
        {protegidas && <AreasProtegidas key={dados.foco.id} className="col-span-12 xl:col-span-5" p={protegidas} anoRecebido={dados.foco.anoRecebido} />}

        {formas && municipal && municipal.anos.length > 0 && (
          <MunicipiosContraIbama className="col-span-12" formas={formas} municipal={municipal} bioma={bioma} aoSelecionar={aoSelecionarMunicipio} />
        )}

        <Estados className="col-span-12" dados={dados} leituras={medidasPorUf} aoSelecionarUf={aoSelecionarUf} partidoFoco={null} sigla={sigla} />

        <Fontes className="col-span-12" dados={dados} series={comFontes} leituras={medidasPorUf} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// O ritmo e os biomas
// ---------------------------------------------------------------------------

/** Cada cartão do "Brasil agora" no painel do ritmo: agrupado por tema, o nome pode ser curto. */
const RITMO_DA_SERIE: Record<string, { grupo: string; rotulo: string }> = {
  prodes_amazonia: { grupo: "Desmatamento", rotulo: "Amazônia" },
  prodes_cerrado: { grupo: "Desmatamento", rotulo: "Cerrado" },
  prodes_outros: { grupo: "Desmatamento", rotulo: "Outros biomas" },
  alertas_amazonia_12m: { grupo: "Alertas", rotulo: "Amazônia" },
  alertas_cerrado_12m: { grupo: "Alertas", rotulo: "Cerrado" },
  focos_12m: { grupo: "Fogo", rotulo: "Focos" },
  cicatriz_12m: { grupo: "Fogo", rotulo: "Área queimada" },
  autos_12m: { grupo: "Fiscalização", rotulo: "Autos" },
  multas_12m: { grupo: "Fiscalização", rotulo: "Multas" },
  embargos_12m: { grupo: "Fiscalização", rotulo: "Embargos" },
};

/**
 * As mesmas séries do "Brasil agora", no painel do ritmo da economia: a seleção é uma
 * só. A cor é o veredito do placar, não o sinal do ritmo, para nunca discordar dele.
 */
function ritmosDoAmbiente(series: SerieEconomia[], porId: Map<string, ItemPlacar>, foco: string, aoEscolher: (id: string) => void): Ritmo[] {
  const cartao = cartaoDaSerie(foco);
  return series.flatMap((s) => {
    const ui = RITMO_DA_SERIE[s.id];
    const r = ui ? ritmoNoMandato(s.datas, s.valores, s.posse) : null;
    if (!ui || !r) return [];
    return [
      {
        id: s.id,
        grupo: ui.grupo,
        rotulo: ui.rotulo,
        v: r.v,
        referencia: r.referencia,
        pontos: false,
        sentido: porId.get(s.id)?.sentido ?? "neutro",
        leitura: r.referencia === null ? null : tendencia(r.v, r.referencia),
        ativa: s.id === cartao,
        aoEscolher: () => aoEscolher(s.id),
      },
    ];
  });
}

/** As colunas da tabela, na ordem dos grupos do placar da sala. */
const COLUNAS_BIOMA: { lente: Lente; rotulo: string; quando: string }[] = [
  { lente: "desmatamento", rotulo: "Desmatamento", quando: "ano PRODES" },
  { lente: "alertas", rotulo: "Alertas", quando: "12 meses" },
  { lente: "fogo", rotulo: "Focos", quando: "12 meses" },
  { lente: "queimada", rotulo: "Área queimada", quando: "12 meses" },
  { lente: "ti", rotulo: "Terras Indígenas", quando: "ano PRODES" },
  { lente: "uc", rotulo: "Unid. Conservação", quando: "ano PRODES" },
  { lente: "fiscalizacao", rotulo: "Autos", quando: "12 meses" },
  { lente: "multas", rotulo: "Multas", quando: "12 meses" },
  { lente: "embargos", rotulo: "Embargos", quando: "12 meses" },
];

const valorDaLinha = (x: LinhaTerritorio | null) => (!x || x.falta ? null : (x.valor ?? (x.serie ? (ultimoDado(x.serie)?.valor ?? null) : null)));

/**
 * Os biomas lado a lado em cada medida, a mesma tabela dos estados: "Desde a posse"
 * em bloco chapado verde ou vermelho, "Hoje" na rampa de cada tipo. O nome abre o bioma
 * no mapa, como o estado na tabela de baixo. O número põe a série no gráfico, e conversa
 * com o "Brasil agora" e com o ritmo: o cartão acende os biomas dele, e o número acende
 * o cartão. O que o INPE não publica fica com "—", e a nota diz por quê.
 */
function Biomas({
  dados,
  municipal,
  foco,
  bioma,
  aoVerSerie,
  aoSelecionarBioma,
  className,
}: {
  dados: DadosPainel;
  municipal: MunicipiosAmbiente | null;
  foco: string;
  bioma: string | null;
  aoVerSerie: (id: string) => void;
  aoSelecionarBioma: (id: string | null) => void;
  className: string;
}) {
  const [modo, setModo] = useEstadoCompartilhavel<"posse" | "hoje">("fiscalizacao.modo", "posse", opcaoCompartilhada(["posse","hoje"]));
  const posse = modo === "posse";
  const linhas = useMemo(
    () => [
      { id: null as string | null, rotulo: "Brasil", placar: placarDoBrasilInteiro(dados) },
      ...dados.ambiente.porBioma.map((b) => ({ id: b.id as string | null, rotulo: b.rotulo, placar: placarDoBioma(dados, b.id, municipal) })),
    ],
    [dados, municipal],
  );
  // A rampa compara os biomas entre si: com o Brasil na conta, nenhum chegaria às classes escuras.
  const reguas = useMemo(
    () =>
      new Map(
        COLUNAS_BIOMA.map((c) => [
          c.lente,
          reguaDeCor(linhas.filter((l) => l.id).map((l) => valorDaLinha(linhaDaMedida(l.placar, c.lente))), "log", RAMPA_DA_LENTE[c.lente]),
        ]),
      ),
    [linhas],
  );
  if (linhas.length < 2) return null;

  const celula = (lente: Lente, x: LinhaTerritorio | null, onde: string) => {
    const v = valorDaLinha(x);
    const sem = !x || Boolean(x.falta) || v === null;
    const regua = reguas.get(lente)!;
    const pintada = !sem && x.sentido !== "neutro";
    // Aceso se é o que está no gráfico, ou um pedaço do cartão que está no gráfico.
    const aceso = !sem && (x.id === foco || cartaoDaSerie(x.id) === foco);
    const estilo: React.CSSProperties = sem
      ? { color: "var(--tinta-3)" }
      : posse
        ? pintada
          ? { background: corDoVeredito(x.sentido), color: "var(--placar-texto, #fff)" }
          : { background: "var(--faixa-a)", color: "var(--tinta-2)" }
        : { background: regua.cor(v), color: tintaNaClasse(regua.classe(v), regua.rampa) };
    const conteudo = (
      <span
        className="tabular flex h-[22px] items-center justify-end whitespace-nowrap rounded-[5px] px-1.5 text-[11.5px] font-semibold"
        style={{ ...estilo, outline: aceso ? "2px solid var(--ouro-forte, var(--serie))" : undefined, outlineOffset: 1 }}
      >
        {sem ? "—" : posse ? x.mudanca : x.agora}
      </span>
    );
    const serie = !sem ? x.serie : undefined;
    return (
      <td key={lente} className="p-0" title={x?.falta}>
        {serie ? (
          <button
            type="button"
            className="block w-full"
            aria-pressed={aceso}
            aria-label={`${onde}, ${serie.rotulo}: ${x!.agora}, ${x!.mudanca} desde a posse. Ver no gráfico.`}
            onClick={(e) => {
              e.stopPropagation();
              aoVerSerie(serie.id);
            }}
          >
            {conteudo}
          </button>
        ) : (
          conteudo
        )}
      </td>
    );
  };

  return (
    <Bloco
      id="biomas"
      titulo="Biomas"
      detalhe={`${posse ? "cada bioma contra o que tinha na posse" : "último dado de cada medida"} · o nome abre no mapa, o número abre no gráfico`}
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
        <table className="tabela-estados w-full min-w-[880px] border-separate text-left text-[12px]" style={{ borderSpacing: "3px 2px" }}>
          <thead>
            <tr className="align-bottom">
              <th className="pb-1 font-normal">
                <span className="sr-only">Bioma</span>
              </th>
              {COLUNAS_BIOMA.map((c) => (
                <th key={c.lente} className="pb-1 pr-1 text-right font-normal">
                  <span className="block text-[11.5px] font-medium leading-tight" style={{ color: "var(--tinta-2)" }}>
                    {c.rotulo}
                  </span>
                  <span className="block text-[10px]" style={{ color: "var(--tinta-3)" }}>
                    {c.quando}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={l.rotulo}
                className="cursor-pointer [&:hover>*]:bg-[var(--faixa-a)]"
                data-escolhido={l.id !== null && l.id === bioma ? true : undefined}
                onClick={() => aoSelecionarBioma(l.id)}
              >
                <th scope="row" className="whitespace-nowrap rounded-md pr-2 font-normal">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      aoSelecionarBioma(l.id);
                    }}
                    className={`text-left text-[12px] hover:underline ${l.id ? "font-medium" : "font-semibold"}`}
                    title={`Abrir ${l.rotulo} no mapa`}
                  >
                    {l.rotulo}
                  </button>
                </th>
                {COLUNAS_BIOMA.map((c) => celula(c.lente, linhaDaMedida(l.placar, c.lente), l.rotulo))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Área mapeada pelo PRODES em cada bioma, que só é anual desde 2017: aqui a Amazônia é o bioma, não a Amazônia Legal da taxa, e os biomas não publicam
        todos no mesmo ano. No Brasil, as áreas protegidas contam os biomas com o último ano publicado. Alertas: o INPE só publica na Amazônia e no Cerrado. Área queimada: só na
        Amazônia. A fiscalização soma os municípios em que cada bioma predomina, sem cor nem série para o gráfico.
      </p>
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// O desmatamento desde 1988
// ---------------------------------------------------------------------------

type Escopo = "amazonia" | "cerrado" | "caatinga" | "mata_atlantica" | "pampa" | "pantanal" | "todos";

/**
 * Caatinga, Mata Atlântica, Pampa e Pantanal só têm uma série por ano desde 2017. Antes
 * o INPE publicou quase sempre em blocos de dois anos, e os poucos anos soltos dariam a
 * um governo uma comparação com um ano pela metade.
 */
const ANUAL_DESDE = "2017-07";

/** Com poucos anos a barra viraria um bloco: ela para aqui, e o ano fica centrado na coluna dele. */
const BARRA_MAXIMA = 72;

/** "-12,9%" vira "-13%", o mesmo arredondamento do resto da tela. */
function semDecimal(texto: string): string {
  const m = texto.match(/^([+\-−]?)([\d.]+),(\d)%$/);
  if (!m) return texto;
  return `${m[1]}${numero(Math.round(Number(m[2].replace(/\./g, "")) + Number(m[3]) / 10), 0)}%`;
}

/**
 * O gráfico clássico do tema: uma barra por ano PRODES, de cada governo numa
 * cor só, contra o que ele recebeu, a régua do placar. Antes de FHC, cinza: a
 * série não tem o ano anterior à posse de quem veio antes. Em cima de cada
 * governo, o rosto e o quanto o desmatamento mudou no mandato; o ano
 * preliminar leva só o contorno.
 */
function BarrasDesmatamento({ dados, mandatos, foco, className }: { dados: DadosPainel; mandatos: MandatoVisual[]; foco: FocoMandato; className: string }) {
  const [escopo, setEscopo] = useEstadoCompartilhavel<Escopo>("desmatamento.bioma", "amazonia", opcaoCompartilhada(["amazonia","cerrado","caatinga","mata_atlantica","pampa","pantanal","todos"]));
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [sob, setSob] = useState<number | null>(null);

  const { s, nome, nota } = useMemo(() => {
    const serie = (id: string) => dados.ambiente.series.find((x) => x.id === id);
    if (escopo === "amazonia") return { s: serie("prodes_amazonia"), nome: "Amazônia Legal", nota: "Taxa modelada do INPE para a Amazônia Legal, de agosto a julho." };
    if (escopo === "cerrado") return { s: serie("prodes_cerrado"), nome: "Cerrado", nota: "Área mapeada no bioma; antes de 2013 o PRODES vinha em blocos de dois anos." };
    if (escopo !== "todos") {
      const b = dados.ambiente.porBioma.find((x) => x.id === escopo);
      const i = b?.prodes ? b.prodes.datas.findIndex((d) => d >= ANUAL_DESDE) : -1;
      return {
        s: b?.prodes && i >= 0 ? { ...b.prodes, datas: b.prodes.datas.slice(i), valores: b.prodes.valores.slice(i) } : undefined,
        nome: b?.rotulo ?? "",
        nota: "Área mapeada no bioma; antes de 2017 o PRODES vinha quase sempre em blocos de dois anos.",
      };
    }
    // Os seis biomas usam os números da leitura do mapa, com a mesma forma de série.
    const base = serie("prodes_amazonia");
    const l = dados.leituras.ambiente.find((x) => x.id === "desmatamento");
    const datas = l?.periodos.map((p) => p.codigo) ?? [];
    return {
      s: base && { ...base, id: "desmatamento_todos", rotulo: "Desmatamento, seis biomas", datas, valores: l?.brasil ?? [], referencia: datas.at(-1) ?? null, preliminares: [] },
      nome: "Seis biomas",
      nota: "Área mapeada somando os seis biomas, que só têm dado anual desde 2017.",
    };
  }, [escopo, dados]);

  const trechos = useMemo(() => (s ? mandatosNaSerie(s, mandatos) : []), [s, mandatos]);
  if (!s) return null;

  const pontos = s.datas.map((d, i) => ({ ano: Number(d.slice(0, 4)), d, v: s.valores[i] }));
  const trechoDe = (d: string) => trechos.find((t) => d >= t.desde && (!t.ate || d < t.ate));
  // Uma folga no alto: o número do maior ano não pode bater na linha do governo.
  const max = Math.max(...pontos.map((p) => p.v ?? 0), 1) * 1.09;

  const A = 260;
  const M = { topo: 62, dir: 8, base: 26, esq: 46 };
  const L = Math.max(0, largura - M.esq - M.dir);
  const n = pontos.length;
  const passo = n ? L / n : 0;
  const lb = Math.min(BARRA_MAXIMA, Math.max(2, passo - 2));
  const y = (v: number) => M.topo + A - (v / max) * A;
  const marcas = passoEixo(max);
  const alvo = sob === null ? null : pontos[sob];
  // As barras comparam todos os governos; o escolhido fica em destaque.
  const foraDoFoco = (d: string) => !foco.emCurso && (d < foco.posse || (foco.ate !== null && d >= foco.ate));
  const tSob = alvo ? trechoDe(alvo.d) : undefined;

  return (
    <Bloco
      id="desmatamento"
      titulo="Desmatamento por ano e por governo"
      detalhe="km² por ano PRODES · cada governo contra o que recebeu"
      className={className}
      lustroFixo
      acao={
        <Opcoes
          quebra
          opcoes={[
            { id: "amazonia", rotulo: "Amazônia" },
            { id: "cerrado", rotulo: "Cerrado" },
            ...dados.ambiente.porBioma.filter((b) => b.prodes && !["amazonia", "cerrado"].includes(b.id)).map((b) => ({ id: b.id as Escopo, rotulo: b.rotulo })),
            { id: "todos", rotulo: "Seis biomas" },
          ]}
          ativa={escopo}
          aoEscolher={(e) => {
            setEscopo(e);
            setSob(null);
          }}
          rotulo="Recorte do gráfico"
        />
      }
    >
      <div ref={ref} className="relative" onPointerLeave={() => setSob(null)}>
        {largura > 0 && (
          <>
            <svg width={largura} height={M.topo + A + M.base} role="img" aria-label={`Desmatamento por ano, ${nome}, de ${pontos[0]?.ano} a ${pontos.at(-1)?.ano}`} className="block">
              {marcas.map((m) => (
                <g key={m}>
                  <line x1={M.esq} x2={largura - M.dir} y1={y(m)} y2={y(m)} stroke="var(--grade)" />
                  <text x={M.esq - 8} y={y(m) + 3.5} textAnchor="end" fontSize={11} style={{ fill: "var(--tinta-3)" }} className="tabular">
                    {m >= 1000 ? `${numero(m / 1000, 0)} mil` : numero(m, 0)}
                  </text>
                </g>
              ))}
              {pontos.map((p, i) => {
                if (p.v === null) return null;
                const t = trechoDe(p.d);
                const cor = !t || t.sentido === "neutro" ? "var(--eixo)" : corDoVeredito(t.sentido);
                const preliminar = s.preliminares?.includes(p.d);
                const x = M.esq + i * passo + (passo - lb) / 2;
                const h = (p.v / max) * A;
                const raio = Math.min(4, lb / 2);
                return (
                  <path
                    key={p.d}
                    d={`M${x},${M.topo + A} V${M.topo + A - h + raio} Q${x},${M.topo + A - h} ${x + raio},${M.topo + A - h} H${x + lb - raio} Q${x + lb},${M.topo + A - h} ${x + lb},${M.topo + A - h + raio} V${M.topo + A} Z`}
                    fill={preliminar ? "none" : cor}
                    stroke={preliminar ? cor : "none"}
                    strokeWidth={preliminar ? 1.5 : 0}
                    strokeDasharray={preliminar ? "3 2" : undefined}
                    opacity={sob === i ? 1 : foraDoFoco(p.d) ? 0.28 : sob === null ? 1 : 0.55}
                  />
                );
              })}
              <line x1={M.esq} x2={largura - M.dir} y1={M.topo + A} y2={M.topo + A} stroke="var(--eixo)" />
              {[pontos.reduce((a, b) => ((b.v ?? 0) > (a.v ?? 0) ? b : a), pontos[0]), pontos.findLast((p) => p.v !== null)!].map((p, k) =>
                p.v === null ? null : (
                  <text
                    key={k}
                    x={k === 1 && pontos.indexOf(p) >= n - 2 ? largura - M.dir : M.esq + pontos.indexOf(p) * passo + passo / 2}
                    y={y(p.v) - 5}
                    textAnchor={k === 1 && pontos.indexOf(p) >= n - 2 ? "end" : "middle"}
                    fontSize={11}
                    fontWeight={600}
                    style={{ fill: "var(--tinta)" }}
                    className="tabular"
                  >
                    {numero(p.v, 0)}
                  </text>
                ),
              )}
              {/* Alvos maiores que as barras: a coluna inteira responde ao ponteiro. */}
              {pontos.map((p, i) => (
                <rect key={p.d} x={M.esq + i * passo} y={M.topo} width={passo} height={A} fill="transparent" onPointerEnter={() => setSob(i)} />
              ))}
              {pontos
                .filter((_, i) => (n - 1 - i) % Math.max(1, Math.ceil(26 / (passo || 1))) === 0)
                .map((p) => (
                  <text
                    key={p.d}
                    x={M.esq + pontos.indexOf(p) * passo + passo / 2}
                    y={M.topo + A + 16}
                    textAnchor="middle"
                    fontSize={10.5}
                    style={{ fill: "var(--tinta-3)" }}
                    className="tabular"
                  >
                    {String(p.ano).slice(2)}
                    {s.preliminares?.includes(p.d) ? "*" : ""}
                  </text>
                ))}
            </svg>
            {/* Os governos em cima das barras: quem, e quanto mudou no mandato. */}
            {trechos.map((t) => {
              const m = mandatos.find((x) => x.id === t.id);
              const idx = pontos.flatMap((p, i) => (p.v !== null && p.d >= t.desde && (!t.ate || p.d < t.ate) ? [i] : []));
              if (!m || !idx.length) return null;
              const x0 = M.esq + idx[0] * passo;
              const x1 = M.esq + (idx.at(-1)! + 1) * passo;
              const d = mudanca(s, t.recebeu, t.ultimo);
              return (
                <div key={t.id} className="pointer-events-none absolute top-0 flex flex-col items-center gap-1 border-b pb-1" style={{ opacity: foraDoFoco(t.desde) ? 0.35 : 1, left: x0 + 1, width: x1 - x0 - 2, borderColor: "var(--eixo)" }}>
                  {x1 - x0 > 26 ? <Retrato presidente={m} tamanho="p" /> : null}
                  {d && x1 - x0 > 34 && <PilulaVeredito texto={semDecimal(d.texto)} sentido={t.sentido} className="text-[10px]" />}
                </div>
              );
            })}
            {alvo && alvo.v !== null && (
              <div
                role="status"
                className="pointer-events-none absolute z-20 w-max rounded-lg border px-3 py-2 text-[11.5px] leading-snug shadow-sm"
                style={{
                  left: Math.min(M.esq + (sob ?? 0) * passo + passo + 6, largura - 190),
                  top: M.topo + 4,
                  background: "var(--superficie)",
                  borderColor: "var(--borda)",
                }}
              >
                <p className="font-semibold">
                  PRODES {alvo.ano}
                  {s.preliminares?.includes(alvo.d) ? ", estimativa preliminar" : ""}
                </p>
                <p className="tabular">{formatar(alvo.v, s.formato)}</p>
                {tSob && (
                  <p style={{ color: "var(--tinta-2)" }}>
                    {(() => {
                      const m = mandatos.find((x) => x.id === tSob.id);
                      return m ? `${rotuloMandato(mandatos, m)}: recebeu ${formatar(tSob.recebeu, s.formato)}` : "";
                    })()}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* A altura da nota mais longa: trocar de bioma não empurra o resto da página. */}
      <p className="mt-2 flex min-h-[107px] flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:min-h-[54px] lg:min-h-[37px]" style={{ color: "var(--tinta-2)" }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm" style={{ background: COR_BOM }} aria-hidden />
          terminou melhor do que recebeu
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm" style={{ background: COR_RUIM }} aria-hidden />
          terminou pior
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm" style={{ background: "var(--eixo)" }} aria-hidden />
          sem o ano anterior à posse
        </span>
        <span style={{ color: "var(--tinta-3)" }}>
          {nota} O ano conta para quem governava em julho, quando ele termina. * Estimativa preliminar. Estar no cargo não é ter causado o número.
        </span>
      </p>
    </Bloco>
  );
}

/** Marcas redondas do eixo, de 0 até perto do máximo. */
function passoEixo(max: number): number[] {
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? pot * 10;
  const lista: number[] = [];
  for (let v = passo; v <= max * 1.02; v += passo) lista.push(v);
  return lista;
}

// ---------------------------------------------------------------------------
// A temporada do fogo
// ---------------------------------------------------------------------------

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * O fogo é sazonal: o que importa é como o ano vai contra os outros no mesmo
 * ponto. Cada ano é o acumulado de janeiro a dezembro; os anteriores ficam em
 * cinza, 2022 (o que o governo recebeu) tracejado, e o ano corrente na cor do
 * veredito contra 2022 no mesmo mês. O mês em andamento vai pontilhado: a
 * fonte ainda está somando.
 */
function TemporadaFogo({
  meses,
  valores,
  parcial,
  anoRecebido,
  className,
}: {
  meses: string[];
  valores: (number | null)[];
  parcial: { mes: string; valor: number; ate: string | null } | null;
  anoRecebido: number;
  className: string;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [mesSob, setMesSob] = useState<number | null>(null);

  const anos = useMemo(() => {
    const porAno = new Map<number, (number | null)[]>();
    meses.forEach((m, i) => {
      const a = Number(m.slice(0, 4));
      const lista = porAno.get(a) ?? Array.from({ length: 12 }, () => null);
      lista[Number(m.slice(5, 7)) - 1] = valores[i];
      porAno.set(a, lista);
    });
    // O acumulado só anda enquanto há mês; o ano incompleto para onde o dado para.
    return [...porAno.entries()]
      .map(([ano, lista]) => {
        let soma = 0;
        let parou = false;
        const acumulado = lista.map((v) => {
          if (v === null || parou) {
            parou = true;
            return null;
          }
          soma += v;
          return soma;
        });
        return { ano, acumulado };
      })
      // 1998 começa em junho: acumulado desde janeiro não existe.
      .filter((x) => x.acumulado[0] !== null);
  }, [meses, valores]);

  const atual = anos.at(-1);
  const deRecebido = anos.find((x) => x.ano === anoRecebido);
  if (!atual || !deRecebido) return null;
  const ultimoMes = atual.acumulado.findLastIndex((v) => v !== null);
  const agora = atual.acumulado[ultimoMes] ?? 0;
  const noRecebido = deRecebido.acumulado[ultimoMes] ?? 0;
  const pct = noRecebido ? Math.round(((agora - noRecebido) / noRecebido) * 100) : null;
  const s: Sentido = pct === null ? "neutro" : sentido(pct, "menor_melhor");
  const anteriores = anos.filter((x) => x.ano < atual.ano);
  const noMesmoPonto = anteriores.map((x) => x.acumulado[ultimoMes] ?? 0).sort((a, b) => a - b);
  const lugar = noMesmoPonto.filter((v) => v < agora).length + 1;
  const pior = anteriores.reduce((a, b) => ((b.acumulado[ultimoMes] ?? 0) > (a.acumulado[ultimoMes] ?? 0) ? b : a), anteriores[0]);
  const comParcial = parcial && parcial.mes.startsWith(String(atual.ano)) && Number(parcial.mes.slice(5, 7)) - 1 === ultimoMes + 1 ? agora + parcial.valor : null;

  const A = 250;
  const M = { topo: 14, dir: 56, base: 24, esq: 48 };
  const L = Math.max(0, largura - M.esq - M.dir);
  const max = Math.max(...anos.flatMap((x) => x.acumulado.map((v) => v ?? 0)), comParcial ?? 0, 1);
  const x = (i: number) => M.esq + (i / 11) * L;
  const y = (v: number) => M.topo + A - (v / max) * A;
  const linha = (l: (number | null)[]) => l.map((v, i) => (v === null ? "" : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  const cor = s === "neutro" ? "var(--serie)" : corDoVeredito(s);

  return (
    <Bloco
      id="temporada"
      titulo="Temporada do fogo"
      detalhe={`focos acumulados no ano, Brasil · ${atual.ano} contra ${anteriores[0].ano}–${anteriores.at(-1)!.ano}`}
      className={`flex flex-col ${className}`}
      corpo="flex flex-1 flex-col"
    >
      <div ref={ref} className="relative" onPointerLeave={() => setMesSob(null)}>
        {largura > 0 && (
          <svg
            width={largura}
            height={M.topo + A + M.base}
            role="img"
            aria-label={`Focos acumulados em ${atual.ano} até ${MESES[ultimoMes]}: ${numero(agora, 0)}; em ${anoRecebido}, no mesmo mês, ${numero(noRecebido, 0)}.`}
            className="block"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMesSob(Math.max(0, Math.min(11, Math.round(((e.clientX - r.left - M.esq) / L) * 11))));
            }}
          >
            {passoEixo(max).map((m) => (
              <g key={m}>
                <line x1={M.esq} x2={M.esq + L} y1={y(m)} y2={y(m)} stroke="var(--grade)" />
                <text x={M.esq - 8} y={y(m) + 3.5} textAnchor="end" fontSize={11} style={{ fill: "var(--tinta-3)" }} className="tabular">
                  {numero(m / 1000, 0)} mil
                </text>
              </g>
            ))}
            {MESES.map((m, i) =>
              i % (L < 420 ? 2 : 1) === 0 ? (
                <text key={m} x={x(i)} y={M.topo + A + 16} textAnchor="middle" fontSize={10.5} style={{ fill: "var(--tinta-3)" }}>
                  {m}
                </text>
              ) : null,
            )}
            {anteriores.map((a) => (
              <path
                key={a.ano}
                d={linha(a.acumulado)}
                fill="none"
                stroke={a.ano === anoRecebido ? "var(--tinta)" : "var(--eixo)"}
                strokeWidth={a.ano === anoRecebido ? 1.5 : 1}
                strokeDasharray={a.ano === anoRecebido ? "5 4" : undefined}
                opacity={a.ano === anoRecebido ? 1 : 0.55}
                strokeLinejoin="round"
              />
            ))}
            <path d={linha(atual.acumulado)} fill="none" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {comParcial !== null && (
              <line x1={x(ultimoMes)} y1={y(agora)} x2={x(ultimoMes + 1)} y2={y(comParcial)} stroke={cor} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" />
            )}
            <circle cx={x(ultimoMes)} cy={y(agora)} r={4.5} fill={cor} stroke="var(--superficie)" strokeWidth={2} />
            {/* Rótulos direto nas linhas: a do ano e a do que o governo recebeu. */}
            <text x={x(ultimoMes) + 8} y={y(agora) + 14} fontSize={12} fontWeight={700} style={{ fill: "var(--tinta)" }}>
              {atual.ano}
            </text>
            <text x={x(11) + 6} y={y(deRecebido.acumulado[11] ?? 0) + 4} fontSize={11} style={{ fill: "var(--tinta-2)" }}>
              {anoRecebido}
            </text>
            {mesSob !== null && <line x1={x(mesSob)} x2={x(mesSob)} y1={M.topo} y2={M.topo + A} stroke="var(--eixo)" />}
          </svg>
        )}
        {mesSob !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-20 w-max rounded-lg border px-3 py-2 text-[11.5px] leading-snug shadow-sm"
            style={{ left: Math.min(x(mesSob) + 10, largura - 170), top: 18, background: "var(--superficie)", borderColor: "var(--borda)" }}
          >
            <p className="font-semibold">Até {MESES[mesSob]}</p>
            {[atual, deRecebido].map((a) =>
              a.acumulado[mesSob] !== null ? (
                <p key={a.ano} className="tabular flex justify-between gap-3">
                  <span style={{ color: "var(--tinta-2)" }}>{a.ano}</span>
                  <span className="font-medium">{numero(a.acumulado[mesSob], 0)}</span>
                </p>
              ) : null,
            )}
          </div>
        )}
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3 sm:grid-cols-4" style={{ borderColor: "var(--borda)" }}>
        <div>
          <dt className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            {atual.ano}, até {MESES[ultimoMes]}
          </dt>
          <dd className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="tabular text-base font-bold">{numero(agora, 0)}</span>
            {pct !== null && <PilulaVeredito texto={`${comSinal(pct, 0)}%`} sentido={s} className="text-[10.5px]" />}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            {anoRecebido}, até {MESES[ultimoMes]}
          </dt>
          <dd className="tabular text-base font-bold">{numero(noRecebido, 0)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            Pior ano até {MESES[ultimoMes]}
          </dt>
          <dd className="tabular text-base font-bold">
            {numero(pior.acumulado[ultimoMes], 0)} <span className="text-[11px] font-normal" style={{ color: "var(--tinta-3)" }}>{pior.ano}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            Posição entre {anos.length} anos
          </dt>
          <dd className="tabular text-base font-bold">
            {lugar}º <span className="text-[11px] font-normal" style={{ color: "var(--tinta-3)" }}>com menos focos</span>
          </dd>
        </div>
      </dl>
      {parcial && (
        <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
          Pontilhado: {MESES[Number(parcial.mes.slice(5, 7)) - 1]} em andamento, {numero(parcial.valor, 0)} focos
          {parcial.ate ? ` até ${parcial.ate.slice(8, 10)}/${parcial.ate.slice(5, 7)}` : ""}. Foco é ponto de calor, não área queimada; seca e calor pesam tanto quanto a política.
        </p>
      )}
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// Áreas protegidas
// ---------------------------------------------------------------------------

/**
 * Quanto se desmatou dentro do que a lei protege: Terras Indígenas e Unidades
 * de Conservação. O número e a pílula são a régua do placar, o último ano contra
 * 2022, na base dos biomas que já publicaram esse ano. As barras contam o
 * caminho, numa cor só desde a posse: um pico como o de 2025 aparece na altura,
 * não na cor. Tocar numa barra mostra quem mais perdeu naquele ano.
 */
function AreasProtegidas({ p, anoRecebido, className }: { p: NonNullable<DadosPainel["ambiente"]["protegidas"]>; anoRecebido: number; className: string }) {
  const [recorte, setRecorte] = useEstadoCompartilhavel<"ti" | "uc">("protegidas.tipo", "ti", opcaoCompartilhada(["ti","uc"]));
  const [anoLista, setAnoLista] = useEstadoCompartilhavel("protegidas.ano", p.ano, v=>typeof v==="number"&&String(v) in p.maisPorAno);
  const s = recorte === "ti" ? p.ti : p.uc;
  if (!s) return null;
  const u = ultimoDado(s);
  const r = recebido(s);
  const dif = u && r ? mudanca(s, r.valor, u.valor) : null;
  const sent: Sentido = dif?.sentido ?? "neutro";
  const max = Math.max(...s.valores.map((v) => v ?? 0), 1);
  const iPico = s.valores.reduce<number>((k, v, i) => ((v ?? 0) > (s.valores[k] ?? 0) ? i : k), 0);
  const lista = (p.maisPorAno[String(anoLista)] ?? []).filter((x) => x.recorte === recorte);
  const preliminar = (d: string) => s.preliminares?.includes(d) ?? false;
  const nomesBiomas = p.biomas.map((b) => NOME_BIOMA[b] ?? b);
  const base = nomesBiomas.length === 6 ? "os seis biomas" : nomesBiomas.join(" e ");
  return (
    <Bloco
      id="protegidas"
      titulo="Áreas protegidas"
      detalhe={`desmatamento mapeado dentro delas · ${base}`}
      className={`flex flex-col ${className}`}
      corpo="flex flex-1 flex-col"
      acao={
        <Opcoes
          opcoes={[
            { id: "ti", rotulo: "Terras Indígenas" },
            { id: "uc", rotulo: "Unidades de Conservação" },
          ]}
          ativa={recorte}
          aoEscolher={setRecorte}
          rotulo="Tipo de área"
        />
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Numero texto={u ? formatar(u.valor, s.formato) : "—"} className="tabular text-[21px] font-bold leading-tight" />
        {dif && <PilulaVeredito texto={dif.texto} sentido={sent} className="text-[10.5px]" />}
        <span className="tabular text-[11px]" style={{ color: "var(--tinta-3)" }}>
          {u ? referencia(s, u.data) : ""}
          {r ? ` · em ${anoRecebido}, ${formatar(r.valor, s.formato)}` : ""}
        </span>
      </div>
      <div className="mt-2 flex h-[5.5rem] items-end gap-[2px]" role="group" aria-label="Ano da lista">
        {s.datas.map((d, i) => {
          const a = Number(d.slice(0, 4));
          const v = s.valores[i] ?? 0;
          const cor = a > anoRecebido ? corDoVeredito(sent) : a === anoRecebido ? "var(--tinta-3)" : "var(--eixo)";
          const pre = preliminar(d);
          const comRotulo = i === iPico || i === s.datas.length - 1;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setAnoLista(a)}
              aria-pressed={anoLista === a}
              aria-label={`PRODES ${a}${pre ? ", estimativa preliminar" : ""}: ${formatar(v, s.formato)}. Ver quem mais perdeu.`}
              title={`PRODES ${a}${pre ? "*" : ""}: ${formatar(v, s.formato)}`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5 rounded-md hover:bg-[var(--faixa-a)]"
            >
              {comRotulo && (
                <span className="tabular text-[10px] font-semibold leading-none">{numero(v, 0)}</span>
              )}
              <span
                className="w-full rounded-t-[4px]"
                style={{
                  height: `${Math.max(2, (v / max) * 50)}px`,
                  background: pre ? "transparent" : cor,
                  boxShadow: pre ? `inset 0 0 0 1.5px ${cor}` : undefined,
                }}
              />
              <span
                className="tabular text-[9.5px]"
                style={{ color: anoLista === a ? "var(--tinta)" : "var(--tinta-3)", fontWeight: anoLista === a ? 700 : 400 }}
              >
                {String(a).slice(2)}
                {pre ? "*" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[10.5px] font-medium" style={{ color: "var(--tinta-3)" }}>
        As que mais perderam em {anoLista}
        {preliminar(`${anoLista}-07`) ? "*" : ""}
      </p>
      <ol className="mt-1 flex flex-1 flex-col justify-between">
        {lista.map((x, i) => {
          const dx = x.recebido ? Math.round(((x.ultimo - x.recebido) / x.recebido) * 100) : null;
          return (
            <li key={`${x.bioma}-${x.nome}`} className="flex items-baseline gap-2 border-t py-1 text-[12px]" style={{ borderColor: "var(--borda)" }}>
              <span className="tabular w-4 shrink-0 text-right text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate" title={x.nome}>
                {titulo(x.nome)} <span className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>{NOME_BIOMA[x.bioma]}</span>
              </span>
              <span className="tabular shrink-0 font-semibold">{formatar(x.ultimo, "km2")}</span>
              <span className="flex w-[3.1rem] shrink-0 justify-end">
                {dx !== null && x.recebido ? <PilulaVeredito texto={textoVariacao(x.ultimo, x.recebido)} sentido={sentido(dx, "menor_melhor")} className="text-[10.5px]" /> : <span className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>novo</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        {recorte === "uc" ? "Inclui as Áreas de Proteção Ambiental (APA), que admitem propriedade privada. " : ""}
        {p.anos.includes(2025) ? "O ano PRODES 2025 vai de ago/2024 a jul/2025 e pegou a seca e o fogo de 2024; a coincidência não prova a causa do pico. " : ""}* Estimativa
        preliminar. Pílula: contra {anoRecebido}; &quot;novo&quot; é quem não tinha área mapeada em {anoRecebido}.
      </p>
    </Bloco>
  );
}


// ---------------------------------------------------------------------------
// Municípios contra a fiscalização
// ---------------------------------------------------------------------------

const LINHAS_MUNICIPIOS = 15;

function baixarCsv(nome: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Onde se desmata e o que o Ibama fez lá: os municípios com mais desmatamento
 * no último ano com os seis biomas, ao lado dos alertas, dos focos e da
 * fiscalização. Acompanha o bioma escolhido na sala; tocar sobe para o mapa com
 * a ficha aberta. Fiscalização sem cor, como no resto da aba.
 */
function MunicipiosContraIbama({
  formas,
  municipal,
  bioma,
  aoSelecionar,
  className,
}: {
  formas: MunicipioNacional[];
  municipal: MunicipiosAmbiente;
  bioma: string | null;
  aoSelecionar: (codigo: string) => void;
  className: string;
}) {
  const ano = municipal.anoCompleto ?? municipal.anos.at(-1)!;
  const i = municipal.anos.indexOf(ano);
  const anoR = municipal.anoRecebido;
  const r = municipal.anos.indexOf(anoR);
  const iFoco = municipal.focosAnos.length - 1;
  const rFoco = municipal.focosAnos.indexOf(anoR);
  const linhas = useMemo(
    () =>
      formas
        .flatMap((m) => {
          const x = municipal.m[m.codigo];
          if (!x?.d || (bioma && x.b !== bioma)) return [];
          const v = x.d[i];
          return v === null || v === undefined ? [] : [{ m, x, v }];
        })
        .sort((a, b) => b.v - a.v)
        .slice(0, LINHAS_MUNICIPIOS),
    [formas, municipal, i, bioma],
  );
  const pilula = (a: number | null | undefined, b: number | null | undefined) => {
    if (a === null || a === undefined || !b) return null;
    const p = Math.round(((a - b) / b) * 100);
    return <PilulaVeredito texto={textoVariacao(a, b)} sentido={sentido(p, "menor_melhor")} className="text-[10px]" />;
  };
  const cinza = (a: number | undefined, b: number | undefined) => {
    if (a === undefined || !b) return "";
    return textoVariacao(a, b);
  };
  const csv = () => {
    const cabecalho = [
      "codigo_ibge", "municipio", "uf", "bioma_predominante", ...municipal.anos.map((a) => `desmatamento_km2_prodes_${a}`),
      `alertas_km2_${anoR}`, "alertas_km2_12m", ...municipal.focosAnos.map((a) => `focos_${a}`),
      `autos_${anoR}`, "autos_12m", `autos_flora_${anoR}`, "autos_flora_12m", `multas_reais_${anoR}`, "multas_reais_12m", `embargos_${anoR}`, "embargos_12m",
    ];
    const corpo = formas.map((m) => {
      const x = municipal.m[m.codigo];
      return [
        m.codigo, m.nome, m.uf, x?.b ?? null, ...(x?.d ?? municipal.anos.map(() => null)),
        x?.a?.[0] ?? null, x?.a?.[1] ?? null, ...(x?.f ?? municipal.focosAnos.map(() => null)),
        x?.i?.[0] ?? null, x?.i?.[1] ?? null, x?.i?.[2] ?? null, x?.i?.[3] ?? null, x?.v?.[0] ?? null, x?.v?.[1] ?? null, x?.e?.[0] ?? null, x?.e?.[1] ?? null,
      ];
    });
    baixarCsv("meio-ambiente-por-municipio.csv", criarCsv(cabecalho, corpo));
  };
  const janela = municipal.janela.atual ? `${MESES[Number(municipal.janela.atual.slice(5, 7)) - 1]}/${municipal.janela.atual.slice(2, 4)}` : "";
  const cab = "pb-1 text-right text-[10.5px] font-normal";
  return (
    <Bloco
      id="municipios"
      titulo="Onde se desmata e o que o Ibama fez lá"
      detalhe={`${bioma ? `${NOME_BIOMA[bioma]}: ` : ""}os ${LINHAS_MUNICIPIOS} municípios com mais desmatamento no PRODES ${ano}`}
      className={className}
      lustroFixo
      acao={
        <button type="button" onClick={csv} className="vidro-lente rounded-full px-3 py-1 text-[11px] font-medium">
          Todos os municípios (CSV)
        </button>
      }
    >
      <div className="-mx-1 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
        <table className="w-full min-w-[820px] border-separate text-left text-[12px]" style={{ borderSpacing: "0 1px" }}>
          <thead style={{ color: "var(--tinta-3)" }}>
            <tr className="align-bottom">
              <th className="w-6 pb-1 text-[10.5px] font-normal">#</th>
              <th className="pb-1 text-[10.5px] font-normal">Município</th>
              <th className={cab}>Desmatamento {ano}<br />km² · contra {anoR}</th>
              <th className={cab}>Alertas até {janela}<br />km² · contra {anoR}</th>
              <th className={cab}>Focos {municipal.focosAnos[iFoco] ?? ""}<br />{iFoco < 0 ? "só desde 2022" : rFoco < 0 ? "sem base" : `contra ${anoR}`}</th>
              <th className={cab}>Autos de flora até {janela}<br />12 meses · contra {anoR}</th>
              <th className={cab}>Embargos até {janela}<br />12 meses · contra {anoR}</th>
              <th className={cab}>Multas até {janela}<br />valor informado</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ m, x, v }, k) => (
              <tr key={m.codigo} className="cursor-pointer [&:hover>*]:bg-[var(--faixa-a)]" onClick={() => aoSelecionar(m.codigo)}>
                <td className="tabular rounded-l-md text-center text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                  {k + 1}
                </td>
                <th scope="row" className="py-1 pr-2 font-normal">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      aoSelecionar(m.codigo);
                    }}
                    className="text-left font-medium hover:underline"
                    title={`Abrir ${m.nome} no mapa`}
                  >
                    {m.nome} <span className="font-normal" style={{ color: "var(--tinta-3)" }}>{m.uf}</span>
                  </button>
                </th>
                <td className="tabular text-right">
                  <span className="font-semibold">{numero(v, 0)}</span> {pilula(v, r >= 0 ? x.d?.[r] : null)}
                </td>
                <td className="tabular text-right">
                  {x.a ? (
                    <>
                      <span className="font-semibold">{numero(x.a[1], 0)}</span> {pilula(x.a[1], x.a[0])}
                    </>
                  ) : (
                    <span style={{ color: "var(--tinta-3)" }}>fora do DETER</span>
                  )}
                </td>
                <td className="tabular text-right">
                  <span className="font-semibold">{iFoco < 0 ? "—" : numero(x.f?.[iFoco] ?? 0, 0)}</span> {pilula(x.f?.[iFoco], rFoco >= 0 ? x.f?.[rFoco] : null)}
                </td>
                <td className="tabular text-right">
                  <span className="font-semibold">{numero(x.i?.[3] ?? 0, 0)}</span>{" "}
                  <span className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>{cinza(x.i?.[3], x.i?.[2])}</span>
                </td>
                <td className="tabular text-right">
                  <span className="font-semibold">{numero(x.e?.[1] ?? 0, 0)}</span>{" "}
                  <span className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>{cinza(x.e?.[1], x.e?.[0])}</span>
                </td>
                <td className="tabular rounded-r-md text-right font-semibold">{reaisCurtos(x.v?.[1] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Fiscalização sem cor: é ação do governo, e mais autos tanto podem ser mais presença quanto mais crime. Autos sem os cancelados; o
        valor é o informado no auto, não o que foi pago. Os meses recentes do Ibama ainda sobem com o registro. Toque num município para abrir
        no mapa.
      </p>
    </Bloco>
  );
}

const reaisCurtos = (v: number) =>
  v >= 1e9 ? `R$ ${numero(v / 1e9, 1)} bi` : v >= 1e6 ? `R$ ${numero(v / 1e6, 0)} mi` : v >= 1e3 ? `R$ ${numero(v / 1e3, 0)} mil` : `R$ ${numero(v, 0)}`;
