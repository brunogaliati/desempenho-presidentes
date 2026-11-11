import test from 'node:test';
import assert from 'node:assert/strict';
import { montarPlenario } from '../src/app/_painel/_dados/plenarioModelo.ts';

for (const total of [1, 2, 3, 12, 81, 513, 1000]) {
  test(`plenário com ${total} cadeiras mantém contagem, ordem e espaço entre cadeiras`, () => {
    const plenario = montarPlenario(total);
    const { cadeiras, fileiras, largura } = plenario;
    assert.equal(cadeiras.length, total);
    assert.deepEqual(plenario, montarPlenario(total), 'determinístico entre servidor e navegador');
    assert.ok(largura > 0 && largura <= 0.5);

    for (const [i, f] of fileiras.entries()) {
      assert.ok(f.interno < f.raio && f.raio < f.externo, 'a cadeira fica dentro do degrau');
      if (i) {
        assert.ok(f.raio > fileiras[i - 1].raio && f.z > fileiras[i - 1].z, 'cada fileira sobe e se afasta da Mesa');
        assert.equal(f.interno, fileiras[i - 1].externo, 'degraus encostados, sem buraco');
      }
    }

    let anterior = -Infinity;
    for (const c of cadeiras) {
      assert.ok([c.x, c.y, c.z, c.angulo, c.vao].every(Number.isFinite));
      assert.ok(c.angulo > 0 && c.angulo < Math.PI && c.y > 0, 'todas do lado das galerias');
      assert.ok(c.angulo >= anterior, 'ordem da esquerda para a direita mantém os blocos de partido');
      assert.equal(c.z, fileiras[c.fileira].z);
      assert.ok(Math.abs(Math.hypot(c.x, c.y) - c.raio) < 1e-3);
      anterior = c.angulo;
    }

    for (let f = 0; f < fileiras.length; f++) {
      const daFileira = cadeiras.filter(c => c.fileira === f).sort((a, b) => a.angulo - b.angulo);
      for (let k = 1; k < daFileira.length; k++) {
        const arco = fileiras[f].raio * (daFileira[k].angulo - daFileira[k - 1].angulo);
        assert.ok(arco >= largura - 1e-6, 'cadeiras vizinhas não se encostam');
      }
    }
  });
}

test('entrada vazia ou inválida não produz cadeiras', () => {
  for (const total of [0, -1, NaN, Infinity]) assert.equal(montarPlenario(total).cadeiras.length, 0);
  assert.equal(montarPlenario(1.9).cadeiras.length, 1);
});

test('Câmara e Senado ganham corredores e o anel do meio só no plenário grande', () => {
  assert.equal(montarPlenario(513).setores, 6);
  assert.equal(montarPlenario(81).setores, 4);
  const camara = montarPlenario(513).fileiras;
  const saltos = camara.slice(1).map((f, i) => Number((f.raio - camara[i].raio).toFixed(3)));
  assert.equal(new Set(saltos).size, 2, 'um único corredor anelar');
  const senado = montarPlenario(81).fileiras;
  assert.equal(new Set(senado.slice(1).map((f, i) => Number((f.raio - senado[i].raio).toFixed(3)))).size, 1);
});
