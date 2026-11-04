import type { DadosPainel, FocoMandato, IndicadorMandato, Leitura, MandatoVisual, SerieEconomia } from "./tipos";
import type { SerieDiaria } from "./mercadoModelo";
import type { DadosAmbiente } from "./ambienteModelo";
import type { Indicador } from "@/types/dados";

/**
 * A tela inteira num mandato: o painel recebe a história toda e daqui sai o que
 * o mandato escolhido enxerga. Os painéis não sabem que houve recorte: leem as
 * mesmas séries e leituras, só que elas terminam no fim dele e a "posse" é a dele.
 *
 * - O fim: nada depois da posse do governo seguinte. É a mesma fronteira de
 *   `mandatosNaSerie`, então o placar e o gráfico não discordam da grade.
 * - O começo: o último dado antes da posse continua sendo "o que recebeu".
 * - Medida sem dado no mandato sai, como quando a fonte não responde. Nada vira
 *   zero.
 *
 * Só funções puras e `import type`, para os testes rodarem com `node --test`.
 */

/**
 * O governo estadual de 2015 a 2018 atravessa dois presidentes (Dilma e Temer) e é
 * o único que não coincide com um mandato presidencial.
 */
export const TERMO_2015 = "gov-2015";

export const deslocar = (mes: string, n: number) => {
  const t = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

/** Dois anos antes da posse: de onde os gráficos curtos do mandato partem. */
export const doisAnosAntes = (posse: string) => deslocar(posse, -24);

/**
 * O ano PRODES é agosto a julho e leva o código `AAAA-07`, então quem assume em
 * agosto já recebeu o ano que acabou de fechar (Temer, em 2016).
 */
const ultimoAnoAntes = (mes: string) => (Number(mes.slice(5, 7)) > 7 ? Number(mes.slice(0, 4)) : Number(mes.slice(0, 4)) - 1);

function montarFoco(id: string, posse: string, ate: string | null, emCurso: boolean, fim: string): FocoMandato {
  const anoRecebido = ultimoAnoAntes(posse);
  return { id, posse, ate, emCurso, anoRecebido, anoFinal: ate ? ultimoAnoAntes(ate) : 9999, fim };
}

/** O mandato pedido, ou `null` se o id não existe. */
export function focoDoMandato(mandatos: MandatoVisual[], id: string): FocoMandato | null {
  const ordem = [...mandatos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (id === TERMO_2015) {
    const seguinte = ordem.find((m) => m.inicio >= "2019");
    return montarFoco(id, "2015-01", seguinte?.inicio.slice(0, 7) ?? null, false, "2018-12-31");
  }
  const k = ordem.findIndex((m) => m.id === id);
  if (k < 0) return null;
  const m = ordem[k];
  return montarFoco(m.id, m.inicio.slice(0, 7), ordem[k + 1]?.inicio.slice(0, 7) ?? null, Boolean(m.emCurso), m.fim);
}

/**
 * O ritmo de uma série num mandato, na régua do placar: a média por ano do que o
 * governo recebeu (o último dado antes da posse) ao último dado dele, e a dos 24 meses
 * antes da posse. Em % ao ano para valores e em pontos por ano para taxas (`pontos`).
 * Serve para ano PRODES e para soma de 12 meses, porque conta os meses entre as datas.
 * `null` quando não há do que partir; sem o dado de 24 meses antes, só falta a referência.
 */
export function ritmoNoMandato(
  datas: string[],
  valores: (number | null)[],
  posse = "2023-01",
  opcoes: { pontos?: boolean; ate?: string | null } = {},
): { v: number; referencia: number | null } | null {
  const lista = datas.flatMap((d, i) => {
    const v = valores[i];
    return v === null || v === undefined || (opcoes.ate && d >= opcoes.ate) ? [] : [{ d, v }];
  });
  const meses = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const porAno = (a: number, b: number, m: number) => {
    if (m <= 0) return null;
    if (opcoes.pontos) return ((b - a) * 12) / m;
    return a > 0 ? ((b / a) ** (12 / m) - 1) * 100 : null;
  };
  const recebido = lista.findLast((p) => p.d < posse);
  const ultimo = lista.at(-1);
  if (!recebido || !ultimo) return null;
  const v = porAno(recebido.v, ultimo.v, meses(recebido.d, ultimo.d));
  if (v === null) return null;
  const antes = lista.find((p) => meses(p.d, recebido.d) === 24);
  return { v, referencia: antes ? porAno(antes.v, recebido.v, 24) : null };
}

export interface Recebido {
  valor: number;
  /** AAAA-MM-DD do dado. */
  data: string;
}

/**
 * O que o governo `k` recebeu numa medida sem série própria: o último dado do governo
 * anterior que a tem. O `herdadoValor` do indicador não serve, porque é o primeiro dado
 * DENTRO do mandato: a pobreza de 2023 não é o que quem assumiu em 2023 recebeu, e um
 * aumento de janeiro ficaria de fora da conta. `null` se a medida começa com ele.
 */
export function recebidoNaLista(indicadores: (Pick<IndicadorMandato, "valorFinal" | "dataFim"> | null | undefined)[], k: number): Recebido | null {
  for (let j = k - 1; j >= 0; j--) {
    const x = indicadores[j];
    if (x && x.valorFinal !== null && x.dataFim) return { valor: x.valorFinal, data: x.dataFim };
  }
  return null;
}

/** O mesmo, para o mandato na tela. */
export function recebidoNoPainel(dados: Pick<DadosPainel, "foco" | "economia">, serieId: string): Recebido | null {
  const ordem = [...dados.economia.mandatos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const k = ordem.findIndex((m) => m.id === dados.foco.id);
  if (k < 0) return null;
  return recebidoNaLista(ordem.map((m) => dados.economia.porMandato[m.id]?.find((i) => i.serieId === serieId)), k);
}

/**
 * A média por ano do recebido ao último dado do mandato: pontos por ano para níveis em
 * %, composta para índices e valores. Taxa do período (o IPCA mensal) não se compara
 * assim, e tem série própria.
 */
export function ritmoDesdeORecebido(
  recebido: Recebido | null,
  i: Pick<IndicadorMandato, "valorFinal" | "dataFim" | "tipo">,
): { v: number; pontos: boolean } | null {
  if (!recebido || i.valorFinal === null || !i.dataFim || i.tipo === "taxa_periodo") return null;
  const m = (Number(i.dataFim.slice(0, 4)) - Number(recebido.data.slice(0, 4))) * 12 + Number(i.dataFim.slice(5, 7)) - Number(recebido.data.slice(5, 7));
  if (m <= 0) return null;
  if (i.tipo === "nivel_pct") return { v: ((i.valorFinal - recebido.valor) * 12) / m, pontos: true };
  if (recebido.valor <= 0 || i.valorFinal <= 0) return null;
  return { v: ((i.valorFinal / recebido.valor) ** (12 / m) - 1) * 100, pontos: false };
}

/** O mês de um período: trimestre, mês ou ano. `null` é período sem calendário ("hoje", semestre). */
export function mesDoPeriodo(codigo: string): string | null {
  if (/^\d{6}$/.test(codigo)) return `${codigo.slice(0, 4)}-${String(Number(codigo.slice(4)) * 3).padStart(2, "0")}`;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(codigo)) return codigo;
  if (/^\d{4}$/.test(codigo)) return `${codigo}-12`;
  return null;
}

/**
 * As leituras mensais antigas só precisam dos pontos em que um mandato começa ou
 * termina: dezembro e o mês antes de Temer. Sem isso, a história inteira pesaria na
 * página de todo mundo para servir quem abre um governo antigo. De 2021 em diante,
 * todos os meses, porque é a régua do mandato atual.
 */
const mesFica = (mes: string) => mes >= "2020-12" || mes.endsWith("-12") || mes === "2016-07";

export function afinarLeitura(l: Leitura): Leitura {
  const anual = l.periodos.every((p) => p.codigo.endsWith("-07"));
  const mensal = l.periodos.every((p) => /^\d{4}-\d{2}$/.test(p.codigo));
  if (!mensal || anual) return l;
  const fica = l.periodos.map((p) => mesFica(p.codigo));
  const cortar = (s: (number | null)[]) => s.filter((_, i) => fica[i]);
  const por = (r: Record<string, (number | null)[]>) => Object.fromEntries(Object.entries(r).map(([k, s]) => [k, cortar(s)]));
  return { ...l, periodos: l.periodos.filter((_, i) => fica[i]), brasil: cortar(l.brasil), regioes: por(l.regioes), ufs: por(l.ufs) };
}

/**
 * Uma leitura no mandato: termina nele, e "o que recebeu" é o último período antes
 * da posse. As mensais e trimestrais começam pouco antes dela: com a história inteira
 * na régua de cor, um pico antigo apagaria o mapa do período. A soma de 12 meses parte
 * de 13 meses antes; o resto, de dois anos. A anual do PRODES fica inteira, para o
 * seletor de ano.
 */
export function recortarLeitura(l: Leitura, foco: FocoMandato): Leitura | null {
  const meses = l.periodos.map((p) => mesDoPeriodo(p.codigo));
  if (meses.some((m) => m === null)) return l;
  const anual = l.periodos.length > 1 && l.periodos.every((p) => p.codigo.endsWith("-07"));
  const margem = l.id.endsWith("_12m") ? 13 : 24;
  const de = anual ? "0000-00" : deslocar(foco.posse, -margem);
  const a = meses.findIndex((m) => m! >= de);
  const fim = foco.ate ?? "9999-99";
  const z = meses.findLastIndex((m) => m! < fim) + 1;
  if (a < 0 || z <= a || meses[z - 1]! < foco.posse) return null;
  const aqui = meses.slice(a, z) as string[];
  const primeiro = aqui.findIndex((m) => m >= foco.posse);
  const cortar = (s: (number | null)[]) => s.slice(a, z);
  const por = (r: Record<string, (number | null)[]>) => Object.fromEntries(Object.entries(r).map(([k, s]) => [k, cortar(s)]));
  return {
    ...l,
    periodos: l.periodos.slice(a, z),
    indicePosse: primeiro > 0 ? primeiro : null,
    indiceRecebido: primeiro > 0 ? primeiro - 1 : null,
    brasil: cortar(l.brasil),
    regioes: por(l.regioes),
    ufs: por(l.ufs),
  };
}

/** Uma série no mandato: sem dado dentro dele, sai. */
export function recortarSerie(s: SerieEconomia, foco: FocoMandato): SerieEconomia | null {
  const fim = foco.ate;
  const n = fim ? s.datas.findIndex((d) => d.slice(0, 7) >= fim) : -1;
  const datas = n < 0 ? s.datas : s.datas.slice(0, n);
  const valores = n < 0 ? s.valores : s.valores.slice(0, n);
  const u = valores.findLastIndex((v) => v !== null);
  if (u < 0 || datas[u] < foco.posse) return null;
  return {
    ...s,
    datas,
    valores,
    posse: foco.posse,
    referencia: datas[u],
    parcial: false,
    cobertura: { ...s.cobertura, fim: datas[u] },
    preliminares: s.preliminares?.filter((d) => d <= datas[u]),
  };
}

function recortarDiaria(b: SerieDiaria | undefined, foco: FocoMandato): SerieDiaria | undefined {
  if (!b) return b;
  const fim = foco.ate ? `${foco.ate}-01` : null;
  const n = fim ? b.datas.findIndex((d) => d >= fim) : -1;
  const datas = n < 0 ? b.datas : b.datas.slice(0, n);
  const valores = n < 0 ? b.valores : b.valores.slice(0, n);
  const u = valores.findLastIndex((v) => v !== null);
  if (u < 0 || datas[u] < `${foco.posse}-01`) return undefined;
  return { ...b, datas, valores, posse: foco.posse };
}

/**
 * O mapa da economia precisa de ao menos uma medida para abrir. Antes de 2001 não há
 * dado por estado: a sala abre vazia e diz por quê, em vez de quebrar.
 */
function leituraVazia(d: DadosPainel, foco: FocoMandato): Leitura {
  const ano = foco.fim.slice(0, 4);
  const nulos = (lista: { codigo: string }[]) => Object.fromEntries(lista.map((x) => [x.codigo, [null]]));
  return {
    id: "sem_dado_por_estado",
    titulo: "Sem dado por estado",
    descricao: "As medidas por estado começam depois deste mandato. O placar e os gráficos abaixo têm os números do país.",
    fonte: "",
    exemplo: false,
    formato: "pct1",
    escala: "linear",
    periodos: [{ codigo: ano, rotulo: ano, extenso: "Por estado, só a partir de 2001" }],
    indicePosse: null,
    indiceRecebido: null,
    brasil: [null],
    regioes: nulos(d.regioes),
    ufs: nulos(d.ufs),
  };
}

function recortarAmbiente(a: DadosAmbiente, foco: FocoMandato): DadosAmbiente {
  const cortar = (s: SerieEconomia | null | undefined) => (s ? recortarSerie(s, foco) : null);
  const m = a.focosMensais;
  const n = m && foco.ate ? m.meses.findIndex((x) => x >= foco.ate!) : -1;
  const p = a.protegidas;
  const ti = cortar(p?.ti);
  const uc = cortar(p?.uc);
  const anos = p?.anos.filter((x) => x <= foco.anoFinal) ?? [];
  return {
    ...a,
    series: a.series.flatMap((s) => recortarSerie(s, foco) ?? []),
    porBioma: a.porBioma.map((b) => ({ ...b, prodes: cortar(b.prodes), focos: cortar(b.focos) })),
    fiscalizacao: a.fiscalizacao.flatMap((l) => recortarLeitura(l, foco) ?? []),
    focosMensais: m && (n < 0 ? m : { meses: m.meses.slice(0, n), brasil: m.brasil.slice(0, n) }),
    focosParcial: null,
    protegidas:
      p && (ti || uc) && anos.length
        ? {
            ...p,
            ti,
            uc,
            anos,
            ano: anos.at(-1)!,
            maisPorAno: Object.fromEntries(
              anos.map((ano) => [
                String(ano),
                (p.maisPorAno[String(ano)] ?? []).map((x) => ({ ...x, recebido: p.anos.includes(foco.anoRecebido) ? (x.porAno[foco.anoRecebido] ?? 0) : null })),
              ]),
            ),
            porBioma: Object.fromEntries(Object.entries(p.porBioma).map(([b, s]) => [b, { ti: cortar(s.ti), uc: cortar(s.uc) }])),
          }
        : null,
  };
}

/** O painel inteiro no mandato de `id`; id desconhecido cai no mandato em curso. */
export function recortarAoMandato(d: DadosPainel, id: string): DadosPainel {
  const mandatos = d.economia.mandatos;
  const foco = focoDoMandato(mandatos, id) ?? focoDoMandato(mandatos, d.presidente.id)!;
  const economia = d.leituras.economia.flatMap((l) => recortarLeitura(l, foco) ?? []);
  const ambiente = d.leituras.ambiente.flatMap((l) => recortarLeitura(l, foco) ?? []);

  // O mandato em curso só ajusta o começo das leituras: as séries seguem até hoje.
  if (foco.emCurso) {
    return {
      ...d,
      foco,
      leituras: { ...d.leituras, economia, ambiente },
      ambiente: { ...d.ambiente, fiscalizacao: d.ambiente.fiscalizacao.flatMap((l) => recortarLeitura(l, foco) ?? []) },
    };
  }

  // Antes de 2017 o PRODES não tem todos os biomas por estado: o mapa fica com a
  // Amazônia Legal, e o título diz que é ela.
  if (!ambiente.some((l) => l.id === "desmatamento") && d.ambiente.desmatamentoLegal) {
    const legal = recortarLeitura(d.ambiente.desmatamentoLegal, foco);
    if (legal) ambiente.unshift(legal);
  }

  const indicadores = (d.economia.porMandato[foco.id] ?? []) as unknown as Indicador[];
  return {
    ...d,
    foco,
    hoje: `${foco.fim}T12:00:00.000Z`,
    novidades: [],
    leituras: { ...d.leituras, economia: economia.length ? economia : [leituraVazia(d, foco)], ambiente },
    queimadas: { ...d.queimadas, anos: d.queimadas.anos.filter((a) => a <= Number(foco.fim.slice(0, 4))) },
    ambiente: recortarAmbiente(d.ambiente, foco),
    economia: {
      ...d.economia,
      series: d.economia.series.flatMap((s) => recortarSerie(s, foco) ?? []),
      indicadores,
      benchmark: d.economia.benchmarkPorMandato[foco.id] ?? [],
      mandatos: mandatos.map((m) => ({ ...m, emCurso: m.id === foco.id })),
      complemento: {
        ...d.economia.complemento,
        series: d.economia.complemento.series.flatMap((s) => recortarSerie(s, foco) ?? []),
        expectativas: [],
        ibovespa: recortarDiaria(d.economia.complemento.ibovespa, foco),
      },
    },
  };
}
