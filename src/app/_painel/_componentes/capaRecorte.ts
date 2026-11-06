import { contagemDoPlacar } from "@/lib/fraseCompartilhamento";
import { sentido as sentidoDe, type Sentido } from "@/lib/formatar";
import { metaDoPerfil } from "@/lib/perfisPainel";
import { imagemDaPagina } from "@/lib/seo";
import { TEMAS_PAINEL, temaDoCaminho } from "@/lib/temasPainel";

import { recortar } from "../_dados/economiaModelo";
import { BIOMAS_DESMATAMENTO, desmatamentoHistorico } from "../_dados/desmatamentoHistorico";
import { doisAnosAntes, focoDoMandato, mandatoDoEndereco, recortarAoMandato } from "../_dados/mandatoRecorte";
import type { DadosPainel, MandatoVisual, SerieEconomia, UF } from "../_dados/tipos";
import { formatar, mandatosNaSerie, ultimoDado } from "./formatos";
import { lugarNoPais, numerosDaLeitura, numerosDaSerie, quandoNaSerie } from "./frases";
import { placarDoAmbiente } from "./placarAmbiente";
import { placarDoMandato, VEREDITO, type ItemPlacar } from "./placarModelo";
import { filtrosDaSecao, secaoCompartilhada, type TemaDeSecao } from "./secoesCompartilhamento";

/**
 * A capa de um link do painel: o cartão que WhatsApp, Telegram, X e Facebook mostram.
 *
 * Tudo aqui é conta pura sobre os dados do painel, e roda nos dois lados. O servidor
 * usa para escrever as metatags e desenhar a imagem; o navegador, para a prévia do
 * diálogo. Por isso a prévia não pode prometer outro cartão. O cartão só tem ids e
 * dados do servidor: nenhum texto vem do endereço.
 */

type Tema = "economia" | "ambiente";

export type PedidoDeCapa =
  | { tipo: "placar"; tema: Tema; mandato: string }
  | { tipo: "desmatamento"; mandato: string; bioma: string }
  | { tipo: "secao"; tema: TemaDeSecao; mandato: string; secao: string; uf: string | null; ano: number | null; filtros: Record<string,string> }
  /** `serie` nula é a que o painel abre sozinho. */
  | { tipo: "serie"; tema: Tema; mandato: string; serie: string | null }
  /** `leitura` nula é a primeira medida; `periodo` nulo, o último com dado. */
  | { tipo: "leitura"; mandato: string; leitura: string | null; uf: string | null; periodo: number | null };

interface Governo {
  id: string;
  nome: string;
  anos: string;
}

interface Capa {
  imagem: string;
  titulo: string;
  descricao: string;
}

export interface CartaoIndicador extends Capa {
  tipo: "indicador";
  nome: string;
  /** O que o governo recebeu; nulo quando o número grande já é a mudança (PIB) ou não há comparação. */
  de: string | null;
  para: string;
  /** Embaixo do número: "do PIB · dez/2022 a set/2026". */
  legenda: string;
  sentido: Sentido;
  /** "Pior que na posse". A cor nunca fala sozinha. */
  veredito: string | null;
  /** "2º maior ritmo de alta em 6 mandatos com dado." */
  destaque: string | null;
  governo: Governo | null;
  uf: UF | null;
  /** O gráfico: dois anos antes da posse até o último dado. */
  linha: {
    valores: (number | null)[];
    /** O ponto recebido, onde a faixa do mandato começa; -1 se o trecho já começa nele. */
    posse: number;
    referencia: number | null;
    inicio: string;
    fim: string;
  };
  fonte: string;
}

export interface CartaoPlacar extends Capa {
  tipo: "placar";
  tema: string;
  governo: Governo;
  bons: number;
  iguais: number;
  ruins: number;
  grupos: { titulo: string; itens: { rotulo: string; mudanca: string; sentido: Sentido }[] }[];
}

export interface CartaoDesmatamento extends Capa {
  tipo: "desmatamento";
  nome: string;
  periodo: string;
  nota: string;
  pontos: { ano: string; valor: number | null; sentido: Sentido; preliminar: boolean; destaque: boolean }[];
  governos: { nome: string; inicio: number; fim: number }[];
}

export interface CartaoSecao extends Capa {
  tipo: "secao";
  nome: string;
  legenda: string;
  uf: UF | null;
  pedido: Extract<PedidoDeCapa, { tipo: "secao" }>;
}

export type Cartao = CartaoIndicador | CartaoPlacar | CartaoDesmatamento | CartaoSecao;

const CONVITE = "Compare os governos.";
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const noEixo = (t: string) => t.replace("PRODES ", "").replace(", preliminar", "*");

function imagemDe(pedido: Record<string, string | number | null | undefined>, inteiros: DadosPainel): string {
  const q = new URLSearchParams();
  for (const [chave, valor] of Object.entries(pedido)) if (valor !== null && valor !== undefined) q.set(chave, String(valor));
  // O dia na URL: os aplicativos guardam a imagem pelo endereço, e o número muda.
  q.set("d", inteiros.hoje.slice(0, 10));
  return `/compartilhar/recorte?${q}`;
}

function governoDe(m: MandatoVisual | undefined): Governo | null {
  return m ? { id: m.id, nome: m.nomeCurto, anos: `${m.inicio.slice(0, 4)}–${m.fim.slice(0, 4)}` } : null;
}

/** O placar inteiro de um tema, sem o que o recorte não mede. */
function itensDoPlacar(tema: Tema, dados: DadosPainel): ItemPlacar[] {
  if (tema === "economia") {
    const { grupos, mercado } = placarDoMandato(dados);
    return [...grupos.flatMap((g) => g.itens), ...mercado];
  }
  const { grupos, fileiras } = placarDoAmbiente(dados);
  return [...grupos.flatMap((g) => g.itens), ...fileiras.flatMap((f) => f.itens)].filter((x) => !x.falta);
}

function cartaoDoPlacar(tema: Tema, mandato: string, inteiros: DadosPainel): CartaoPlacar | null {
  const governo = governoDe(inteiros.economia.mandatos.find((m) => m.id === mandato));
  if (!governo) return null;
  const dados = recortarAoMandato(inteiros, mandato);
  const brutos = tema === "economia" ? placarDoMandato(dados).grupos : placarDoAmbiente(dados).grupos;
  const grupos = brutos
    .map((g) => ({
      titulo: g.titulo,
      itens: g.itens.filter((x) => !("falta" in x && x.falta)).map((x) => ({ rotulo: x.rotulo, mudanca: x.mudanca, sentido: x.sentido })),
    }))
    .filter((g) => g.itens.length > 0);
  const itens = grupos.flatMap((g) => g.itens);
  if (!itens.length) return null;
  const quantos = (s: Sentido) => itens.filter((x) => x.sentido === s).length;
  const conta = { bons: quantos("bom"), iguais: quantos("neutro"), ruins: quantos("ruim") };
  const nomeTema = tema === "economia" ? "Economia" : "Meio ambiente";
  return {
    tipo: "placar",
    tema: nomeTema,
    governo,
    ...conta,
    grupos,
    titulo: `${nomeTema} no governo ${governo.nome} (${governo.anos}): ${contagemDoPlacar(conta)}`,
    descricao: `De ${itens.length} indicadores, cada um hoje contra o que o governo recebeu na posse. Mesma régua para todos os governos, com a fonte de cada número.`,
    imagem: imagemDe({ tema: tema === "ambiente" ? tema : null, mandato }, inteiros),
  };
}

/** Todas as séries que o gráfico do meio ambiente abre, inclusive as dos biomas. */
function seriesDoAmbiente(d: DadosPainel): SerieEconomia[] {
  const { series, protegidas, porBioma } = d.ambiente;
  return [
    ...series,
    protegidas?.ti ?? null,
    protegidas?.uc ?? null,
    ...porBioma.flatMap((b) => [b.prodes, b.focos]),
    ...Object.values(protegidas?.porBioma ?? {}).flatMap((b) => [b.ti, b.uc]),
  ].filter((x): x is SerieEconomia => x !== null);
}

function cartaoDaSerie(p: Extract<PedidoDeCapa, { tipo: "serie" }>, inteiros: DadosPainel): CartaoIndicador | null {
  const dados = recortarAoMandato(inteiros, p.mandato);
  const atual = recortarAoMandato(inteiros, inteiros.presidente.id);
  const economia = p.tema === "economia";
  const lista = economia ? dados.economia.series : seriesDoAmbiente(dados);
  const s = p.serie ? lista.find((x) => x.id === p.serie) : (economia ? dados.economia.series : dados.ambiente.series).find((x) => ultimoDado(x));
  const ultimo = s ? ultimoDado(s) : null;
  if (!s || !ultimo) return null;
  const item = itensDoPlacar(p.tema, dados).find((x) => (economia ? x.serie?.id : x.id) === s.id);
  const m = inteiros.economia.mandatos.find((x) => x.id === p.mandato);
  const n = numerosDaSerie(s, {
    governo: m?.nomeCurto,
    mudancaNoPlacar: item?.mudanca,
    completa: (economia ? atual.economia.series : atual.ambiente.series).find((c) => c.id === s.id),
    mandatos: atual.economia.mandatos,
    foco: dados.foco.id,
  });
  if (!n) return null;

  // O que o leitor enxerga manda, como na frase: igual nos dois lados não é mudança.
  const igual = n.de?.texto === n.para.texto;
  const de = igual ? null : n.de;
  const sentido = igual ? "neutro" : (item?.sentido ?? (de ? sentidoDe(Math.round((n.para.valor - de.valor) * 10) / 10, s.direcao) : "neutro"));
  const posse = s.posse ?? dados.foco.posse;
  const trecho = recortar(s, doisAnosAntes(posse), ultimo.data);
  const aPartir = trecho.datas.findLastIndex((d) => d < posse);
  const noGoverno = m ? ` no governo ${m.nomeCurto}` : "";
  const unidade = n.unidade ? ` ${n.unidade}` : "";
  const titulo = n.crescimento
    ? `${n.nome}${noGoverno}: ${n.crescimento} desde a posse`
    : n.de
      ? `${n.nome}${noGoverno}: ${de ? `de ${de.texto} para ` : ""}${n.para.texto}${unidade}`
      : `${n.rotulo}: ${n.para.texto}${unidade}`;
  return {
    tipo: "indicador",
    nome: n.crescimento || n.de ? n.nome : n.rotulo,
    de: de?.texto ?? null,
    para: n.crescimento ?? n.para.texto,
    legenda: [n.unidade, n.crescimento ? `desde a posse, até ${n.ate}` : (n.periodo ?? n.ate)].filter(Boolean).join(" · "),
    sentido,
    veredito: igual || sentido !== "neutro" ? maiuscula(VEREDITO[sentido]) : null,
    destaque: n.posicao,
    governo: governoDe(m),
    uf: null,
    linha: {
      valores: trecho.valores,
      posse: aPartir,
      referencia: s.formato === "pctsinal1" ? 0 : (n.de?.valor ?? null),
      // No eixo o ano PRODES fica só no ano: o nome da série já diz de onde ele vem.
      inicio: noEixo(quandoNaSerie(s, trecho.datas[0])),
      fim: noEixo(n.ate),
    },
    fonte: s.fonte,
    titulo,
    descricao: [n.crescimento ? `Da posse até ${n.ate}.` : n.periodo && `${maiuscula(n.periodo)}.`, n.posicao, `Fonte: ${s.fonte}.`, CONVITE].filter(Boolean).join(" "),
    imagem: imagemDe({ tema: economia ? null : p.tema, mandato: p.mandato, serie: s.id }, inteiros),
  };
}

function cartaoDaLeitura(p: Extract<PedidoDeCapa, { tipo: "leitura" }>, inteiros: DadosPainel): CartaoIndicador | null {
  const dados = recortarAoMandato(inteiros, p.mandato);
  const uf = p.uf ? dados.ufs.find((u) => u.sigla === p.uf) : null;
  const l = p.leitura ? dados.leituras.economia.find((x) => x.id === p.leitura) : dados.leituras.economia[0];
  if (!l || uf === undefined) return null;
  const crua = uf ? l.ufs[uf.codigo] : l.brasil;
  const periodo = p.periodo ?? crua?.findLastIndex((v) => v !== null) ?? -1;
  if (!l.periodos[periodo]) return null;
  const { serie, nome, para, de: recebeu, recebido: r } = numerosDaLeitura(l, uf, periodo);
  if (para === null) return null;
  const texto = (v: number) => formatar(v, l.formato);
  const igual = recebeu !== null && texto(recebeu) === texto(para);
  const de = igual ? null : recebeu;

  const m = inteiros.economia.mandatos.find((x) => x.id === p.mandato);
  const sentido = de === null ? "neutro" : sentidoDe(Math.round((para - de) * 10) / 10, l.direcao ?? "neutro");
  const lugar = uf ? lugarNoPais(l, uf, periodo, dados.ufs) : "";
  const periodoTexto = r !== null && recebeu !== null ? `${l.periodos[r].rotulo} a ${l.periodos[periodo].rotulo}` : l.periodos[periodo].rotulo;
  const inicio = r === null ? 0 : Math.max(0, r - 8);
  const noGoverno = m ? ` no governo ${m.nomeCurto}` : "";
  return {
    tipo: "indicador",
    nome,
    de: de === null ? null : texto(de),
    para: texto(para),
    legenda: periodoTexto,
    sentido,
    veredito: igual || sentido !== "neutro" ? maiuscula(VEREDITO[sentido]) : null,
    destaque: lugar ? `${maiuscula(lugar)}.` : null,
    governo: governoDe(m),
    uf: uf ?? null,
    linha: {
      valores: serie.slice(inicio, periodo + 1),
      posse: r === null || r < inicio || r > periodo ? -1 : r - inicio,
      referencia: recebeu,
      inicio: l.periodos[inicio].rotulo,
      fim: l.periodos[periodo].rotulo,
    },
    fonte: l.fonte,
    titulo: recebeu === null ? `${nome}: ${texto(para)} (${l.periodos[periodo].rotulo})` : `${nome}${noGoverno}: ${de === null ? "" : `de ${texto(de)} para `}${texto(para)}`,
    descricao: [`${maiuscula(periodoTexto)}.`, lugar && `${maiuscula(lugar)}.`, `Fonte: ${l.fonte}.`, uf ? "Veja o seu estado." : "Veja estado por estado."].filter(Boolean).join(" "),
    imagem: imagemDe({ mandato: p.mandato, leitura: l.id, uf: uf?.sigla, periodo: p.periodo }, inteiros),
  };
}

/** O cartão de um pedido, ou `null` se o id não existe ou o governo não tem o dado. */
export function cartaoDoPedido(p: PedidoDeCapa, inteiros: DadosPainel): Cartao | null {
  if (!focoDoMandato(inteiros.economia.mandatos, p.mandato)) return null;
  if (p.tipo === "secao") {
    const uf = p.uf ? inteiros.ufs.find((u) => u.sigla === p.uf) : null;
    const secao = secaoCompartilhada(p.tema, p.secao, uf?.sigla);
    if (!secao || uf === undefined || (p.ano !== null && (!Number.isInteger(p.ano) || p.ano < 1990 || p.ano > 2200))) return null;
    const governo = governoDe(inteiros.economia.mandatos.find((m) => m.id === p.mandato));
    const legenda = [uf?.nome ?? (p.tema === "dinheiro" ? "União" : "Brasil"), p.ano ?? (governo ? `período selecionado: ${governo.nome} (${governo.anos})` : null)].filter(Boolean).join(" · ");
    return { tipo: "secao", nome: secao[0], legenda, uf: uf ?? null, pedido: p, titulo: `${secao[0]} · ${legenda}`, descricao: secao[1], imagem: imagemDe({ tema: p.tema, mandato: p.mandato, secao: p.secao, uf: p.uf, ano: p.ano, ...p.filtros, conteudo: "dados-v1" }, inteiros) };
  }
  if (p.tipo === "desmatamento") return cartaoDoDesmatamento(p, inteiros);
  if (p.tipo === "placar") return cartaoDoPlacar(p.tema, p.mandato, inteiros);
  if (p.tipo === "serie") return cartaoDaSerie(p, inteiros);
  return cartaoDaLeitura(p, inteiros);
}

function cartaoDoDesmatamento(p: Extract<PedidoDeCapa, { tipo: "desmatamento" }>, dados: DadosPainel): CartaoDesmatamento | null {
  if (!BIOMAS_DESMATAMENTO.some((id) => id === p.bioma)) return null;
  const { s, nome, nota } = desmatamentoHistorico(dados, p.bioma);
  if (!s || !s.valores.some((v) => v !== null)) return null;
  const mandatos = dados.economia.mandatos;
  const trechos = mandatosNaSerie(s, mandatos);
  const foco = mandatos.find((m) => m.id === p.mandato);
  const pontos = s.datas.map((d, i) => {
    const trecho = trechos.find((t) => d >= t.desde && (!t.ate || d < t.ate));
    return { ano: d.slice(0, 4), valor: s.valores[i], sentido: trecho?.sentido ?? "neutro", preliminar: s.preliminares?.includes(d) ?? false, destaque: Boolean(foco?.emCurso || trecho?.id === p.mandato) };
  });
  const governos = trechos.flatMap((t) => {
    const indices = s.datas.flatMap((d, i) => d >= t.desde && (!t.ate || d < t.ate) ? [i] : []);
    const m = mandatos.find((m) => m.id === t.id);
    return indices.length && m ? [{ nome: m.nomeCurto, inicio: indices[0], fim: indices.at(-1)! }] : [];
  });
  const periodo = `${pontos[0].ano}–${pontos.at(-1)!.ano}`;
  return {
    tipo: "desmatamento", nome, periodo, nota, pontos, governos,
    titulo: `Desmatamento por ano e por governo: ${nome} (${periodo})`,
    descricao: `Compare o desmatamento por ano PRODES em ${nome}, de ${pontos[0].ano} a ${pontos.at(-1)!.ano}. Cada governo contra o que recebeu. ${nota} Fonte: INPE/PRODES.`,
    imagem: imagemDe({ tema: "ambiente", mandato: p.mandato, grafico: "desmatamento", bioma: p.bioma }, dados),
  };
}

/**
 * O pedido que um link do painel faz, pela mesma leitura que o painel faz do endereço.
 * O botão do painel leva `mandato`; o de cada bloco leva também `painel`.
 */
export function pedidoDoLink(caminho: string, q: URLSearchParams, inteiros: DadosPainel): PedidoDeCapa | null {
  const pessoaId = caminho.match(/^\/presidente\/([^/]+)$/)?.[1];
  const tema = temaDoCaminho(caminho);
  if (!pessoaId && caminho !== TEMAS_PAINEL[tema].caminho) return null;
  const sigla = pessoaId ? null : (inteiros.ufs.find((u) => u.sigla === q.get("uf")?.toUpperCase())?.sigla ?? null);
  const pedido = q.get("mandato");
  const mandato = mandatoDoEndereco(inteiros, { pessoaId, sigla, pedido });
  const painel = q.get("painel");
  if (painel && secaoCompartilhada(tema, painel, sigla)) {
    const ano = tema === "dinheiro" ? Number(q.get("r.ano") ?? NaN) : NaN;
    return { tipo: "secao", tema, mandato, secao: painel, uf: sigla, ano: Number.isInteger(ano) && ano >= 1990 && ano <= 2200 ? ano : null, filtros: filtrosDaSecao(q) };
  }
  if (tema === "dinheiro") return null;
  if (tema === "ambiente" && painel === "desmatamento") {
    const bioma = q.get("r.desmatamento.bioma") ?? "amazonia";
    return { tipo: "desmatamento", mandato, bioma: BIOMAS_DESMATAMENTO.some((id) => id === bioma) ? bioma : "amazonia" };
  }
  if (painel === "de-perto") {
    if ((!sigla || q.get('r.leitura')==='null') && (q.get('r.faixa')==='tudo' || q.get('r.historico.tabela')==='true')) return {tipo:'secao',tema,mandato,secao:'historico-serie',uf:sigla,ano:null,filtros:filtrosDaSecao(q)};
    if (tema === "economia" && sigla && q.get("r.leitura") !== "null") return { tipo: "leitura", mandato, leitura: q.get("r.leitura"), uf: sigla, periodo: null };
    return { tipo: "serie", tema, mandato, serie: q.get("r.serie") };
  }
  if (painel === "mapa-economia") {
    const periodo = q.get("r.mapa.historico") === "true" ? Number(q.get("r.mapa.periodo")) : NaN;
    return { tipo: "leitura", mandato, leitura: q.get("r.mapa.indicador"), uf: sigla, periodo: Number.isInteger(periodo) ? periodo : null };
  }
  // Um bloco sem capa própria não pode fingir ser o placar inteiro de um mandato.
  return pedido && !sigla && (!painel || painel === "agora") ? { tipo: "placar", tema, mandato } : null;
}

/** O pedido escrito na URL da imagem; ids não conferidos aqui: `cartaoDoPedido` confere. */
export function pedidoDaImagem(q: URLSearchParams): PedidoDeCapa | null {
  const mandato = q.get("mandato");
  if (!mandato) return null;
  if (q.has("secao")) {
    const tema = q.get("tema");
    if (tema !== "economia" && tema !== "ambiente" && tema !== "dinheiro") return null;
    return { tipo: "secao", tema, mandato, secao: q.get("secao")!, uf: q.get("uf"), ano: q.has("ano") ? Number(q.get("ano")) : null, filtros: filtrosDaSecao(q) };
  }
  if (q.has("grafico")) return q.get("grafico") === "desmatamento" ? { tipo: "desmatamento", mandato, bioma: q.get("bioma") ?? "amazonia" } : null;
  const tema: Tema = q.get("tema") === "ambiente" ? "ambiente" : "economia";
  const serie = q.get("serie"), leitura = q.get("leitura");
  if (serie) return { tipo: "serie", tema, mandato, serie };
  if (!leitura) return { tipo: "placar", tema, mandato };
  const periodo = Number(q.get("periodo") ?? NaN);
  return { tipo: "leitura", mandato, leitura, uf: q.get("uf"), periodo: Number.isInteger(periodo) ? periodo : null };
}

export function cartaoDoEndereco(caminho: string, q: URLSearchParams, inteiros: DadosPainel): Cartao | null {
  const pedido = pedidoDoLink(caminho, q, inteiros);
  if (!pedido) return null;
  const cartao = cartaoDoPedido(pedido, inteiros);
  // O mapa de um governo sem dado por estado: a frase fala do governo, e o cartão também.
  if (!cartao && pedido.tipo === "leitura" && !pedido.uf) return cartaoDoPedido({ tipo: "placar", tema: "economia", mandato: pedido.mandato }, inteiros);
  return cartao;
}

/** O que os aplicativos vão mostrar para este link: o cartão do recorte ou, sem recorte, a capa da página. */
export function capaDoLink(link: string, inteiros: DadosPainel): { imagem: string; titulo: string; descricao: string } {
  const { pathname: caminho, searchParams } = new URL(link);
  const cartao = cartaoDoEndereco(caminho, searchParams, inteiros);
  if (cartao) return { imagem: imagemDaPagina(caminho, cartao.imagem), titulo: cartao.titulo, descricao: cartao.descricao };
  const pessoaId = caminho.match(/^\/presidente\/([^/]+)$/)?.[1];
  const perfil = pessoaId ? metaDoPerfil(inteiros.economia.mandatos.filter((m) => m.pessoaId === pessoaId)) : null;
  return { imagem: imagemDaPagina(caminho), ...(perfil ?? TEMAS_PAINEL[temaDoCaminho(caminho)]) };
}
