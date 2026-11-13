import test from 'node:test';
import assert from 'node:assert/strict';
import {alvoCompartilhado,codificarFiltro,decodificarFiltro,registroDoFiltro,linkCompartilhado,idCompartilhavel,opcaoCompartilhada,inteiroCompartilhado} from '../src/lib/compartilhamento.ts';

test('foco aceita âncora direta, preserva prioridade de painel e recusa identificadores inválidos',()=>{
 const base='https://exemplo.com/congresso/deputados/jadyel-alencar-220697';
 assert.equal(alvoCompartilhado(new URL(base+'#emendas-municipios')),'emendas-municipios');
 assert.equal(alvoCompartilhado(new URL(base+'#emendas%2Dmunicipios')),'emendas-municipios');
 assert.equal(alvoCompartilhado(new URL(base+'?painel=outro#emendas-municipios')),'outro');
 for(const fim of ['', '#%ZZ', '#%3Cscript%3E', '#'+ 'a'.repeat(101)])assert.equal(alvoCompartilhado(new URL(base+fim)),null);
});

test('filtro calculado preserva ano e período efetivos mesmo se o estado interno é padrão',()=>{
 assert.equal(registroDoFiltro(null,null,null,()=>2024),'2024');
 assert.equal(registroDoFiltro(2024,null,null,()=>2024),'2024');
 assert.equal(registroDoFiltro(null,null,null,()=>({desmatamento:2025,fogo:null,protegidas:null})),JSON.stringify({desmatamento:2025,fogo:null,protegidas:null}));
 assert.equal(registroDoFiltro('pf','pf','pf'),null);
 assert.equal(registroDoFiltro('pj','pf','pf'),'pj');
});

test('recorte preserva governo e filtros, distingue null de padrão e aponta ao componente',()=>{
 const url=new URL(linkCompartilhado('https://exemplo.com/?utm_source=x&uf=SP&r.serie=ipca#antigo', [['r.faixa','tudo'],['r.historico.tabela','true'],['r.leitura','pib'],['r.ficha.lula_1','cambio']], {mandato:'lula_1',uf:null,'r.serie':'dolar','r.leitura':null},'de-perto'));
 assert.equal(url.pathname,'/'); assert.equal(url.searchParams.get('mandato'),'lula_1');
 assert.equal(url.searchParams.get('r.ficha.lula_1'),'cambio'); assert.equal(url.searchParams.get('r.serie'),'dolar'); assert.equal(url.searchParams.get('r.leitura'),'null');
 assert.equal(url.searchParams.get('r.faixa'),'tudo');assert.equal(url.searchParams.get('r.historico.tabela'),'true');
 assert.equal(url.searchParams.has('uf'),false);assert.equal(url.searchParams.has('utm_source'),false);
 assert.equal(url.hash,'#de-perto');assert.equal(url.searchParams.get('painel'),'de-perto');
});
test('roundtrip de filtros tipados sem aceitar opções inventadas',()=>{
 for(const valor of [true,false,null,2023,'dolar',{id:'ipca',desc:true}])assert.deepEqual(decodificarFiltro(codificarFiltro(valor),v=>JSON.stringify(v)===JSON.stringify(valor)),valor);
 assert.equal(codificarFiltro(undefined),null);
 assert.equal(decodificarFiltro('null',v=>v===null||typeof v==='string'),null);
 assert.deepEqual(decodificarFiltro('{"id":"ipca","desc":true}',v=>!!v&&typeof v==='object'&&v.id==='ipca'&&typeof v.desc==='boolean'),{id:'ipca',desc:true});
 assert.equal(decodificarFiltro('fake',opcaoCompartilhada(['ipca','dolar'])),undefined);
 assert.equal(decodificarFiltro('-1',inteiroCompartilhado),undefined);
 assert.equal(decodificarFiltro('x'.repeat(2049),()=>true),undefined);
 assert.equal(decodificarFiltro('{broken',v=>typeof v==='object'),undefined);
});
test('nomes de filtros e âncoras ficam limitados ao contrato público',()=>{
 const url=new URL(linkCompartilhado('https://exemplo.com/economia/inflacao?redirect=ruim&r.medida=mensal', [['cookie','segredo'],['r.ate','2025-01']], {'<script>':'x'},'<img>'));
 assert.deepEqual([...url.searchParams.keys()],['r.medida','r.ate']);assert.equal(url.hash,'');
 assert.equal(idCompartilhavel('Inflação no período?'),'bloco-inflacao-no-periodo');
});
