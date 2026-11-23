import { type CasaCongresso, type Plenario, type VotacaoPlenario, NOME_UF } from "@/app/_painel/_dados/congressoModelo";
import malha from "@/app/_painel/_dados/ufs.json";
import { PESSOAS, type Pessoa, numerosDaPessoa, semVotosIndividuais } from "./painelContaModelo";

/**
 * As contas da montagem da lista (`Montagem`): o mapa por estado, a bancada de cada um e o
 * desafio "como votou?", sorteado entre votações de verdade de quem a pessoa acabou de seguir.
 */

const SIGLA_POR_CODIGO: Record<string, string> = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA",
  31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS",
  50: "MS", 51: "MT", 52: "GO", 53: "DF",
};
/** "no Pará", "na Bahia", "em São Paulo": não há regra que dispense a lista (a mesma de `carregar.ts`). */
const ARTIGO: Record<string, "o" | "a" | ""> = {
  AC: "o", AP: "o", AM: "o", CE: "o", DF: "o", ES: "o", MA: "o", PA: "o",
  PR: "o", PI: "o", RJ: "o", RN: "o", RS: "o", TO: "o",
  BA: "a", PB: "a",
};

export type Estado = {
  sigla: string;
  nome: string;
  /** "de São Paulo", "da Bahia", "do Pará". */
  deNome: string;
  d: string;
  centro: [number, number];
  caixa: [number, number, number, number];
  senadores: Pessoa[];
  deputados: Pessoa[];
};

export const LARGURA_MAPA = malha.largura;
export const ALTURA_MAPA = malha.altura;
/** Brasília, de onde o mapa se acende em onda na chegada. */
const ORIGEM: [number, number] = (() => {
  const df = malha.ufs.find(u => u.codigo === "53");
  return df ? [df.centro[0], df.centro[1]] : [LARGURA_MAPA / 2, ALTURA_MAPA / 2];
})();

const porNome = (a: Pessoa, b: Pessoa) => a.nome.localeCompare(b.nome, "pt-BR");

export const ESTADOS: Estado[] = malha.ufs
  .map(u => {
    const sigla = SIGLA_POR_CODIGO[u.codigo];
    const artigo = ARTIGO[sigla] ?? "";
    return {
      sigla,
      nome: NOME_UF[sigla] ?? sigla,
      deNome: `${artigo ? `d${artigo}` : "de"} ${NOME_UF[sigla] ?? sigla}`,
      d: u.d,
      centro: [u.centro[0], u.centro[1]] as [number, number],
      caixa: [u.caixa[0], u.caixa[1], u.caixa[2], u.caixa[3]] as [number, number, number, number],
      senadores: PESSOAS.filter(p => p.casa === "senadores" && p.uf === sigla).sort(porNome),
      deputados: PESSOAS.filter(p => p.casa === "deputados" && p.uf === sigla).sort(porNome),
    };
  })
  .filter(e => !!e.sigla);
export const ESTADO_POR_SIGLA = new Map(ESTADOS.map(e => [e.sigla, e]));
/** Por sigla, na ordem dos botões. */
export const SIGLAS = ESTADOS.map(e => e.sigla).sort((a, b) => a.localeCompare(b));

const MAIOR_BANCADA = Math.max(...ESTADOS.map(e => e.senadores.length + e.deputados.length));
/** De 0 a 1, pela raiz do tamanho da bancada: o tom do estado no mapa. */
export const pesoDaBancada = (e: Estado) => Math.sqrt((e.senadores.length + e.deputados.length) / MAIOR_BANCADA);

/** Atraso da onda de chegada: cada estado acende conforme a distância até Brasília. */
export function atrasoDaOnda(e: Estado): number {
  return Math.round(Math.hypot(e.centro[0] - ORIGEM[0], e.centro[1] - ORIGEM[1]) * 0.9);
}

/** O viewBox que enquadra um estado com folga, para o desenho dele sozinho. */
export function enquadrar(e: Estado, folga = 0.08): string {
  const [x0, y0, x1, y1] = e.caixa;
  const lado = Math.max(x1 - x0, y1 - y0) * (1 + folga * 2);
  return `${(x0 + x1) / 2 - lado / 2} ${(y0 + y1) / 2 - lado / 2} ${lado} ${lado}`;
}

// ---------------------------------------------------------------------------
// O desafio
// ---------------------------------------------------------------------------

export type Pergunta = {
  pessoa: Pessoa;
  votacao: VotacaoPlenario;
  /** O voto de verdade. */
  letra: "S" | "N";
  /** A dica: como votou a maioria do partido (sem contar a pessoa) e o quanto ela segue o governo. */
  dica: { partido: { sim: number; nao: number } | null; comGoverno: { taxa: number; ano: number } | null };
};

/** Quantas das mais recentes olhar, e entre quantas das que servem sortear: votação recente é mais divertida. */
const JANELA = 150;
const SORTEIO = 24;
/** Votação "dividida": o lado menor teve pelo menos isto dos votos. Unânime não tem graça. */
const DIVIDIDA = 0.12;

function embaralhar<T>(lista: T[], sorte: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(sorte() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const partidoDe = (casa: CasaCongresso) => new Map(PESSOAS.filter(p => p.casa === casa).map(p => [p.id, p.partido]));
const PARTIDO = { deputados: partidoDe("deputados"), senadores: partidoDe("senadores") };

function votoDoPartido(p: Plenario, pessoa: Pessoa, i: number) {
  if (!pessoa.partido) return null;
  let sim = 0, nao = 0;
  for (const [id, letras] of Object.entries(p.votos)) {
    if (Number(id) === pessoa.id || PARTIDO[pessoa.casa].get(Number(id)) !== pessoa.partido) continue;
    if (letras[i] === "S") sim++;
    else if (letras[i] === "N") nao++;
  }
  return sim + nao >= 2 ? { sim, nao } : null;
}

/**
 * Até `quantas` perguntas, uma pessoa de cada vez (em ordem sorteada) e nunca a mesma votação
 * duas vezes. Primeiro as votações divididas em que a pessoa votou Sim ou Não; se não houver
 * bastante, qualquer uma em que ela votou Sim ou Não.
 */
export function montarDesafio(
  plenarios: Partial<Record<CasaCongresso, Plenario | null>>,
  pessoas: Pessoa[],
  quantas = 5,
  sorte: () => number = Math.random,
): Pergunta[] {
  const candidatas = (pessoa: Pessoa, exigirDivisao: boolean) => {
    const p = plenarios[pessoa.casa];
    const letras = p?.votos[pessoa.id];
    if (!p || !letras) return [];
    const vazias = semVotosIndividuais(p);
    const indices: number[] = [];
    for (let i = 0; i < Math.min(p.votacoes.length, JANELA); i++) {
      const v = p.votacoes[i];
      if (vazias.has(i) || (letras[i] !== "S" && letras[i] !== "N")) continue;
      const total = v.sim + v.nao;
      if (exigirDivisao && (v.placarInformado === false || !total || Math.min(v.sim, v.nao) / total < DIVIDIDA)) continue;
      indices.push(i);
    }
    return embaralhar(indices.slice(0, SORTEIO), sorte).slice(0, 8).map(i => ({ pessoa, p, i }));
  };
  const montar = (exigirDivisao: boolean) => embaralhar(pessoas, sorte).map(pessoa => candidatas(pessoa, exigirDivisao));
  let filas = montar(true);
  if (filas.reduce((n, f) => n + f.length, 0) < quantas) filas = montar(false);

  const usadas = new Set<string>();
  const perguntas: Pergunta[] = [];
  let mudou = true;
  while (perguntas.length < quantas && mudou) {
    mudou = false;
    for (const fila of filas) {
      if (perguntas.length >= quantas) break;
      while (fila.length) {
        const { pessoa, p, i } = fila.shift()!;
        const chave = `${pessoa.casa}:${p.votacoes[i].id}`;
        if (usadas.has(chave)) continue;
        usadas.add(chave);
        const n = numerosDaPessoa(pessoa, p, null);
        perguntas.push({
          pessoa, votacao: p.votacoes[i], letra: p.votos[pessoa.id][i] as "S" | "N",
          dica: { partido: votoDoPartido(p, pessoa, i), comGoverno: n.governo !== null && n.ano !== null ? { taxa: n.governo, ano: n.ano } : null },
        });
        mudou = true;
        break;
      }
    }
  }
  return perguntas;
}

/** A frase do placar final, do jeito de quem conta para um amigo. */
export function fraseDoPlacar(acertos: number, total: number): { titulo: string; texto: string } {
  if (!total) return { titulo: "Lista pronta!", texto: "Os votos de quem você segue vão aparecer na sua página." };
  if (acertos === total) return { titulo: "Gabaritou!", texto: "Você conhece bem quem escolheu. Agora dá para ver cada voto novo." };
  if (acertos / total >= 0.6) return { titulo: "Mandou bem!", texto: "Conhece a maioria. O resto você vai descobrir acompanhando." };
  if (acertos > 0) return { titulo: "Teve surpresa", texto: "Bom motivo para acompanhar de perto. Cada votação nova aparece na sua página." };
  return { titulo: "Nenhum acerto!", texto: "Ainda bem que agora você vai acompanhar. Cada votação nova aparece na sua página." };
}
