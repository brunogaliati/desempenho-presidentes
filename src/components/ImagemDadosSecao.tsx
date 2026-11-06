import type { CSSProperties } from 'react';
import type { DesenhoSecao, VisualizacaoSecao } from '@/app/_painel/_componentes/visualizacaoSecao';
import { numero } from '@/lib/formatar';
import { respostaDaCapa, TINTA, TINTA_2 } from './ImagemCompartilhamento';

const flex=(p:CSSProperties):CSSProperties=>({display:'flex',...p});
const W=1104,H=220;
const COR={bom:'#2e795b',ruim:'#a3473a',neutro:'#e7edf0'};
const rotulo=(s:string)=>/^\d{4}-\d{2}$/.test(s)?`${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][Number(s.slice(5))-1]}/${s.slice(2,4)}`:s;

function Tabela({v}:{v:Extract<DesenhoSecao,{tipo:'tabela'}>}) {
  const linhas=v.linhas.slice(0,7),n=v.colunas.length,primeira=n>6?176:250,celula=(W-primeira)/(n-1||1);
  return <div style={flex({flexDirection:'column',fontSize:n>7?15:19,width:W,gap:2})}>
    <div style={flex({minHeight:42,alignItems:'center',fontWeight:600,color:TINTA_2})}>{v.colunas.map((c,i)=><div key={i} style={flex({width:i?celula:primeira,padding:'3px 7px',lineHeight:1.12})}>{c}</div>)}</div>
    {linhas.map((l,k)=><div key={k} style={flex({minHeight:29,alignItems:'stretch',background:k%2?'#edf2f4':'#f8fafd'})}>{l.map((c,i)=><div key={i} style={flex({width:i?celula:primeira,padding:'5px 7px',fontWeight:i===0?600:400,lineHeight:1.12,...(c.sentido?{background:COR[c.sentido]}:{}),color:c.sentido&&c.sentido!=='neutro'?'#ffffff':TINTA,...(i===v.destaque?{borderBottom:'2px solid #a58138'}:{})})}>{c.texto}</div>)}</div>)}
    {v.linhas.length>linhas.length&&<div style={flex({fontSize:15,color:TINTA_2,marginTop:5})}>{`Primeiras ${linhas.length} de ${v.linhas.length} linhas, na ordem selecionada. Tabela completa no link.`}</div>}
    {v.linhas.length===0&&<div style={flex({fontSize:24,padding:'36px 0'})}>Nenhuma linha neste filtro.</div>}
  </div>;
}

function Linhas({v}:{v:Extract<DesenhoSecao,{tipo:'linhas'}>}) {
  const valores=v.series.flatMap(s=>s.valores.filter((x):x is number=>x!==null&&Number.isFinite(x))),min=Math.min(...valores,0),max=Math.max(...valores,1),folga=(max-min)*0.06;
  const x=(i:number)=>62+i*(W-84)/Math.max(1,v.datas.length-1),y=(valor:number)=>H-38-(valor-min+folga)/(max-min+folga*2)*(H-60);
  const path=(valores:(number|null)[])=>{let aberto=false;return valores.map((valor,i)=>{if(valor===null){aberto=false;return '';}const comando=aberto?'L':'M';aberto=true;return `${comando}${x(i).toFixed(1)},${y(valor).toFixed(1)}`;}).join(' ');};
  const legenda=v.series.filter(s=>s.cor!=='#b9c5cc');
  return <div style={flex({flexDirection:'column',width:W,gap:8})}>
    <div style={flex({position:'relative',width:W,height:H})}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {[min,(max+min)/2,max].map((n,i)=><line key={i} x1={62} x2={W-16} y1={y(n)} y2={y(n)} stroke="#d7e1e7" />)}
        {v.series.map((s,i)=><path key={i} d={path(s.valores)} fill="none" stroke={s.cor} strokeWidth={s.cor==='#b9c5cc'?1.3:3.5} strokeDasharray={s.tracejada?'7 5':undefined} strokeLinejoin="round" />)}
      </svg>
      {[min,(max+min)/2,max].map((n,i)=><div key={i} style={flex({position:'absolute',left:0,top:y(n)-10,width:54,justifyContent:'flex-end',fontSize:15,color:TINTA_2})}>{numero(n,Math.abs(n)<10?1:0)}</div>)}
      {[0,Math.floor((v.datas.length-1)/2),v.datas.length-1].filter((i,k,a)=>i>=0&&a.indexOf(i)===k).map(i=><div key={i} style={flex({position:'absolute',top:H-25,left:Math.max(42,Math.min(W-108,x(i)-40)),width:92,justifyContent:'center',fontSize:17,color:TINTA_2})}>{rotulo(v.datas[i])}</div>)}
    </div>
    <div style={flex({gap:20,flexWrap:'wrap',fontSize:17,color:TINTA_2})}>{legenda.map((s,i)=>{const ultimo=s.valores.findLast(x=>x!==null);return <div key={i} style={flex({alignItems:'center',gap:7})}><div style={flex({width:18,height:4,background:s.cor})}/>{`${s.nome}${ultimo===undefined?'':`: ${numero(ultimo,Math.abs(ultimo)<100?1:0)}`}`}</div>;})}<div style={flex({marginLeft:'auto'})}>{v.unidade}</div></div>
  </div>;
}

function Barras({v}:{v:Extract<DesenhoSecao,{tipo:'barras'}>}) {
  const linhas=v.linhas.slice(0,7),max=Math.max(...linhas.flatMap(x=>[Math.abs(x.valor),Math.abs(x.referencia??0)]),1),negativo=linhas.some(x=>x.valor<0||(x.referencia??0)<0),base=negativo?480:285,largura=negativo?265:575;
  return <div style={flex({width:W,flexDirection:'column',gap:5,fontSize:18})}>
    {linhas.map((l,i)=><div key={i} style={flex({height:30,alignItems:'center',position:'relative'})}>
      <div style={flex({width:265,fontWeight:600})}>{l.nome}</div>
      <svg width={650} height={30} style={{position:'absolute',left:265}}>
        <line x1={base-265} x2={base-265} y1={0} y2={30} stroke="#a3afb8" />
        <rect x={base-265+Math.min(0,l.valor/max*largura)} y={6} width={Math.abs(l.valor)/max*largura} height={18} rx={3} fill={l.cor}/>
        {l.referencia!=null&&<line x1={base-265+l.referencia/max*largura} x2={base-265+l.referencia/max*largura} y1={2} y2={28} stroke="#263746" strokeWidth={2} strokeDasharray="3 2"/>}
      </svg>
      <div style={flex({marginLeft:'auto',width:230,justifyContent:'flex-end',fontWeight:600})}>{l.texto}</div>
    </div>)}
    {v.linhas.length>linhas.length&&<div style={flex({fontSize:15,color:TINTA_2,marginTop:4})}>{`Primeiros ${linhas.length} de ${v.linhas.length} indicadores. Lista completa no link.`}</div>}
  </div>;
}

function Desenho({v}:{v:DesenhoSecao}) {
  if(v.tipo==='tabela')return <Tabela v={v}/>;
  if(v.tipo==='linhas')return <Linhas v={v}/>;
  if(v.tipo==='barras')return <Barras v={v}/>;
  if(v.tipo==='treemap')return <div style={flex({position:'relative',width:W,height:260})}>{v.blocos.map((b,i)=><div key={i} style={flex({position:'absolute',left:b.x,top:b.y,width:b.w,height:b.h,background:b.cor,color:'#ffffff',padding:b.w>85&&b.h>45?8:0,flexDirection:'column',justifyContent:'center',overflow:'hidden'})}>{b.w>85&&b.h>45&&<div style={flex({fontSize:b.w>180?21:16,fontWeight:600,lineHeight:1.1})}>{b.nome}</div>}{b.w>85&&b.h>65&&<div style={flex({fontSize:b.w>180?18:14,marginTop:6})}>{b.valor}</div>}</div>)}</div>;
  if(v.tipo==='empilhadas'){const passo=(W-30)/Math.max(1,v.nomes.length);return <div style={flex({position:'relative',width:W,height:H})}><svg width={W} height={H}>{v.nomes.flatMap((_,i)=>{let altura=0;return v.grupos.map((g,k)=>{const valor=g.valores[i];if(valor==null)return null;const h=valor/100*(H-36),y=H-36-altura-h;altura+=h;return <rect key={`${i}-${k}`} x={15+i*passo} y={y} width={Math.max(1,passo-6)} height={h} fill={g.cor}/>;});})}</svg>{v.nomes.map((n,i)=><div key={i} style={flex({position:'absolute',left:15+i*passo,top:H-29,width:passo-5,fontSize:15,justifyContent:'center'})}>{n}</div>)}<div style={flex({position:'absolute',top:H+4,fontSize:14,gap:12})}>{v.grupos.map(g=><div key={g.nome} style={flex({gap:5,alignItems:'center'})}><div style={flex({width:10,height:10,background:g.cor})}/>{g.nome}</div>)}</div></div>;}
  if(v.tipo==='mapa'){
    const caixa=v.caixa?[v.caixa[0]-5,v.caixa[1]-5,v.caixa[2]-v.caixa[0]+10,v.caixa[3]-v.caixa[1]+10]:[0,0,v.largura,v.altura],escala=Math.min(620/caixa[2],260/caixa[3]);
    return <div style={flex({width:W,height:260,gap:32,alignItems:'center'})}><div style={flex({width:650,justifyContent:'center'})}><svg width={caixa[2]*escala} height={caixa[3]*escala} viewBox={caixa.join(' ')} preserveAspectRatio="xMidYMid meet">{v.formas.map((p,i)=><path key={i} d={p.d} fill={p.cor} stroke={p.borda??'#ffffff'} strokeWidth={p.borda?2:0.2}/>)}</svg></div><div style={flex({width:390,flexDirection:'column',gap:14,fontSize:22,color:TINTA_2})}>{v.legenda.map(t=><div key={t} style={flex({})}>{t}</div>)}</div></div>;
  }
  return <div style={flex({height:260,alignItems:'center',fontSize:30,color:TINTA_2})}>{v.motivo}</div>;
}

export async function imagemDadosSecao(v:VisualizacaoSecao) {
  return respostaDaCapa(<div style={flex({flex:1,flexDirection:'column',justifyContent:'center',gap:10})}>
    <div style={flex({fontSize:32,fontWeight:600,letterSpacing:-0.6})}>{v.titulo}</div>
    <div style={flex({fontSize:19,color:TINTA_2,lineHeight:1.15})}>{v.subtitulo}</div>
    <Desenho v={v.desenho}/>
    {v.nota&&<div style={flex({fontSize:14,color:TINTA_2,lineHeight:1.15,maxHeight:34,overflow:'hidden'})}>{v.nota}</div>}
  </div>,`Fonte: ${v.fonte}`);
}
