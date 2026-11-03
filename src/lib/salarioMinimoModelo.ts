export interface ObservacaoSalario { serie_id: string; mes: string; valor: number }
export interface MesSalario { mes: string; nominal: number; real: number | null }

export function montarSalarioMinimo(linhas: ObservacaoSalario[], hoje: string) {
  const mesAtual = hoje.slice(0, 7);
  const validas = linhas.filter((r) => r.mes >= "1995-01" && r.mes <= mesAtual && Number.isFinite(r.valor));
  const nominais = validas.filter((r) => r.serie_id === "salario_minimo" && r.valor > 0).sort((a, b) => a.mes.localeCompare(b.mes));
  const reais = new Map(validas.filter((r) => r.serie_id === "salario_minimo_real" && r.valor > 0).map((r) => [r.mes, r.valor]));
  const referenciaReal = validas.filter((r) => r.serie_id === "ipca").map((r) => r.mes).sort().at(-1);
  if (!nominais.length || !referenciaReal || !reais.has(referenciaReal)) throw new Error("Séries de salário mínimo ou IPCA incompletas.");
  // A série real é normalizada pelo backend ao último IPCA; uma base futura
  // não pode ser apresentada como se fosse a referência disponível hoje.
  if (linhas.some((r) => r.serie_id === "ipca" && r.mes > mesAtual)) throw new Error("IPCA com referência futura.");
  const historico: MesSalario[] = nominais.map((r) => ({ mes: r.mes, nominal: r.valor, real: r.mes <= referenciaReal ? reais.get(r.mes) ?? null : null }));
  const reajustes = historico.filter((r, i) => i === 0 || r.nominal !== historico[i - 1].nominal);
  const porAno = new Map<string, MesSalario>();
  for (const r of historico) if (r.real !== null) porAno.set(r.mes.slice(0, 4), r);
  const ultimo = historico.at(-1)!;
  const reajuste = reajustes.at(-1)!;
  const anterior = reajustes.at(-2);
  return { historico, reajustes, anuais: [...porAno.values()].reverse(), ultimo, reajuste, anterior, referenciaReal };
}

export function compararSalario(historico: MesSalario[], desde: string, ate: string) {
  if (desde > ate) return null;
  const inicio = historico.find((r) => r.mes === desde), fim = historico.find((r) => r.mes === ate);
  if (!inicio || !fim) return null;
  return {
    nominal: (fim.nominal / inicio.nominal - 1) * 100,
    real: inicio.real !== null && fim.real !== null ? (fim.real / inicio.real - 1) * 100 : null,
  };
}
