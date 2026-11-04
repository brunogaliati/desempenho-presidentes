import type { Leitura, MandatoVisual } from "./tipos";

export type Pontos = { datas: string[]; valores: (number | null)[] };

export interface PontoPublico { mes: string; valor: number | null }
export interface SeriePublica { codigo: string; nome: string; pontos: PontoPublico[] }

/** Meses ausentes continuam visíveis; trimestre só entra depois de encerrado. */
export function prepararSeriePublica(linhas: PontoPublico[], trimestral: boolean, hoje: string): PontoPublico[] {
  const datas = new Set<string>();
  for (const r of linhas) {
    if (datas.has(r.mes)) throw new Error("Observação duplicada na série pública.");
    datas.add(r.mes);
  }
  const s = regularizar({ datas: linhas.map((r) => r.mes), valores: linhas.map((r) => r.valor) }, trimestral ? "trimestral" : "mensal", hoje);
  return s.datas.map((mes, i) => ({ mes, valor: s.valores[i] }));
}

export function ultimaReferenciaPublica(pontos: PontoPublico[]) {
  return pontos.findLast((p) => p.valor !== null && Number.isFinite(p.valor)) ?? null;
}

export function seriePublicavel(pontos: PontoPublico[], minimo: number): boolean {
  // Uma base longa e cheia de lacunas não basta: o trecho recente precisa ter cobertura.
  return pontos.length >= minimo && pontos.slice(-minimo).every((p) => p.valor !== null && Number.isFinite(p.valor));
}

/** Recortes já publicados conservam a última janela válida quando a fonte falha. */
export function ultimaJanelaPublica(pontos: PontoPublico[], minimo: number) {
  for (let fim = pontos.length; fim >= minimo; fim--) {
    if (seriePublicavel(pontos.slice(fim - minimo, fim), minimo)) return pontos.slice(0, fim);
  }
  return [];
}

export function compararPontosPublicos(pontos: PontoPublico[], desde: string, ate: string, emPontos: boolean) {
  if (desde > ate) return null;
  const a = pontos.find((p) => p.mes === desde)?.valor, b = pontos.find((p) => p.mes === ate)?.valor;
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || (!emPontos && a === 0)) return null;
  return emPontos ? b - a : (b / a - 1) * 100;
}

export function rotuloPeriodoPublico(mes: string, trimestral: boolean): string {
  if (trimestral) return `${Math.ceil(Number(mes.slice(5, 7)) / 3)}º trimestre de ${mes.slice(0, 4)}`;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-01T00:00:00Z`));
}

/** Escala compartilhada pelas UFs do período; falta de dado não vira posição zero. */
export function reguaComparacao(valor: number | null, brasil: number | null, contexto: (number | null)[] = []) {
  const valores = [valor, brasil, ...contexto].filter((v): v is number => v !== null && Number.isFinite(v));
  const menor = Math.min(0, ...valores), maior = Math.max(0, ...valores);
  const passo = 10 ** Math.floor(Math.log10(Math.max(Math.abs(menor), maior) || 1)) / 2;
  const minimo = menor < 0 ? Math.floor(menor * 1.25 / passo) * passo : 0;
  const maximo = maior > 0 ? Math.ceil(maior * 1.25 / passo) * passo : menor < 0 ? 0 : 1;
  const posicao = (v: number | null) => v !== null && Number.isFinite(v) ? (v - minimo) / (maximo - minimo) * 100 : null;
  return { minimo, maximo, estado: posicao(valor), brasil: posicao(brasil) };
}

/** A referência vale zero; ausência de base ou de observação não é estabilidade. */
export function variacaoDesdeReferencia(serie: (number | null)[] | undefined, referencia: number | null, periodo: number, emPontos: boolean): number | null {
  if (!serie || referencia === null || periodo < referencia) return null;
  const a = serie[referencia], b = serie[periodo];
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (periodo === referencia) return 0;
  return emPontos ? b - a : a === 0 ? null : ((b - a) / a) * 100;
}

/** Compara a UF com o agregado nacional e as UFs disponíveis no mesmo período. */
export function compararUf(
  leitura: Pick<Leitura, "ufs" | "brasil">,
  codigo: string,
  periodo: number,
  codigos = Object.keys(leitura.ufs),
) {
  const valor = leitura.ufs[codigo]?.[periodo];
  if (valor == null || !Number.isFinite(valor)) return null;
  const nacional = leitura.brasil[periodo];
  const brasil = nacional != null && Number.isFinite(nacional) ? nacional : null;
  const valores = codigos.map((c) => leitura.ufs[c]?.[periodo])
    .filter((v): v is number => v != null && Number.isFinite(v));
  return {
    valor,
    brasil,
    diferenca: brasil === null ? null : valor - brasil,
    total: valores.length,
    menor: 1 + valores.filter((v) => v < valor).length,
    maior: 1 + valores.filter((v) => v > valor).length,
    empatados: valores.filter((v) => v === valor).length,
  };
}

export const indiceMes = (mes: string) => Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1;
export function deslocarMes(mes: string, passos: number) {
  const n = indiceMes(mes) + passos;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
}
export const fimMes = (mes: string) => new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** Grade regular: ausência permanece nula, nunca vira zero nem encurta o tempo. */
export function regularizar(s: Pontos, frequencia: string, hoje: string): Pontos {
  const trimestral = frequencia === "trimestral";
  const pares = s.datas.flatMap((d, i) => {
    const mes = trimestral ? deslocarMes(d, 2) : d.slice(0, 7);
    return mes < "1994-07" || mes > hoje.slice(0, 7) || (trimestral && fimMes(mes) > hoje)
      ? [] : [[mes, Number.isFinite(s.valores[i]) ? s.valores[i] : null] as const];
  }).sort(([a], [b]) => a.localeCompare(b));
  if (!pares.length) return { datas: [], valores: [] };
  const mapa = new Map(pares);
  const datas: string[] = [];
  for (let d = pares[0][0]; d <= pares.at(-1)![0]; d = deslocarMes(d, trimestral ? 3 : 1)) datas.push(d);
  return { datas, valores: datas.map((d) => mapa.get(d) ?? null) };
}

export function acumulado12(s: Pontos): Pontos {
  return {
    datas: s.datas.slice(11),
    valores: s.datas.slice(11).map((d, k) => {
      const i = k + 11;
      const janela = s.valores.slice(i - 11, i + 1);
      if (indiceMes(d) - indiceMes(s.datas[i - 11]) !== 11 || janela.some((v) => v === null)) return null;
      return Math.round((janela.reduce<number>((f, v) => f * (1 + v! / 100), 1) - 1) * 10000) / 100;
    }),
  };
}

/** Variações de todos os meses do intervalo, inclusive início e fim. */
export function acumuladoPeriodo(s: Pontos, desde: string, ate: string): number | null {
  const inicio = s.datas.indexOf(desde), fim = s.datas.indexOf(ate);
  if (inicio < 0 || fim < inicio || fim - inicio !== indiceMes(ate) - indiceMes(desde)) return null;
  let fator = 1;
  for (let i = inicio; i <= fim; i++) {
    const valor = s.valores[i];
    if (s.datas[i] !== deslocarMes(desde, i - inicio) || valor == null || !Number.isFinite(valor) || valor <= -100) return null;
    fator *= 1 + valor / 100;
  }
  return Math.round((fator - 1) * 10000) / 100;
}

export interface MesInflacao { mes: string; mensal: number | null; ano: number | null; dozeMeses: number | null }

export function montarInflacao(s: Pontos, hoje: string) {
  const publicados = s.datas.flatMap((mes, i) => {
    const valor = s.valores[i];
    return valor != null && Number.isFinite(valor) && valor > -100 ? [{ mes, valor }] : [];
  });
  const mensal = regularizar({ datas: publicados.map((r) => r.mes), valores: publicados.map((r) => r.valor) }, "mensal", hoje);
  if (!mensal.datas.length) throw new Error("IPCA sem observações disponíveis.");
  const doze = acumulado12(mensal);
  const porMes = new Map(doze.datas.map((mes, i) => [mes, doze.valores[i]]));
  const historico: MesInflacao[] = mensal.datas.map((mes, i) => ({
    mes, mensal: mensal.valores[i], ano: acumuladoPeriodo(mensal, `${mes.slice(0, 4)}-01`, mes), dozeMeses: porMes.get(mes) ?? null,
  }));
  const porAno = new Map<string, MesInflacao>();
  for (const r of historico) if (r.mes >= "1995-01" && r.mensal !== null) porAno.set(r.mes.slice(0, 4), r);
  return { mensal, historico, anuais: [...porAno.values()].reverse(), ultimo: historico.at(-1)! };
}

export function contraAnoAnterior(s: Pontos): Pontos {
  const porData = new Map(s.datas.map((d, i) => [d, s.valores[i]]));
  const inicio = s.datas.findIndex((d) => indiceMes(d) - indiceMes(s.datas[0]) >= 12);
  if (inicio < 0) return { datas: [], valores: [] };
  return {
    datas: s.datas.slice(inicio),
    valores: s.valores.slice(inicio).map((v, i) => {
      const anterior = porData.get(deslocarMes(s.datas[inicio + i], -12));
      return v === null || anterior == null || anterior === 0 ? null : Math.round((v / anterior - 1) * 1000) / 10;
    }),
  };
}

export function intervaloReferencia(mes: string, meses: number, hoje?: string) {
  return { inicio: `${deslocarMes(mes, 1 - meses)}-01`, fim: hoje && fimMes(mes) > hoje ? hoje : fimMes(mes) };
}

/** Quem estava na Presidência em algum momento do período a que o dado se refere. */
export function governosNoPeriodo(mes: string, meses: number, mandatos: MandatoVisual[], hoje?: string) {
  const { inicio, fim } = intervaloReferencia(mes, meses, hoje);
  return mandatos.filter((p) => p.inicio <= fim && p.fim >= inicio);
}

export function recortar(s: Pontos, inicio: string, fim: string): Pontos {
  const indices = s.datas.map((_, i) => i).filter((i) => s.datas[i] >= inicio && s.datas[i] <= fim);
  return { datas: indices.map((i) => s.datas[i]), valores: indices.map((i) => s.valores[i]) };
}

/**
 * CSV usa os mesmos pontos da tabela; metadados ficam em colunas explícitas.
 *
 * No formato do IBGE e do BCB: ponto e vírgula entre colunas e vírgula
 * decimal. Com ponto decimal, o Excel em português lia "4.62" como data.
 */
export function criarCsv(cabecalho: string[], linhas: (string | number | null)[][]) {
  const celula = (v: string | number | null) => {
    let t = v === null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v;
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replaceAll('"', '""')}"`;
  };
  return "\ufeff" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
}

export interface LinhaPnad { nivel: string; codigo_territorio: string; periodo: string; valor: number | string | null }
export function organizarPnad(linhas: LinhaPnad[]) {
  const publicados = [...new Set(linhas.map((r) => r.periodo))].sort();
  const periodos: string[] = [];
  if (publicados.length) {
    const primeiro = publicados[0], ultimo = publicados.at(-1)!;
    for (let ano = Number(primeiro.slice(0, 4)); ano <= Number(ultimo.slice(0, 4)); ano++) {
      for (let tri = 1; tri <= 4; tri++) {
        const codigo = `${ano}0${tri}`;
        if (codigo >= primeiro && codigo <= ultimo) periodos.push(codigo);
      }
    }
  }
  const grupos = new Map<string, Map<string, number | null>>();
  for (const r of linhas) {
    const key = `${r.nivel}:${r.codigo_territorio}`;
    const valores = grupos.get(key) ?? new Map();
    if (valores.has(r.periodo)) throw new Error("PNAD com referências duplicadas.");
    const v = r.valor === null ? null : Number(r.valor);
    valores.set(r.periodo, v !== null && Number.isFinite(v) ? v : null);
    grupos.set(key, valores);
  }
  const grupo = (nivel: string) => Object.fromEntries([...grupos].filter(([k]) => k.startsWith(nivel + ":")).map(([k, vs]) => [k.split(":")[1], periodos.map((p) => vs.get(p) ?? null)]));
  return { periodos: periodos.map((codigo) => ({ codigo })), brasil: grupo("N1")["1"] ?? periodos.map(() => null), regioes: grupo("N2"), ufs: grupo("N3") };
}

/** Meses de `inicio` a `fim`, inclusive, no formato AAAA-MM. */
export function mesesEntre(inicio: string, fim: string): string[] {
  const lista: string[] = [];
  for (let m = inicio; m <= fim; m = deslocarMes(m, 1)) lista.push(m);
  return lista;
}

export interface LinhaTerritorio {
  nivel: "N1" | "N2" | "N3";
  codigo: string;
  periodo: string;
  valor: number | null;
}

/**
 * Séries por território alinhadas a uma lista de períodos, no formato do
 * mapa. Período sem linha fica `null`: ausência, nunca zero.
 */
export function alinharTerritorio(linhas: LinhaTerritorio[], periodos: string[]) {
  const posicao = new Map(periodos.map((p, i) => [p, i]));
  const grupos: Record<LinhaTerritorio["nivel"], Record<string, (number | null)[]>> = { N1: {}, N2: {}, N3: {} };
  for (const r of linhas) {
    const i = posicao.get(r.periodo);
    if (i === undefined) continue;
    const serie = (grupos[r.nivel][r.codigo] ??= periodos.map(() => null));
    serie[i] = r.valor !== null && Number.isFinite(r.valor) ? r.valor : null;
  }
  return {
    brasil: grupos.N1["1"] ?? periodos.map(() => null),
    regioes: grupos.N2,
    ufs: grupos.N3,
  };
}
