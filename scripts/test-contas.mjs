import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEmail, normalizarNome, senhaValida } from '../src/lib/credenciais.ts';

test('normaliza e-mails e valida o comprimento da senha sem remover espaços', () => {
  assert.equal(normalizarEmail('  Leitor+Dados@Exemplo.COM  '), 'leitor+dados@exemplo.com');
  assert.equal(normalizarEmail('leitor..dados@exemplo.com'), null);
  assert.equal(normalizarEmail('leitor@-exemplo.com'), null);
  assert.equal(senhaValida('á'.repeat(7)), false);
  assert.equal(senhaValida('á'.repeat(8)), true);
  assert.equal(senhaValida('💬'.repeat(64)), true);
  assert.equal(senhaValida('💬'.repeat(65)), false);
  assert.equal(senhaValida('a'.repeat(129)), false);
  assert.equal(senhaValida('  com espaços  '), true);
});

test('normaliza o nome sem caracteres invisíveis e exige ao menos uma letra', () => {
  assert.equal(normalizarNome('  Maria   da\tSilva '), 'Maria da Silva');
  assert.equal(normalizarNome('Jo​ão‮'), 'João');
  assert.equal(normalizarNome('   '), null);
  assert.equal(normalizarNome('123'), null);
  assert.equal(normalizarNome('Á'.repeat(80)), 'Á'.repeat(80));
  assert.equal(normalizarNome('Á'.repeat(81)), null);
  assert.equal(normalizarNome(null), null);
});
