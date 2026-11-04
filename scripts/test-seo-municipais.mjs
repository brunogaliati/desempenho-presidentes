import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepararLinhasMunicipais,linhaMunicipalValida,serieMunicipalPublicavel,rotaMunicipal,idsMunicipais,ultimaJanelaMunicipal} from '../src/lib/indicadoresMunicipais.ts';
const linha=(referencia,valor=10,extras=[])=>({referencia,valor,extras,atualizado:'2026-11-03T12:00:00Z'});

test('série anual preserva anos ausentes, exige dois anos recentes e não mistura Censo',()=>{
 const p=prepararLinhasMunicipais('populacao',[linha('2021-07'),linha('2024-07',11),linha('2025-07',12),linha('2027-07',13)],'2026-11-03');
 assert.equal(p.length,5);assert.equal(p[1].valor,null);assert.equal(p[2].valor,null);
 assert(serieMunicipalPublicavel('populacao',p,'2025-07'));assert(!serieMunicipalPublicavel('populacao',p,'2026-07'));
});
test('contagens preservam zero e saldo negativo, mas rejeitam estoque negativo e inconsistências',()=>{
 assert(linhaMunicipalValida('emprego-formal',linha('2026-08',0,[2,5,-3])));
 assert(!linhaMunicipalValida('emprego-formal',linha('2026-08',-1,[2,5,-3])));
 assert(!linhaMunicipalValida('emprego-formal',linha('2026-08',10,[2,5,3])));
 assert(linhaMunicipalValida('bpc',linha('2026-07',0,[0,0])));
 assert(!linhaMunicipalValida('bpc',linha('2026-07',10,[2,5])));
 assert(!linhaMunicipalValida('cadunico',linha('2026-08',10,[5])));
 assert(!linhaMunicipalValida('cadunico',linha('2026-08',10,[null])));
});
test('publicação mensal exige 12 meses completos e a referência atual; lacunas e duplicações não passam',()=>{
 const rows=Array.from({length:12},(_,i)=>linha(`2025-${String(i+1).padStart(2,'0')}`,0,[0]));
 assert(serieMunicipalPublicavel('cadunico',prepararLinhasMunicipais('cadunico',rows,'2026-11-03'),'2025-12'));
 const p=prepararLinhasMunicipais('cadunico',rows.filter((_,i)=>i!==5),'2026-11-03');
 assert.equal(p[5].valor,null);assert(!serieMunicipalPublicavel('cadunico',p,'2025-12'));
 assert.throws(()=>prepararLinhasMunicipais('cadunico',[rows[0],rows[0]]),/duplicada/);
 assert.throws(()=>prepararLinhasMunicipais('cadunico',[linha('2026-13',1,[1])]),/inválida/);
});
test('cadastro municipal tem URLs únicas, UF coerente e programas sociais somente em SP',async()=>{
 const ms=JSON.parse(await readFile(new URL('../src/lib/municipiosIndicadores.json',import.meta.url),'utf8'));
 const urls=[];for(const m of ms){assert.equal(m.codigo.slice(0,2),m.uf.codigo);for(const id of m.indicadores){assert(idsMunicipais.includes(id));if(['bpc','cadunico'].includes(id))assert.equal(m.uf.sigla,'SP');urls.push(rotaMunicipal(id,m));}}
 assert.equal(ms.length,5571);assert.equal(urls.length,12431);assert.equal(new Set(urls).size,urls.length);
});


test('URL já publicada preserva janela anual ou mensal anterior sem relaxar novos cadastros',()=>{
 const anual=prepararLinhasMunicipais('populacao',[linha('2024-07',10),linha('2025-07',11),linha('2026-07',null)],'2026-11-04');
 assert(!serieMunicipalPublicavel('populacao',anual,'2026-07'));
 assert.equal(ultimaJanelaMunicipal('populacao',anual).at(-1).referencia,'2025-07');
 const mensal=prepararLinhasMunicipais('bpc',[...Array.from({length:12},(_,i)=>linha(`2025-${String(i+1).padStart(2,'0')}`,10,[4,6])),linha('2026-01',10,[4,5])],'2026-11-04');
 assert(!serieMunicipalPublicavel('bpc',mensal,'2026-01'));
 assert.equal(ultimaJanelaMunicipal('bpc',mensal).at(-1).referencia,'2025-12');
 assert.deepEqual(ultimaJanelaMunicipal('bpc',mensal.slice(0,11)),[]);
});
