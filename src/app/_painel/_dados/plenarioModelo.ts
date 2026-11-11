/**
 * Maquete do plenário: fileiras em arquibancada, voltadas para a Mesa.
 *
 * Unidades em metros aproximados. A Mesa fica na origem; as cadeiras ocupam
 * o semicírculo y > 0 e sobem um degrau a cada fileira. Corredores radiais
 * têm largura constante, e o anel do meio só existe em plenários grandes.
 */

export interface Cadeira3D {
  x: number;
  y: number;
  /** Piso do degrau onde a cadeira está. */
  z: number;
  /** Radianos: 0 em x+, π em x−. */
  angulo: number;
  raio: number;
  fileira: number;
  /** Largura angular do lugar, para a bancada à frente ficar contínua. */
  vao: number;
}

export interface Fileira3D {
  raio: number;
  z: number;
  /** Faixa do degrau, do lado da Mesa até o encosto. */
  interno: number;
  externo: number;
}

export interface Plenario3D {
  /** Ordenadas pelo ângulo, da esquerda para a direita de quem olha da galeria. */
  cadeiras: Cadeira3D[];
  fileiras: Fileira3D[];
  setores: number;
  /** Largura de cada cadeira ao longo do arco. */
  largura: number;
  raioExterno: number;
  alturaTopo: number;
}

const RAIO_INTERNO = 3.1;
const PASSO = 0.74;
const CORREDOR_ANEL = 0.5;
const DEGRAU = 0.14;
const CORREDOR = 0.46;
const MARGEM = 0.13;
/** Do centro da cadeira até a borda do degrau, do lado da Mesa e do encosto. */
const FRENTE = 0.47;
const COSTAS = 0.27;

const fixo = (valor: number) => Number(valor.toFixed(4));

export function montarPlenario(total: number): Plenario3D {
  if (!Number.isFinite(total) || total < 1) {
    return { cadeiras: [], fileiras: [], setores: 1, largura: 0, raioExterno: RAIO_INTERNO, alturaTopo: 0 };
  }
  total = Math.floor(total);

  const quantasFileiras = Math.max(1, Math.min(14, Math.round(Math.sqrt(total) / 2.1)));
  const setores = total >= 200 ? 6 : total >= 40 ? 4 : total >= 12 ? 2 : 1;
  const anel = quantasFileiras >= 8 ? Math.ceil(quantasFileiras / 2) : Infinity;
  const inicio = MARGEM;
  const fim = Math.PI - MARGEM;
  const util = (raio: number) => (fim - inicio) - (setores - 1) * CORREDOR / raio;

  const fileiras: Fileira3D[] = [];
  for (let i = 0; i < quantasFileiras; i++) {
    const raio = RAIO_INTERNO + i * PASSO + (i >= anel ? CORREDOR_ANEL : 0);
    const interno = i === 0 ? raio - FRENTE : fileiras[i - 1].externo;
    const externo = raio + COSTAS + (i === quantasFileiras - 1 ? 0.18 : 0);
    fileiras.push({ raio: fixo(raio), z: fixo((i + 1) * DEGRAU), interno: fixo(interno), externo: fixo(externo) });
  }

  // Cada fileira recebe cadeiras na proporção do arco que tem livre.
  const pesos = fileiras.map(f => f.raio * util(f.raio));
  const somaPesos = pesos.reduce((soma, peso) => soma + peso, 0);
  let acumulado = 0;
  let distribuidas = 0;
  const cadeiras: Cadeira3D[] = [];
  let menorEspaco = Infinity;
  // Sobras vão primeiro para os setores do meio, para o desenho ficar simétrico.
  const ordemSetores = Array.from({ length: setores }, (_, s) => s)
    .sort((a, b) => Math.abs(a - (setores - 1) / 2) - Math.abs(b - (setores - 1) / 2) || a - b);

  fileiras.forEach((fileira, i) => {
    acumulado += pesos[i];
    const ate = Math.round(total * acumulado / somaPesos);
    const quantidade = ate - distribuidas;
    distribuidas = ate;
    if (quantidade <= 0) return;

    const corredor = CORREDOR / fileira.raio;
    const largura = util(fileira.raio) / setores;
    const porSetor = Array.from({ length: setores }, () => Math.floor(quantidade / setores));
    for (let k = 0; k < quantidade % setores; k++) porSetor[ordemSetores[k]]++;

    porSetor.forEach((lugares, s) => {
      if (!lugares) return;
      const comeco = inicio + s * (largura + corredor);
      const vao = largura / lugares;
      menorEspaco = Math.min(menorEspaco, fileira.raio * vao);
      for (let j = 0; j < lugares; j++) {
        const angulo = comeco + (j + 0.5) * vao;
        cadeiras.push({
          x: fixo(fileira.raio * Math.cos(angulo)),
          y: fixo(fileira.raio * Math.sin(angulo)),
          z: fileira.z,
          angulo: fixo(angulo),
          raio: fileira.raio,
          fileira: i,
          vao: fixo(vao),
        });
      }
    });
  });

  // Da galeria, x+ fica à esquerda: ângulo crescente é ler da esquerda para a direita.
  cadeiras.sort((a, b) => a.angulo - b.angulo || a.fileira - b.fileira);
  const ultima = fileiras[fileiras.length - 1];
  return {
    cadeiras,
    fileiras,
    setores,
    largura: fixo(Math.max(0.16, Math.min(0.5, menorEspaco * 0.8))),
    raioExterno: ultima.externo,
    alturaTopo: ultima.z,
  };
}
