import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('reflexo agrupa eventos no mesmo quadro, preserva a última posição e cancela ao sair', () => {
  const ouvintes = new Map(), saida = new Map(), quadros = new Map(), limpezas = [];
  let sequencia = 0, escritas = 0;
  class Elemento {
    dataset = {};
    valores = new Map();
    style = {
      setProperty: (k, v) => { this.valores.set(k, v); escritas++; },
      removeProperty: k => this.valores.delete(k),
    };
    closest() { return this; }
    getBoundingClientRect() { return { left: 10, top: 20 }; }
  }
  const react = { useEffect: fn => limpezas.push(fn()), useState: () => {}, useTransition: () => {} };
  const modulo = { exports: {} };
  const codigo = ts.transpileModule(readFileSync(new URL('../src/app/_painel/_componentes/Vidro.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nome => { if (nome === 'react') return react; if (nome === 'react/jsx-runtime') return {}; throw new Error(nome); },
    Element: Elemento,
    navigator: { userAgent: 'Chrome/142' },
    window: { matchMedia: () => ({ matches: true }) },
    document: {
      documentElement: { classList: { add() {}, remove() {} }, addEventListener: (k, v) => saida.set(k, v), removeEventListener: k => saida.delete(k) },
      addEventListener: (k, v) => ouvintes.set(k, v), removeEventListener: k => ouvintes.delete(k),
    },
    requestAnimationFrame: fn => { const id = ++sequencia; quadros.set(id, fn); return id; },
    cancelAnimationFrame: id => quadros.delete(id),
  });
  modulo.exports.useVidro();
  const alvo = new Elemento();
  for (let i = 0; i < 100; i++) ouvintes.get('pointermove')({ target: alvo, clientX: 10 + i, clientY: 40 });
  assert.equal(escritas, 0, 'movimento não força layout antes do quadro');
  assert.equal(quadros.size, 1, 'uma pintura para os cem eventos');
  const pintar = () => { const tarefas = [...quadros.values()]; quadros.clear(); tarefas.forEach(fn => fn()); };
  pintar();
  assert.equal(escritas, 2);
  assert.equal(alvo.valores.get('--mx'), '99px');
  assert.equal(alvo.valores.get('--my'), '20px');
  ouvintes.get('pointermove')({ target: alvo, clientX: 200, clientY: 40 });
  saida.get('pointerleave')();
  pintar();
  assert.equal(escritas, 2, 'quadro pendente não reacende o reflexo depois da saída');
  assert.equal(alvo.valores.size, 0);
  limpezas.forEach(fn => fn?.());
  assert.equal(ouvintes.size, 0);
  assert.equal(saida.size, 0);
});
