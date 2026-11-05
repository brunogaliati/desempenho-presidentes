import { comSinal, sentido } from "@/lib/formatar";

import { PISO_POSSE, somaNaUf, somaNoBioma, type Lente, type Municipal, type MunicipiosAmbiente } from "../_dados/ambienteMunicipal";
import type { DadosPainel, Leitura, SerieEconomia, UF } from "../_dados/tipos";
import { formatar, recebido, ultimoDado } from "./formatos";
import { itemDaSerie, type FileiraPlacar, type GrupoPlacar, type ItemPlacar } from "./placarModelo";

/**
 * O placar do meio ambiente: a mesma régua do da economia, cada medida no
 * último dado contra o que o governo recebeu (o último ano PRODES e os últimos 12
 * meses antes da posse). Muda o recorte: o país, um bioma ou um estado.
 *
 * A lista é fixa, pela importância e não pela cor: desmatamento, alertas do DETER,
 * fogo e áreas protegidas. A fiscalização do Ibama vem embaixo, em cinza e fora da
 * contagem: é o que o governo fez, não o resultado no território, e mais autos
 * tanto podem ser mais fiscalização quanto mais crime.
 *
 * No placar nacional, "Outros biomas" é um resumo: tocar numa linha do desmatamento
 * o abre em Caatinga, Mata Atlântica, Pampa e Pantanal (`desdobra`).
 *
 * Toda linha aponta o que pintar no mapa (`vista`). E num bioma ou estado as linhas
 * são sempre as mesmas: o que não existe ali continua na lista dizendo por quê
 * (`falta`), para o leitor não achar que sumiu por erro. Só some o que a fonte não
 * respondeu agora.
 */

/** Um pedaço do Brasil dentro do placar nacional: pinta só os municípios dele. */
export type RegiaoPlacar = "amazonia" | "cerrado" | "caatinga" | "mata_atlantica" | "pampa" | "pantanal" | "outros";

/** O que uma linha pinta no mapa. */
export interface VistaDoMapa {
  lente: Lente;
  regiao?: RegiaoPlacar;
}

export interface LinhaTerritorio extends ItemPlacar {
  vista?: VistaDoMapa;
  /** Por que esta medida não existe neste recorte. */
  falta?: string;
  /** O número de agora, quando a linha não tem série de onde tirar. */
  valor?: number;
}

export interface GrupoTerritorio extends GrupoPlacar {
  itens: LinhaTerritorio[];
  /** A linha de resumo (`troca`) e as linhas em que ela se abre. Ficam fora da contagem: o resumo já conta. */
  desdobra?: { troca: string; linhas: LinhaTerritorio[] };
}

export interface FileiraTerritorio extends FileiraPlacar {
  itens: LinhaTerritorio[];
}

export interface PlacarAmbiente {
  grupos: GrupoTerritorio[];
  fileiras: FileiraTerritorio[];
}

const ROTULO_TI = "Terras Indígenas";
const ROTULO_UC = "Unid. Conservação";

/** A cor de cada tipo de medida: a mesma do mapa e da coluna da esquerda. */
const COR = {
  desmatamento: "var(--desmate-4)",
  alertas: "var(--alerta-4)",
  fogo: "var(--fogo-4)",
  protegidas: "var(--protegidas)",
  fiscalizacao: "var(--fiscal-4)",
};

/**
 * Por que uma medida não existe num recorte. Conferido nas camadas do INPE em
 * 02/11/2026: só há DETER da Amazônia e do Cerrado, o do Cerrado só registra
 * desmatamento, e TI e UC vêm sem estado.
 */
const MOTIVO = {
  alertas: "o INPE só publica na Amazônia e no Cerrado",
  queimada: "o INPE só mede na Amazônia",
  porEstado: "o INPE publica por área, não por estado",
};
const BIOMAS_COM_ALERTA = ["amazonia", "cerrado"];
const OUTROS_BIOMAS: { id: RegiaoPlacar; rotulo: string }[] = [
  { id: "caatinga", rotulo: "Caatinga" },
  { id: "mata_atlantica", rotulo: "Mata Atlântica" },
  { id: "pampa", rotulo: "Pampa" },
  { id: "pantanal", rotulo: "Pantanal" },
];

const presentes = <T>(lista: (T | null)[]) => lista.filter((x): x is NonNullable<T> & T => x !== null);
const comItens = <T extends { itens: unknown[] }>(grupos: T[]) => grupos.filter((g) => g.itens.length > 0);
const naVista = (x: ItemPlacar | null, vista: VistaDoMapa): LinhaTerritorio | null => (x ? { ...x, vista } : null);

function falta(id: string, rotulo: string, motivo: string, vista: Lente | VistaDoMapa): LinhaTerritorio {
  return { id, rotulo, falta: motivo, mudanca: "", agora: "—", leitura: motivo, sentido: "neutro", nacional: false, fonte: "", fonteUrl: "", vista: typeof vista === "string" ? { lente: vista } : vista };
}

/**
 * No mandato em curso, medida sem dado é fonte que não respondeu, e sai. Num governo
 * antigo é a fonte que ainda não existia: a linha fica, e diz isso.
 */
const ouSemDado = (dados: DadosPainel, x: LinhaTerritorio | null, id: string, rotulo: string, vista: Lente | VistaDoMapa): LinhaTerritorio | null =>
  x ?? (dados.foco.emCurso ? null : falta(id, rotulo, "sem dado para comparar", vista));

/** A linha de uma medida num placar. */
export const linhaDaMedida = (p: PlacarAmbiente, lente: Lente): LinhaTerritorio | null =>
  [...p.grupos, ...p.fileiras].flatMap((g) => g.itens).find((x) => x.vista?.lente === lente) ?? null;

/** "PRODES 2026*": os biomas não publicam todos no mesmo ano, e o título diz qual é. */
function anoProdes(s: SerieEconomia | null | undefined): string {
  const u = s ? ultimoDado(s) : null;
  return u ? `PRODES ${u.data.slice(0, 4)}${s?.preliminares?.includes(u.data) ? "*" : ""}` : "ano PRODES";
}

const fileiraDoIbama = (itens: LinhaTerritorio[], detalhe = "12 meses, sem veredito"): FileiraTerritorio => ({
  titulo: "Fiscalização do Ibama",
  detalhe,
  cor: COR.fiscalizacao,
  itens,
  rotular: (x) => `${x.rotulo} do Ibama: ${x.agora} em 12 meses, ${x.mudanca} desde a posse. É ação do governo, sem cor de melhor ou pior.`,
});

export function placarDoAmbiente(dados: DadosPainel): PlacarAmbiente {
  const serie = (id: string) => dados.ambiente.series.find((s) => s.id === id);
  const item = (id: string, rotulo: string, vista: VistaDoMapa) => ouSemDado(dados, naVista(itemDaSerie(id, rotulo, serie(id), true), vista), id, rotulo, vista);
  const p = dados.ambiente.protegidas;
  return {
    grupos: comItens([
      {
        titulo: "Desmatamento",
        detalhe: "ano PRODES",
        cor: COR.desmatamento,
        itens: presentes([
          item("prodes_amazonia", "Amazônia", { lente: "desmatamento", regiao: "amazonia" }),
          item("prodes_cerrado", "Cerrado", { lente: "desmatamento", regiao: "cerrado" }),
          item("prodes_outros", "Outros biomas", { lente: "desmatamento", regiao: "outros" }),
        ]),
        desdobra: {
          troca: "prodes_outros",
          linhas: presentes(
            OUTROS_BIOMAS.map((b) =>
              naVista(itemDaSerie(`prodes_bioma_${b.id}`, b.rotulo, dados.ambiente.porBioma.find((x) => x.id === b.id)?.prodes ?? undefined, true), {
                lente: "desmatamento",
                regiao: b.id,
              }),
            ),
          ),
        },
      },
      {
        titulo: "Alertas de desmatamento",
        detalhe: "12 meses",
        cor: COR.alertas,
        itens: presentes([
          item("alertas_amazonia_12m", "Amazônia", { lente: "alertas", regiao: "amazonia" }),
          item("alertas_cerrado_12m", "Cerrado", { lente: "alertas", regiao: "cerrado" }),
        ]),
      },
      {
        titulo: "Fogo",
        detalhe: "12 meses",
        cor: COR.fogo,
        itens: presentes([item("focos_12m", "Focos", { lente: "fogo" }), item("cicatriz_12m", "Área queimada", { lente: "queimada" })]),
      },
      {
        titulo: "Áreas protegidas",
        detalhe: anoProdes(p?.ti),
        cor: COR.protegidas,
        itens: presentes([
          ouSemDado(dados, naVista(itemDaSerie("protegidas_ti", ROTULO_TI, p?.ti ?? undefined, true), { lente: "ti" }), "protegidas_ti", ROTULO_TI, "ti"),
          ouSemDado(dados, naVista(itemDaSerie("protegidas_uc", ROTULO_UC, p?.uc ?? undefined, true), { lente: "uc" }), "protegidas_uc", ROTULO_UC, "uc"),
        ]),
      },
    ]),
    fileiras: [
      fileiraDoIbama(
        presentes([
          item("autos_12m", "Autos", { lente: "fiscalizacao" }),
          item("multas_12m", "Multas", { lente: "multas" }),
          item("embargos_12m", "Embargos", { lente: "embargos" }),
        ]),
      ),
    ],
  };
}

/**
 * Área protegida com quase nada nos dois períodos não leva veredito: ir de 0,00 a
 * 0,02 km² não é "piorou", nem de 0,1 a zero é "-100%". É o mesmo piso do mapa. A
 * linha continua lá, porque zero é resultado, não falta de dado.
 */
function itemDaProtegida(id: string, rotulo: string, s: SerieEconomia | null | undefined, lente: Lente, anoRecebido: number): LinhaTerritorio | null {
  const ultimo = s ? ultimoDado(s) : null;
  const recebeu = s ? recebido(s) : null;
  // Sem dado antes da posse não há o que comparar: sem base não é zero.
  if (!s || !ultimo || !recebeu) return null;
  const base = recebeu.valor;
  if (Math.max(base, ultimo.valor) >= PISO_POSSE[lente] && base > 0) return naVista(itemDaSerie(id, rotulo, s, true), { lente });
  const km2 = (v: number) => (v === 0 ? "0 km²" : v < 0.05 ? "< 0,1 km²" : formatar(v, s.formato));
  const quase = ultimo.valor < PISO_POSSE[lente];
  return {
    id,
    rotulo,
    mudanca: base === 0 && ultimo.valor === 0 ? "igual" : quase ? "pouco" : "novo",
    agora: km2(ultimo.valor),
    leitura: `Em ${anoRecebido}, ${km2(base)}. No PRODES ${ultimo.data.slice(0, 4)}, ${km2(ultimo.valor)}.`,
    sentido: quase ? "neutro" : "ruim",
    serie: s,
    direcao: s.direcao,
    proporcao: base > 0 ? ultimo.valor / base : quase ? 0 : 2,
    nacional: true,
    fonte: s.fonte,
    fonteUrl: s.fonteUrl,
    vista: { lente },
  };
}

/** Um número sem série: só o de agora e o recebido (o que vem de somar municípios ou da UF). */
function itemSolto(
  id: string,
  rotulo: string,
  agora: number | null,
  recebido: number | null,
  formato: Leitura["formato"],
  direcao: NonNullable<Leitura["direcao"]>,
  quando: string,
  fonte: string,
  fonteUrl: string,
  anoRecebido: number,
): LinhaTerritorio | null {
  if (agora === null || recebido === null) return null;
  const base = { id, rotulo, valor: agora, agora: formatar(agora, formato), leitura: `Em ${anoRecebido}, ${formatar(recebido, formato)}. ${quando}, ${formatar(agora, formato)}.`, nacional: false, fonte, fonteUrl };
  // Sem nada no ano recebido não há percentual: a linha fica, dizendo que ficou igual ou que é novidade.
  if (recebido === 0) {
    return { ...base, mudanca: agora ? "novo" : "igual", sentido: agora ? sentido(1, direcao) : "neutro", proporcao: agora ? 2 : 0 };
  }
  const v = Math.round(((agora - recebido) / recebido) * 1000) / 10;
  return { ...base, mudanca: v === 0 ? "igual" : `${comSinal(v, 1)}%`, sentido: sentido(v, direcao), proporcao: agora / recebido };
}

const FONTE_IBAMA = ["Ibama, dados abertos da fiscalização", "https://dadosabertos.ibama.gov.br/dataset/fiscalizacao-auto-de-infracao"] as const;
const FONTE_DETER = ["INPE, DETER", "https://terrabrasilis.dpi.inpe.br/"] as const;
const AUTOS = (x: Municipal) => (x.i ? ([x.i[0], x.i[1]] as const) : undefined);

/**
 * Num bioma: sempre as mesmas nove linhas. O desmatamento mapeado nele, os alertas,
 * os focos, a área queimada, as áreas protegidas e a fiscalização, que soma os
 * municípios em que o bioma predomina, e diz isso.
 */
export function placarDoBioma(dados: DadosPainel, bioma: string, municipal: MunicipiosAmbiente | null): PlacarAmbiente {
  const b = dados.ambiente.porBioma.find((x) => x.id === bioma);
  const serie = (id: string) => dados.ambiente.series.find((s) => s.id === id);
  const protegidas = dados.ambiente.protegidas?.porBioma[bioma];
  const anoRecebido = dados.foco.anoRecebido;
  const ibama = (id: string, rotulo: string, campo: Parameters<typeof somaNoBioma>[2], formato: Leitura["formato"], lente: Lente) => {
    const s = municipal ? somaNoBioma(municipal, bioma, campo) : null;
    const linha = naVista(itemSolto(id, rotulo, s?.agora ?? null, s?.recebido ?? null, formato, "neutro", "Nos últimos 12 meses", ...FONTE_IBAMA, anoRecebido), { lente });
    return municipal ? ouSemDado(dados, linha, id, rotulo, lente) : linha;
  };
  return {
    grupos: comItens([
      {
        titulo: "Desmatamento",
        detalhe: anoProdes(b?.prodes),
        cor: COR.desmatamento,
        itens: presentes([ouSemDado(dados, naVista(itemDaSerie(`prodes_bioma_${bioma}`, "Área mapeada", b?.prodes ?? undefined, true), { lente: "desmatamento" }), `prodes_bioma_${bioma}`, "Área mapeada", "desmatamento")]),
      },
      {
        titulo: "Alertas de desmatamento",
        detalhe: "12 meses",
        cor: COR.alertas,
        itens: presentes([
          BIOMAS_COM_ALERTA.includes(bioma)
            ? ouSemDado(dados, naVista(itemDaSerie(`alertas_${bioma}_12m`, "Área em alerta", serie(`alertas_${bioma}_12m`), true), { lente: "alertas" }), `alertas_${bioma}_12m`, "Área em alerta", "alertas")
            : falta(`alertas_${bioma}`, "Área em alerta", MOTIVO.alertas, "alertas"),
        ]),
      },
      {
        titulo: "Fogo",
        detalhe: "12 meses",
        cor: COR.fogo,
        itens: presentes([
          ouSemDado(dados, naVista(itemDaSerie(`focos_bioma_${bioma}`, "Focos", b?.focos ?? undefined, true), { lente: "fogo" }), `focos_bioma_${bioma}`, "Focos", "fogo"),
          bioma === "amazonia"
            ? ouSemDado(dados, naVista(itemDaSerie("cicatriz_12m", "Área queimada", serie("cicatriz_12m"), true), { lente: "queimada" }), "cicatriz_12m", "Área queimada", "queimada")
            : falta(`queimada_${bioma}`, "Área queimada", MOTIVO.queimada, "queimada"),
        ]),
      },
      {
        titulo: "Áreas protegidas",
        detalhe: anoProdes(protegidas?.ti),
        cor: COR.protegidas,
        itens: presentes([
          ouSemDado(dados, itemDaProtegida(`protegidas_ti_${bioma}`, ROTULO_TI, protegidas?.ti, "ti", anoRecebido), `protegidas_ti_${bioma}`, ROTULO_TI, "ti"),
          ouSemDado(dados, itemDaProtegida(`protegidas_uc_${bioma}`, ROTULO_UC, protegidas?.uc, "uc", anoRecebido), `protegidas_uc_${bioma}`, ROTULO_UC, "uc"),
        ]),
      },
    ]),
    fileiras: [
      fileiraDoIbama(
        presentes([
          ibama("autos_bioma", "Autos", AUTOS, "contagem", "fiscalizacao"),
          ibama("multas_bioma", "Multas", (x) => x.v, "reaiscurto", "multas"),
          ibama("embargos_bioma", "Embargos", (x) => x.e, "contagem", "embargos"),
        ]),
        "municípios do bioma, sem veredito",
      ),
    ],
  };
}

/** O Brasil inteiro em cada medida: o desmatamento e os alertas somam os biomas, o resto é a linha do placar nacional. */
export function placarDoBrasilInteiro(dados: DadosPainel): PlacarAmbiente {
  const nacional = placarDoAmbiente(dados);
  const deLeitura = (id: string, rotulo: string, lente: Lente) => {
    const l = dados.leituras.ambiente.find((x) => x.id === id);
    if (!l || l.indiceRecebido === null) return null;
    const i = l.brasil.findLastIndex((v) => v !== null);
    return naVista(itemSolto(`brasil_${id}`, rotulo, l.brasil[i] ?? null, l.brasil[l.indiceRecebido] ?? null, l.formato, l.direcao ?? "neutro", l.periodos[i]?.extenso ?? "Agora", l.fonte, l.fonteUrl ?? "", dados.foco.anoRecebido), { lente });
  };
  return {
    grupos: [
      {
        titulo: "Brasil",
        itens: presentes([
          deLeitura("desmatamento", "Área mapeada", "desmatamento"),
          deLeitura("alertas_12m", "Área em alerta", "alertas"),
          ...nacional.grupos.flatMap((g) => g.itens).filter((x) => x.vista && !x.vista.regiao),
        ]),
      },
    ],
    fileiras: nacional.fileiras,
  };
}

/** Num estado: as medidas por UF, no último período contra o recebido. */
export function placarDoEstado(dados: DadosPainel, uf: UF, municipal: MunicipiosAmbiente | null): PlacarAmbiente {
  const anoRecebido = dados.foco.anoRecebido;
  const leitura = (l: Leitura | undefined, rotulo: string, lente: Lente): LinhaTerritorio | null => {
    const s = l?.ufs[uf.codigo];
    if (!l || !s || l.indiceRecebido === null) return ouSemDado(dados, null, `${lente}-${uf.sigla}`, rotulo, lente);
    const i = s.findLastIndex((v) => v !== null);
    return naVista(itemSolto(`${l.id}-${uf.sigla}`, rotulo, s[i] ?? null, s[l.indiceRecebido] ?? null, l.formato, l.direcao ?? "neutro", l.periodos[i]?.extenso ?? "Agora", l.fonte, l.fonteUrl ?? "", anoRecebido), { lente });
  };
  const de = (id: string) => [...dados.leituras.ambiente, ...dados.ambiente.fiscalizacao].find((l) => l.id === id);
  const queimada = municipal ? somaNaUf(municipal, uf.codigo, (x) => x.q) : null;
  const multas = municipal ? somaNaUf(municipal, uf.codigo, (x) => x.v) : null;
  const alertas = de("alertas_12m");
  return {
    grupos: comItens([
      { titulo: "Desmatamento", detalhe: "ano PRODES", cor: COR.desmatamento, itens: presentes([leitura(de("desmatamento"), "Área mapeada", "desmatamento")]) },
      {
        titulo: "Alertas de desmatamento",
        detalhe: "12 meses",
        cor: COR.alertas,
        itens: presentes([alertas && !alertas.ufs[uf.codigo] ? falta(`alertas-${uf.sigla}`, "Área em alerta", MOTIVO.alertas, "alertas") : leitura(alertas, "Área em alerta", "alertas")]),
      },
      {
        titulo: "Fogo",
        detalhe: "12 meses",
        cor: COR.fogo,
        itens: presentes([
          leitura(de("focos_12m"), "Focos", "fogo"),
          queimada
            ? ouSemDado(dados, naVista(itemSolto(`queimada-${uf.sigla}`, "Área queimada", queimada.agora, queimada.recebido, "km2", "menor_melhor", "Nos últimos 12 meses", ...FONTE_DETER, anoRecebido), { lente: "queimada" }), `queimada-${uf.sigla}`, "Área queimada", "queimada")
            : municipal
              ? falta(`queimada-${uf.sigla}`, "Área queimada", MOTIVO.queimada, "queimada")
              : null,
        ]),
      },
      {
        titulo: "Áreas protegidas",
        detalhe: "ano PRODES",
        cor: COR.protegidas,
        itens: [falta(`ti-${uf.sigla}`, ROTULO_TI, MOTIVO.porEstado, "ti"), falta(`uc-${uf.sigla}`, ROTULO_UC, MOTIVO.porEstado, "uc")],
      },
    ]),
    fileiras: [
      fileiraDoIbama(
        presentes([
          leitura(de("autos_12m"), "Autos", "fiscalizacao"),
          multas ? ouSemDado(dados, naVista(itemSolto(`multas-${uf.sigla}`, "Multas", multas.agora, multas.recebido, "reaiscurto", "neutro", "Nos últimos 12 meses", ...FONTE_IBAMA, anoRecebido), { lente: "multas" }), `multas-${uf.sigla}`, "Multas", "multas") : null,
          leitura(de("embargos_12m"), "Embargos", "embargos"),
        ]),
      ),
    ],
  };
}
