import { registerHooks, createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),ts=require('typescript'),raiz=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
// O teste executa os mesmos modelos TS/TSX do painel, inclusive a grade com detalhes JSX.
registerHooks({
  resolve(spec,ctx,next){
    if(spec.startsWith('@/')||spec.startsWith('.')){
      const base=spec.startsWith('@/')?path.join(raiz,'src',spec.slice(2)):fileURLToPath(new URL(spec,ctx.parentURL));
      const p=[base,base+'.ts',base+'.tsx',base+'.json'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
      if(p)return {url:pathToFileURL(p).href,shortCircuit:true};
    }
    return next(spec,ctx);
  },
  load(url,ctx,next){
    if(url.startsWith('file:')&&/\.(ts|tsx)$/.test(url))return {format:'commonjs',shortCircuit:true,source:ts.transpileModule(fs.readFileSync(fileURLToPath(url),'utf8'),{fileName:fileURLToPath(url),compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText};
    return next(url,ctx);
  }
});
const {empregoEm12,temporadas,anoDoOrcamento,listasDasEmendas,tabelaDosEstados,visualizacaoDaSecao}=require('../src/app/_painel/_componentes/visualizacaoSecao.ts');
const {filtrosDaSecao}=require('../src/app/_painel/_componentes/secoesCompartilhamento.ts');
const {ITENS}=require('../src/app/_painel/_dados/dinheiroModelo.ts');

test('Caged usa doze meses completos, preserva saldo negativo e exclui janela com lacuna',()=>{
 const datas=Array.from({length:13},(_,i)=>new Date(Date.UTC(2023,i,15)).toISOString().slice(0,7));
 assert.deepEqual(empregoEm12({datas,valores:datas.map(()=>-2)}),[{d:'2023-12',v:-24},{d:'2024-01',v:-24}]);
 assert.deepEqual(empregoEm12({datas,valores:datas.map((_,i)=>i===5?null:1)}),[]);
});
test('temporada acumula desde janeiro e para na primeira lacuna',()=>{
 const anos=temporadas(['2022-06','2023-01','2023-02','2023-04'],[50,2,0,8]);
 assert.equal(anos.length,1);assert.deepEqual(anos[0].acumulado.slice(0,4),[2,2,null,null]);
});
test('ano do orçamento respeita o mandato e o padrão de último ano fechado',()=>{
 const painel={anos:[2022,2023,2024,2025,2026],parcial:{ano:2026}};
 const foco={posse:'2023-01',ate:null};
 assert.equal(anoDoOrcamento(painel,foco,null),2025);assert.equal(anoDoOrcamento(painel,foco,2026),2026);assert.equal(anoDoOrcamento(painel,foco,2022),2025);
});
test('emendas: busca sem acento, UF e ordem por habitante/total são as do painel',()=>{
 const d={municipios:[['São João','SP',100,1,10,'a'],['São José','SP',500,2,100,'b'],['Salvador','BA',1000,3,20,'c']],parlamentares:[['Ana','SP',20,1],['Ana','SP',30,2]]};
 assert.deepEqual(listasDasEmendas(d,'sao','hab','SP').municipios.map(m=>m.cnpj),['a','b']);
 assert.deepEqual(listasDasEmendas(d,'sao','tot','SP').municipios.map(m=>m.cnpj),['b','a']);
 assert.deepEqual(listasDasEmendas(d,'Ana','tot',null).parlamentares,[{nome:'Ana',v:50,q:3}]);
 assert.equal(listasDasEmendas(d,'inexistente','tot',null).municipios.length,0);
});
test('estados: ordenação, unidade e ausência acompanham o modo selecionado',()=>{
 const l={id:'a',titulo:'A',formato:'pct1',periodos:[{},{}],indiceRecebido:0,ufs:{'1':[10,8],'2':[4,5],'3':[2,null]}};
 const ufs=['1','2','3'].map(codigo=>({codigo}));
 assert.deepEqual(tabelaDosEstados([l],ufs,'posse',{id:'a',desc:true}).linhas.map(u=>u.codigo),['2','1','3']);
 assert.equal(tabelaDosEstados([l],ufs,'posse',{id:'a',desc:true}).texto(l,'1'),'-2,0 pts');
 assert.equal(tabelaDosEstados([l],ufs,'hoje',{id:'a',desc:true}).texto(l,'3'),'—');
});
const mandato={id:'lula_3',inicio:'2023-01-01',fim:'2026-12-31',emCurso:true,nomeCurto:'Lula'};
const s=(id,valores)=>({id,origem:id,rotulo:id,datas:['2023-01','2024-01'],valores,fonte:'Fonte oficial',unidade:'%',formato:'pct1',cobertura:{inicio:'2023-01'}});
const dados={presidente:{id:'lula_3'},hoje:'2026-11-06T12:00:00Z',ufs:[],leituras:{economia:[],ambiente:[]},economia:{mandatos:[mandato],series:[],complemento:{series:[s('credito_pf_inadimplencia',[3,4]),s('credito_pj_inadimplencia',[1,2])]}},ambiente:{series:[],porBioma:[],fiscalizacao:[]}};
const cartao=(secao,filtros={},tema='economia')=>({tipo:'secao',nome:secao,legenda:'Brasil',pedido:{tema,secao,mandato:'lula_3',uf:null,ano:null,filtros}});
test('crédito PF/PJ altera os números do gráfico, não apenas a URL ou a legenda',()=>{
 const pf=visualizacaoDaSecao(cartao('bloco-credito-e-inadimplencia'),dados);
 const pj=visualizacaoDaSecao(cartao('bloco-credito-e-inadimplencia',{'r.credito.pessoa':'pj'}),dados);
 assert.deepEqual(pf.desenho.series[0].valores,[3,4]);assert.deepEqual(pj.desenho.series[0].valores,[1,2]);
 const invalido=visualizacaoDaSecao(cartao('bloco-credito-e-inadimplencia',{'r.credito.pessoa':'<script>'}),dados);assert.deepEqual(invalido,pf);
});
test('treemap e tabela usam valores reais do ano e família selecionados',()=>{
 const itens=ITENS.filter(i=>i.familia==='beneficios').slice(0,2),outro=ITENS.find(i=>i.familia==='divida');
 const painel={anos:[2024,2025],parcial:null,entes:{BR:{nome:'União',anos:{'2024':{t:100,p:10,v:{[itens[0].id]:40,[itens[1].id]:20,[outro.id]:40}},'2025':{t:200,p:10,v:{[itens[0].id]:50,[itens[1].id]:50,[outro.id]:100}}},abre:{}}},idx:{2024:1,2025:1},receita:{},baseReal:'2025'};
 const a=visualizacaoDaSecao(cartao('orcamento',{'r.ano':'2024'},'dinheiro'),dados,{dinheiro:painel});
 const b=visualizacaoDaSecao(cartao('orcamento',{'r.ano':'2025','r.orcamento.familia':'beneficios'},'dinheiro'),dados,{dinheiro:painel});
 assert.equal(a.desenho.tipo,'treemap');assert.equal(b.desenho.blocos.length,2);
 assert(b.desenho.blocos.every(b=>b.valor==='R$ 25,00 de R$ 100'));assert.notDeepEqual(a.desenho,b.desenho);
 const reais=visualizacaoDaSecao(cartao('orcamento-detalhe',{'r.ano':'2025','r.orcamento.item':itens[0].id},'dinheiro'),dados,{dinheiro:{...painel,idx:{2024:2,2025:1},parcial:{ano:2025}}});
 assert.deepEqual(reais.desenho.datas,['2024']);assert.deepEqual(reais.desenho.series[0].valores,[80/1e9]);
});
test('filtros aceitos entram no endereço da imagem; dados e títulos livres não entram',()=>{
 const f=filtrosDaSecao(new URLSearchParams('r.credito.pessoa=pj&r.estados.modo=hoje&r.emendas.busca=São+Paulo&r.mapa.anos=%7B%22fogo%22:2024%7D&r.foo=texto&titulo=forjado'));
 assert.equal(f['r.credito.pessoa'],'pj');assert.equal(f['r.estados.modo'],'hoje');assert.equal(f['r.emendas.busca'],'São Paulo');assert.equal(f['r.foo'],undefined);assert.equal(f.titulo,undefined);
});
