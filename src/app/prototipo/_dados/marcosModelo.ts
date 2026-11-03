import type { Marco, MandatoVisual } from "./tipos";

export interface LinhaMarco {
  mandato_id: string;
  evento_id: string;
  data: string;
  data_publicacao: string | null;
  rotulo: string;
  etapa: string;
  responsavel: string;
  documento: string;
  contexto: string;
  fonte: string;
  fonte_url: string;
}

/** O catálogo de mandatos vem do banco; nunca cria um mandato a partir de um evento. */
export function organizarMarcos(linhas: LinhaMarco[], mandatos: Pick<MandatoVisual, "id">[], hoje: string): Record<string, Marco[]> {
  const porMandato = Object.fromEntries(mandatos.map((m) => [m.id, [] as Marco[]]));
  const vistos = new Set<string>();
  for (const r of linhas) {
    if (!Object.hasOwn(porMandato, r.mandato_id)) throw new Error(`Mandato de marco desconhecido: ${r.mandato_id}`);
    const chave = `${r.mandato_id}/${r.evento_id}`;
    if (vistos.has(chave)) throw new Error(`Marco repetido: ${chave}`);
    vistos.add(chave);
    if (r.data > hoje) continue;
    porMandato[r.mandato_id].push({
      id: r.evento_id, data: r.data, dataPublicacao: r.data_publicacao,
      rotulo: r.rotulo, etapa: r.etapa, responsavel: r.responsavel,
      documento: r.documento, contexto: r.contexto, fonte: r.fonte, fonteUrl: r.fonte_url,
    });
  }
  return porMandato;
}

/** Limite exclusivo para calcular a régua; a data final exibida continua inclusiva. */
export function fimTimeline(mandato: Pick<MandatoVisual, "emCurso" | "fim">, proximaPosse: string): string {
  if (mandato.emCurso) return proximaPosse;
  const fim = new Date(`${mandato.fim}T00:00:00Z`);
  fim.setUTCDate(fim.getUTCDate() + 1);
  return fim.toISOString().slice(0, 10);
}
