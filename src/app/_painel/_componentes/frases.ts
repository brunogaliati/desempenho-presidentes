import { mesLegivel } from "@/lib/formatar";
import { fraseDeCrescimento, fraseDeMudanca, fraseDePosicao, juntar, nomeNaFrase, posicaoDoRitmo } from "@/lib/fraseCompartilhamento";

import { compararUf } from "../_dados/economiaModelo";
import { ritmoNoMandato } from "../_dados/mandatoRecorte";
import type { Leitura, SerieEconomia, UF } from "../_dados/tipos";
import { emPercentual, formatar, mandatosNaSerie, recebido, referencia, ultimoDado } from "./formatos";

/**
 * O ritmo com a régua do placar, para os dois não discordarem: do último dado antes da
 * posse ao último dado do mandato. Taxas em pontos por ano, valores em % ao ano. PIB e
 * renda já são crescimento e não entram: no placar eles vêm do indicador do mandato.
 */
export function ritmoNaRegua(s: SerieEconomia | undefined, posse: string, ate?: string | null) {
  if (!s || s.formato === "pctsinal1") return null;
  const pontos = !emPercentual(s.formato);
  const r = ritmoNoMandato(s.datas, s.valores, posse, { pontos, ate });
  return r && { ...r, pontos };
}

const COMPARE = "Compare os governos:";

/** Como a série escreve uma data: "set/2026", "2º tri/2026", "PRODES 2025, preliminar". */
export const quandoNaSerie = (s: SerieEconomia, data: string) =>
  s.frequencia === "trimestral" || s.frequencia === "ano-prodes" ? referencia(s, data).replace("*", ", preliminar") : mesLegivel(data);

interface ContextoDaSerie {
  governo?: string;
  /** O que o placar diz da série: a conta de PIB e renda mora lá. */
  mudancaNoPlacar?: string;
  /** A série inteira: com um governo antigo escolhido a da tela para nele, e a fila precisa de todos. */
  completa?: SerieEconomia;
  mandatos: { id: string; inicio: string; emCurso?: boolean }[];
  foco: string;
}

/** Os números de uma série no mandato: a frase e o cartão de compartilhar saem daqui. */
export function numerosDaSerie(s: SerieEconomia, c: ContextoDaSerie) {
  const agora = ultimoDado(s);
  if (!agora) return null;
  const { nome, unidade } = nomeNaFrase(s.id, s.rotulo);
  const base = {
    nome,
    unidade,
    /** Como o número se apresenta sozinho, sem a comparação. */
    rotulo: s.formato === "pctsinal1" ? s.rotulo : nome,
    para: { valor: agora.valor, texto: formatar(agora.valor, s.formato) },
    ate: quandoNaSerie(s, agora.data),
  };
  if (s.formato === "pctsinal1") return { ...base, crescimento: c.mudancaNoPlacar ?? null, de: null, periodo: null, posicao: null };
  const de = recebido(s);
  if (!de) return { ...base, crescimento: null, de: null, periodo: null, posicao: null };
  const fila = c.completa ? mandatosNaSerie(c.completa, c.mandatos) : [];
  const ritmos = fila.map((t) => ritmoNaRegua(c.completa, t.desde, t.ate)?.v ?? null);
  const posicao = posicaoDoRitmo(ritmos, fila.findIndex((t) => t.id === c.foco));
  return {
    ...base,
    crescimento: null,
    de: { valor: de.valor, texto: formatar(de.valor, s.formato) },
    // "Inflação em 12 meses" já diz; o ano PRODES já é um período de 12 meses.
    periodo: `${s.mesesReferencia === 12 && s.frequencia !== "ano-prodes" && !nome.includes("12 meses") ? "12 meses, " : ""}${quandoNaSerie(s, de.data)} a ${base.ate}`,
    posicao: posicao && fraseDePosicao(posicao, c.mandatos.length),
  };
}

/** A frase de uma série nacional: os números do gráfico e a posição que a grade mostra. */
export function fraseDaSerie(s: SerieEconomia, c: ContextoDaSerie): string {
  const n = numerosDaSerie(s, c);
  if (!n) return nomeNaFrase(s.id, s.rotulo).nome;
  if (n.crescimento) return juntar(fraseDeCrescimento({ nome: n.nome, texto: n.crescimento, governo: c.governo, ate: n.ate }), COMPARE);
  if (!n.de || !n.periodo) return juntar(`${n.rotulo}: ${n.para.texto}${n.unidade ? ` ${n.unidade}` : ""} (${n.ate}).`, COMPARE);
  return juntar(
    fraseDeMudanca({ nome: n.nome, unidade: n.unidade, de: n.de.valor, para: n.para.valor, deTexto: n.de.texto, paraTexto: n.para.texto, governo: c.governo, periodo: n.periodo }),
    n.posicao,
    COMPARE,
  );
}

/** "3º maior entre 27 UFs": o lugar de um estado na medida. */
export function lugarNoPais(l: Leitura, u: UF, periodo: number, ufs: UF[]): string {
  const c = compararUf(l, u.codigo, periodo, ufs.map((x) => x.codigo));
  if (!c || c.total < 2) return "";
  if (c.empatados === c.total) return `mesmo valor nas ${c.total} UFs com dado`;
  const maior = c.maior <= c.menor;
  const pos = maior ? c.maior : c.menor;
  const lado = maior ? "maior" : "menor";
  return `${pos}º ${lado} entre ${c.total} UFs${c.empatados > 1 ? " (empatado)" : ""}`;
}

/** O que a medida do mapa diz num lugar: no período pedido e no que o governo recebeu. */
export function numerosDaLeitura(l: Leitura, uf: UF | null, periodo: number) {
  const serie = (uf ? l.ufs[uf.codigo] : l.brasil) ?? [];
  const r = l.indiceRecebido;
  const de = r !== null && r < periodo ? serie[r] ?? null : null;
  return { serie, nome: `${l.titulo} ${uf?.emNome ?? "no Brasil"}`, para: serie[periodo] ?? null, de, recebido: r };
}

/** A frase de uma medida do mapa, no Brasil ou num estado. `lugar` é a posição dele entre as UFs. */
export function fraseDaLeitura(l: Leitura, uf: UF | null, periodo: number, governo: string | undefined, lugar: string): string {
  const { nome, para, de, recebido: r } = numerosDaLeitura(l, uf, periodo);
  const convite = uf ? "Veja o seu estado:" : "Veja estado por estado:";
  // Governo sem dado por estado: o mapa não tem número nenhum para dizer.
  if (para === null) return governo ? `A economia no governo ${governo}. Veja os números:` : `${nome}.`;
  const destaque = lugar && `${lugar[0].toUpperCase()}${lugar.slice(1)}.`;
  if (r === null || de === null) {
    return juntar(`${nome}: ${formatar(para, l.formato)} (${l.periodos[periodo].rotulo}).`, destaque, convite);
  }
  return juntar(
    fraseDeMudanca({
      nome,
      de,
      para,
      deTexto: formatar(de, l.formato),
      paraTexto: formatar(para, l.formato),
      governo,
      periodo: `${l.periodos[r].rotulo} a ${l.periodos[periodo].rotulo}`,
    }),
    destaque,
    convite,
  );
}
