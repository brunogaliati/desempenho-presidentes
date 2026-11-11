import test from 'node:test';
import assert from 'node:assert/strict';
import { senadoresNaPosse, linhasSaude, quadrimestreAntes, normalizarRGF, linhasFiscais, marcasGraficoResumo } from '../src/app/_painel/_dados/resumoComplementos.ts';
import { linhasRedeSaude } from '../src/lib/redeSaudeModelo.ts';
import { recorteMunicipal, caminhoResumoMunicipal } from '../src/lib/resumoMunicipalModelo.ts';
import { coortesDaFila } from '../src/lib/filasSusModelo.ts';

// BASE=http://localhost:3000 habilita os testes HTTP; usa o servidor já existente.
const base = process.env.BASE;

test('resumo municipal usa a posse municipal de 2025 e não o ciclo federal; preserva zero e exclui dados inválidos',()=>{
  const p=(referencia,valor)=>({referencia,valor,extras:[],atualizado:'2026-11-10'});
  const pontos=[p('2022-07',10),p('2024-07',20),p('2025-07',0),p('2026-07',-1),p('2029-07',99)];
  const r=recorteMunicipal('populacao',pontos,2025);
  assert.equal(r.base.valor,20);assert.equal(r.atual,null); // população zero é inválida
  const e=recorteMunicipal('emprego-formal',[
    {...p('2024-12',10),extras:[0,0,0]}, {...p('2025-01',0),extras:[0,10,-10]}, {...p('2029-01',99),extras:[1,0,1]},
  ],2025);
  assert.equal(e.base.valor,10);assert.equal(e.atual.valor,0);
  assert.equal(caminhoResumoMunicipal({slug:'sao-paulo',uf:{slug:'sao-paulo'}}),'/resumo/municipios/sao-paulo/sao-paulo');
});

test('rede hospitalar não soma competências, não preenche lacunas nem atribui resultados ao governo',()=>{
  const l=(mes,n)=>({mes,hospitais_sus:n,leitos_sus:n,uti_sus:n,leitos_gestao_estadual:n,nao_mapeados:0,coletado_em:'2026-11-10'});
  const linhas=linhasRedeSaude({territorio:'SP',linhas:[l('2022-12',10),l('2023-01',12),l('2023-03',15),l('2027-01',99)]},{posse:'2023-01',ate:'2027-01',fim:'2026-12-31'});
  assert.equal(linhas[0].de,'10');assert.equal(linhas[0].para,'15');assert.equal(linhas[0].mudanca,'+5');assert.equal(linhas[0].sentido,'bom');
  const g=linhas[0].grafico.series[0];assert.equal(g.valores[g.datas.indexOf('2023-02')],null);
});

test('coortes da fila não sugerem continuidade quando um ano está ausente',()=>{
  assert.equal(coortesDaFila([2025,2023,2024,2025]),'2023 a 2025');
  assert.equal(coortesDaFila([2023,2025]),'2023, 2025');assert.equal(coortesDaFila([]),'não informados');
});

test('escala do gráfico contém os extremos, inclusive negativos e o pico do Mais Médicos', () => {
  for (const [min,max] of [[0,3666],[-12,113.03],[3.2,3.8],[100,100],[0,0]]) {
    const ticks=marcasGraficoResumo(min,max);
    assert(ticks[0]<=min);assert(ticks.at(-1)>=max);
    for(let i=1;i<ticks.length;i++) assert(ticks[i]>ticks[i-1]);
  }
});

test('Senado inclui a suplementar de MT somente depois da eleição', () => {
  const linhas = [
    { ano: 2018, uf: 'MT', cargo: 'senador', partido: 'DEM', n: 1, dataSuplementar: null },
    { ano: 2018, uf: 'MT', cargo: 'senador', partido: 'PSD', n: 1, dataSuplementar: '2020-11-15' },
    { ano: 2022, uf: 'MT', cargo: 'senador', partido: 'PL', n: 1, dataSuplementar: null },
  ];
  assert.equal(senadoresNaPosse(linhas, 2022, '2023-01').reduce((s, e) => s + e.n, 0), 3);
  assert.equal(senadoresNaPosse(linhas, 2018, '2019-01').length, 1);
  assert.equal(senadoresNaPosse(linhas, 2026, '2027-01').length, 1);
});

test('Mais Médicos usa estoques válidos dentro do mandato, sem somar meses ou trazer o sucessor', () => {
  const dado = { territorio: 'SP', saude: { meses: ['2022-12','2023-01','2024-12','2025-01','2026-10'], valores: [100,120,150,200,null] } };
  const foco = { posse: '2023-01', ate: '2025-01', fim: '2024-12-31' };
  const [linha] = linhasSaude(dado, foco);
  assert.equal(linha.de, '100'); assert.equal(linha.para, '150'); assert.equal(linha.mudanca, '+50 vagas');
  assert.equal(linha.sentido, 'bom');
  const [semBase] = linhasSaude(dado, { posse: '2010-01', fim: '2024-12-31' });
  assert.equal(semBase.de, null); assert.equal(semBase.para, '150'); assert.equal(semBase.mudanca, null);
});

test('quadrimestre precisa estar inteiramente encerrado', () => {
  assert.deepEqual(quadrimestreAntes('2023-01'), { ano: 2022, quadrimestre: 3 });
  assert.deepEqual(quadrimestreAntes('2026-04'), { ano: 2025, quadrimestre: 3 });
  assert.deepEqual(quadrimestreAntes('2026-05'), { ano: 2026, quadrimestre: 1 });
  assert.deepEqual(quadrimestreAntes('2026-11'), { ano: 2026, quadrimestre: 2 });
});

test('RGF não confunde percentuais com reais, limites legais ou saldo anterior; preserva dívida negativa', () => {
  const p = { ano: 2026, quadrimestre: 2 };
  const base = { exercicio: 2026, periodo: 2, periodicidade: 'Q', cod_ibge: 35, co_poder: 'E' };
  const linha = (anexo, cod_conta, coluna, valor) => ({ ...base, anexo, cod_conta, coluna, valor });
  const linhas = [
    linha('RGF-Anexo 01','DespesaComPessoalTotal','Valor',118023183648.21),
    linha('RGF-Anexo 01','DespesaComPessoalTotal','% sobre a RCL Ajustada',42.28),
    linha('RGF-Anexo 01','LimiteMaximoDespesaComPessoalTotal','% sobre a RCL Ajustada',49),
    linha('RGF-Anexo 02','PercentualDaDCLSobreARCL','SALDO DO EXERCÍCIO ANTERIOR',124.23),
    linha('RGF-Anexo 02','PercentualDaDCLSobreARCL','Até o 1º Quadrimestre',115.82),
    linha('RGF-Anexo 02','PercentualDaDCLSobreARCL','Até o 2º Quadrimestre',-3.25),
  ];
  assert.deepEqual(normalizarRGF(linhas,35,p), { ...p, pessoal:42.28, divida:-3.25 });
  assert.deepEqual(normalizarRGF(linhas,53,p), { ...p, pessoal:null, divida:null });
  assert.equal(normalizarRGF([...linhas,linhas[1]],35,p).pessoal,null);
  assert.equal(normalizarRGF([{...linhas[1],valor:null}],35,p).pessoal,null);
  assert.equal(normalizarRGF([{...linhas[1],valor:NaN}],35,p).pessoal,null);
  const [divida] = linhasFiscais({ recebido:{ano:2022,quadrimestre:3,divida:0,pessoal:40}, atual:{...p,divida:-3.25,pessoal:42.28}, consultadoEm:'2026-11-10' });
  assert.equal(divida.de,'0,00%'); assert.equal(divida.mudanca,'-3,25 p.p.'); assert.equal(divida.sentido,'bom');
});

test('API mantém 81 senadores em 2023 e não transporta a suplementar para 2019', {skip:!base}, async () => {
  const consultar = async (uf,posse) => {
    const r=await fetch(`${base}/api/painel/resumo?uf=${uf}&posse=${posse}`);
    assert.equal(r.status,200);return r.json();
  };
  const [br,mt,antigo]=await Promise.all([consultar('BR','2023-01'),consultar('MT','2023-01'),consultar('MT','2019-01')]);
  assert.equal(br.senado.total,81);assert.equal(mt.senado.total,3);
  assert.deepEqual(mt.senadoSuplementares,['2020-11-15']);assert.deepEqual(antigo.senadoSuplementares,[]);
  assert.equal(br.saude.meses.length,br.saude.valores.length);assert(br.saude.valores.some(v=>Number.isFinite(v)));
  for(const busca of ['uf=ZZ','uf=SP&posse=2023-13']) assert.equal((await fetch(`${base}/api/painel/resumo?${busca}`)).status,400);
});

test('API do RGF entrega percentuais e datas para SP e DF; rejeita recortes inválidos', {skip:!base}, async () => {
  for(const uf of ['SP','DF']) {
    const r=await fetch(`${base}/api/painel/resumo/fiscal?uf=${uf}&posse=2023-01&fim=2027-01`);
    assert.equal(r.status,200);const d=await r.json();
    assert.equal(d.recebido.ano,2022);assert.equal(d.recebido.quadrimestre,3);
    for(const p of [d.recebido,d.atual]) for(const k of ['divida','pessoal']) assert(Number.isFinite(p[k]));
    assert(d.atual.ano>=2023 && d.atual.ano<=2026);
  }
  assert.equal((await fetch(`${base}/api/painel/resumo/fiscal?uf=ZZ&posse=2023-01&fim=2027-01`)).status,400);
});

test('Resumo anuncia uma imagem própria válida e oferece o seletor municipal', {skip:!base}, async () => {
  const r=await fetch(`${base}/resumo?uf=SP&mandato=lula_3`,{headers:{'user-agent':'WhatsApp/2.23'}});
  assert.equal(r.status,200);const html=await r.text();
  const imagem=html.match(/property="og:image" content="([^"]+)"/)?.[1].replaceAll('&amp;','&');
  assert(imagem);const url=new URL(imagem);assert.equal(url.pathname,'/compartilhar');assert.equal(url.searchParams.get('pagina'),'/resumo');
  assert.equal(url.searchParams.get('v'),'20261110');
  assert(html.includes('aria-label="Escolher um município"'));
  const png=await fetch(base+url.pathname+url.search);assert.equal(png.status,200);assert.equal(png.headers.get('content-type'),'image/png');
  const bytes=Buffer.from(await png.arrayBuffer());assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
  assert.equal((await fetch(`${base}/resumo/municipios/sao-paulo`)).status,200);
});

test('resumo municipal entrega indicadores e contas próprias, aceita outro período e rejeita cidade ou ciclo inválidos', {skip:!base}, async()=>{
  for(const [path,texto] of [
    ['/resumo/municipios/sao-paulo/sao-paulo','Resumo de São Paulo'],
    ['/resumo/municipios/rio-grande-do-sul/porto-alegre','Resumo de Porto Alegre'],
    ['/resumo/municipios/distrito-federal/brasilia','Contas do governo distrital'],
  ]){
    const r=await fetch(base+path);assert.equal(r.status,200,path);const html=await r.text();
    assert(html.includes(texto));assert(html.includes('Hospitais e leitos SUS no município'));assert(html.includes('name="ano"'));
  }
  for(const path of ['/resumo/municipios/sao-paulo/sao-paulo?ano=2023','/resumo/municipios/sao-paulo/cidade-inexistente','/resumo/municipios/bahia/sao-paulo'])assert.equal((await fetch(base+path)).status,404,path);
  const antigo=await fetch(base+'/resumo/municipios/sao-paulo/sao-paulo?ano=2021');assert.equal(antigo.status,200);assert((await antigo.text()).includes('2021–2024'));
});

test('filas distinguem município, rede do RS e falta de cobertura em outra UF', {skip:!base}, async()=>{
  const rs=await(await fetch(base+'/api/painel/resumo/filas?territorio=RS')).json();
  assert.equal(rs.disponivel,true);assert(rs.referencia);assert(rs.anos.includes(2026));assert(rs.situacoes.some(s=>s.solicitacoes>0));
  const poa=await(await fetch(base+'/api/painel/resumo/filas?territorio=4314902')).json();
  assert.equal(poa.disponivel,true);assert(poa.situacoes.length);assert(poa.situacoes.reduce((s,v)=>s+v.solicitacoes,0)<=rs.situacoes.reduce((s,v)=>s+v.solicitacoes,0));
  const sp=await(await fetch(base+'/api/painel/resumo/filas?territorio=SP')).json();assert.equal(sp.disponivel,false);assert.deepEqual(sp.situacoes,[]);
  assert.equal((await fetch(base+'/api/painel/resumo/filas?territorio=0000000')).status,400);
});

test('votações estaduais têm fonte e data de sessão, filtro literal e documentos nominais da Alesp', {skip:!base}, async()=>{
  const pi=await(await fetch(base+'/api/painel/resumo/assembleia?uf=PI&posse=2023-01&fim=2027-01')).json();
  assert(pi.total>0);assert(pi.votacoes.every(v=>v.data>='2023-01-01'&&v.data<'2027-01-01'&&v.fonte.startsWith('https://sapl.al.pi.leg.br/')));
  const sp=await(await fetch(base+'/api/painel/resumo/assembleia?uf=SP&posse=2023-01&fim=2027-01')).json();
  assert(sp.total>0);assert(sp.votacoes.every(v=>v.fonte.endsWith('.pdf')&&v.sim===null&&v.nao===null));
  const vazia=await(await fetch(base+'/api/painel/resumo/assembleia?uf=PI&posse=2023-01&fim=2027-01&q=%25')).json();assert.equal(vazia.total,0);
  assert.equal((await fetch(base+'/api/painel/resumo/assembleia?uf=ZZ&posse=2023-01&fim=2027-01')).status,400);
});

test('mapa-ambiente tem imagem PNG no endereço anunciado, com filtros preservados', {skip:!base}, async()=>{
  const r=await fetch(base+'/meio-ambiente?mandato=lula_3&painel=mapa-ambiente&r.mapa.lente=fogo',{headers:{'user-agent':'WhatsApp/2.23'}});
  assert.equal(r.status,200);const html=await r.text();const imagem=html.match(/property="og:image" content="([^"]+)"/)?.[1].replaceAll('&amp;','&');
  assert(imagem);const u=new URL(imagem);assert.equal(u.searchParams.get('secao'),'mapa-ambiente');assert.equal(u.searchParams.get('r.mapa.lente'),'fogo');
  const png=await fetch(base+u.pathname+u.search);assert.equal(png.status,200);assert.equal(png.headers.get('content-type'),'image/png');
  const bytes=Buffer.from(await png.arrayBuffer());assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
});
