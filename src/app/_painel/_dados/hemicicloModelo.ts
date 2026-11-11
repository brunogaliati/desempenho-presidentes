/** Cadeiras em um SVG 1000 × 540, ordenadas da esquerda para a direita. */
export function posicoesHemiciclo(total: number): { x: number; y: number; raio: number }[] {
  if (!Number.isFinite(total) || total < 1) return [];
  total = Math.floor(total);

  const fileiras = Math.max(1, Math.round(Math.sqrt(total) / 1.8));
  const passo = fileiras > 1 ? (470 - 180) / (fileiras - 1) : 0;
  const distancias = Array.from({ length: fileiras }, (_, i) => fileiras === 1 ? 325 : 180 + i * passo);
  const somaDistancias = distancias.reduce((soma, distancia) => soma + distancia, 0);
  let pesoAcumulado = 0;
  let distribuidas = 0;
  let separacao = fileiras > 1 ? passo : Infinity;
  const pontos: { x: number; y: number; angulo: number }[] = [];

  for (const distancia of distancias) {
    pesoAcumulado += distancia;
    const acumulado = Math.round(total * pesoAcumulado / somaDistancias);
    const quantidade = acumulado - distribuidas;
    distribuidas = acumulado;
    if (quantidade > 1) {
      separacao = Math.min(separacao, 2 * distancia * Math.sin(Math.PI / (2 * (quantidade - 1))));
    }
    for (let i = 0; i < quantidade; i++) {
      const angulo = quantidade === 1 ? Math.PI / 2 : Math.PI - i * Math.PI / (quantidade - 1);
      pontos.push({ x: 500 + distancia * Math.cos(angulo), y: 510 - distancia * Math.sin(angulo), angulo });
    }
  }

  const raio = Number(Math.min(24, separacao * 0.42).toFixed(3));
  // A ordenação angular transforma partidos consecutivos em setores radiais.
  return pontos.sort((a, b) => b.angulo - a.angulo).map(({ x, y }) => ({
    x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), raio,
  }));
}
