/** Geometria plana dos scripts que geram desenhos para o mapa, sem biblioteca: Douglas-Peucker e área de anel. */

function distancia(p, a, b) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const q = dx * dx + dy * dy;
  if (q === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas-Peucker num trecho aberto. */
function simplificarTrecho(pontos, tolerancia) {
  const manter = new Uint8Array(pontos.length);
  manter[0] = manter[pontos.length - 1] = 1;
  const pilha = [[0, pontos.length - 1]];
  while (pilha.length) {
    const [i, j] = pilha.pop();
    let [maior, onde] = [0, -1];
    for (let k = i + 1; k < j; k++) {
      const d = distancia(pontos[k], pontos[i], pontos[j]);
      if (d > maior) [maior, onde] = [d, k];
    }
    if (maior > tolerancia) {
      manter[onde] = 1;
      pilha.push([i, onde], [onde, j]);
    }
  }
  return pontos.filter((_, k) => manter[k]);
}

/** Num anel fechado (sem repetir o primeiro ponto no fim), corta no ponto mais longe do primeiro e simplifica as duas metades. */
export function simplificarAnel(anel, tolerancia) {
  let [maior, corte] = [0, 0];
  anel.forEach((p, k) => {
    const d = Math.hypot(p[0] - anel[0][0], p[1] - anel[0][1]);
    if (d > maior) [maior, corte] = [d, k];
  });
  if (corte === 0) return anel;
  const ida = simplificarTrecho(anel.slice(0, corte + 1), tolerancia);
  const volta = simplificarTrecho([...anel.slice(corte), anel[0]], tolerancia);
  return [...ida.slice(0, -1), ...volta.slice(0, -1)];
}

export function areaDoAnel(anel) {
  let soma = 0;
  anel.forEach((a, i) => {
    const b = anel[(i + 1) % anel.length];
    soma += a[0] * b[1] - b[0] * a[1];
  });
  return Math.abs(soma) / 2;
}
