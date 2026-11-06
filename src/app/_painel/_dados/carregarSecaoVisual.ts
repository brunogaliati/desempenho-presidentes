import 'server-only';
import type { CartaoSecao } from '../_componentes/capaRecorte';
import { anoDoOrcamento, lerFiltro, visualizacaoDaSecao, type ExtrasSecao } from '../_componentes/visualizacaoSecao';
import type { DadosPainel, MunicipioNacional } from './tipos';
import { recortarAoMandato } from './mandatoRecorte';
import { carregarDinheiro, carregarEmendas } from './dinheiro';
import { carregarMunicipiosAmbiente } from './carregarMunicipiosAmbiente';
import { jsonCompartilhamento } from '@/lib/fonteCompartilhamento';
import { carregarAreasProtegidas } from './carregarAreasProtegidas';
import { GET as consultarDinheiro } from '@/app/api/painel/dinheiro/route';

let formas: Promise<{municipios:MunicipioNacional[]}> | undefined;
let areas: Promise<{areas:NonNullable<ExtrasSecao['areas']>}> | undefined;
export async function carregarSecaoVisual(c:CartaoSecao,dados:DadosPainel) {
  const e:ExtrasSecao={},p=c.pedido;
  if(p.tema==='dinheiro') {
    e.dinheiro=await carregarDinheiro();
    if(p.secao==='emendas') {
      const foco=recortarAoMandato(dados,p.mandato).foco;
      const ano=Math.max(2020,anoDoOrcamento(e.dinheiro,foco,lerFiltro(c,'ano',p.ano,x=>x===null||typeof x==='number'&&Number.isInteger(x))));
      e.emendas=await carregarEmendas(ano);
      const filtro=lerFiltro<string|null>(c,'emendas.detalhe',null,x=>x===null||typeof x==='string'&&(e.emendas!.municipios.some(m=>'cnpj:'+m[5]===x)||e.emendas!.parlamentares.some(m=>'parlamentar:'+m[0]===x)));
      const municipio=e.emendas.municipios.find(m=>'cnpj:'+m[5]===filtro),parlamentar=e.emendas.parlamentares.find(m=>'parlamentar:'+m[0]===filtro);
      if(municipio||parlamentar){
        const pagina=lerFiltro(c,'emendas.pagina',0,x=>typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=10000);
        const q=new URLSearchParams({tipo:'planos',ano:String(ano),pagina:String(pagina)});
        if(municipio)q.set('cnpj',municipio[5]);
        if(parlamentar){q.set('parlamentar',parlamentar[0]);if(p.uf)q.set('uf',p.uf);}
        const resposta=await consultarDinheiro(new Request(`https://dados.local/?${q}`));
        if(!resposta.ok)throw new Error('Planos indisponíveis na fonte');
        e.planos=await resposta.json();
      }
    }
  }
  if(p.tema==='ambiente'&&['biomas','municipios','mapa-ambiente'].includes(p.secao)) {
    const foco=recortarAoMandato(dados,p.mandato).foco;
    e.municipal=await carregarMunicipiosAmbiente(foco.posse,foco.ate);
    if(p.secao!=='biomas')e.formas=(await (formas??=jsonCompartilhamento('painel/municipios-brasil.json'))).municipios;
    if(['ti','uc'].includes(lerFiltro(c,'mapa.lente','desmatamento',x=>typeof x==='string'&&['desmatamento','alertas','fogo','queimada','ti','uc','fiscalizacao','multas','embargos'].includes(x)))){
      [e.areas,e.valoresAreas]=await Promise.all([(areas??=jsonCompartilhamento('painel/areas-protegidas.json')).then(x=>x.areas),carregarAreasProtegidas()]);
    }
  }
  return visualizacaoDaSecao(c,dados,e);
}
