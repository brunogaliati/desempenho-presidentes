/** Identificador público do fluxo web; não é uma credencial. */
export const ID_ANALYTICS = "G-DSETD1YL9C";
export const CHAVE_ANALYTICS = "ddg:estatisticas:v1";
const DOMINIOS_ANALYTICS = ["desempenhodogoverno.com.br", "www.desempenhodogoverno.com.br"];

export function dominioComAnalytics(hostname: string) {
  return DOMINIOS_ANALYTICS.includes(hostname);
}

/** Executa junto do HTML: evita piscar o aviso salvo, sem esperar hidratação nem iniciar analytics. */
export const INICIAR_AVISO_ANALYTICS = `(()=>{const aviso=document.getElementById("analytics-aviso"),preferencias=document.getElementById("analytics-preferencias");if(!${JSON.stringify(DOMINIOS_ANALYTICS)}.includes(location.hostname)){if(aviso)aviso.hidden=true;if(preferencias)preferencias.hidden=true;return}try{if(["aceito","recusado"].includes(localStorage.getItem(${JSON.stringify(CHAVE_ANALYTICS)}))){if(aviso)aviso.hidden=true}}catch{}})();`;

/** Filtros, buscas, fragmentos e credenciais não entram nos relatórios. */
export function enderecoAnalytics(endereco: string): string | undefined {
  try {
    const u = new URL(endereco);
    return ["https:", "http:"].includes(u.protocol) ? u.origin + u.pathname : undefined;
  } catch { return undefined; }
}

export function paginaAnalytics(endereco: string, anterior: string | null) {
  const pagina = enderecoAnalytics(endereco);
  return pagina && pagina !== anterior ? pagina : null;
}

let eventosPermitidos = false;
export function permitirEventosAnalytics(permitir: boolean) { eventosPermitidos = permitir; }

export const DIMENSOES_COMPARTILHAMENTO = [
  ['item_id','Conteúdo compartilhado'], ['content_type','Tipo de conteúdo'], ['method','Destino do compartilhamento'],
  ['share_action','Ação de compartilhamento'], ['share_theme','Tema compartilhado'], ['share_government','Governo compartilhado'],
  ['share_territory','Território compartilhado'], ['share_indicator','Indicador compartilhado'], ['share_period','Período compartilhado'],
  ['share_biome','Bioma compartilhado'], ['filter_range','Faixa do histórico'], ['filter_mode','Modo de comparação'],
  ['filter_scope','Recorte do mapa'], ['filter_measure','Medida selecionada'], ['filter_order','Ordenação selecionada'],
  ['filter_credit','Famílias ou empresas'], ['filter_family','Família do orçamento'], ['filter_item','Despesa selecionada'],
  ['filter_comparison','Governo de comparação'], ['filter_detail','Tipo de detalhe selecionado'], ['filter_plan','Plano selecionado'],
  ['filter_protected','Tipo de área protegida'],
] as const;

export type MetodoCompartilhamento = 'whatsapp'|'telegram'|'x'|'facebook'|'linkedin'|'copiar_link'|'copiar_com_frase'|'menu_sistema';
export type AcaoCompartilhamento = 'abertura'|'destino_aberto'|'copia_concluida'|'menu_concluido';
const token = (s: string | null) => s && /^[a-z][a-z0-9_.-]{0,79}$/i.test(s) ? s : undefined;
const BIOMAS = ['amazonia','cerrado','caatinga','mata_atlantica','pampa','pantanal','todos','outros'];
const GOVERNOS = ['fhc_1','fhc_2','lula_1','lula_2','dilma_1','dilma_2','temer','bolsonaro','lula_3','gov-2015'];

/** Identificadores e filtros tipados; nunca a frase, a busca, a URL completa ou nomes digitados. */
export function dadosAnalyticsCompartilhamento(link: string, imagem: string | null) {
  const u = new URL(link);
  if (!dominioComAnalytics(u.hostname)) return null;
  const capa = imagem ? new URL(imagem,u.origin) : null;
  const doPainel = capa?.origin === u.origin && capa.pathname === '/compartilhar/recorte';
  const q = doPainel ? capa!.searchParams : u.searchParams;
  const get = (...chaves: string[]) => chaves.map(k=>q.get(k)).find(v=>v!==null)??null;
  const tema = u.pathname.startsWith('/meio-ambiente')?'ambiente':u.pathname.startsWith('/dinheiro')?'dinheiro':u.pathname.startsWith('/sobre')||u.pathname.startsWith('/correcoes')||u.pathname.startsWith('/metodologia')?'institucional':'economia';
  const secao = token(get('secao','grafico')) ?? (q.has('serie')?'de-perto':q.has('leitura')?'mapa':doPainel?'agora':token(u.searchParams.get('painel')??u.hash.slice(1))??'pagina');
  const filtros: Record<string,string> = {};
  const escolha = (campo:string,valor:string|null,opcoes:readonly string[],padrao?:string) => { if(valor&&opcoes.includes(valor))filtros[campo]=valor;else if(padrao)filtros[campo]=padrao; };
  const governo=get('mandato');if(governo&&GOVERNOS.includes(governo))filtros.share_government=governo;
  const uf=get('uf'),municipio=get('r.municipio');
  const localMunicipal=u.pathname.match(/\/municipios\/([a-z0-9-]+-[a-z]{2})(?:\/|$)/)?.[1];
  filtros.share_territory=municipio&&/^\d{7}$/.test(municipio)?`ibge:${municipio}`:uf&&/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf)?uf:localMunicipal?`municipio:${localMunicipal}`.slice(0,100):'BR';
  const indicador=token(get('serie','leitura','r.serie','r.leitura','r.mapa.lente'));if(indicador)filtros.share_indicator=indicador;else if(secao==='mapa-ambiente')filtros.share_indicator='desmatamento';
  escolha('share_biome',get('bioma','r.bioma','r.desmatamento.bioma','r.mapa.regiao'),BIOMAS,secao==='desmatamento'?'amazonia':undefined);
  const ano=get('ano','r.ano','r.protegidas.ano'),periodo=get('periodo');
  if(ano&&/^(19|20|21)\d{2}$/.test(ano))filtros.share_period=`ano:${ano}`;
  else if(periodo&&/^\d{1,4}$/.test(periodo))filtros.share_period=`indice:${periodo}`;
  const datas=['r.de','r.ate'].map(k=>q.get(k));
  if(datas.some(Boolean)&&datas.every(d=>d===null||/^\d{4}(?:-(0[1-9]|1[0-2])(?:-\d{2})?|-?T[1-4])?$/.test(d)))filtros.share_period=datas.map((d,i)=>d?`${i?'ate':'de'}:${d}`:'').filter(Boolean).join(';');
  try { const anos=JSON.parse(get('r.mapa.anos')??'null');if(anos&&typeof anos==='object'){const partes=['desmatamento','fogo','protegidas'].flatMap(k=>Number.isInteger(anos[k])&&anos[k]>=1900&&anos[k]<=2200?[`${k}:${anos[k]}`]:[]);if(partes.length)filtros.share_period=partes.join(';');} } catch { /* Ignora valores desconhecidos. */ }
  escolha('filter_range',get('r.faixa'),['mandato','tudo'],secao==='historico-serie'?'mandato':undefined);
  escolha('filter_mode',get('r.estados.modo','r.fiscalizacao.modo','r.mapa.modo','r.emendas.modo'),['posse','hoje','mudanca','valor','evolucao','area','total','hab','tot'],['estados','biomas'].includes(secao)?'posse':secao==='emendas'?'hab':secao==='mapa-ambiente'?'area':undefined);
  escolha('filter_scope',get('r.mapa.recorte'),['municipios','estados'],secao==='mapa-ambiente'?'municipios':undefined);
  escolha('filter_measure',get('r.medida'),['real','nominal','mensal','ano','doze','acumulado','12meses']);
  escolha('filter_credit',get('r.credito.pessoa'),['pf','pj'],secao==='bloco-credito-e-inadimplencia'?'pf':undefined);
  escolha('filter_family',get('r.orcamento.familia'),['beneficios','divida','transfer','servicos','opaco','estado'],secao==='orcamento'?'todas':undefined);
  const item=token(get('r.orcamento.item'));if(item)filtros.filter_item=item;
  escolha('filter_comparison',get('r.comparar'),GOVERNOS);
  escolha('filter_protected',get('r.protegidas.tipo'),['ti','uc'],secao==='protegidas'?'ti':undefined);
  try { const ordem=JSON.parse(get('r.estados.ordem')??'null');if(ordem&&token(ordem.id)&&typeof ordem.desc==='boolean')filtros.filter_order=`${ordem.id}:${ordem.desc?'desc':'asc'}`; } catch { /* Sem ordem válida. */ }
  const detalhe=get('r.emendas.detalhe','r.mapa.area');
  if(detalhe)filtros.filter_detail=detalhe.startsWith('cnpj:')?'municipio':detalhe.startsWith('parlamentar:')?'parlamentar':detalhe.startsWith('ti:')?'terra_indigena':detalhe.startsWith('uc:')?'unidade_conservacao':'outro';
  const plano=get('r.emendas.plano');if(plano&&/^(?:\d{1,20}|[0-9a-f]{8}-[0-9a-f-]{27})$/i.test(plano))filtros.filter_plan=plano;
  const tabelas=['governo-a-governo','estados','biomas','municipios','todas-as-linhas','emendas','fontes','fontes-dinheiro','bloco-governadores-por-partido','bloco-brasil-e-o-mundo','bloco-ultimos-dados'];
  const tipo=secao==='mapa-ambiente'||secao==='mapa'?'mapa':tabelas.includes(secao)||secao==='historico-serie'&&get('r.historico.tabela')==='true'||secao==='protegidas'&&!!get('r.protegidas.ano')?'tabela':secao==='agora'?'resumo':secao==='pagina'?'pagina':'grafico';
  return {item_id:`${u.pathname}#${secao}${indicador?':'+indicador:''}`.slice(0,100),content_type:tipo,share_theme:tema,...filtros};
}

export function registrarCompartilhamentoAnalytics(evento:'share'|'share_open',metodo:MetodoCompartilhamento|'menu',acao:AcaoCompartilhamento,link:string,imagem:string|null) {
  if(!eventosPermitidos||typeof window==='undefined'||!dominioComAnalytics(window.location.hostname)||!window.gtag)return;
  try {
    const dados=dadosAnalyticsCompartilhamento(link,imagem);
    if(dados)window.gtag('event',evento,{...dados,method:metodo,share_action:acao});
  } catch { /* A medição nunca impede o compartilhamento. */ }
}
