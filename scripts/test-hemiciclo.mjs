import test from 'node:test';
import assert from 'node:assert/strict';
import { posicoesHemiciclo } from '../src/app/_painel/_dados/hemicicloModelo.ts';
import { fotoParlamentar } from '../src/app/_painel/_dados/fotoParlamentar.ts';

for (const total of [0, 1, 2, 3, 7, 81, 513, 1000]) {
  test(`hemiciclo com ${total} cadeiras mantém contagem, limites e separação`, () => {
    const pontos = posicoesHemiciclo(total);
    assert.equal(pontos.length, total);
    assert.deepEqual(pontos, posicoesHemiciclo(total));
    assert.equal(new Set(pontos.map(({ x, y }) => `${x},${y}`)).size, total);
    let anguloAnterior = Math.PI;
    for (const [i, ponto] of pontos.entries()) {
      const { x, y, raio } = ponto;
      assert.ok([x, y, raio].every(Number.isFinite));
      assert.ok([x, y, raio].every((valor) => valor === Number(valor.toFixed(3))), 'precisão estável entre servidor e navegador');
      assert.ok(raio > 0 && x - raio >= 0 && x + raio <= 1000 && y - raio >= 0 && y + raio <= 540);
      const angulo = Math.atan2(510 - y, x - 500);
      // Coordenadas em milésimos perturbam empates angulares em até 0,00001 rad.
      assert.ok(angulo <= anguloAnterior + 1e-5, 'ordem angular preserva blocos de partido');
      anguloAnterior = angulo;
      for (const outro of pontos.slice(i + 1)) {
        assert.ok(Math.hypot(x - outro.x, y - outro.y) > raio + outro.raio, 'cadeiras não se sobrepõem');
      }
    }
  });
}

test('entrada vazia ou inválida não produz cadeiras', () => {
  for (const total of [-1, NaN, Infinity]) assert.deepEqual(posicoesHemiciclo(total), []);
  assert.equal(posicoesHemiciclo(1.9).length, 1);
});

test('retratos usam o identificador oficial e rejeitam IDs inválidos', () => {
  assert.equal(fotoParlamentar('deputados', 204379), 'https://www.camara.leg.br/internet/deputado/bandep/204379.jpg');
  assert.equal(fotoParlamentar('senadores', 5672), 'https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5672.jpg');
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(fotoParlamentar('deputados', id), null);
    assert.equal(fotoParlamentar('senadores', id), null);
  }
});
