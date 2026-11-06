import type { CartaoSecao } from "./capaRecorte";
import type { DadosPainel, Leitura, MunicipioNacional, SerieEconomia } from "../_dados/tipos";
import type { MunicipiosAmbiente } from "../_dados/ambienteMunicipal";
import { chaveDaArea, corDaLente, numerosDaArea, numerosDaLente, somaNaUf, RAMPA_DA_LENTE, type Lente, type ModoMapa, type ValoresDasAreas } from "../_dados/ambienteMunicipal";
import { arranjarTreemap, baseDoAno, deCem, gruposDeGovernadores, gruposDePresidentes, ITENS, NOME_FAMILIA, nomeDoItem, ORDEM_FAMILIAS, reais, sinal, variacaoReal, type EmendasDoAno, type PainelDinheiro } from "../_dados/dinheiroModelo";
import { recortarAoMandato, recebidoNoPainel } from "../_dados/mandatoRecorte";
import { variacaoDesdeReferencia } from "../_dados/economiaModelo";
import { decodificarFiltro } from "@/lib/compartilhamento";
import { comSinal, numero, type Sentido } from "@/lib/formatar";
import { linhasDaGrade, MUNDO, REGIOES } from "./gradeModelo";
import { emPontos, curto, ritmosDoAmbiente, ritmosDoEstado, ritmosDoPais } from "./ritmoModelo";
import { formatar, recebido, referencia, reguaDeCor, ultimoDado } from "./formatos";
import { placarDoMandato } from "./placarModelo";
import { linhaDaMedida, placarDoAmbiente, placarDoBioma, placarDoBrasilInteiro } from "./placarAmbiente";
import { familiaDe, governoEm, termosDoGoverno } from "./governos";

export type CelulaVisual = { texto: string; sentido?: Sentido };
export type DesenhoSecao =
  | { tipo: 'tabela'; colunas: string[]; linhas: CelulaVisual[][]; destaque?: number }
  | { tipo: 'linhas'; datas: string[]; series: { nome: string; valores: (number|null)[]; cor: string; tracejada?: boolean }[]; unidade: string }
  | { tipo: 'barras'; linhas: { nome: string; valor: number; texto: string; cor: string; referencia?: number|null }[] }
  | { tipo: 'empilhadas'; nomes: string[]; grupos: { nome: string; cor: string; valores: (number|null)[] }[] }
  | { tipo: 'treemap'; blocos: { x:number;y:number;w:number;h:number;nome:string;valor:string;cor:string }[] }
  | { tipo: 'mapa'; largura:number;altura:number;caixa?:[number,number,number,number];formas:{d:string;cor:string;borda?:string}[]; legenda:string[] }
  | { tipo: 'indisponivel'; motivo: string };

export interface VisualizacaoSecao { titulo:string; subtitulo:string; fonte:string; nota:string; desenho:DesenhoSecao }
export interface ExtrasSecao { dinheiro?:PainelDinheiro; emendas?:EmendasDoAno; municipal?:MunicipiosAmbiente; formas?:MunicipioNacional[]; areas?:{r:string;b:string;n:string;d:string}[]; valoresAreas?:ValoresDasAreas; planos?:{id:string;codigo:string;beneficiario:string|null;uf:string|null;parlamentar:string|null;situacao:string|null;custeio:number|null;investimento:number|null}[] }
const CORES = ['#2e795b','#a3473a','#285c84','#b17b36','#82528f','#6c7e8c'];
const porSentido = (s:Sentido) => s==='bom'?CORES[0]:s==='ruim'?CORES[1]:'#7d8b95';
const cel = (v:string|number|null|undefined,sentido?:Sentido):CelulaVisual => ({texto:v==null?'—':String(v),sentido});
const tabela = (colunas:string[],linhas:(string|number|null|CelulaVisual)[][]):DesenhoSecao => ({tipo:'tabela',colunas,linhas:linhas.map(l=>l.map(v=>typeof v==='object'&&v!==null?v:cel(v)))});
const indisponivel = (motivo='Sem dados publicados para este recorte.'):DesenhoSecao => ({tipo:'indisponivel',motivo});
export const FAMILIA_COR = Object.fromEntries(ORDEM_FAMILIAS.map((id,i)=>[id,CORES[i]]));

export function lerFiltro<T>(c:CartaoSecao,id:string,inicial:T,validar:(v:unknown)=>boolean):T {
  const raw=c.pedido.filtros[`r.${id}`];
  return raw===undefined?inicial:decodificarFiltro<T>(raw,validar)??inicial;
}
const escolha = <T extends string>(c:CartaoSecao,id:string,inicial:T,opcoes:readonly T[]) => lerFiltro(c,id,inicial,v=>opcoes.includes(v as T));

/** A mesma janela de doze meses usada no gráfico do Caged; um mês ausente invalida a janela. */
export function empregoEm12(s:SerieEconomia) {
  const porMes=new Map(s.datas.map((d,i)=>[d,s.valores[i]]));
  return s.datas.map(d=>{
    const t=new Date(`${d}-15T12:00:00Z`);
    const valores=Array.from({length:12},(_,i)=>{const x=new Date(t);x.setUTCMonth(x.getUTCMonth()-i);return porMes.get(x.toISOString().slice(0,7));});
    return {d,v:valores.every(v=>v!=null)?valores.reduce<number>((a,v)=>a+v!,0):null};
  }).filter((p):p is {d:string;v:number}=>p.v!==null);
}

/** Os acumulados param na primeira lacuna, como a temporada no painel. */
export function temporadas(meses:string[],valores:(number|null)[]) {
  const anos=new Map<number,(number|null)[]>();
  meses.forEach((m,i)=>{const a=Number(m.slice(0,4)),v=anos.get(a)??Array(12).fill(null);v[Number(m.slice(5,7))-1]=valores[i];anos.set(a,v);});
  return [...anos].map(([ano,lista])=>{let soma=0,parou=false;return {ano,acumulado:lista.map(v=>{if(v===null||parou){parou=true;return null;}return soma+=v;})};}).filter(x=>x.acumulado[0]!==null);
}

export function anoDoOrcamento(painel:PainelDinheiro,foco:DadosPainel['foco'],pedido:number|null) {
  const anos=painel.anos.filter(a=>foco.posse<=`${a}-07`&&(foco.ate===null||`${a}-07`<foco.ate));
  if(pedido!==null&&(anos.length===0||anos.includes(pedido)))return pedido;
  return anos.filter(a=>a!==painel.parcial?.ano).at(-1)??anos.at(-1)??painel.anos[0];
}

export function listasDasEmendas(d:EmendasDoAno,busca:string,modo:'hab'|'tot',sigla:string|null) {
  const normal=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),alvo=normal(busca.trim());
  const casa=(s:string)=>!alvo||normal(s).includes(alvo);
  const municipios=d.municipios.filter(m=>(!sigla||m[1]===sigla)&&casa(`${m[0]} ${m[1]}`)).map(m=>({nome:m[0],uf:m[1],v:m[2],hab:m[2]/m[4],cnpj:m[5]})).sort((a,b)=>modo==='hab'?b.hab-a.hab:b.v-a.v);
  const porNome=new Map<string,{nome:string;v:number;q:number}>();
  for(const p of d.parlamentares){if((sigla&&p[1]!==sigla)||!casa(p[0]))continue;const x=porNome.get(p[0])??{nome:p[0],v:0,q:0};x.v+=p[2];x.q+=p[3];porNome.set(p[0],x);}
  return {municipios,parlamentares:[...porNome.values()].sort((a,b)=>b.v-a.v)};
}

/** O número, a ordenação e a formatação são partilhados com a tabela ao vivo. */
export function tabelaDosEstados(leituras:Leitura[],ufs:DadosPainel['ufs'],modo:'posse'|'hoje',ordem:{id:string;desc:boolean}) {
  const ativa=leituras.find(l=>l.id===ordem.id)??leituras[0];
  const valor=(l:Leitura,codigo:string)=>valorDaLeitura(l,l.ufs[codigo],modo);
  const linhas=[...ufs].sort((a,b)=>{const va=ativa?valor(ativa,a.codigo):null,vb=ativa?valor(ativa,b.codigo):null;return va===null?1:vb===null?-1:ordem.desc?vb-va:va-vb;});
  return {linhas,valor,texto:(l:Leitura,codigo:string)=>{const v=valor(l,codigo);return v===null?'—':modo==='hoje'?formatar(v,l.formato):Math.round(v*10)===0?'igual':`${comSinal(Math.round(v*10)/10,1)}${emPontos(l)?' pts':'%'}`;}};
}

export function valorDaLeitura(l:Leitura,s:(number|null)[]|undefined,modo:'posse'|'hoje') {
  if(modo==='hoje')return s?.[l.periodos.length-1]??null;
  if(l.indiceRecebido===null||l.periodos.length<2)return null;
  const d=variacaoDesdeReferencia(s,l.indiceRecebido,l.periodos.length-1,emPontos(l));
  return d===null?null:Math.round(d*10)/10;
}

export function visualizacaoDaSecao(c:CartaoSecao,inteiros:DadosPainel,e:ExtrasSecao={}):VisualizacaoSecao {
  const p=c.pedido,d=recortarAoMandato(inteiros,p.mandato),atual=recortarAoMandato(inteiros,inteiros.presidente.id);
  const v:VisualizacaoSecao={titulo:c.nome,subtitulo:c.legenda,fonte:'Fontes oficiais indicadas no painel',nota:'',desenho:indisponivel()};
  const series=p.tema==='ambiente'?[...d.ambiente.series,...d.ambiente.porBioma.flatMap(b=>[b.prodes,b.focos]).filter((s):s is SerieEconomia=>!!s)]:[...d.economia.series,...d.economia.complemento.series];
  const linha=(s:SerieEconomia,nome=s.rotulo):DesenhoSecao=>{const inicio=s.datas.findIndex(x=>x>=d.foco.posse);const i=inicio<0?0:Math.max(0,inicio-1);v.fonte=s.fonte;v.subtitulo=`${c.legenda} · ${nome}`;return {tipo:'linhas',datas:s.datas.slice(i),series:[{nome,valores:s.valores.slice(i),cor:CORES[2]}],unidade:s.unidade};};
  if(p.tema==='dinheiro')return dinheiroVisual(c,d,e,v);
  if(p.secao==='historico-serie'){
    const lista=p.tema==='ambiente'?[...d.ambiente.series,...d.ambiente.porBioma.flatMap(b=>[b.prodes,b.focos]),d.ambiente.protegidas?.ti,d.ambiente.protegidas?.uc,...Object.values(d.ambiente.protegidas?.porBioma??{}).flatMap(x=>[x.ti,x.uc])].filter((s):s is SerieEconomia=>!!s):d.economia.series;
    const id=lerFiltro<string|null>(c,'serie',null,x=>x===null||typeof x==='string'&&lista.some(s=>s.id===x)),s=lista.find(s=>s.id===id)??lista.find(s=>ultimoDado(s));
    if(s){const faixa=escolha(c,'faixa','mandato',['mandato','tudo']),desde=faixa==='tudo'?(s.cobertura.inicio??s.datas[0]):(recebido(s)?.data??d.foco.posse),pontos=s.datas.flatMap((data,i)=>data>=desde?[{data,valor:s.valores[i]}]:[]);v.titulo=s.rotulo;v.subtitulo+=` · ${faixa==='tudo'?'Desde o início':'Mandato'} · ${referencia(s,pontos[0]?.data??desde)} a ${referencia(s,pontos.at(-1)?.data??desde)}`;v.fonte=s.fonte;
      v.desenho=lerFiltro(c,'historico.tabela',false,x=>typeof x==='boolean')?tabela(['Referência',s.rotulo,'Na Presidência'],[...pontos].reverse().map(x=>[referencia(s,x.data),x.valor===null?'sem dado':formatar(x.valor,s.formato),inteiros.economia.mandatos.filter(m=>x.data>=m.inicio.slice(0,7)&&x.data<=m.fim.slice(0,7)).map(m=>m.nomeCurto).join(' e ')])):{tipo:'linhas',datas:pontos.map(x=>x.data),series:[{nome:s.rotulo,valores:pontos.map(x=>x.valor),cor:CORES[2]}],unidade:s.unidade};
    }
  } else if(p.secao==='governo-a-governo') {
    const ordem=[...inteiros.economia.mandatos].sort((a,b)=>a.inicio.localeCompare(b.inicio));
    const placar=placarDoMandato(atual),itens=[...placar.grupos.flatMap(g=>g.itens),...placar.mercado];
    const s=atual.economia.series;
    const linhas=linhasDaGrade(ordem,inteiros.economia.porMandato,inteiros.economia.benchmarkPorMandato,new Set(s.map(x=>x.origem)),s,new Map(itens.map(x=>[x.id,x])));
    const comparar=lerFiltro<string|null>(c,'comparar',d.foco.emCurso?null:p.mandato,x=>x===null||typeof x==='string'&&ordem.some(m=>m.id===x));
    v.desenho={tipo:'tabela',colunas:['Indicador',...ordem.map(m=>`${m.nomeCurto} ${m.inicio.slice(0,4)}`)],linhas:linhas.map(l=>[cel(l.rotulo),...l.celulas.map(x=>cel(x.texto,x.sentido))]),destaque:comparar===null?undefined:ordem.findIndex(m=>m.id===comparar)+1};
    v.fonte='Banco Central · IBGE · World Bank';
    v.nota='Mudança desde a posse; cada indicador conserva a unidade da tabela. Sem dado: —.';
  } else if(p.secao==='estados') {
    const leituras=p.tema==='ambiente'?[...d.leituras.ambiente,...d.ambiente.fiscalizacao]:d.leituras.economia;
    const modo=escolha(c,'estados.modo','posse',['posse','hoje']);
    const ordem=lerFiltro(c,'estados.ordem',{id:leituras[0]?.id??'',desc:true},x=>!!x&&typeof x==='object'&&'id'in x&&leituras.some(l=>l.id===x.id)&&'desc'in x&&typeof x.desc==='boolean');
    const t=tabelaDosEstados(leituras,d.ufs,modo,ordem);
    v.subtitulo+=` · ${modo==='posse'?'Desde a posse':'Último dado'} · ordem: ${leituras.find(l=>l.id===ordem.id)?.titulo??''} ${ordem.desc?'↓':'↑'}`;
    v.desenho=tabela(['UF',...leituras.map(curto)],t.linhas.map(u=>[u.sigla,...leituras.map(l=>t.texto(l,u.codigo))]));
    v.nota=leituras.map(l=>`${curto(l)}: ${l.periodos.at(-1)?.rotulo??'sem referência'}`).join(' · ');
  } else if(p.secao==='biomas') {
    const modo=escolha(c,'fiscalizacao.modo','posse',['posse','hoje']);
    const lentes=['desmatamento','alertas','fogo','queimada','ti','uc','fiscalizacao','multas','embargos'] as Lente[];
    const linhas=[{nome:'Brasil',placar:placarDoBrasilInteiro(d)},...d.ambiente.porBioma.map(b=>({nome:b.rotulo,placar:placarDoBioma(d,b.id,e.municipal??null)}))];
    v.desenho=tabela(['Bioma','Desmate','Alertas','Focos','Área queimada','T. Indígenas','U. Conserv.','Autos','Multas','Embargos'],linhas.map(l=>[l.nome,...lentes.map(m=>{const x=linhaDaMedida(l.placar,m);return cel(!x||x.falta?null:modo==='posse'?x.mudanca:x.agora,modo==='posse'?x?.sentido:undefined);})]));
    v.subtitulo+=modo==='posse'?' · Desde a posse':' · Último dado';v.fonte='INPE/PRODES, DETER e Programa Queimadas · Ibama';
  } else if(p.secao==='temporada') {
    const f=d.ambiente.focosMensais;
    if(f){const anos=temporadas(f.meses,f.brasil),ultimo=anos.at(-1);v.desenho={tipo:'linhas',datas:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'],series:anos.map(a=>({nome:String(a.ano),valores:a.acumulado,cor:a===ultimo?CORES[0]:a.ano===d.foco.anoRecebido?CORES[1]:'#b9c5cc',tracejada:a.ano===d.foco.anoRecebido})),unidade:'focos acumulados'};v.subtitulo+=` · Acumulado desde janeiro · ${ultimo?.ano??''}`;v.fonte='INPE · Programa Queimadas';v.nota=d.ambiente.focosParcial?`Mês em andamento: ${d.ambiente.focosParcial.mes}, ${numero(d.ambiente.focosParcial.valor)} focos parciais; não integra o acumulado dos meses completos.`:'';}
  } else if(p.secao==='protegidas') {
    const tipo=escolha(c,'protegidas.tipo','ti',['ti','uc']),s=d.ambiente.protegidas?.[tipo];
    if(s)v.desenho=linha(s,tipo==='ti'?'Terras Indígenas':'Unidades de Conservação');
    const protegidas=d.ambiente.protegidas;
    if(protegidas&&p.filtros['r.protegidas.ano']){
      const ano=lerFiltro(c,'protegidas.ano',protegidas.ano,x=>typeof x==='number'&&String(x) in protegidas.maisPorAno);
      v.subtitulo+=` · Lista de ${ano}`;
      v.desenho=tabela(['Área protegida','Bioma',`PRODES ${ano} (km²)`],(protegidas.maisPorAno[String(ano)]??[]).filter(x=>x.recorte===tipo).map(x=>[x.nome,d.ambiente.porBioma.find(b=>b.id===x.bioma)?.rotulo??x.bioma,numero(x.ultimo,1)]));
    }
    v.nota='Área desmatada mapeada pelo PRODES dentro das áreas protegidas. Referências preliminares são identificadas na fonte.';
  } else if(p.secao==='emprego-e-credito') {
    const s=d.economia.complemento.series.find(x=>x.id==='caged_saldo');
    if(s){const pontos=empregoEm12(s),i=pontos.findIndex(x=>x.d>=d.foco.posse),trecho=pontos.slice(Math.max(0,i-1));v.desenho={tipo:'linhas',datas:trecho.map(x=>x.d),series:[{nome:'Vagas abertas em 12 meses',valores:trecho.map(x=>x.v),cor:CORES[2]}],unidade:'vagas'};v.fonte=s.fonte;v.nota='Admissões menos desligamentos. Só emprego com carteira; vínculos são contratos, não pessoas.';}
  } else if(p.secao==='bloco-credito-e-inadimplencia') {
    const disponiveis=['pf','pj'].filter(q=>series.some(s=>s.id===`credito_${q}_inadimplencia`)),quem=escolha(c,'credito.pessoa','pf',['pf','pj']);
    const s=series.find(x=>x.id===`credito_${disponiveis.includes(quem)?quem:disponiveis[0]}_inadimplencia`);
    if(s)v.desenho=linha(s,`Inadimplência ${s.id.includes('_pf_')?'das famílias':'das empresas'}`);
  } else if(p.secao==='bloco-ritmo-no-mandato') {
    const placar=p.tema==='ambiente'?placarDoAmbiente(d):placarDoMandato(d),itens=[...placar.grupos.flatMap(g=>g.itens)];
    const uf=d.ufs.find(u=>u.sigla===p.uf);
    if(p.tema==='economia') {const ritmos=uf?ritmosDoEstado(d.leituras.economia,uf,null,()=>{}):ritmosDoPais(d.economia.indicadores,series,id=>recebidoNoPainel(d,id),new Map(itens.map(x=>[x.id,x.sentido])),null,()=>{},()=>false);v.desenho={tipo:'barras',linhas:ritmos.map(r=>({nome:r.rotulo,valor:r.v,texto:`${comSinal(r.v,1)}${r.pontos?' pts':'%'} por ano`,cor:porSentido(r.sentido),referencia:r.referencia}))};}
    else {const ritmos=ritmosDoAmbiente(d.ambiente.series,new Map(itens.map(x=>[x.id,x])),'',()=>{});v.desenho={tipo:'barras',linhas:ritmos.map(r=>({nome:`${r.grupo} · ${r.rotulo}`,valor:r.v,texto:`${comSinal(r.v,1)}% por ano`,cor:porSentido(r.sentido),referencia:r.referencia}))};}
    v.nota='Cada linha conserva a unidade do indicador; taxas em pontos por ano, demais medidas em % ao ano.';
  } else if(p.secao==='bloco-governadores-por-partido') {
    const grupos=new Map<string,string[]>();for(const u of d.ufs){const partido=governoEm(d.governos,u.sigla,d.hoje.slice(0,10))?.partido??'Não confirmado',familia=familiaDe(d.governos,partido);const lista=grupos.get(familia)??[];lista.push(u.sigla);grupos.set(familia,lista);}
    v.desenho=tabela(['Partido / família','Governadores','Estados'],[...grupos].sort((a,b)=>b[1].length-a[1].length).map(([nome,ufs])=>[nome,ufs.length,ufs.join(' ')]));
  } else if(p.secao.startsWith('bloco-quem-governou-')&&p.uf) {
    v.desenho=tabela(['Governador','Início','Fim','Partido'],(d.governos.ufs[p.uf]??[]).map(g=>[g.nome,g.inicio,g.fim??'Em exercício',g.partido??'Não confirmado']));
  } else if(p.secao==='bloco-brasil-e-o-mundo') {
    v.desenho=tabela(['Medida',...REGIOES.map(r=>r[1])],MUNDO.map(m=>[m.rotulo,...REGIOES.map(([id])=>{const b=d.economia.benchmark.find(x=>x.indicadorWb===m.id&&x.regiao===id);return b?`${numero(b.mediaPeriodo,1)}%`:null;})]));v.fonte='World Bank';v.nota='Média dos anos com cobertura no mandato; a comparação não demonstra causalidade.';
  } else if(p.secao==='bloco-ultimos-dados') {
    v.desenho=tabela(['Referência','Indicador / divulgação','Entrou no banco'],[...d.novidades].sort((a,b)=>b.registradoEm.localeCompare(a.registradoEm)).slice(0,8).map(n=>[n.data,n.texto,n.registradoEm.slice(0,10)]));
  } else if(p.secao.startsWith('bloco-orcamento-federal')) {
    const rec=series.find(s=>s.id==='fiscal_receitas'),pag=series.find(s=>s.id==='fiscal_pagas');
    if(rec&&pag){const ano=ultimoDado(rec)?.data.slice(0,4),bimestre=(s:SerieEconomia)=>{const ps=s.datas.flatMap((d,i)=>d.startsWith(ano??'')&&s.valores[i]!==null?[{d,v:s.valores[i]!}]:[]);return ps.map((x,i)=>({d:x.d,v:i===0?(x.d.endsWith('-02')?x.v:null):Number(x.d.slice(5))-Number(ps[i-1].d.slice(5))===2?x.v-ps[i-1].v:null}));};const r=bimestre(rec),pago=bimestre(pag);v.desenho={tipo:'linhas',datas:r.map(x=>x.d),series:[{nome:'Arrecadou',valores:r.map(x=>x.v),cor:CORES[2]},{nome:'Pagou',valores:r.map(x=>pago.find(p=>p.d===x.d)?.v??null),cor:'#7d8b95'}],unidade:'R$ bilhões por bimestre'};v.fonte=rec.fonte;v.subtitulo+=` · ${ano}`;}
  } else if(p.secao==='fontes') {
    v.desenho=tabela(['Indicador','Fonte','Referência'],series.map(s=>[s.rotulo,s.fonte,s.referencia]));
  } else if(p.secao==='municipios'||p.secao==='mapa-ambiente') {
    ambienteMunicipalVisual(c,d,e,v);
  }
  return v;
}

function dinheiroVisual(c:CartaoSecao,d:DadosPainel,e:ExtrasSecao,v:VisualizacaoSecao):VisualizacaoSecao {
  const painel=e.dinheiro;if(!painel)return v;
  const pedido=lerFiltro(c,'ano',c.pedido.ano,x=>x===null||typeof x==='number'&&Number.isInteger(x));
  const ano=anoDoOrcamento(painel,d.foco,pedido),ente=painel.entes[c.pedido.uf??'BR'],p=ente?.anos[String(ano)];
  const rotulo=painel.parcial?.ano===ano?`${ano} até ${painel.parcial.mes}`:String(ano);
  v.subtitulo=`${ente?.nome??c.legenda} · ${rotulo}`;v.fonte='Tesouro Nacional · Siconfi · valor liquidado';
  const secao=c.pedido.secao;
  if(secao==='fontes-dinheiro')v.desenho=tabela(['Fonte','Medida / cobertura','Referência'],[['Tesouro / Siconfi','RREO Anexo 02 · despesa liquidada',painel.coletadoEm],['Tesouro / Siconfi','RREO Anexo 01 · receita',rotulo],['IBGE','População para valores por habitante',rotulo],['IPCA','Base dos valores reais',painel.baseReal]]);
  else if(secao==='emendas') {
    const em=e.emendas;if(!em)return v;
    const busca=lerFiltro(c,'emendas.busca','',x=>typeof x==='string'&&x.length<=200),modo=escolha(c,'emendas.modo','hab',['hab','tot']);
    const listas=listasDasEmendas(em,busca,modo,c.pedido.uf);
    v.desenho=tabela(['Município','UF','Planos (R$)','R$ por habitante'],listas.municipios.map(x=>[x.nome,x.uf,reais(x.v),numero(x.hab)]));
    v.subtitulo+=` · Emendas ${em.ano} · ${modo==='hab'?'por habitante':'valor total'}${busca?` · busca: ${busca}`:''}`;v.fonte='Transferegov · transferências especiais';v.nota='Valor dos planos de ação, não comprovação de execução de obras.';
    if(e.planos){const pagina=lerFiltro(c,'emendas.pagina',0,x=>typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=10000),id=lerFiltro<string|null>(c,'emendas.plano',null,x=>x===null||typeof x==='string'&&e.planos!.some(p=>p.id===x)),plano=e.planos.slice(0,50).find(p=>p.id===id);
      v.subtitulo+=` · Planos · página ${pagina+1}`;
      v.desenho=plano?tabela(['Plano','Informação'],[['Código',plano.codigo],['Beneficiário',plano.beneficiario],['UF',plano.uf],['Parlamentar',plano.parlamentar],['Situação',plano.situacao],['Custeio previsto',plano.custeio===null?null:reais(plano.custeio)],['Investimento previsto',plano.investimento===null?null:reais(plano.investimento)]]):tabela(['Beneficiário','UF','Parlamentar','Situação','Valor previsto'],e.planos.slice(0,50).map(p=>[p.beneficiario,p.uf,p.parlamentar,p.situacao,reais((p.custeio??0)+(p.investimento??0))]));
    }
  } else if(secao==='de-onde-veio') {
    const r=painel.receita[String(ano)];if(r)v.desenho={tipo:'barras',linhas:[['Contribuições',r.con],['Impostos e taxas',r.imp],['Outras receitas correntes',r.out],['Empréstimos novos',r.emp],['Outras de capital',r.cap]].map(([nome,valor],i)=>({nome:String(nome),valor:Number(valor),texto:reais(Number(valor)),cor:CORES[i]}))};v.subtitulo=`União · ${rotulo}`;
  } else if(secao==='ano-a-ano') {
    if(ente)v.desenho={tipo:'empilhadas',nomes:painel.anos.map(String),grupos:ORDEM_FAMILIAS.map(f=>({nome:NOME_FAMILIA[f],cor:FAMILIA_COR[f],valores:painel.anos.map(a=>{const p=ente.anos[String(a)];return p?100*ITENS.filter(i=>i.familia===f).reduce((s,i)=>s+(p.v[i.id]??0),0)/p.t:null;})}))};v.nota='Participação de cada família em cada R$ 100 de despesa. Ano aberto usa somente o período informado.';
  } else if(p) {
    const familia=lerFiltro<string|null>(c,'orcamento.familia',null,x=>x===null||ORDEM_FAMILIAS.includes(x as typeof ORDEM_FAMILIAS[number]));
    const item=lerFiltro<string|null>(c,'orcamento.item',null,x=>x===null||ITENS.some(i=>i.id===x));
    if(secao==='orcamento')v.desenho={tipo:'treemap',blocos:arranjarTreemap(p,{w:1080,h:260},familia as typeof ORDEM_FAMILIAS[number]|null).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,nome:b.dobra?`Mais ${b.dobra} áreas`:nomeDoItem(b.id),valor:`R$ ${deCem(b.v,p.t)} de R$ 100`,cor:FAMILIA_COR[b.familia]}))};
    else if(secao==='orcamento-detalhe'&&item){v.titulo=nomeDoItem(item);const anos=painel.anos.filter(a=>a!==painel.parcial?.ano&&ente.anos[String(a)]);v.desenho={tipo:'linhas',datas:anos.map(String),series:[{nome:`R$ de ${painel.baseReal}`,valores:anos.map(a=>(ente.anos[String(a)].v[item]??0)*(painel.idx[String(a)]??1)/1e9),cor:CORES[2]}],unidade:`R$ bilhões de ${painel.baseReal}`};v.nota=`${rotulo}: ${reais(p.v[item]??0)}, R$ ${deCem(p.v[item]??0,p.t)} de cada R$ 100. Ano parcial fica fora da linha até fechar.`;}
    else {const grupos=c.pedido.uf?gruposDeGovernadores(painel.anos,termosDoGoverno(d.governos,c.pedido.uf,d.economia.mandatos)):gruposDePresidentes(painel.anos,d.economia.mandatos),base=baseDoAno(painel,ano,grupos);v.desenho=tabela(['Linha','De R$ 100','Total','Por habitante','Mudança real'],ITENS.map(i=>({...i,v:p.v[i.id]??0})).filter(i=>i.v>0).sort((a,b)=>b.v-a.v).map(i=>{const x=variacaoReal(painel,ente,ano,base,i.id);return [i.nome,deCem(i.v,p.t),reais(i.v),p.p?numero(i.v/p.p):null,x===null?null:sinal(x)];}));}
    if(familia)v.subtitulo+=` · ${NOME_FAMILIA[familia as keyof typeof NOME_FAMILIA]}`;
  }
  return v;
}

function ambienteMunicipalVisual(c:CartaoSecao,d:DadosPainel,e:ExtrasSecao,v:VisualizacaoSecao) {
  const m=e.municipal,formas=e.formas;if(!m||!formas)return;
  const bioma=lerFiltro<string|null>(c,'bioma',null,x=>x===null||typeof x==='string'&&d.ambiente.porBioma.some(b=>b.id===x));
  if(c.pedido.secao==='municipios'){
    const ano=m.anoCompleto??m.anos.at(-1)!,i=m.anos.indexOf(ano);
    const linhas=formas.flatMap(f=>{const x=m.m[f.codigo],v=x?.d?.[i];return v==null||(bioma&&x?.b!==bioma)?[]:[{f,x,v}];}).sort((a,b)=>b.v-a.v).slice(0,12);
    v.desenho=tabela(['Município','UF','Desmate km²','Alertas km²','Autos','Multas'],linhas.map(x=>[x.f.nome,x.f.uf,numero(x.v,1),x.x.a?numero(x.x.a[1],1):null,x.x.i?numero(x.x.i[1]):null,x.x.v?reais(x.x.v[1]):null]));v.subtitulo+=` · PRODES ${ano}${bioma?` · ${bioma}`:''}`;v.fonte='INPE/PRODES e DETER · Ibama';return;
  }
  const lente=escolha<Lente>(c,'mapa.lente','desmatamento',['desmatamento','alertas','fogo','queimada','ti','uc','fiscalizacao','multas','embargos']);
  const regiao=lerFiltro<string|null>(c,'mapa.regiao',null,x=>x===null||typeof x==='string'&&['amazonia','cerrado','caatinga','mata_atlantica','pampa','pantanal','outros'].includes(x));
  const ehArea=lente==='ti'||lente==='uc',ibama=['fiscalizacao','multas','embargos'].includes(lente),modoPedido=escolha<ModoMapa>(c,'mapa.modo','area',['area','total','posse']),modo=ehArea&&modoPedido==='area'?'total':ibama&&modoPedido==='posse'?'area':modoPedido;
  const anos=lerFiltro(c,'mapa.anos',{desmatamento:null,fogo:null,protegidas:null} as Record<string,number|null>,x=>!!x&&typeof x==='object'&&['desmatamento','fogo','protegidas'].every(k=>k in x)&&Object.values(x).every(n=>n===null||typeof n==='number'&&Number.isInteger(n)&&n>=1900&&n<=2200));
  const disponiveis=lente==='fogo'?d.queimadas.anos:ehArea?(bioma?d.ambiente.protegidas?.porBioma[bioma]?.[lente]?.datas.map(x=>Number(x.slice(0,4))):d.ambiente.protegidas?.anos)??[]:(d.leituras.ambiente.find(l=>l.id==='desmatamento')?.periodos.map(p=>Number(p.codigo.slice(0,4)))??[]);
  const umBioma=bioma??(regiao!=='outros'?regiao:null);
  if(lente==='desmatamento'&&umBioma&&!c.pedido.uf){const ultimo=d.ambiente.porBioma.find(b=>b.id===umBioma)?.prodes?.referencia;const a=ultimo?Number(ultimo.slice(0,4)):null;if(a&&!disponiveis.includes(a))disponiveis.push(a);}
  const pedido=anos[ehArea?'protegidas':lente==='fogo'?'fogo':'desmatamento'],ano=pedido!==null&&disponiveis.includes(pedido)?pedido:disponiveis.at(-1)??null;
  const cores:Record<string,string>={'atlas-papel':'#eef2ea','grade':'#e4e8e3','mapa-estavel':'#b6c3b9','mapa-melhor':'#2e795b','mapa-pior':'#a3473a'};
  for(const [id,rampa] of Object.entries({desmate:['#f5e4e4','#e4babd','#c27d83','#872e36','#541820'],fogo:['#fbe3cd','#f7bd8b','#f2944e','#e8650f','#9e2f08'],alerta:['#f4e0ef','#deb3d3','#b974af','#943981','#5f205c'],fiscal:['#e1e5f7','#b7c2ec','#879ad8','#536dc3','#2b428e'],protegidas:['#e3eee8','#b7d2c2','#78b39a','#458b75','#285c49']}))rampa.forEach((cor,i)=>cores[`${id}-${i+1}`]=cor);
  const cor=(token:string)=>cores[token.replace(/^var\(--|\)$/g,'')]??'#eef2ea';
  const municipio=lerFiltro<string|null>(c,'municipio',null,x=>x===null||typeof x==='string'&&formas.some(f=>f.codigo===x));
  const estado=escolha(c,'mapa.recorte','municipios',['municipios','estados'])==='estados'||(lente==='desmatamento'?!m.anos.includes(ano??0):lente==='fogo'?!m.focosAnos.includes(ano??0):false);
  let contornos:{d:string;cor:string;borda?:string}[];
  if(ehArea&&e.areas&&e.valoresAreas){const area=lerFiltro<string|null>(c,'mapa.area',null,x=>x===null||typeof x==='string'&&e.areas!.some(a=>chaveDaArea(a.r,a.b,a.n)===x));contornos=[...d.ufs.map(u=>({d:u.d,cor:'#eef2ea'})),...e.areas.filter(a=>a.r===lente&&(!bioma||a.b===bioma)).map(a=>{const chave=chaveDaArea(a.r,a.b,a.n),n=numerosDaArea(e.valoresAreas!,chave,a.b,ano,d.foco.anoRecebido);return {d:a.d,cor:cor(corDaLente(n.agora,n.recebido,lente,modo,0)),borda:area===chave?'#a58138':undefined};})];if(area)v.subtitulo+=` · ${e.areas.find(a=>chaveDaArea(a.r,a.b,a.n)===area)?.n??''}`;}
  else if(estado){const id=({desmatamento:'desmatamento',alertas:'alertas_12m',fogo:'focos_12m',fiscalizacao:'autos_12m',embargos:'embargos_12m'} as Partial<Record<Lente,string>>)[lente],l=[...d.leituras.ambiente,...d.ambiente.fiscalizacao].find(x=>x.id===id);
    const valores=d.ufs.map(u=>{const s=l?.ufs[u.codigo],i=lente==='desmatamento'&&ano!==null?l?.periodos.findIndex(p=>Number(p.codigo.slice(0,4))===ano)??-1:(l?.periodos.length??0)-1;const soma=!l?somaNaUf(m,u.codigo,x=>lente==='queimada'?x.q:lente==='multas'?x.v:lente==='embargos'?x.e:x.i?[x.i[0],x.i[1]]:undefined):null;return {u,agora:l?s?.[i]??null:soma?.agora??null,recebido:l&&l.indiceRecebido!==null?s?.[l.indiceRecebido]??null:soma?.recebido??null};});
    const medida=(x:typeof valores[number])=>x.agora===null?null:modo==='area'?1000*x.agora/x.u.areaKm2:x.agora,regua=reguaDeCor(valores.map(medida),'log',RAMPA_DA_LENTE[lente]);
    contornos=valores.map(x=>({d:x.u.d,cor:c.pedido.uf&&x.u.sigla!==c.pedido.uf?'#eef2ea':cor(modo==='posse'?corDaLente(x.agora,x.recebido,lente,modo,x.u.areaKm2):x.agora===null?'var(--atlas-papel)':regua.cor(medida(x)))}));
  } else contornos=formas.map(f=>{const x=m.m[f.codigo],n=numerosDaLente(x,lente,m,ano),noRecorte=c.pedido.uf?f.uf===c.pedido.uf:bioma?x?.b===bioma:regiao?regiao==='outros'?['caatinga','mata_atlantica','pampa','pantanal'].includes(x?.b??''):x?.b===regiao:true;return {d:f.d,cor:noRecorte?cor(corDaLente(n.agora,n.recebido,lente,modo,f.areaKm2)):'#eef2ea',borda:municipio===f.codigo?'#a58138':undefined};});
  v.desenho={tipo:'mapa',largura:d.mapa.largura,altura:d.mapa.altura,caixa:d.ufs.find(u=>u.sigla===c.pedido.uf)?.caixa,formas:contornos,legenda:modo==='posse'?['Verde: abaixo do recebido','Vermelho: acima do recebido','Cinza: estável ou sem dado']:['Claro: menor intensidade','Escuro: maior intensidade','Cinza: sem dado']};
  const nome={desmatamento:'Desmatamento',alertas:'Alertas de desmatamento',fogo:'Focos de queimada',queimada:'Área queimada',ti:'Terras Indígenas',uc:'Unidades de Conservação',fiscalizacao:'Autos do Ibama',multas:'Multas do Ibama',embargos:'Embargos do Ibama'}[lente];
  v.subtitulo+=` · ${nome} · ${ano??m.janela.atual??''} · ${modo==='area'?'por área':modo==='posse'?'desde a posse':'total'}${bioma?` · ${d.ambiente.porBioma.find(b=>b.id===bioma)?.rotulo??bioma}`:''}`;v.fonte='INPE · Ibama · IBGE (malha municipal)';
  if(municipio)v.subtitulo+=` · ${formas.find(f=>f.codigo===municipio)?.nome??''}`;
}
