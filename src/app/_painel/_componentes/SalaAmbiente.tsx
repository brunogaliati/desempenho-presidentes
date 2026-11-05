"use client";
import { Compartilhar } from "@/components/Compartilhar";
import { opcaoCompartilhada, textoCompartilhado } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { numero, sentido as sentidoDe, type Sentido } from "@/lib/formatar";
import type { Direcao } from "@/types/dados";

import {
  CORTES,
  corDaLente,
  numerosDaArea,
  numerosDaLente,
  RAMPA_DA_LENTE,
  somaNaUf,
  somaNoBioma,
  textoVariacao,
  type Lente,
  type ModoMapa,
  type Municipal,
  type MunicipiosAmbiente,
} from "../_dados/ambienteMunicipal";
import biomasMunicipios from "../_dados/biomas-municipios.json";
import silhuetas from "../_dados/biomas-silhuetas.json";
import { deslocar, doisAnosAntes } from "../_dados/mandatoRecorte";
import type { DadosPainel, Formato, Leitura, MunicipioNacional, SerieEconomia, UF } from "../_dados/tipos";
import { corDoSentido, formatar, recebido as recebidoDaSerie, referencia, reguaDeCor, titulo } from "./formatos";
import { Faisca } from "./GraficoLinha";
import { NumeroRolante } from "./PainelEconomia";
import { useAreasProtegidas, type AreaDesenhada } from "./municipiosAmbiente";
import { PilulaVeredito } from "./Placar";
import { placarDoBioma, placarDoEstado, type PlacarAmbiente, type RegiaoPlacar, type VistaDoMapa } from "./placarAmbiente";
import { PlacarTerritorio } from "./PlacarTerritorio";

/**
 * A sala do meio ambiente: aqui o dado é o lugar, então o mapa é por município.
 *
 * Os 5.570 municípios soltos na tela, sem moldura, para o desenho aparecer: o
 * arco do desmatamento, a fronteira do Cerrado, o fogo na estação seca. O
 * estado e o bioma são recortes sobre esse mapa, não a unidade da cor: escolher
 * um enquadra o mapa nele e apaga o resto.
 *
 * A esquerda diz como está o país de várias formas de uma vez: as cinco lentes
 * (desmatamento, alertas, fogo, áreas protegidas e fiscalização), sempre as cinco, com o número
 * de cada uma. Tocar numa lente repinta o mapa; nada anda de lugar. Embaixo, os
 * municípios onde mais acontece, e o cartão de como ler o mapa.
 *
 * A direita, o bioma no lugar dos estados: o placar é do recorte escolhido, com
 * a mesma régua do resto do site (hoje contra o que o governo recebeu). Tocar
 * num município abre a ficha dele ali.
 *
 * Toda linha do placar pinta o mapa com a medida dela: o placar também é a chave
 * do que se vê. As áreas protegidas não têm número por município, então o mapa
 * apaga os municípios e pinta os contornos delas.
 *
 * A manchete não passeia sozinha como a da economia: repintar 5.570 municípios
 * a cada cinco segundos cansaria o olho e a máquina.
 */

const BIOMAS: { id: string | null; rotulo: string }[] = [
  { id: null, rotulo: "Brasil" },
  { id: "amazonia", rotulo: "Amazônia" },
  { id: "cerrado", rotulo: "Cerrado" },
  { id: "caatinga", rotulo: "Caatinga" },
  { id: "mata_atlantica", rotulo: "Mata Atlântica" },
  { id: "pampa", rotulo: "Pampa" },
  { id: "pantanal", rotulo: "Pantanal" },
];
const NOME_BIOMA = Object.fromEntries(BIOMAS.flatMap((b) => (b.id ? [[b.id, b.rotulo]] : []))) as Record<string, string>;

const MEDIDAS: Record<Lente, { rotulo: string; curto: string; familia: Lente }> = {
  desmatamento: { rotulo: "Desmatamento", curto: "Desmatamento", familia: "desmatamento" },
  alertas: { rotulo: "Alertas de desmatamento", curto: "Alertas", familia: "alertas" },
  fogo: { rotulo: "Focos de queimada", curto: "Focos", familia: "fogo" },
  queimada: { rotulo: "Área queimada", curto: "Área queimada", familia: "fogo" },
  ti: { rotulo: "Desmatado em Terras Indígenas", curto: "Terras Indígenas", familia: "ti" },
  uc: { rotulo: "Desmatado em Unid. Conservação", curto: "Unid. Conservação", familia: "ti" },
  fiscalizacao: { rotulo: "Autos do Ibama", curto: "Autos do Ibama", familia: "fiscalizacao" },
  multas: { rotulo: "Multas do Ibama", curto: "Multas do Ibama", familia: "fiscalizacao" },
  embargos: { rotulo: "Embargos do Ibama", curto: "Embargos do Ibama", familia: "fiscalizacao" },
};

/** As cinco linhas da coluna, na ordem dos grupos da barra. Uma linha mostra a medida da família que está no mapa. */
const FAMILIAS: Lente[] = ["desmatamento", "alertas", "fogo", "ti", "fiscalizacao"];

/** Os pedaços do Brasil que o placar nacional separa. */
const REGIOES: Record<RegiaoPlacar, { rotulo: string; biomas: string[] }> = {
  amazonia: { rotulo: "Amazônia", biomas: ["amazonia"] },
  cerrado: { rotulo: "Cerrado", biomas: ["cerrado"] },
  caatinga: { rotulo: "Caatinga", biomas: ["caatinga"] },
  mata_atlantica: { rotulo: "Mata Atlântica", biomas: ["mata_atlantica"] },
  pampa: { rotulo: "Pampa", biomas: ["pampa"] },
  pantanal: { rotulo: "Pantanal", biomas: ["pantanal"] },
  outros: { rotulo: "Outros biomas", biomas: ["caatinga", "mata_atlantica", "pampa", "pantanal"] },
};

/** Onde está o par [recebido, último] de cada medida que só existe somando municípios. */
const CAMPO_MUNICIPAL: Partial<Record<Lente, (x: Municipal) => readonly [number | null, number] | undefined>> = {
  queimada: (x) => x.q,
  fiscalizacao: (x) => (x.i ? [x.i[0], x.i[1]] : undefined),
  multas: (x) => x.v,
  embargos: (x) => x.e,
};
const ehAreaProtegida = (l: Lente) => l === "ti" || l === "uc";

/** Na lista curta, o que diferencia a unidade é o nome dela, não a categoria por extenso. */
const nomeCurtoDaArea = (nome: string) =>
  nome
    .replace(/^Área de Proteção Ambiental( d[aeo]s?)?\b/i, "APA")
    .replace(/^Reserva Extrativista( d[aeo]s?)?\b/i, "Resex")
    .replace(/^Reserva Particular do Patrimônio Natural\b/i, "RPPN")
    .replace(/^Floresta Nacional( d[aeo]s?)?\b/i, "Flona");

/** A unidade da legenda em cada modo. */
const UNIDADE: Record<Lente, Record<"area" | "total", string>> = {
  desmatamento: { area: "km² desmatados por 1.000 km²", total: "km² desmatados" },
  alertas: { area: "km² em alerta por 1.000 km², 12 meses", total: "km² em alerta, 12 meses" },
  fogo: { area: "focos por 1.000 km²", total: "focos" },
  fiscalizacao: { area: "autos por 1.000 km², 12 meses", total: "autos, 12 meses" },
  queimada: { area: "km² queimados por 1.000 km², 12 meses", total: "km² queimados, 12 meses" },
  multas: { area: "R$ milhões por 1.000 km², 12 meses", total: "R$ milhões em multas, 12 meses" },
  embargos: { area: "embargos por 1.000 km², 12 meses", total: "embargos, 12 meses" },
  ti: { area: "km² desmatados em cada terra", total: "km² desmatados em cada terra" },
  uc: { area: "km² desmatados em cada unidade", total: "km² desmatados em cada unidade" },
};

const MOVIMENTO = "duration-700 ease-[cubic-bezier(.22,1,.36,1)]";
const LARGURA_BARRA = "23.5rem";
const ESMAECER = "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)";
const ROTULO_BLOCO = "mono text-[10px] font-medium uppercase tracking-[0.14em]";
const CAIXAS = biomasMunicipios.caixas as unknown as Record<string, [number, number, number, number]>;

/**
 * Os biomas como miniaturas do Brasil, com o bioma aceso: mostra onde cada um
 * fica, sem precisar saber de cor. O desenho é o dos municípios que o mapa enquadra
 * ao tocar. A cor é a da medida que o mapa está mostrando, e o escolhido ganha a
 * moldura em ouro; nada muda de tamanho.
 *
 * Tocar em "Amazônia" no placar nacional acende a Amazônia aqui também (`acesos`), e
 * "Outros biomas" acende os quatro: mostra quais são. Tocar na miniatura acesa entra
 * no bioma, com o mapa enquadrado e o placar dele.
 */
function SeletorBioma({
  lente,
  escolhido,
  acesos,
  aoEscolher,
}: {
  lente: Lente;
  escolhido: string | null | undefined;
  acesos: string[] | null;
  aoEscolher: (id: string | null) => void;
}) {
  const rampa = RAMPA_DA_LENTE[lente];
  return (
    <div
      className="abas-bioma"
      role="radiogroup"
      aria-label="Bioma"
      style={{ "--bioma-aceso": `var(--${rampa}-4)`, "--bioma-calmo": `var(--${rampa}-3)` } as React.CSSProperties}
    >
      {BIOMAS.map((b) => {
        const aceso = acesos ? b.id !== null && acesos.includes(b.id) : escolhido === b.id;
        return (
          <button
            key={b.rotulo}
            type="button"
            role="radio"
            aria-checked={aceso && (acesos?.length ?? 1) === 1}
            data-aceso={aceso ? "" : undefined}
            data-bioma={b.id ?? "brasil"}
            onClick={() => aoEscolher(b.id)}
          >
            <svg viewBox={silhuetas.viewBox} aria-hidden>
              {b.id && <path className="bioma-fundo" d={silhuetas.brasil} fillRule="evenodd" />}
              <path className="bioma-forma" d={b.id ? silhuetas.biomas[b.id as keyof typeof silhuetas.biomas] : silhuetas.brasil} fillRule="evenodd" />
            </svg>
            <span>{b.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/** O que a esquerda diz de uma lente no recorte escolhido. */
interface Resumo {
  valor: number | null;
  recebido: number | null;
  formato: Formato;
  direcao: Direcao;
  periodo: string;
  datas: string[];
  valores: (number | null)[];
  /** Por que não há número neste recorte. */
  fora?: string;
}

/** Os gráficos curtos começam pouco antes da posse; a soma de 12 meses, na do último dezembro antes dela. */
const desdeNoMandato = (dados: DadosPainel) => deslocar(dados.foco.posse, -13);
/** O PRODES por bioma só é anual desde 2017; nos governos antigos, a taxa vem de antes. */
const desdeAnual = (dados: DadosPainel) => (doisAnosAntes(dados.foco.posse) < "2017-01" ? doisAnosAntes(dados.foco.posse) : "2017-01");

const SEM_DADO: Omit<Resumo, "periodo"> = { valor: null, recebido: null, formato: "km2", direcao: "neutro", datas: [], valores: [] };

function daLeitura(l: Leitura | undefined, s: (number | null)[] | undefined, ano: number | null): Resumo {
  if (!l || !s) return { ...SEM_DADO, periodo: "" };
  const porAno = ano === null ? -1 : l.periodos.findIndex((p) => p.codigo === `${ano}-07`);
  const i = porAno >= 0 ? porAno : s.findLastIndex((v) => v !== null);
  return {
    valor: s[i] ?? null,
    recebido: l.indiceRecebido === null ? null : (s[l.indiceRecebido] ?? null),
    formato: l.formato,
    direcao: l.direcao ?? "neutro",
    periodo: l.periodos[i]?.extenso ?? "",
    datas: l.periodos.slice(0, i + 1).map((p) => p.codigo),
    valores: s.slice(0, i + 1),
  };
}

function daSerie(s: SerieEconomia | null | undefined, ano: number | null, desde: string): Resumo {
  if (!s) return { ...SEM_DADO, periodo: "" };
  const porAno = ano === null ? -1 : s.datas.indexOf(`${ano}-07`);
  const i = porAno >= 0 ? porAno : s.valores.findLastIndex((v) => v !== null);
  const corte = Math.max(0, s.datas.findIndex((d) => d >= desde));
  return {
    valor: s.valores[i] ?? null,
    recebido: recebidoDaSerie(s)?.valor ?? null,
    formato: s.formato,
    direcao: s.direcao,
    periodo: s.datas[i] ? referencia(s, s.datas[i]) : "",
    datas: s.datas.slice(corte, i + 1),
    valores: s.valores.slice(corte, i + 1),
  };
}

function resumoDaLente(
  lente: Lente,
  dados: DadosPainel,
  bioma: string | null,
  uf: UF | null,
  municipal: MunicipiosAmbiente | null,
  ano: number | null,
  regiao: RegiaoPlacar | null = null,
): Resumo {
  const leitura = (id: string) => [...dados.leituras.ambiente, ...dados.ambiente.fiscalizacao].find((l) => l.id === id);
  const serie = (id: string) => dados.ambiente.series.find((x) => x.id === id);
  const idLeitura: Partial<Record<Lente, string>> = { desmatamento: "desmatamento", alertas: "alertas_12m", fogo: "focos_12m", fiscalizacao: "autos_12m", embargos: "embargos_12m" };
  const FORA_QUEIMADA = { ...SEM_DADO, periodo: "", fora: "O INPE só mede a área queimada na Amazônia" };
  const formatoDa = (l: Lente): Formato => (l === "multas" ? "reaiscurto" : l === "queimada" ? "km2" : "contagem");
  const noMandato = desdeNoMandato(dados);
  const anual = desdeAnual(dados);
  const somado = (soma: { agora: number; recebido: number | null } | null, periodo: string): Resumo => ({
    ...SEM_DADO,
    valor: soma?.agora ?? null,
    recebido: soma?.recebido ?? null,
    formato: formatoDa(lente),
    direcao: lente === "queimada" ? "menor_melhor" : "neutro",
    periodo,
  });

  // A linha "Amazônia" do placar nacional: o número da linha, não a soma dos municípios.
  if (regiao && !uf && !bioma) {
    if (lente === "desmatamento") return daSerie(serie(`prodes_${regiao}`) ?? dados.ambiente.porBioma.find((b) => b.id === regiao)?.prodes, ano, anual);
    if (lente === "alertas") return daSerie(serie(`alertas_${regiao}_12m`), null, noMandato);
  }
  if (ehAreaProtegida(lente)) {
    if (uf) return { ...SEM_DADO, periodo: "", fora: "O INPE publica por área, não por estado" };
    const p = dados.ambiente.protegidas;
    const r = lente as "ti" | "uc";
    return daSerie(bioma ? p?.porBioma[bioma]?.[r] : p?.[r], ano, anual);
  }
  const campo = CAMPO_MUNICIPAL[lente];
  if (uf) {
    if (campo && !idLeitura[lente]) {
      const soma = municipal ? somaNaUf(municipal, uf.codigo, campo) : null;
      if (!soma && municipal && lente === "queimada") return FORA_QUEIMADA;
      return somado(soma, "12 meses, municípios do estado");
    }
    const l = leitura(idLeitura[lente]!);
    const r = daLeitura(l, l?.ufs[uf.codigo], lente === "desmatamento" ? ano : null);
    return l && !l.ufs[uf.codigo] ? { ...r, fora: `O DETER não cobre ${uf.deNome.replace(/^d[oae]s? /, "")}` } : r;
  }
  if (!bioma) {
    if (lente === "queimada") return daSerie(serie("cicatriz_12m"), null, noMandato);
    if (lente === "multas") return daSerie(serie("multas_12m"), null, noMandato);
    const l = leitura(idLeitura[lente]!);
    return daLeitura(l, l?.brasil, lente === "desmatamento" ? ano : null);
  }
  const doBioma = dados.ambiente.porBioma.find((b) => b.id === bioma);
  if (lente === "desmatamento") return daSerie(doBioma?.prodes, ano, anual);
  if (lente === "fogo") return daSerie(doBioma?.focos, null, noMandato);
  if (lente === "alertas") {
    const s = serie(`alertas_${bioma}_12m`);
    return s ? daSerie(s, null, noMandato) : { ...SEM_DADO, periodo: "", fora: "O INPE só publica alertas da Amazônia e do Cerrado" };
  }
  if (lente === "queimada") return bioma === "amazonia" ? daSerie(serie("cicatriz_12m"), null, noMandato) : FORA_QUEIMADA;
  return somado(municipal && campo ? somaNoBioma(municipal, bioma, campo) : null, "12 meses, municípios do bioma");
}

/** A mudança desde a posse: em %, e o sentido pela direção da medida. */
function mudancaDe(r: Pick<Resumo, "valor" | "recebido" | "direcao">): { texto: string; sentido: Sentido } | null {
  if (r.valor === null || r.recebido === null || r.recebido === 0) return null;
  const v = Math.round(((r.valor - r.recebido) / r.recebido) * 100);
  return { texto: textoVariacao(r.valor, r.recebido), sentido: sentidoDe(v, r.direcao) };
}

interface Props {
  dados: DadosPainel;
  formas: MunicipioNacional[] | null;
  municipal: MunicipiosAmbiente | null;
  placar: PlacarAmbiente;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  bioma: string | null;
  setBioma: (b: string | null) => void;
  municipio: string | null;
  setMunicipio: (m: string | null) => void;
  aoFocarSerie: (id: string) => void;
  aoVerHistorico: (id: string) => void;
}

export function SalaAmbiente({
  dados,
  formas,
  municipal,
  placar,
  sigla,
  setSigla,
  bioma,
  setBioma,
  municipio,
  setMunicipio,
  aoFocarSerie,
  aoVerHistorico,
}: Props) {
  const [lente, setLente] = useEstadoCompartilhavel<Lente>("mapa.lente", "desmatamento", opcaoCompartilhada(["desmatamento","alertas","fogo","queimada","ti","uc","fiscalizacao","multas","embargos"]));
  const [modoEscolhido, setModo] = useEstadoCompartilhavel<ModoMapa>("mapa.modo", "area", opcaoCompartilhada(["area","total","posse"]));
  const [recorte, setRecorte] = useEstadoCompartilhavel<"municipios" | "estados">("mapa.recorte", "municipios", opcaoCompartilhada(["municipios","estados"]));
  const [anoEscolhido, setAno] = useEstadoCompartilhavel<{ desmatamento: number | null; fogo: number | null; protegidas: number | null }>("mapa.anos", { desmatamento: null, fogo: null, protegidas: null }, v=>!!v&&typeof v==="object"&&["desmatamento","fogo","protegidas"].every(k=>k in v)&&Object.values(v).every(n=>n===null||typeof n==="number"&&Number.isInteger(n)&&n>=1900&&n<=2200), (v):{desmatamento:number|null;fogo:number|null;protegidas:number|null}=>chaveDoAno?{...v,[chaveDoAno]:ano}:v);
  // A linha do placar nacional que separa um pedaço do Brasil: pinta só os municípios dele.
  const [regiao, setRegiao] = useEstadoCompartilhavel<RegiaoPlacar | null>("mapa.regiao", null, opcaoCompartilhada([null,"amazonia","cerrado","caatinga","mata_atlantica","pampa","pantanal","outros"]));
  const [areaEscolhida, setAreaEscolhida] = useEstadoCompartilhavel<string | null>("mapa.area", null, v=>v===null||textoCompartilhado(v));
  // O bioma e o estado também se escolhem nas tabelas lá embaixo: o pedaço do Brasil aceso aqui não sobrevive a isso.
  const recorteAgora = `${bioma}|${sigla}`;
  const [recorteVisto, setRecorteVisto] = useState(recorteAgora);
  if (recorteVisto !== recorteAgora) {
    setRecorteVisto(recorteAgora);
    setRegiao(null);
    setAreaEscolhida(null);
  }
  const uf = dados.ufs.find((u) => u.sigla === sigla) ?? null;
  const ehArea = ehAreaProtegida(lente);
  const { areas, valores: valoresDasAreas } = useAreasProtegidas(ehArea);

  // A fiscalização não tem lado: não há "desde a posse" em cor. E cada área protegida
  // pinta pelo próprio número: "por área" só faz sentido para dividir por município.
  const ehIbama = MEDIDAS[lente].familia === "fiscalizacao";
  const modos: ModoMapa[] = ehIbama ? ["area", "total"] : ehArea ? ["total", "posse"] : ["area", "total", "posse"];
  const modo = modos.includes(modoEscolhido) ? modoEscolhido : modos[0];

  // Os anos que o mapa sabe mostrar: 2026 só existe na Amazônia e no Cerrado.
  const anosDaLente = useMemo(() => {
    if (lente === "fogo") return dados.queimadas.anos;
    if (ehArea) {
      const p = dados.ambiente.protegidas;
      return bioma ? (p?.porBioma[bioma]?.[lente as "ti" | "uc"]?.datas.map((d) => Number(d.slice(0, 4))) ?? []) : (p?.anos ?? []);
    }
    if (lente !== "desmatamento") return [];
    const l = dados.leituras.ambiente.find((x) => x.id === "desmatamento");
    const completos = l?.periodos.map((p) => Number(p.codigo.slice(0, 4))) ?? [];
    // A Amazônia e o Cerrado já têm o ano preliminar; a linha "Outros biomas" não.
    const umBioma = bioma ?? (regiao && REGIOES[regiao].biomas.length === 1 ? REGIOES[regiao].biomas[0] : null);
    if (!umBioma || uf) return completos;
    const s = dados.ambiente.porBioma.find((b) => b.id === umBioma)?.prodes;
    const ultimo = s?.referencia ? Number(s.referencia.slice(0, 4)) : null;
    return ultimo && !completos.includes(ultimo) ? [...completos, ultimo] : completos;
  }, [lente, ehArea, bioma, regiao, uf, dados]);
  const chaveDoAno = lente === "fogo" ? "fogo" : lente === "desmatamento" ? "desmatamento" : ehArea ? "protegidas" : null;
  const pedido: number | null = chaveDoAno ? anoEscolhido[chaveDoAno] : null;
  const ano: number | null = pedido !== null && anosDaLente.includes(pedido) ? pedido : (anosDaLente.at(-1) ?? null);

  // Os governos antigos não têm número por município em tudo: o mapa fica nos estados, e diz por quê.
  const semMunicipio = Boolean(
    municipal && (lente === "desmatamento" ? ano === null || !municipal.anos.includes(ano) : lente === "fogo" ? ano === null || !municipal.focosAnos.includes(ano) : false),
  );
  // Área protegida se desenha por contorno: nem município nem estado.
  const recorteDoMapa = ehArea ? "municipios" : semMunicipio ? "estados" : recorte;
  const anoRecebido = dados.foco.anoRecebido;

  const familiaAtiva = MEDIDAS[lente].familia;
  const medidaDa = (f: Lente) => (f === familiaAtiva ? lente : f);
  const resumos = useMemo(
    () =>
      Object.fromEntries(
        FAMILIAS.map((f) => {
          const m = f === familiaAtiva ? lente : f;
          return [f, m === lente ? resumoDaLente(m, dados, bioma, uf, municipal, ano, regiao) : resumoDaLente(m, dados, bioma, uf, municipal, null)];
        }),
      ) as Record<Lente, Resumo>,
    [dados, bioma, uf, municipal, lente, familiaAtiva, ano, regiao],
  );
  const resumo = resumos[familiaAtiva];
  const dif = mudancaDe(resumo);

  // O recorte: um município está nele se é da UF, do bioma ou do pedaço do Brasil escolhido.
  const biomasDaRegiao = regiao ? REGIOES[regiao].biomas : null;
  const noRecorte = (m: MunicipioNacional) => {
    if (uf) return m.uf === uf.sigla;
    const b = municipal?.m[m.codigo]?.b ?? null;
    if (bioma) return b === bioma;
    return biomasDaRegiao ? b !== null && biomasDaRegiao.includes(b) : true;
  };

  const cores = useMemo(() => {
    if (!formas || !municipal) return null;
    return new Map(
      formas.map((m) => {
        if (ehArea || !noRecorte(m)) return [m.codigo, "var(--atlas-papel)"] as const;
        const n = numerosDaLente(municipal.m[m.codigo], lente, municipal, ano);
        return [m.codigo, corDaLente(n.agora, n.recebido, lente, modo, m.areaKm2)] as const;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formas, municipal, lente, ehArea, modo, ano, bioma, regiao, uf]);

  // As áreas protegidas: as do bioma escolhido, ou todas, com o número do ano no mapa.
  const areasNaVez = useMemo(() => {
    if (!ehArea || !areas || !valoresDasAreas) return null;
    return areas
      .filter((a) => a.r === lente && (!bioma || a.b === bioma))
      .map((a) => ({ area: a, ...numerosDaArea(valoresDasAreas, a.chave, a.b, ano, anoRecebido) }));
  }, [ehArea, areas, valoresDasAreas, lente, bioma, ano, anoRecebido]);
  const camadaDeAreas = useMemo(
    () =>
      areasNaVez && {
        lista: areasNaVez.map((x) => x.area),
        numeros: new Map(areasNaVez.map((x) => [x.area.chave, { agora: x.agora, recebido: x.recebido }])),
        cores: new Map(areasNaVez.map((x) => [x.area.chave, corDaLente(x.agora, x.recebido, lente, modo, 0)])),
      },
    [areasNaVez, lente, modo],
  );

  const ondeMais = useMemo(() => {
    const emOrdem = <T extends { agora: number; recebido: number }>(itens: T[]) => {
      const ordem = (x: T) => (modo === "posse" ? x.agora - x.recebido : x.agora);
      return itens.sort((a, b) => ordem(b) - ordem(a)).slice(0, 5);
    };
    if (ehArea) {
      return emOrdem(
        (areasNaVez ?? []).flatMap((x) =>
          x.agora === null || (modo !== "posse" && x.agora === 0)
            ? []
            : [{ id: x.area.chave, nome: nomeCurtoDaArea(titulo(x.area.n)), completo: titulo(x.area.n), sufixo: "", agora: x.agora, recebido: x.recebido ?? 0 }],
        ),
      );
    }
    if (!formas || !municipal) return [];
    return emOrdem(
      formas.flatMap((m) => {
        if (!noRecorte(m)) return [];
        const n = numerosDaLente(municipal.m[m.codigo], lente, municipal, ano);
        return n.agora === null ? [] : [{ id: m.codigo, nome: m.nome, completo: m.nome, sufixo: m.uf, agora: n.agora, recebido: n.recebido ?? 0 }];
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formas, municipal, lente, ehArea, areasNaVez, modo, ano, bioma, regiao, uf]);

  // O mapa por estado, que também é o que aparece enquanto os municípios chegam.
  const coresUf = useMemo(() => {
    const id = ({ desmatamento: "desmatamento", alertas: "alertas_12m", fogo: "focos_12m", fiscalizacao: "autos_12m", embargos: "embargos_12m" } as Partial<Record<Lente, string>>)[lente];
    const l = [...dados.leituras.ambiente, ...dados.ambiente.fiscalizacao].find((x) => x.id === id);
    const campo = CAMPO_MUNICIPAL[lente];
    const valores = dados.ufs.map((u) => {
      // Sem leitura por estado, soma os municípios dele.
      if (!l && campo) {
        const soma = municipal ? somaNaUf(municipal, u.codigo, campo) : null;
        return { u, agora: soma?.agora ?? null, recebido: soma?.recebido ?? null };
      }
      const s = l?.ufs[u.codigo];
      const r = daLeitura(l, s, lente === "desmatamento" ? ano : null);
      return { u, agora: s ? r.valor : null, recebido: r.recebido };
    });
    const medida = (x: (typeof valores)[number]) => (x.agora === null ? null : modo === "area" ? (x.agora / x.u.areaKm2) * 1000 : x.agora);
    const regua = reguaDeCor(valores.map(medida), "log", RAMPA_DA_LENTE[lente]);
    return new Map(
      valores.map((x) => {
        const dentro = uf ? x.u.sigla === uf.sigla : true;
        if (!dentro) return [x.u.sigla, "var(--atlas-papel)"] as const;
        if (modo === "posse") return [x.u.sigla, corDaLente(x.agora, x.recebido, lente, "posse", x.u.areaKm2)] as const;
        return [x.u.sigla, x.agora === null ? "var(--atlas-papel)" : regua.cor(medida(x))] as const;
      }),
    );
  }, [dados, municipal, lente, modo, ano, uf]);

  // Trocar de lente é um instante de esmaecer: a camada toda, de uma vez, nunca município a município.
  const camada = useRef<HTMLDivElement>(null);
  const vista = useRef(`${lente}|${modo}|${regiao}`);
  useEffect(() => {
    const atual = `${lente}|${modo}|${regiao}`;
    if (vista.current === atual) return;
    vista.current = atual;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    camada.current?.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 420, easing: "ease-out" });
  }, [lente, modo, regiao]);

  const escolherBioma = (b: string | null) => {
    setBioma(b);
    setSigla(null);
    setMunicipio(null);
    setRegiao(null);
    setAreaEscolhida(null);
  };
  const escolherUf = (s: string | null) => {
    setSigla(s);
    setBioma(null);
    setMunicipio(null);
    setRegiao(null);
    setAreaEscolhida(null);
    if (s) setRecorte("municipios");
  };
  const escolherLente = (l: Lente) => {
    setLente(l);
    setRegiao(null);
    setAreaEscolhida(null);
  };
  // Uma linha do placar: a medida dela no mapa e, no placar nacional, o pedaço do Brasil dela.
  const verNoMapa = (v: VistaDoMapa) => {
    setLente(v.lente);
    setRegiao(v.regiao ?? null);
    setAreaEscolhida(null);
  };
  const vistaAtiva = (v: VistaDoMapa) => v.lente === lente && (v.regiao ?? null) === regiao;
  const vistaAcesa = (v: VistaDoMapa) => vistaAtiva(v) || (v.lente === lente && regiao !== null && v.regiao !== undefined && REGIOES[regiao].biomas.includes(v.regiao));

  const forma = municipio ? (formas?.find((m) => m.codigo === municipio) ?? null) : null;
  const caixa = uf ? uf.caixa : bioma ? (CAIXAS[bioma] ?? null) : null;
  const nomeRecorte = uf ? uf.nome : bioma ? NOME_BIOMA[bioma] : regiao ? REGIOES[regiao].rotulo : "Brasil";
  const corDif = dif ? corDoSentido(dif.sentido) : undefined;
  const placarDaVez = uf ? placarDoEstado(dados, uf, municipal) : bioma ? placarDoBioma(dados, bioma, municipal) : placar;

  return (
    <section id="mapa-ambiente" className="sala-tema relative -mx-3 -mt-3 overflow-hidden" aria-label="Meio ambiente no Brasil">
      <div
        className="relative mx-auto flex max-w-[1680px] flex-col gap-4 px-3 py-4 lg:block lg:h-[calc(100dvh-var(--altura-cabecalho,4rem))] lg:min-h-[640px] lg:p-0"
        style={{ "--largura": LARGURA_BARRA } as React.CSSProperties}
      >
        {/* A esquerda, de cima para baixo: a lente escolhida; as cinco lentes;
            onde mais acontece; como ler o mapa. Tudo em altura fixa: trocar de
            lente não move nada. */}
        <div
          data-coluna-resumo
          className="contents lg:absolute lg:bottom-6 lg:left-6 lg:top-6 lg:z-10 lg:flex lg:w-[17rem] lg:flex-col lg:gap-3.5"
        >
          <div className="order-1" data-destaque={lente}>
            <h1 className="titulo-painel">Meio ambiente</h1>
            <p className="mono flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: "var(--serie)" }}>
              {nomeRecorte}
              {(uf || bioma || regiao) && (
                <button
                  type="button"
                  onClick={() => escolherBioma(null)}
                  className="text-[10px] normal-case tracking-normal hover:underline"
                  style={{ color: "var(--tinta-3)", fontFamily: "var(--fonte-sans)" }}
                >
                  ← Brasil
                </button>
              )}
            </p>
            <div className="flex items-center justify-between gap-2"><h2 className="mt-1 truncate text-[15px] font-semibold">{MEDIDAS[lente].rotulo}</h2><Compartilhar mensagem={resumo.valor===null?MEDIDAS[lente].rotulo+" · "+nomeRecorte:`${MEDIDAS[lente].rotulo} · ${nomeRecorte}: ${formatar(resumo.valor,resumo.formato)}${dif?`, ${dif.texto} contra ${anoRecebido}`:""}.${resumo.periodo?` ${resumo.periodo[0].toUpperCase()}${resumo.periodo.slice(1).replace("*",", preliminar")}.`:""} Veja no mapa:`} contexto="" ancora="mapa-ambiente" compacto/></div>
            <div className="mt-1.5 flex h-11 items-end gap-3">
              <p className="manchete shrink-0 text-4xl font-bold leading-none xl:text-[2.75rem]">
                <NumeroRolante texto={resumo.valor === null ? "—" : formatar(resumo.valor, resumo.formato)} />
              </p>
              {resumo.datas.length > 2 && (
                <span key={`faisca-${lente}-${nomeRecorte}`} className="mb-1 min-w-0 flex-1 animate-[aparecer_.5s_ease-out_backwards]">
                  <Faisca datas={resumo.datas} valores={resumo.valores} altura={30} cor={corDif ?? "var(--serie)"} />
                </span>
              )}
            </div>
            <p className="tabular mt-1.5 h-4 truncate text-xs" style={{ color: "var(--tinta-3)" }}>
              {resumo.fora ?? resumo.periodo}
            </p>
            <div className="mt-2 h-6">
              {dif && (
                <p
                  className="inline-flex max-w-full items-baseline gap-x-1.5 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs"
                  style={{ background: `color-mix(in srgb, ${corDif ?? "var(--tinta-3)"} 9%, transparent)`, color: corDif ?? "var(--tinta-2)" }}
                >
                  <strong className="tabular">{dif.texto}</strong>
                  <span style={{ color: "var(--tinta-2)" }}>contra {anoRecebido}{resumo.direcao === "neutro" ? ", sem cor: é ação do governo" : ""}</span>
                </p>
              )}
            </div>
          </div>

          <section className="order-2" aria-label="Formas de ver">
            <ul role="radiogroup" aria-label="O que o mapa mostra">
              {FAMILIAS.map((f) => {
                const r = resumos[f];
                const d = mudancaDe(r);
                const ativa = f === familiaAtiva;
                return (
                  <li key={f}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={ativa}
                      data-lente={f}
                      onClick={() => escolherLente(f)}
                      className={`flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[12.5px] ${ativa ? "linha-escolhida font-semibold" : "hover:bg-[var(--faixa-a)]"}`}
                    >
                      <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: `var(--${RAMPA_DA_LENTE[f]}-4)` }} />
                      <span className="min-w-0 flex-1 truncate">{MEDIDAS[medidaDa(f)].curto}</span>
                      <span className="tabular shrink-0" style={{ color: "var(--tinta-2)" }}>
                        {r.valor === null ? "—" : compacto(r.valor, r.formato)}
                      </span>
                      <span className="flex w-[3.1rem] shrink-0 justify-end">
                        {d && <PilulaVeredito texto={d.texto} sentido={d.sentido} className="text-[10.5px]" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="order-5 border-t pt-2.5 lg:order-3" style={{ borderColor: "var(--borda)" }} aria-label="Onde mais acontece">
            <p className={ROTULO_BLOCO} style={{ color: "var(--tinta-3)" }}>
              {modo === "posse" ? `Onde mais cresceu desde ${anoRecebido}` : `Onde mais${chaveDoAno ? ` · ${ano ?? ""}` : " · 12 meses"}`}
            </p>
            <ol className="onde-mais mt-1">
              {ondeMais.length === 0 && municipal && (ano !== null || !ehArea) && !(ehArea && !areasNaVez) && (
                <li className="px-1 text-[11.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
                  {ehArea ? "Nenhuma área com desmatamento neste ano." : "Sem número por município neste mandato."}
                </li>
              )}
              {ehArea && ano === null && (
                <li className="px-1 text-[11.5px] leading-snug" style={{ color: "var(--tinta-3)" }}>
                  O desmatamento por área começa em 2017.
                </li>
              )}
              {ondeMais.map((x) => {
                const d = x.agora - x.recebido;
                const escolhido = ehArea ? areaEscolhida === x.id : municipio === x.id;
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => (ehArea ? setAreaEscolhida(escolhido ? null : x.id) : setMunicipio(escolhido ? null : x.id))}
                      aria-pressed={escolhido}
                      className={`flex h-6 w-full items-center gap-1.5 rounded-md px-1 text-left text-[12px] ${escolhido ? "linha-escolhida" : "hover:bg-[var(--faixa-a)]"}`}
                    >
                      <span className="min-w-0 flex-1 truncate" title={x.completo}>
                        {x.nome} <span style={{ color: "var(--tinta-3)" }}>{x.sufixo}</span>
                      </span>
                      <span className="tabular shrink-0 font-medium" style={{ color: "var(--tinta-2)" }}>
                        {modo === "posse" ? `${d > 0 ? "+" : ""}${formatarNaLente(d, lente)}` : formatarNaLente(x.agora, lente)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="controle-mapa vidro order-4 w-full rounded-2xl px-3 py-2.5 lg:order-last lg:mt-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="modos-mapa" role="radiogroup" aria-label="Como pintar o mapa">
                {modos.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={m === modo} data-opcao={m} onClick={() => setModo(m)}>
                    {m === "area" ? "Por área" : m === "total" ? "Total" : "Desde a posse"}
                  </button>
                ))}
              </div>
            </div>
            <LegendaLente lente={lente} modo={modo} recorte={recorteDoMapa} anoRecebido={anoRecebido} />
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2 text-[11px]" style={{ borderColor: "var(--borda)", color: "var(--tinta-2)" }}>
              {ehArea ? (
                <span style={{ color: "var(--tinta)", fontWeight: 600 }}>{lente === "ti" ? "Cada terra" : "Cada unidade"}</span>
              ) : semMunicipio ? (
                <span title={lente === "fogo" ? "O número de focos por município começa em 2022." : "O desmatamento por município começa em 2017."} style={{ color: "var(--tinta)", fontWeight: 600 }}>
                  Só por estado
                </span>
              ) : (
                <span className="inline-flex gap-2.5" role="radiogroup" aria-label="Recorte do mapa">
                  {(["municipios", "estados"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={r === recorte}
                      onClick={() => setRecorte(r)}
                      style={r === recorte ? { color: "var(--tinta)", fontWeight: 600 } : undefined}
                    >
                      {r === "municipios" ? "Municípios" : "Estados"}
                    </button>
                  ))}
                </span>
              )}
              {anosDaLente.length > 1 && chaveDoAno && (recorteDoMapa === "municipios" || (semMunicipio && lente === "desmatamento")) ? (
                <SeletorAno anos={anosDaLente} ano={ano} preliminar={municipal?.preliminar ?? null} aoEscolher={(a) => setAno((v) => ({ ...v, [chaveDoAno]: a }))} />
              ) : (
                <span style={{ color: "var(--tinta-3)" }}>{chaveDoAno ? "" : "12 meses"}</span>
              )}
            </div>
          </div>
        </div>

        <div
          ref={camada}
          className="order-3 h-[82vw] max-h-[560px] animate-[aproximar_1.6s_cubic-bezier(.16,1,.3,1)_both] lg:absolute lg:bottom-5 lg:left-[19.5rem] lg:right-[calc(var(--largura)+2.5rem)] lg:top-5 lg:h-auto lg:max-h-none"
          aria-label={`Mapa: ${MEDIDAS[lente].rotulo}`}
        >
          <MapaTerritorio
            dados={dados}
            formas={recorteDoMapa === "municipios" ? formas : null}
            cores={recorteDoMapa === "municipios" ? cores : null}
            coresUf={coresUf}
            caixa={caixa}
            destaque={municipio}
            municipal={municipal}
            areas={ehArea ? camadaDeAreas : null}
            areaEscolhida={areaEscolhida}
            aoTocarArea={(c) => setAreaEscolhida(areaEscolhida === c ? null : c)}
            anoDasAreas={ano}
            anoRecebido={anoRecebido}
            aoTocarMunicipio={(c) => setMunicipio(municipio === c ? null : c)}
            aoTocarUf={escolherUf}
            ano={{ desmatamento: lente === "desmatamento" ? ano : (municipal?.anoCompleto ?? null), fogo: lente === "fogo" ? ano : (dados.queimadas.anos.at(-1) ?? null) }}
          />
        </div>

        <aside
          className="vidro order-5 animate-[entrar-lado_.6s_ease-out_.1s_backwards] rounded-3xl p-2 lg:absolute lg:right-5 lg:top-5 lg:z-20 lg:flex lg:max-h-[calc(100%-2.5rem)] lg:w-[var(--largura)] lg:flex-col"
          aria-label="Indicadores do meio ambiente"
        >
          <div className="px-1.5 pt-1.5">
            <SeletorBioma lente={lente} escolhido={uf ? undefined : bioma} acesos={biomasDaRegiao} aoEscolher={escolherBioma} />
            {uf && (
              <p className="mt-1.5 flex items-center justify-between gap-2 px-1.5 text-[12px] font-semibold">
                {uf.nome}
                <button type="button" onClick={() => escolherUf(null)} className="text-[11px] font-normal hover:underline" style={{ color: "var(--tinta-3)" }}>
                  voltar ao Brasil
                </button>
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-5" style={{ scrollbarWidth: "none", maskImage: ESMAECER, WebkitMaskImage: ESMAECER }}>
            {forma && municipal ? (
              <FichaMunicipio
                forma={forma}
                municipal={municipal}
                aoFechar={() => setMunicipio(null)}
                nomeUf={dados.ufs.find((u) => u.sigla === forma.uf)?.nome ?? forma.uf}
                aoVerEstado={uf ? undefined : () => escolherUf(forma.uf)}
              />
            ) : (
              <PlacarTerritorio
                key={`${dados.foco.id}-${uf?.sigla ?? bioma ?? "brasil"}`}
                grupos={placarDaVez.grupos}
                fileiras={placarDaVez.fileiras}
                anoRecebido={anoRecebido}
                emCurso={dados.foco.emCurso}
                vistaAtiva={vistaAtiva}
                vistaAcesa={vistaAcesa}
                aoVerNoMapa={verNoMapa}
                aoFocar={aoFocarSerie}
                aoVerHistorico={aoVerHistorico}
              />
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

/** O número na linha da lente, curto o bastante para a coluna: "130,9 mil", "R$ 4,4 bi". */
function compacto(v: number, formato: Formato): string {
  if (formato === "km2") return `${numero(v, 0)} km²`;
  if (formato === "reaiscurto") return formatar(v, formato);
  return v >= 10000 ? `${numero(v / 1000, 1)} mil` : numero(v, 0);
}

function formatarNaLente(v: number, lente: Lente): string {
  if (lente === "desmatamento" || lente === "alertas" || lente === "queimada" || ehAreaProtegida(lente)) return `${numero(v, Math.abs(v) < 10 ? 1 : 0)} km²`;
  if (lente === "multas") return reaisNoFicha(v);
  return numero(v, 0);
}

function SeletorAno({
  anos,
  ano,
  preliminar,
  aoEscolher,
}: {
  anos: number[];
  ano: number | null;
  preliminar: number | null;
  aoEscolher: (a: number) => void;
}) {
  const i = ano === null ? -1 : anos.indexOf(ano);
  const botao = "flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--faixa-a)] disabled:opacity-30";
  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label="Ano do mapa">
      <button type="button" className={botao} disabled={i <= 0} aria-label="Ano anterior" onClick={() => aoEscolher(anos[i - 1])}>
        ‹
      </button>
      <span className="tabular min-w-[2.6rem] text-center font-semibold" style={{ color: "var(--tinta)" }}>
        {ano}
        {ano === preliminar ? "*" : ""}
      </span>
      <button type="button" className={botao} disabled={i < 0 || i >= anos.length - 1} aria-label="Ano seguinte" onClick={() => aoEscolher(anos[i + 1])}>
        ›
      </button>
    </span>
  );
}

/** Como ler o mapa: as faixas da lente, ou melhorou e piorou em "desde a posse". */
function LegendaLente({ lente, modo, recorte, anoRecebido }: { lente: Lente; modo: ModoMapa; recorte: "municipios" | "estados"; anoRecebido: number }) {
  if (modo === "posse") {
    return (
      <div className="mt-2.5 h-[52px] text-[10.5px]" style={{ color: "var(--tinta-2)" }} data-legenda>
        <p className="font-medium" style={{ color: "var(--tinta)" }}>
          Contra {anoRecebido}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {[
            ["var(--mapa-melhor)", "Melhorou"],
            ["var(--mapa-pior)", "Piorou"],
            ["var(--mapa-estavel)", "Estável ou pouco"],
            ["var(--atlas-papel)", "Sem medida"],
          ].map(([cor, rotulo]) => (
            <span key={rotulo} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: cor, boxShadow: "inset 0 0 0 1px var(--borda)" }} aria-hidden />
              {rotulo}
            </span>
          ))}
        </div>
      </div>
    );
  }
  const cortes = CORTES[lente][modo];
  const rampa = RAMPA_DA_LENTE[lente];
  const f = (n: number) => numero(n, n < 1 ? 1 : 0);
  const zero = RAMPA_DA_LENTE[lente] === "protegidas" ? "var(--protegidas-0)" : "var(--grade)";
  const rotulos = [`< ${f(cortes[0])}`, ...cortes.slice(0, -1).map((c, i) => `${f(c)}–${f(cortes[i + 1])}`), `${f(cortes.at(-1)!)}+`];
  return (
    <div className="mt-2.5 h-[52px] text-[10px]" style={{ color: "var(--tinta-2)" }} data-legenda>
      <p className="truncate text-[10.5px] font-medium" style={{ color: "var(--tinta)" }}>
        {recorte === "estados" ? `${UNIDADE[lente][modo]} · escala do estado` : UNIDADE[lente][modo]}
      </p>
      <div className="tabular mt-1 flex items-start gap-[2px]">
        <span className="flex w-6 shrink-0 flex-col items-center gap-0.5">
          <span className="block h-2 w-full rounded-sm" style={{ background: zero }} />0
        </span>
        {(recorte === "estados" ? ["", "", "", "", ""] : rotulos).map((r, k) => (
          <span key={k} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 whitespace-nowrap">
            <span className="block h-2 w-full rounded-sm" style={{ background: `var(--${rampa}-${k + 1})` }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// O mapa
// ---------------------------------------------------------------------------

/**
 * Camada dos 5.570 municípios, memorizada: passar o mouse não pode redesenhar
 * todos. O hover é por delegação (um ouvinte no grupo, o código no `data-m` do
 * path), e o contorno de destaque é desenhado à parte. Sem transição na cor de
 * cada path: 5.570 transições juntas travam a tela.
 */
const CamadaMunicipios = memo(function CamadaMunicipios({ formas, cores }: { formas: MunicipioNacional[]; cores: Map<string, string> }) {
  return (
    <>
      {formas.map((m) => (
        <path key={m.codigo} d={m.d} data-m={m.codigo} style={{ fill: cores.get(m.codigo) ?? "var(--grade)" }} />
      ))}
    </>
  );
});

/**
 * Os contornos das áreas protegidas, em cima dos municípios apagados. O traço leva a
 * cor da área: sem ele, uma unidade pequena não chega a um pixel e some do mapa.
 */
const CamadaAreas = memo(function CamadaAreas({ areas, cores }: { areas: AreaDesenhada[]; cores: Map<string, string> }) {
  return (
    <>
      {areas.map((a) => {
        const cor = cores.get(a.chave) ?? "var(--atlas-papel)";
        return <path key={a.chave} d={a.d} data-a={a.chave} fillRule="evenodd" style={{ fill: cor, stroke: cor }} />;
      })}
    </>
  );
});

const FOLGA = 12;

/** No zoom, o mapa some aos poucos nas bordas do vão, sem invadir a coluna nem a barra. */
const BORDAS_ESMAECIDAS: React.CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent), linear-gradient(to bottom, transparent, #000 4%, #000 96%, transparent)",
  WebkitMaskImage: "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent), linear-gradient(to bottom, transparent, #000 4%, #000 96%, transparent)",
  maskComposite: "intersect",
  WebkitMaskComposite: "source-in",
};

/**
 * O zoom é um `transform` no invólucro, que o navegador leva numa camada só:
 * mudar o viewBox a cada quadro redesenharia os 5.570 caminhos. No fim da
 * transição ele redesenha nítido na escala nova; as linhas e rótulos dividem
 * pela escala, para não engrossar.
 */
function MapaTerritorio({
  dados,
  formas,
  cores,
  coresUf,
  caixa,
  destaque,
  municipal,
  areas,
  areaEscolhida,
  aoTocarArea,
  anoDasAreas,
  anoRecebido,
  aoTocarMunicipio,
  aoTocarUf,
  ano,
}: {
  dados: DadosPainel;
  formas: MunicipioNacional[] | null;
  cores: Map<string, string> | null;
  coresUf: Map<string, string>;
  caixa: readonly [number, number, number, number] | null;
  destaque: string | null;
  municipal: MunicipiosAmbiente | null;
  areas: { lista: AreaDesenhada[]; cores: Map<string, string>; numeros: Map<string, { agora: number | null; recebido: number | null }> } | null | undefined;
  areaEscolhida: string | null;
  aoTocarArea: (chave: string) => void;
  anoDasAreas: number | null;
  anoRecebido: number;
  aoTocarMunicipio: (codigo: string) => void;
  aoTocarUf: (sigla: string) => void;
  ano: { desmatamento: number | null; fogo: number | null };
}) {
  const palco = useRef<HTMLDivElement>(null);
  const [tamanho, setTamanho] = useState({ l: 0, a: 0 });
  useLayoutEffect(() => {
    const el = palco.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTamanho({ l: r.width, a: r.height });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const L = dados.mapa.largura + FOLGA * 2;
  const A = dados.mapa.altura + FOLGA * 2;
  const s0 = tamanho.l && tamanho.a ? Math.min(tamanho.l / L, tamanho.a / A) : 1;
  let k = 1;
  let tx = 0;
  let ty = 0;
  if (caixa && tamanho.l) {
    const [x0, y0, x1, y1] = caixa;
    const bl = (x1 - x0) * 1.08;
    const ba = (y1 - y0) * 1.08;
    k = Math.min(tamanho.l / (bl * s0), tamanho.a / (ba * s0), 7);
    tx = -((x0 + x1) / 2 - dados.mapa.largura / 2) * s0 * k;
    ty = -((y0 + y1) / 2 - dados.mapa.altura / 2) * s0 * k;
  }

  const [foco, setFoco] = useState<{ codigo: string; x: number; y: number } | null>(null);
  const formaPorCodigo = useMemo(() => new Map(formas?.map((m) => [m.codigo, m]) ?? []), [formas]);
  const ufPorSigla = useMemo(() => new Map(dados.ufs.map((u) => [u.sigla, u])), [dados.ufs]);
  const emFoco = foco ? formaPorCodigo.get(foco.codigo) : undefined;
  const ufEmFoco = foco && !emFoco ? ufPorSigla.get(foco.codigo) : undefined;
  const areaPorChave = useMemo(() => new Map(areas?.lista.map((a) => [a.chave, a]) ?? []), [areas]);
  const areaEmFoco = foco ? areaPorChave.get(foco.codigo) : undefined;
  const contornos = [foco?.codigo, destaque].filter((c): c is string => Boolean(c));
  const contornosDeArea = [foco?.codigo, areaEscolhida].filter((c): c is string => Boolean(c && areaPorChave.has(c)));
  const mostraMunicipios = Boolean(formas && cores);

  return (
    <div ref={palco} className="relative h-full w-full" onPointerLeave={() => setFoco(null)}>
      <div className="absolute inset-0 overflow-hidden" style={caixa ? BORDAS_ESMAECIDAS : undefined}>
      <div className={`absolute inset-0 transition-transform ${MOVIMENTO}`} style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
        <svg
          viewBox={`${-FOLGA} ${-FOLGA} ${L} ${A}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full overflow-visible"
          role="img"
          aria-label="Mapa do Brasil"
        >
          <g
            stroke="var(--plano)"
            strokeWidth={(mostraMunicipios ? 0.15 : 0.8) / k}
            onPointerMove={(e) => {
              const alvo = e.target as SVGElement;
              const codigo = alvo.getAttribute("data-m") ?? alvo.getAttribute("data-uf");
              const r = palco.current?.getBoundingClientRect();
              if (codigo && r) setFoco({ codigo, x: e.clientX - r.left, y: e.clientY - r.top });
            }}
            onClick={(e) => {
              const alvo = e.target as SVGElement;
              const m = alvo.getAttribute("data-m");
              const u = alvo.getAttribute("data-uf");
              if (m) aoTocarMunicipio(m);
              else if (u) aoTocarUf(u);
            }}
            style={{ cursor: "pointer" }}
            pointerEvents={areas ? "none" : undefined}
          >
            {mostraMunicipios ? (
              <CamadaMunicipios formas={formas!} cores={cores!} />
            ) : (
              dados.ufs.map((u) => <path key={u.sigla} d={u.d} data-uf={u.sigla} style={{ fill: coresUf.get(u.sigla) ?? "var(--grade)" }} />)
            )}
          </g>
          {areas && (
            <g
              strokeWidth={1 / k}
              strokeLinejoin="round"
              style={{ cursor: "pointer" }}
              onPointerMove={(e) => {
                const chave = (e.target as SVGElement).getAttribute("data-a");
                const r = palco.current?.getBoundingClientRect();
                if (chave && r) setFoco({ codigo: chave, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              onPointerOut={() => setFoco(null)}
              onClick={(e) => {
                const chave = (e.target as SVGElement).getAttribute("data-a");
                if (chave) aoTocarArea(chave);
              }}
            >
              <CamadaAreas areas={areas.lista} cores={areas.cores} />
            </g>
          )}
          {/* As divisas e as siglas orientam sem competir com o dado. */}
          <g fill="none" stroke="var(--tinta-3)" strokeWidth={0.7 / k} strokeOpacity={0.5} pointerEvents="none">
            {dados.ufs.map((u) => (
              <path key={u.sigla} d={u.d} />
            ))}
          </g>
          <g pointerEvents="none" textAnchor="middle" style={{ fontSize: 13 / k, fontWeight: 600 }}>
            {dados.ufs
              .filter((u) => u.area >= 2000)
              .map((u) => (
                <text
                  key={u.sigla}
                  x={u.centro[0]}
                  y={u.centro[1]}
                  style={{ fill: "var(--atlas-rotulo-tinta)", stroke: "var(--atlas-rotulo-contorno)", strokeWidth: 3 / k, paintOrder: "stroke" }}
                >
                  {u.sigla}
                </text>
              ))}
          </g>
          {contornos.map((c) => {
            const d = formaPorCodigo.get(c)?.d ?? ufPorSigla.get(c)?.d;
            return d ? <path key={c} d={d} fill="none" stroke="var(--tinta)" strokeWidth={(c === destaque ? 2 : 1.2) / k} pointerEvents="none" /> : null;
          })}
          {contornosDeArea.map((c) => (
            <path key={c} d={areaPorChave.get(c)!.d} fill="none" stroke="var(--tinta)" strokeWidth={(c === areaEscolhida ? 2 : 1.2) / k} pointerEvents="none" />
          ))}
        </svg>
      </div>
      </div>

      {foco && (emFoco || ufEmFoco || areaEmFoco) && (
        <div
          role="status"
          className="pointer-events-none absolute z-30 w-max max-w-[15rem] rounded-lg border px-3 py-2 text-[11.5px] leading-snug shadow-sm"
          style={{
            left: Math.max(4, Math.min(foco.x + 14, tamanho.l - 230)),
            top: Math.max(4, Math.min(foco.y + 14, tamanho.a - 130)),
            background: "var(--superficie)",
            borderColor: "var(--borda)",
          }}
        >
          {areaEmFoco ? (
            <DicaArea area={areaEmFoco} numeros={areas?.numeros.get(areaEmFoco.chave)} ano={anoDasAreas} anoRecebido={anoRecebido} preliminar={municipal?.preliminar ?? null} />
          ) : emFoco ? (
            <DicaMunicipio forma={emFoco} municipal={municipal} ano={ano} />
          ) : (
            <DicaEstado uf={ufEmFoco!} dados={dados} municipal={municipal} />
          )}
        </div>
      )}
    </div>
  );
}

/** O balão de uma área protegida: o desmatamento dela no ano do mapa e no que o governo recebeu. */
function DicaArea({
  area,
  numeros,
  ano,
  anoRecebido,
  preliminar,
}: {
  area: AreaDesenhada;
  numeros: { agora: number | null; recebido: number | null } | undefined;
  ano: number | null;
  anoRecebido: number;
  preliminar: number | null;
}) {
  const km2 = (v: number) => `${numero(v, v > 0 && v < 10 ? 1 : 0)} km²`;
  const linhas: [string, string][] = [
    [`Desmatado em ${ano ?? ""}${ano === preliminar ? "*" : ""}`, numeros?.agora === null || numeros?.agora === undefined ? "bioma sem dado" : km2(numeros.agora)],
    [`Desmatado em ${anoRecebido}`, numeros?.recebido === null || numeros?.recebido === undefined ? "sem dado" : km2(numeros.recebido)],
  ];
  return (
    <>
      <p className="font-semibold">{titulo(area.n)}</p>
      <p style={{ color: "var(--tinta-3)" }}>{NOME_BIOMA[area.b]}</p>
      {linhas.map(([rotulo, valor]) => (
        <p key={rotulo} className="flex justify-between gap-3" style={{ color: "var(--tinta-2)" }}>
          <span>{rotulo}</span>
          <span className="tabular font-medium" style={{ color: "var(--tinta)" }}>
            {valor}
          </span>
        </p>
      ))}
    </>
  );
}

/** O balão de um estado: as cinco medidas, e o convite para abrir os municípios dele. */
function DicaEstado({ uf, dados, municipal }: { uf: UF; dados: DadosPainel; municipal: MunicipiosAmbiente | null }) {
  return (
    <>
      <p className="font-semibold">{uf.nome}</p>
      {FAMILIAS.filter((f) => !ehAreaProtegida(f)).map((f) => {
        const r = resumoDaLente(f, dados, null, uf, municipal, null);
        return (
          <p key={f} className="flex justify-between gap-3" style={{ color: "var(--tinta-2)" }}>
            <span>{MEDIDAS[f].curto}</span>
            <span className="tabular font-medium" style={{ color: "var(--tinta)" }}>
              {r.fora || r.valor === null ? (f === "alertas" ? "fora do DETER" : "—") : compacto(r.valor, r.formato)}
            </span>
          </p>
        );
      })}
      <p className="mt-1 text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
        Toque para ver os municípios
      </p>
    </>
  );
}

function DicaMunicipio({
  forma,
  municipal,
  ano,
}: {
  forma: MunicipioNacional;
  municipal: MunicipiosAmbiente | null;
  ano: { desmatamento: number | null; fogo: number | null };
}) {
  const x = municipal?.m[forma.codigo];
  const linhas: [string, string][] = municipal
    ? [
        [`Desmatamento ${ano.desmatamento ?? ""}`, (() => {
          const n = numerosDaLente(x, "desmatamento", municipal, ano.desmatamento);
          return n.agora === null ? "sem dado" : formatarNaLente(n.agora, "desmatamento");
        })()],
        ["Alertas, 12 meses", x?.a ? formatarNaLente(x.a[1], "alertas") : "fora do DETER"],
        [`Focos ${ano.fogo ?? ""}`, (() => {
          const n = numerosDaLente(x, "fogo", municipal, ano.fogo);
          return n.agora === null ? "sem dado" : numero(n.agora, 0);
        })()],
        ["Autos do Ibama, 12 meses", x?.i ? numero(x.i[1], 0) : "sem dado"],
      ]
    : [];
  return (
    <>
      <p className="font-semibold">
        {forma.nome} <span style={{ color: "var(--tinta-3)" }}>{forma.uf}</span>
      </p>
      {x?.b && <p style={{ color: "var(--tinta-3)" }}>{NOME_BIOMA[x.b]}</p>}
      {linhas.map(([rotulo, valor]) => (
        <p key={rotulo} className="flex justify-between gap-3" style={{ color: "var(--tinta-2)" }}>
          <span>{rotulo}</span>
          <span className="tabular font-medium" style={{ color: "var(--tinta)" }}>
            {valor}
          </span>
        </p>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// A ficha do município, na barra
// ---------------------------------------------------------------------------

function FichaMunicipio({
  forma,
  municipal,
  nomeUf,
  aoFechar,
  aoVerEstado,
}: {
  forma: MunicipioNacional;
  municipal: MunicipiosAmbiente;
  nomeUf: string;
  aoFechar: () => void;
  aoVerEstado?: () => void;
}) {
  const x = municipal.m[forma.codigo];
  const rAno = municipal.anos.indexOf(municipal.anoRecebido);
  const rFogo = municipal.focosAnos.indexOf(municipal.anoRecebido);
  // O último ano com dado neste município.
  const iUltimo = x?.d ? x.d.findLastIndex((v) => v !== null) : -1;
  const iFogo = municipal.focosAnos.length - 1;
  const janela = municipal.janela.atual
    ? `12 meses até ${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(municipal.janela.atual.slice(5, 7)) - 1]}/${municipal.janela.atual.slice(0, 4)}`
    : "12 meses";
  const linhas: { rotulo: string; quando: string; agora: number | null; recebido: number | null; fmt: (v: number) => string; direcao: Direcao }[] = [
    {
      rotulo: "Desmatamento",
      quando: iUltimo >= 0 ? `PRODES ${municipal.anos[iUltimo]}${municipal.anos[iUltimo] === municipal.preliminar ? "*" : ""}` : "",
      agora: iUltimo >= 0 ? (x.d![iUltimo] ?? null) : null,
      recebido: rAno >= 0 ? (x?.d?.[rAno] ?? null) : null,
      fmt: (v) => formatarNaLente(v, "desmatamento"),
      direcao: "menor_melhor",
    },
    { rotulo: "Alertas", quando: janela, agora: x?.a?.[1] ?? null, recebido: x?.a?.[0] ?? null, fmt: (v) => formatarNaLente(v, "alertas"), direcao: "menor_melhor" },
    {
      rotulo: "Focos",
      quando: String(municipal.focosAnos[iFogo] ?? ""),
      agora: x?.f?.[iFogo] ?? null,
      recebido: rFogo >= 0 ? (x?.f?.[rFogo] ?? null) : null,
      fmt: (v) => numero(v, 0),
      direcao: "menor_melhor",
    },
    ...(x?.q ? [{ rotulo: "Área queimada", quando: janela, agora: x.q[1], recebido: x.q[0], fmt: (v: number) => formatarNaLente(v, "queimada"), direcao: "menor_melhor" as Direcao }] : []),
    { rotulo: "Autos do Ibama", quando: janela, agora: x?.i?.[1] ?? null, recebido: x?.i?.[0] ?? null, fmt: (v) => numero(v, 0), direcao: "neutro" },
    { rotulo: "Autos de flora", quando: janela, agora: x?.i?.[3] ?? null, recebido: x?.i?.[2] ?? null, fmt: (v) => numero(v, 0), direcao: "neutro" },
    { rotulo: "Embargos", quando: janela, agora: x?.e?.[1] ?? null, recebido: x?.e?.[0] ?? null, fmt: (v) => numero(v, 0), direcao: "neutro" },
    { rotulo: "Multas aplicadas", quando: janela, agora: x?.v?.[1] ?? null, recebido: x?.v?.[0] ?? null, fmt: (v) => reaisNoFicha(v), direcao: "neutro" },
  ];
  const faisca = x?.d?.length ? { datas: municipal.anos.map((a) => `${a}-07`), valores: x.d } : null;
  return (
    <section className="px-3 pb-1 pt-2" aria-label={`Ficha de ${forma.nome}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{forma.nome}</h2>
          <p className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {nomeUf}
            {x?.b ? ` · ${NOME_BIOMA[x.b]}` : ""} · {numero(forma.areaKm2, 0)} km²
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar a ficha"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--faixa-a)]"
          style={{ color: "var(--tinta-2)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      {faisca && (
        <div className="mt-2">
          <p className="text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            Desmatamento por ano PRODES, {municipal.anos[0]} a {municipal.anos.at(-1)}
          </p>
          <div className="mt-1">
            <Faisca datas={faisca.datas} valores={faisca.valores} altura={44} cor="var(--desmate-4)" />
          </div>
        </div>
      )}
      <ul className="mt-2">
        {linhas.map((l) => {
          const d = l.agora === null ? null : mudancaDe({ valor: l.agora, recebido: l.recebido, direcao: l.direcao });
          return (
            <li key={l.rotulo} className="flex items-baseline gap-2 border-t py-1.5 text-[12px]" style={{ borderColor: "var(--borda)" }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{l.rotulo}</span>
                <span className="tabular block truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
                  {l.quando}
                  {l.recebido !== null && l.agora !== null ? ` · em ${municipal.anoRecebido}, ${l.fmt(l.recebido)}` : ""}
                </span>
              </span>
              <span className="tabular shrink-0 font-semibold">{l.agora === null ? "—" : l.fmt(l.agora)}</span>
              <span className="flex w-[3.1rem] shrink-0 justify-end">{d && <PilulaVeredito texto={d.texto} sentido={d.sentido} className="text-[10.5px]" />}</span>
            </li>
          );
        })}
      </ul>
      {aoVerEstado && (
        <button type="button" onClick={aoVerEstado} className="mt-2 text-[11.5px] font-medium hover:underline" style={{ color: "var(--serie)" }}>
          Ver {nomeUf} inteiro
        </button>
      )}
    </section>
  );
}

const reaisNoFicha = (v: number) =>
  v >= 1e9 ? `R$ ${numero(v / 1e9, 1)} bi` : v >= 1e6 ? `R$ ${numero(v / 1e6, 1)} mi` : v >= 1e3 ? `R$ ${numero(v / 1e3, 0)} mil` : `R$ ${numero(v, 0)}`;
