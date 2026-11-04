import test from 'node:test';
import assert from 'node:assert/strict';
import { organizarMarcos, fimTimeline } from '../src/app/_painel/_dados/marcosModelo.ts';

test('timeline separa IDs canônicos, preserva ausência e não inventa eventos de outros mandatos', () => {
  const mandatos = [{ id: 'lula_1' }, { id: 'lula_3' }];
  const marco = { mandato_id: 'lula_3', evento_id: 'sancao', data: '2023-08-30', data_publicacao: null,
    rotulo: 'Ato sancionado', etapa: 'Sanção', responsavel: 'Presidência', documento: 'LC 200/2023',
    contexto: 'Contexto verificado', fonte: 'Câmara', fonte_url: 'https://www.camara.leg.br/' };
  const porMandato = organizarMarcos([marco, { ...marco, evento_id: 'futuro', data: '2027-01-01' }], mandatos, '2026-10-27');
  assert.deepEqual(porMandato.lula_1, []);
  assert.equal(porMandato.lula_3.length, 1);
  assert.equal(porMandato.lula_3[0].dataPublicacao, null);
  assert.throws(() => organizarMarcos([{ ...marco, mandato_id: 'lula-3' }], mandatos, '2026-10-27'), /desconhecido/);
  assert.throws(() => organizarMarcos([marco, marco], mandatos, '2026-10-27'), /repetido/);
  assert.equal(fimTimeline({ emCurso: false, fim: '2006-12-31' }, '2027-01-05'), '2007-01-01');
  assert.equal(fimTimeline({ emCurso: true, fim: '2026-12-31' }, '2027-01-05'), '2027-01-05');
});
