type MandatoPerfil = {id:string;pessoaId:string;mandato:number;inicio:string};

export function mandatoDoPerfil<T extends MandatoPerfil>(mandatos:T[],pessoaId:string,pedido:string|null):T|undefined {
  const proprios=mandatos.filter(m=>m.pessoaId===pessoaId).sort((a,b)=>b.inicio.localeCompare(a.inicio));
  return proprios.find(m=>m.id===pedido)??proprios[0];
}

/** Traduz os links já compartilhados, sem assumir igualdade entre IDs de séries. */
export function migrarLinkPerfil(url:URL,mandatos:MandatoPerfil[],series:{id:string;origem:string}[]):URL|null {
  const pessoa=url.pathname.match(/^\/presidente\/([^/]+)$/)?.[1];
  if(!pessoa)return null;
  let hash=url.hash.slice(1);
  try{hash=decodeURIComponent(hash);}catch{return null;}
  const alvo=url.searchParams.get('painel')||hash;
  let mandato=mandatos.find(m=>m.pessoaId===pessoa&&alvo.startsWith(`indicador-${m.id}-`));
  const numero=alvo.match(/^(?:mandato|ato)-(\d+)(?:-|$)/)?.[1];
  mandato??=mandatos.find(m=>m.pessoaId===pessoa&&m.mandato===Number(numero));
  let origem=mandato&&alvo.startsWith(`indicador-${mandato.id}-`)?alvo.slice(`indicador-${mandato.id}-`.length):null;
  if(!origem){for(const m of mandatos.filter(m=>m.pessoaId===pessoa)){const salvo=url.searchParams.get(`r.ficha.${m.id}`);if(salvo){mandato??=m;origem=salvo;break;}}}
  origem??=url.searchParams.get('r.pessoa.comparacao');
  const comparacao=alvo==='comparacao-de-mandatos'||alvo.includes('onde-este-mandato');
  if(!mandato&&!origem&&!comparacao)return null;
  const nova=new URL(url),serie=series.find(s=>s.origem===origem);
  const pedido=mandatos.find(m=>m.pessoaId===pessoa&&m.id===url.searchParams.get('mandato'));
  if(mandato&&!pedido)nova.searchParams.set('mandato',mandato.id);
  if(serie){nova.searchParams.set('r.serie',serie.id);nova.searchParams.set('r.leitura','null');}
  const painel=comparacao?'governo-a-governo':'de-perto';
  nova.searchParams.set('painel',painel);nova.hash=painel;
  nova.searchParams.delete('r.pessoa.comparacao');
  for(const m of mandatos)nova.searchParams.delete(`r.ficha.${m.id}`);
  return nova.href===url.href?null:nova;
}
