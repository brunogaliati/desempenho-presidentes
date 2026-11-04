import test from 'node:test';
import assert from 'node:assert/strict';
import { mandatoDoPerfil, migrarLinkPerfil } from '../src/lib/perfisPainel.ts';
import nextConfig from '../next.config.ts';
const mandatos=[{id:'lula_1',pessoaId:'lula',mandato:1,inicio:'2003-01-01'},{id:'lula_2',pessoaId:'lula',mandato:2,inicio:'2007-01-01'},{id:'lula_3',pessoaId:'lula',mandato:3,inicio:'2023-01-01'},{id:'dilma_1',pessoaId:'dilma',mandato:1,inicio:'2011-01-01'}];
const series=[{id:'dolar',origem:'cambio'},{id:'minimo',origem:'salario_minimo_real'}];
test('perfil abre o último mandato e só aceita seleção da própria pessoa',()=>{
 assert.equal(mandatoDoPerfil(mandatos,'lula',null).id,'lula_3');
 assert.equal(mandatoDoPerfil(mandatos,'lula','lula_1').id,'lula_1');
 assert.equal(mandatoDoPerfil(mandatos,'lula','dilma_1').id,'lula_3');
 assert.equal(mandatoDoPerfil(mandatos,'inexistente',null),undefined);
});
test('âncoras e fichas antigas apontam ao mesmo mandato e série pela origem',()=>{
 for(const sufixo of ['#indicador-lula_1-cambio','?painel=indicador-lula_1-cambio','?r.ficha.lula_1=cambio#mandato-1-os-numeros']){
  const u=migrarLinkPerfil(new URL('https://site.test/presidente/lula'+sufixo),mandatos,series);
  assert.equal(u.searchParams.get('mandato'),'lula_1');assert.equal(u.searchParams.get('r.serie'),'dolar');assert.equal(u.hash,'#de-perto');
  assert.equal(migrarLinkPerfil(u,mandatos,series),null);
 }
});
test('narrativa e comparação são traduzidas; mandato explícito válido tem precedência',()=>{
 const u=migrarLinkPerfil(new URL('https://site.test/presidente/lula?mandato=lula_2#ato-1'),mandatos,series);
 assert.equal(u.searchParams.get('mandato'),'lula_2');
 const c=migrarLinkPerfil(new URL('https://site.test/presidente/lula?r.pessoa.comparacao=salario_minimo_real#comparacao-de-mandatos'),mandatos,series);
 assert.equal(c.hash,'#governo-a-governo');assert.equal(c.searchParams.get('r.serie'),'minimo');
 assert.equal(migrarLinkPerfil(new URL('https://site.test/?r.serie=cambio#de-perto'),mandatos,series),null);
 assert.equal(migrarLinkPerfil(new URL('https://site.test/presidente/lula#%E0%A4%A'),mandatos,series),null);
});
test('só o catálogo exato muda de endereço; descendentes preservam suas URLs',async()=>{
 const redirects=await nextConfig.redirects();
 const r=redirects.find(r=>r.source==='/economia');
 assert.deepEqual(r,{source:'/economia',destination:'/explorar',permanent:true});
 assert(!redirects.some(r=>r.source.startsWith('/economia/')));
});
