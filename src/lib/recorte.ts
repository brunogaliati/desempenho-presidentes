import type { DadosSite, Presidente, Serie } from "@/types/dados";

/**
 * As séries de um mandato, cortadas no período dele.
 *
 * O recorte acontece no servidor, porque quem consome é um componente de
 * cliente. Passar a base inteira serializava as 14 séries com ~3.400 pontos
 * para dentro do bundle uma vez por mandato, e na página do Lula isso
 * acontecia três vezes: a hidratação quebrava em silêncio, sem erro no
 * console, e nenhum botão da página respondia.
 */
export function seriesDoMandato(
  dados: DadosSite,
  m: Presidente,
): Record<string, Serie> {
  const saida: Record<string, Serie> = {};
  const de = m.inicio.slice(0, 7);
  const ate = m.fim.slice(0, 7);

  for (const ind of m.indicadores) {
    const s = dados.series[ind.serieId];
    if (!s) continue;
    const datas: string[] = [];
    const valores: number[] = [];
    s.datas.forEach((d, k) => {
      if (d >= de && d <= ate) {
        datas.push(d);
        valores.push(s.valores[k]);
      }
    });
    if (datas.length >= 2) saida[ind.serieId] = { ...s, datas, valores };
  }
  return saida;
}
