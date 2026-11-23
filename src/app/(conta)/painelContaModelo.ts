import {
  type CasaCongresso, type IndiceCota, type Plenario, type VotacaoPlenario,
  NOME_UF, comparadoAMedia, taxa,
} from "@/app/_painel/_dados/congressoModelo";
import fotografia from "@/app/_painel/_dados/fotografia.json";
import { chaveSeguido, type ChaveSeguido } from "@/lib/seguindoChave";

/**
 * As contas da página "Minha conta": a busca de parlamentares, o feed de votações de quem a
 * pessoa segue e quem vota junto. Tudo sai dos mesmos arquivos do painel do Congresso
 * (`plenario-{casa}.json` e o índice da cota), sem consulta nova ao banco.
 */

export type Pessoa = { casa: CasaCongresso; id: number; nome: string; partido: string | null; uf: string };

export const PESSOAS: Pessoa[] = (["deputados", "senadores"] as const)
  .flatMap(casa => fotografia[casa].map(p => ({ casa, id: p.id, nome: p.nome, partido: p.partido, uf: p.uf })));
export const PESSOA_POR_CHAVE = new Map(PESSOAS.map(p => [chaveSeguido(p), p]));

export const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
const ordemNome = (a: Pessoa, b: Pessoa) => a.nome.localeCompare(b.nome, "pt-BR");

/**
 * Por nome ou partido (todas as palavras precisam aparecer), ou a bancada inteira de um estado
 * pela sigla ("SP") ou pelo nome ("São Paulo"). Na bancada, os senadores vêm primeiro.
 */
export function buscarParlamentares(consulta: string, casa: CasaCongresso | null): { lista: Pessoa[]; uf: string | null } {
  const q = semAcento(consulta.trim());
  if (!q) return { lista: [], uf: null };
  const naCasa = PESSOAS.filter(p => !casa || p.casa === casa);
  const uf = (q.length === 2 && NOME_UF[q.toUpperCase()] ? q.toUpperCase() : null)
    ?? Object.entries(NOME_UF).find(([, nome]) => semAcento(nome) === q)?.[0] ?? null;
  if (uf) {
    return { uf, lista: naCasa.filter(p => p.uf === uf).sort((a, b) => (a.casa === b.casa ? ordemNome(a, b) : a.casa === "senadores" ? -1 : 1)) };
  }
  const termos = q.split(/\s+/);
  const lista = naCasa
    .filter(p => { const alvo = semAcento(`${p.nome} ${p.partido ?? ""}`); return termos.every(t => alvo.includes(t)); })
    .sort((a, b) => Number(!semAcento(a.nome).startsWith(q)) - Number(!semAcento(b.nome).startsWith(q)) || ordemNome(a, b));
  return { lista, uf: null };
}

/** Abaixo de 10 sessões ou votos, a porcentagem diz pouco (a mesma regra da página do parlamentar). */
const BASE_MINIMA = 10;
const taxaComBase = (par: [number, number] | undefined) => (par && par[1] >= BASE_MINIMA ? taxa(par) : null);

/**
 * Votações em que a fonte deu o placar mas não o voto de ninguém (a mais recente da Câmara costuma
 * chegar assim, antes da lista nominal). Ali "-" não é falta: é voto ainda não publicado, e a
 * conta mostraria "Não votou" para todo mundo. Ficam de fora do feed e do último voto.
 */
const semNominal = new WeakMap<Plenario, Set<number>>();
export function semVotosIndividuais(p: Plenario): Set<number> {
  let vazias = semNominal.get(p);
  if (!vazias) {
    const linhas = Object.values(p.votos);
    vazias = new Set(p.votacoes.flatMap((_, i) => (linhas.every(l => l[i] === "-" || l[i] === " " || l[i] === undefined) ? [i] : [])));
    semNominal.set(p, vazias);
  }
  return vazias;
}

/** O ano mais recente com votações suficientes na casa: no começo do ano, o anterior. */
export function anoDeReferencia(p: Plenario): number | null {
  const anos = [...p.anos].sort((a, b) => b - a);
  return anos.find(ano => (p.totais[String(ano)]?.votacoes ?? 0) >= BASE_MINIMA) ?? anos[0] ?? null;
}

export type NumerosPessoa = {
  ano: number | null;
  /** Câmara: presença nas sessões deliberativas. Senado: ausências nas votações (justificadas ou não). */
  presenca: number | null;
  ausencias: number | null;
  votou: number | null;
  governo: number | null;
  mediana: { s: number | null; v: number | null; g: number | null } | null;
  cota: { ano: number; total: number; ate: number | null; comparacao: string | null } | null;
  ultimo: { votacao: VotacaoPlenario; letra: string } | null;
};

export function numerosDaPessoa(pessoa: Pessoa, plenario: Plenario | null, indice: IndiceCota | null): NumerosPessoa {
  const ano = plenario ? anoDeReferencia(plenario) : null;
  const linha = plenario && ano !== null ? plenario.pessoas[pessoa.id]?.[String(ano)] : undefined;
  const letras = plenario?.votos[pessoa.id] ?? "";
  const vazias = plenario ? semVotosIndividuais(plenario) : null;
  const i = plenario ? plenario.votacoes.findIndex((_, k) => (letras[k] ?? " ") !== " " && !vazias?.has(k)) : -1;
  return {
    ano,
    presenca: pessoa.casa === "deputados" ? taxaComBase(linha?.s) : null,
    ausencias: pessoa.casa === "senadores" && linha ? (linha.j ?? 0) + (linha.n ?? 0) : null,
    votou: taxaComBase(linha?.v),
    governo: taxaComBase(linha?.g),
    mediana: plenario && ano !== null ? plenario.totais[String(ano)]?.mediana ?? null : null,
    cota: cotaDoAno(pessoa, indice, ano),
    ultimo: plenario && i >= 0 ? { votacao: plenario.votacoes[i], letra: letras[i] } : null,
  };
}

/** O total da cota no ano dos números (ou no último ano do índice) e a comparação com a média da casa. */
function cotaDoAno(pessoa: Pessoa, indice: IndiceCota | null, anoPlenario: number | null): NumerosPessoa["cota"] {
  if (!indice?.anos.length) return null;
  const ano = anoPlenario !== null && indice.anos.includes(anoPlenario) ? anoPlenario : indice.anos[indice.anos.length - 1];
  const total = indice.totais[pessoa.id]?.[indice.anos.indexOf(ano)];
  if (total === null || total === undefined) return null;
  const media = indice.media[String(ano)]?.media;
  const parcial = ano >= new Date(indice.coletadoEm).getUTCFullYear();
  return { ano, total, ate: parcial ? indice.ultimoMes[String(ano)] ?? null : null, comparacao: media ? comparadoAMedia(total, media)?.texto ?? null : null };
}

export type VotoSeguido = { pessoa: Pessoa; letra: string };
export type ItemFeed = {
  casa: CasaCongresso;
  votacao: VotacaoPlenario;
  votos: VotoSeguido[];
  /** Entre quem a pessoa segue, houve Sim e Não. */
  divergiram: boolean;
  /** Alguém votou Sim ou Não ao contrário do que o governo orientou. */
  contraGoverno: boolean;
};

const VOTO_SN: Record<string, "Sim" | "Não"> = { S: "Sim", N: "Não" };

/** As votações de mérito das duas casas, da mais recente para a mais antiga, só onde alguém seguido estava no cargo. */
export function feedDeVotacoes(plenarios: Partial<Record<CasaCongresso, Plenario | null>>, seguidos: Pessoa[]): ItemFeed[] {
  const itens: ItemFeed[] = [];
  for (const casa of ["deputados", "senadores"] as const) {
    const p = plenarios[casa];
    const daCasa = seguidos.filter(s => s.casa === casa);
    if (!p || !daCasa.length) continue;
    const vazias = semVotosIndividuais(p);
    p.votacoes.forEach((votacao, i) => {
      if (vazias.has(i)) return;
      const votos = daCasa.map(pessoa => ({ pessoa, letra: p.votos[pessoa.id]?.[i] ?? " " })).filter(v => v.letra !== " ");
      if (!votos.length) return;
      const letras = new Set(votos.map(v => v.letra));
      itens.push({
        casa, votacao, votos,
        divergiram: letras.has("S") && letras.has("N"),
        contraGoverno: !!votacao.governo && votos.some(v => VOTO_SN[v.letra] && VOTO_SN[v.letra] !== votacao.governo),
      });
    });
  }
  return itens.sort((a, b) => b.votacao.data.localeCompare(a.votacao.data));
}

export type Par = { a: Pessoa; b: Pessoa; iguais: number; comparadas: number };

/** Pares da mesma casa: em quantas votações os dois votaram igual, entre as que os dois votaram Sim ou Não. */
export function quemVotaJunto(plenarios: Partial<Record<CasaCongresso, Plenario | null>>, seguidos: Pessoa[]): Par[] {
  const pares: Par[] = [];
  for (const casa of ["deputados", "senadores"] as const) {
    const p = plenarios[casa];
    const daCasa = seguidos.filter(s => s.casa === casa);
    if (!p) continue;
    for (let x = 0; x < daCasa.length; x++) {
      for (let y = x + 1; y < daCasa.length; y++) {
        const [la, lb] = [p.votos[daCasa[x].id] ?? "", p.votos[daCasa[y].id] ?? ""];
        let iguais = 0, comparadas = 0;
        for (let i = 0; i < p.votacoes.length; i++) {
          if (!VOTO_SN[la[i]] || !VOTO_SN[lb[i]]) continue;
          comparadas++;
          if (la[i] === lb[i]) iguais++;
        }
        if (comparadas >= BASE_MINIMA) pares.push({ a: daCasa[x], b: daCasa[y], iguais, comparadas });
      }
    }
  }
  return pares.sort((m, n) => n.iguais / n.comparadas - m.iguais / m.comparadas || n.comparadas - m.comparadas);
}

export const mesmaChave = (a: ChaveSeguido, b: ChaveSeguido) => a.casa === b.casa && a.id === b.id;
