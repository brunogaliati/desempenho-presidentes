import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { CHAVE_ANALYTICS, INICIAR_AVISO_ANALYTICS, dominioComAnalytics, enderecoAnalytics, paginaAnalytics, dadosAnalyticsCompartilhamento, registrarCompartilhamentoAnalytics, permitirEventosAnalytics, DIMENSOES_COMPARTILHAMENTO } from '../src/lib/analytics.ts';

test('aviso inicial respeita consentimento e ambiente antes da hidratação, inclusive sem armazenamento', () => {
 for (const hostname of ['desempenhodogoverno.com.br', 'www.desempenhodogoverno.com.br', 'localhost', 'desempenho-do-governo.brunop-galiati.workers.dev']) {
  for (const salva of [null, 'aceito', 'recusado', 'invalido', 'bloqueado']) {
   const elementos = { 'analytics-aviso': { hidden: false }, 'analytics-preferencias': { hidden: false } };
   runInNewContext(INICIAR_AVISO_ANALYTICS, {
    document: { getElementById: id => elementos[id] }, location: { hostname },
    localStorage: { getItem(chave) { assert.equal(chave, CHAVE_ANALYTICS); if (salva === 'bloqueado') throw Error('bloqueado'); return salva; } },
   });
   const publico = dominioComAnalytics(hostname);
   assert.equal(elementos['analytics-aviso'].hidden, !publico || salva === 'aceito' || salva === 'recusado', `${hostname}: ${salva}`);
   assert.equal(elementos['analytics-preferencias'].hidden, !publico);
  }
 }
});

test('analytics só permite os dois hosts públicos, sem desenvolvimento nem previews',()=>{
 for(const h of ['desempenhodogoverno.com.br','www.desempenhodogoverno.com.br'])assert.equal(dominioComAnalytics(h),true);
 for(const h of ['localhost','127.0.0.1','desempenho-do-governo.brunop-galiati.workers.dev','desempenhodogoverno.com.br.exemplo.com'])assert.equal(dominioComAnalytics(h),false);
});

test('compartilhamento usa o recorte efetivo da imagem, sem filtros de outros blocos',()=>{
 const site='https://desempenhodogoverno.com.br';
 const credito=dadosAnalyticsCompartilhamento(site+'/?r.credito.pessoa=pj&r.emendas.busca=privado', '/compartilhar/recorte?tema=economia&mandato=lula_3&secao=bloco-credito-e-inadimplencia&r.credito.pessoa=pj');
 assert.equal(credito.filter_credit,'pj');assert.equal(credito.share_government,'lula_3');assert.equal(credito.content_type,'grafico');
 const dinheiro=dadosAnalyticsCompartilhamento(site+'/dinheiro?r.ano=2025','/compartilhar/recorte?tema=dinheiro&mandato=lula_3&secao=orcamento&ano=2024&r.orcamento.familia=beneficios');
 assert.equal(dinheiro.share_period,'ano:2024');assert.equal(dinheiro.filter_family,'beneficios');
 const cerrado=dadosAnalyticsCompartilhamento(site+'/meio-ambiente','/compartilhar/recorte?mandato=lula_3&grafico=desmatamento&bioma=cerrado');
 assert.equal(cerrado.share_biome,'cerrado');assert.equal(cerrado.item_id,'/meio-ambiente#desmatamento');
 const tabela=dadosAnalyticsCompartilhamento(site+'/', '/compartilhar/recorte?mandato=lula_3&secao=historico-serie&r.serie=selic&r.historico.tabela=true&r.faixa=tudo');
 assert.equal(tabela.content_type,'tabela');assert.equal(tabela.filter_range,'tudo');assert.equal(tabela.share_indicator,'selic');
});

test('filtros são limitados e não expõem busca, frase, CNPJ ou nome do parlamentar',()=>{
 const d=dadosAnalyticsCompartilhamento('https://desempenhodogoverno.com.br/dinheiro?frase=segredo','/compartilhar/recorte?mandato=lula_3&secao=emendas&r.emendas.busca=nome%40email.com&r.emendas.detalhe=parlamentar:Fulano&r.emendas.plano=123&ano=2025');
 assert.equal(d.filter_detail,'parlamentar');assert.equal(d.filter_plan,'123');
 assert.doesNotMatch(JSON.stringify(d),/Fulano|nome|email|segredo|busca/);
 assert.equal(dadosAnalyticsCompartilhamento('https://outro.exemplo/',null),null);
 assert.equal(new Set(DIMENSOES_COMPARTILHAMENTO.map(d=>d[0])).size,DIMENSOES_COMPARTILHAMENTO.length);
 assert(Object.keys({...d,method:'copiar_link',share_action:'copia_concluida'}).length<=25);
 assert(Object.values(d).every(v=>v.length<=100));
});

test('sem permissão ou após revogar não há evento; falha de analytics não quebra a ação',()=>{
 const antes=globalThis.window,eventos=[];
 globalThis.window={location:{hostname:'desempenhodogoverno.com.br'},gtag:(...args)=>eventos.push(args)};
 const enviar=()=>registrarCompartilhamentoAnalytics('share','copiar_link','copia_concluida','https://desempenhodogoverno.com.br/','/compartilhar/recorte?mandato=lula_3&secao=governo-a-governo');
 try {
  permitirEventosAnalytics(false);enviar();assert.equal(eventos.length,0);
  permitirEventosAnalytics(true);enviar();assert.equal(eventos.length,1);assert.equal(eventos[0][1],'share');assert.equal(eventos[0][2].method,'copiar_link');
  permitirEventosAnalytics(false);enviar();assert.equal(eventos.length,1);
  permitirEventosAnalytics(true);window.location.hostname='localhost';enviar();assert.equal(eventos.length,1);
  window.location.hostname='desempenhodogoverno.com.br';window.gtag=()=>{throw Error('bloqueado')};assert.doesNotThrow(enviar);
 } finally {permitirEventosAnalytics(false);if(antes===undefined)delete globalThis.window;else globalThis.window=antes;}
});
test('endereços excluem buscas, filtros, fragmentos e credenciais; recortes não duplicam visitas',()=>{
 const pagina='https://desempenhodogoverno.com.br/meio-ambiente';
 assert.equal(enderecoAnalytics(pagina+'?r.busca=nome@email.com&mandato=lula_3#desmatamento'),pagina);
 assert.equal(enderecoAnalytics('https://usuario:senha@exemplo.com/pagina?q=privado#x'),'https://exemplo.com/pagina');
 for(const url of ['','javascript:alert(1)','data:text/plain,segredo'])assert.equal(enderecoAnalytics(url),undefined);
 assert.equal(paginaAnalytics(pagina+'?r.mapa.ano=2024',null),pagina);
 assert.equal(paginaAnalytics(pagina+'?r.mapa.ano=2025#biomas',pagina),null);
 assert.equal(paginaAnalytics('https://desempenhodogoverno.com.br/dinheiro',pagina),'https://desempenhodogoverno.com.br/dinheiro');
});
