import "server-only";
import { unstable_cache } from "next/cache";
import { montarIbovespa, normalizarIbovespa, type SerieDiaria } from "./mercadoModelo";

/** Uma chave por ano: revalidação mantém a resposta válida anterior se a B3 falhar. */
function anoB3(ano: number, atual: number) {
  return unstable_cache(async () => {
    const params = Buffer.from(JSON.stringify({ index: "IBOVESPA", language: "pt-br", year: String(ano) })).toString("base64");
    const resposta = await fetch(`https://sistemaswebb3-listados.b3.com.br/indexStatisticsProxy/IndexCall/GetPortfolioDay/${params}`, {
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!resposta.ok) throw new Error(`B3 respondeu ${resposta.status}`);
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const pontos = normalizarIbovespa(await resposta.json(), ano, hoje);
    if (!pontos.length) throw new Error("B3 sem observações válidas.");
    return { pontos, coletadoEm: new Date().toISOString() };
  }, ["ibovespa-fechamentos-v1", String(ano)], { revalidate: ano === atual ? 3600 : 86400 })();
}

export async function carregarIbovespa(hoje: string): Promise<SerieDiaria> {
  const atual = Number(hoje.slice(0, 4));
  const anos = Array.from({ length: Math.max(0, atual - 2020) }, (_, i) => 2021 + i);
  // Duas consultas simultâneas no máximo; histórico anterior reaproveita o cache diário.
  const resultados: PromiseSettledResult<Awaited<ReturnType<typeof anoB3>>>[] = [];
  for (let i = 0; i < anos.length; i += 2) resultados.push(...await Promise.allSettled(anos.slice(i, i + 2).map((ano) => anoB3(ano, atual))));
  return montarIbovespa(anos, resultados, hoje, Date.now());
}
