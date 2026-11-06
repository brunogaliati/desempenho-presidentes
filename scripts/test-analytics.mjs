import test from 'node:test';
import assert from 'node:assert/strict';
import { dominioComAnalytics, enderecoAnalytics, paginaAnalytics } from '../src/lib/analytics.ts';

test('analytics só permite os dois hosts públicos, sem desenvolvimento nem previews',()=>{
 for(const h of ['desempenhodogoverno.com.br','www.desempenhodogoverno.com.br'])assert.equal(dominioComAnalytics(h),true);
 for(const h of ['localhost','127.0.0.1','desempenho-do-governo.brunop-galiati.workers.dev','desempenhodogoverno.com.br.exemplo.com'])assert.equal(dominioComAnalytics(h),false);
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
