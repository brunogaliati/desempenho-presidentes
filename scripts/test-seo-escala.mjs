import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogoEconomia, buscarPaginaEconomia, rotaEconomia, RECORTES_PUBLICADOS } from '../src/lib/catalogoEconomia.ts';
import { prepararSeriePublica, ultimaJanelaPublica, seriePublicavel, ultimaReferenciaPublica, compararPontosPublicos, rotuloPeriodoPublico } from '../src/app/prototipo/_dados/economiaModelo.ts';

test('catálogo publica cinco intenções e não cria páginas para filtros ou slugs desconhecidos', () => {
  const paginas=catalogoEconomia([]);
  assert.equal(paginas.length,5);
  assert.equal(new Set(paginas.map(rotaEconomia)).size,5);
  assert.equal(buscarPaginaEconomia(['desemprego','estados']).id,'estados');
  for(const partes of [['gasolina','bahia'],['desemprego','campinas'],['nao-existe'],['gasolina?uf=BA']]) assert.equal(buscarPaginaEconomia(partes,[]),null);
});

test('catálogo estadual cobre 27 UFs nas duas famílias e distingue estado de capital', () => {
  const estaduais=RECORTES_PUBLICADOS.filter(r=>!r.uf);
  assert.equal(estaduais.length,54);
  const paginas=catalogoEconomia();
  assert.equal(paginas.length,RECORTES_PUBLICADOS.length+5);
  assert.equal(new Set(paginas.map(rotaEconomia)).size,paginas.length);
  const codigos=['11','12','13','14','15','16','17','21','22','23','24','25','26','27','28','29','31','32','33','35','41','42','43','50','51','52','53'];
  for(const indicador of ['gasolina','desemprego']) assert.deepEqual(estaduais.filter(r=>r.indicador===indicador).map(r=>r.codigo).sort(),codigos);
  for(const r of estaduais) {
    const p=buscarPaginaEconomia([r.indicador,r.slug]);
    assert.equal(p.territorio.codigo,r.codigo);
    assert.equal(p.id,r.indicador==='gasolina'?'gasolina':'estados');
    if(['35','33'].includes(r.codigo)) assert.match(p.titulo,/no estado/);
  }
  assert.match(buscarPaginaEconomia(['desemprego','bahia']).titulo,/na Bahia/);
  assert.match(buscarPaginaEconomia(['gasolina','distrito-federal']).titulo,/no Distrito Federal/);
  assert.equal(buscarPaginaEconomia(['gasolina','brasilia']),null);
  assert.equal(buscarPaginaEconomia(['gasolina','uf-inexistente']),null);
  assert.equal(buscarPaginaEconomia(['desemprego','campinas']),null);
});

test('recorte só existe após cadastro explícito e mantém fonte trimestral para desemprego estadual', () => {
  const recorte={indicador:'desemprego',codigo:'29',nome:'Bahia',slug:'bahia'};
  const pagina=buscarPaginaEconomia(['desemprego','bahia'],[recorte]);
  assert.equal(pagina.id,'estados'); assert.equal(pagina.territorio.codigo,'29');
  assert.equal(rotaEconomia(pagina),'/economia/desemprego/bahia');
  assert.equal(catalogoEconomia([recorte]).length,6);
});

test('cadastro rejeita colisões, aliases do mesmo território e caminhos arbitrários', () => {
  const r={indicador:'gasolina',codigo:'29',nome:'Bahia',slug:'bahia'};
  assert.throws(()=>catalogoEconomia([r,r]),/duplicada/);
  assert.throws(()=>catalogoEconomia([r,{...r,slug:'estado-da-bahia'}]),/Território duplicado/);
  for(const slug of ['../bahia','bahia/sp','estados','Bahia','']) assert.throws(()=>catalogoEconomia([{...r,slug}]));
  assert.throws(()=>catalogoEconomia([{...r,codigo:'abc'}]));
});

test('cadastro municipal exige UF e fonte própria sem fabricar desemprego municipal', () => {
  const r={indicador:'gasolina',codigo:'3509502',nome:'Campinas',slug:'campinas',uf:{codigo:'35',nome:'São Paulo',sigla:'SP',slug:'sao-paulo'}};
  assert.equal(buscarPaginaEconomia(['gasolina','sao-paulo','campinas'],[r]).territorio.codigo,'3509502');
  assert.equal(buscarPaginaEconomia(['gasolina','campinas'],[r]),null);
  assert.throws(()=>catalogoEconomia([{...r,uf:undefined}]),/municipal/);
  assert.throws(()=>catalogoEconomia([{...r,indicador:'desemprego'}]),/municipal/);
  assert.throws(()=>catalogoEconomia([{...r,uf:{...r.uf,codigo:'33'}}]),/municipal/);
  assert.equal(seriePublicavel([],12),false);
});

test('lote municipal separa capital e estado, inclui UF no endereço e preserva homônimos', () => {
  const municipios=RECORTES_PUBLICADOS.filter(r=>r.uf);
  assert(municipios.length>=300);
  for(const r of municipios){
    const p=buscarPaginaEconomia(['gasolina',r.uf.slug,r.slug]);
    assert.equal(p.territorio.codigo,r.codigo);
    assert.equal(p.territorio.uf.codigo,r.codigo.slice(0,2));
    assert.match(p.titulo,new RegExp(`\\(${r.uf.sigla}\\)`));
  }
  assert.equal(buscarPaginaEconomia(['gasolina','sao-paulo']).territorio.codigo,'35');
  assert.equal(buscarPaginaEconomia(['gasolina','sao-paulo','sao-paulo']).territorio.codigo,'3550308');
  const cidades=[{indicador:'gasolina',codigo:'2201903',nome:'Bom Jesus',slug:'bom-jesus',uf:{codigo:'22',nome:'Piauí',sigla:'PI',slug:'piaui'}},{indicador:'gasolina',codigo:'4302303',nome:'Bom Jesus',slug:'bom-jesus',uf:{codigo:'43',nome:'Rio Grande do Sul',sigla:'RS',slug:'rio-grande-do-sul'}}];
  assert.equal(new Set(catalogoEconomia(cidades).map(rotaEconomia)).size,7);
});

test('página exige cobertura recente completa e mantém ausência diferente de zero', () => {
  const pontos=Array.from({length:12},(_,i)=>({mes:`2025-${String(i+1).padStart(2,'0')}`,valor:i===0?0:5}));
  assert(seriePublicavel(pontos,12));
  assert(!seriePublicavel(pontos.slice(1),12));
  assert(!seriePublicavel([...pontos.slice(0,-1),{mes:'2025-12',valor:null}],12));
  assert(!seriePublicavel([...pontos.slice(0,-1),{mes:'2025-12',valor:NaN}],12));
});

test('série mensal regulariza lacunas, ignora futuro e preserva taxa zero', () => {
  const p=prepararSeriePublica([{mes:'2025-01',valor:0},{mes:'2025-03',valor:8},{mes:'2025-12',valor:9}],false,'2025-03-10');
  assert.deepEqual(p,[{mes:'2025-01',valor:0},{mes:'2025-02',valor:null},{mes:'2025-03',valor:8}]);
  assert.deepEqual(ultimaReferenciaPublica(p),{mes:'2025-03',valor:8});
});

test('trimestre aberto é excluído e não se mistura com o mês da divulgação nacional', () => {
  const rows=[{mes:'2026-01',valor:6.1},{mes:'2026-04',valor:5.4},{mes:'2026-07',valor:5.2}];
  const p=prepararSeriePublica(rows,true,'2026-08-31');
  assert.deepEqual(p,[{mes:'2026-03',valor:6.1},{mes:'2026-06',valor:5.4}]);
  assert.equal(rotuloPeriodoPublico('2026-06',true),'2º trimestre de 2026');
  assert(rotuloPeriodoPublico('2026-09',false).includes('setembro'));
});

test('duplicação de observação é erro em vez de média implícita', () => {
  assert.throws(()=>prepararSeriePublica([{mes:'2025-01',valor:3},{mes:'2025-01',valor:5}],false,'2025-12-31'),/duplicada/);
});

test('comparações usam p.p. para taxas, porcentagem para preço e exigem referências exatas', () => {
  const p=[{mes:'2025-01',valor:10},{mes:'2025-02',valor:null},{mes:'2025-03',valor:8}];
  assert.equal(compararPontosPublicos(p,'2025-01','2025-03',true),-2);
  assert(Math.abs(compararPontosPublicos(p,'2025-01','2025-03',false)+20)<1e-10);
  assert.equal(compararPontosPublicos(p,'2025-02','2025-03',true),null);
  assert.equal(compararPontosPublicos(p,'2025-03','2025-01',true),null);
  assert.equal(compararPontosPublicos(p,'','2025-03',true),null);
  assert.equal(compararPontosPublicos(p,'2025-03','2025-03',true),0);
});


test('janela pública conserva histórico de página existente quando o mês recente é nulo',()=>{
 const pontos=Array.from({length:14},(_,i)=>({mes:`2025-${String(i+1).padStart(2,'0')}`,valor:i<12?0:null}));
 assert(!seriePublicavel(pontos,12));assert.equal(ultimaJanelaPublica(pontos,12).length,12);
 assert.deepEqual(ultimaJanelaPublica(pontos.slice(0,11),12),[]);
});
