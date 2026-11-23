import type { CasaCongresso } from "@/app/_painel/_dados/congressoModelo";
import fotografia from "@/app/_painel/_dados/fotografia.json";

/** Quantos parlamentares uma conta pode seguir. */
export const LIMITE_SEGUIDOS = 60;

export type ChaveSeguido = { casa: CasaCongresso; id: number };

/** "deputados:204379": a forma do parlamentar seguido na URL e na resposta da API. */
export const chaveSeguido = ({ casa, id }: ChaveSeguido) => `${casa}:${id}`;

export function lerChaveSeguido(valor: unknown): ChaveSeguido | null {
  if (typeof valor !== "string") return null;
  const m = /^(deputados|senadores):(\d{1,9})$/.exec(valor);
  if (!m) return null;
  const id = Number(m[2]);
  return id > 0 ? { casa: m[1] as CasaCongresso, id } : null;
}

/** Só quem está na composição atual (a fotografia do painel) pode ser seguido. */
export function naComposicao(chave: ChaveSeguido | null): chave is ChaveSeguido {
  return !!chave && fotografia[chave.casa].some(p => p.id === chave.id);
}
