export type IndicadorMunicipal = "populacao" | "emprego-formal" | "cadunico" | "bpc";
export interface MunicipioIndicadores {
  codigo: string; nome: string; slug: string;
  uf: {codigo:string;nome:string;sigla:string;slug:string};
  indicadores: string[];
}
export interface LinhaMunicipal { referencia: string; valor: number | null; extras: (number | null)[]; atualizado: string }

export const INDICADORES_MUNICIPAIS = {
  populacao: {nome:"População",unidade:"habitantes",anual:true,medidas:["População estimada"],fonte:"IBGE, estimativas de população",url:"https://sidra.ibge.gov.br/tabela/6579",limites:["É uma estimativa anual com referência em 1º de julho, não uma contagem do Censo nem uma previsão para hoje.","Anos sem publicação ficam ausentes. Revisões de projeções e alterações territoriais podem produzir diferenças que não equivalem apenas a nascimentos, mortes e migração.","O cadastro territorial é o atual do IBGE; a série não reconstrói limites históricos. Brasília e Fernando de Noronha são unidades equivalentes a município nesse cadastro."],pergunta:"Essa população é a do Censo?",resposta:"Não. Esta página usa a estimativa anual da tabela 6579 do IBGE. Os anos e valores do Censo pertencem a outra pesquisa e não foram usados para preencher lacunas."},
  "emprego-formal": {nome:"Emprego formal",unidade:"vínculos",anual:false,medidas:["Estoque de vínculos formais","Admissões","Desligamentos","Saldo de empregos"],fonte:"Ministério do Trabalho e Emprego, Novo Caged",url:"https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/novo-caged",limites:["Usamos a série com ajustes do Novo Caged, desde 2020. Declarações fora do prazo podem revisar valores anteriores; não emendamos automaticamente o Caged antigo.","Estoque é o número de vínculos formais. Saldo é admissões menos desligamentos no mês, e pode ser negativo. São medidas distintas.","Os vínculos são atribuídos à localização do estabelecimento. Uma pessoa pode ter mais de um vínculo; os números não são uma contagem de moradores ocupados, uma lista de vagas disponíveis ou uma taxa municipal de desemprego."],pergunta:"O saldo do Caged é a taxa de desemprego?",resposta:"Não. O Caged mede vínculos e movimentações do emprego formal. A taxa de desemprego exige outra pesquisa e outro denominador. Um saldo negativo também não significa que o estoque de empregos seja negativo."},
  cadunico: {nome:"CadÚnico",unidade:"famílias",anual:false,medidas:["Famílias cadastradas","Pessoas cadastradas"],fonte:"Fundação Seade, com dados do MDS/Sagicad",url:"https://repositorio.seade.gov.br/dataset/648ae821-4df3-43d1-8d69-850d345f22a2",limites:["A base municipal integrada cobre os municípios do estado de São Paulo. Famílias cadastradas e pessoas cadastradas são contagens diferentes.","Estar no Cadastro Único não equivale a receber Bolsa Família ou outro benefício. Não usamos o total de cadastros como total de beneficiários.","São dados agregados publicados pela Fundação Seade com fonte MDS/Sagicad. Não permitem consultar o cadastro de uma pessoa, localizar atendimento ou confirmar elegibilidade."],pergunta:"Todas essas famílias recebem Bolsa Família?",resposta:"Não. Inscrição no CadÚnico e recebimento de um benefício são situações distintas. Esta página informa famílias e pessoas cadastradas, conforme os campos documentados na fonte."},
  bpc: {nome:"BPC",unidade:"pessoas beneficiárias",anual:false,medidas:["Pessoas beneficiárias","Pessoas idosas beneficiárias","Pessoas com deficiência beneficiárias"],fonte:"Fundação Seade, com dados do MDS/Sagicad",url:"https://repositorio.seade.gov.br/dataset/648ae821-4df3-43d1-8d69-850d345f22a2",limites:["A base municipal integrada cobre os municípios do estado de São Paulo. Os números contam pessoas beneficiárias, não famílias, requerimentos ou valores pagos.","As duas categorias publicadas são pessoas idosas e pessoas com deficiência. O total é conferido com a soma dessas categorias.","Os dados são agregados e históricos. Não confirmam concessão individual, situação de requerimento ou calendário de pagamento."],pergunta:"Esse número mostra quanto o município recebeu de BPC?",resposta:"Não. A unidade é pessoas beneficiárias. Quantidade de pessoas e montante financeiro são indicadores diferentes; esta fonte não foi convertida em uma estimativa de valores pagos."},
} satisfies Record<IndicadorMunicipal,{nome:string;unidade:string;anual:boolean;medidas:string[];fonte:string;url:string;limites:string[];pergunta:string;resposta:string}>;

export const idsMunicipais = Object.keys(INDICADORES_MUNICIPAIS) as IndicadorMunicipal[];
export const rotaMunicipal = (id: IndicadorMunicipal,m: MunicipioIndicadores) => `/economia/${id}/${m.uf.slug}/${m.slug}`;
export function tituloMunicipal(id:IndicadorMunicipal,m:MunicipioIndicadores) {
  const local=`${m.nome} (${m.uf.sigla})`;
  if(id==="populacao") return `População de ${local}: habitantes e histórico`;
  if(id==="emprego-formal") return `Caged em ${local}: emprego formal, saldo e histórico`;
  if(id==="cadunico") return `CadÚnico em ${local}: famílias e pessoas cadastradas`;
  return `BPC em ${local}: pessoas beneficiárias e histórico`;
}
export const rotuloReferenciaMunicipal = (ref:string,anual:boolean) => anual ? ref.slice(0,4) : new Date(`${ref}-15T12:00:00Z`).toLocaleDateString("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"});

export function linhaMunicipalValida(id:IndicadorMunicipal,l:LinhaMunicipal):boolean {
  const contagem=(v:number|null)=>v!==null && Number.isSafeInteger(v) && v>=0;
  if(!contagem(l.valor)) return false;
  if(id==="populacao") return l.valor!>0;
  if(!l.extras.every(contagem)) {
    if(id!=="emprego-formal" || !l.extras.slice(0,2).every(contagem) || !Number.isSafeInteger(l.extras[2])) return false;
  }
  if(id==="emprego-formal") return l.extras.length===3 && l.extras[0]!==null && l.extras[1]!==null && l.extras[2]===l.extras[0]-l.extras[1];
  if(id==="cadunico") return l.extras.length===1 && l.extras[0]!==null && l.extras[0]>=l.valor!;
  return l.extras.length===2 && l.valor===l.extras[0]!+l.extras[1]!;
}

export function prepararLinhasMunicipais(id:IndicadorMunicipal,linhas:LinhaMunicipal[],hoje=new Date().toISOString().slice(0,10)):LinhaMunicipal[] {
  const anual=INDICADORES_MUNICIPAIS[id].anual, mapa=new Map<string,LinhaMunicipal>();
  for(const l of linhas) {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.referencia)) throw new Error("Referência municipal inválida.");
    if(`${l.referencia}-01`>hoje || (!anual && l.referencia>=hoje.slice(0,7))) continue;
    if(mapa.has(l.referencia)) throw new Error("Observação municipal duplicada.");
    mapa.set(l.referencia,linhaMunicipalValida(id,l) ? l : {...l,valor:null,extras:l.extras.map(()=>null)});
  }
  const refs=[...mapa.keys()].sort(); if(!refs.length) return [];
  const numeroMes=(r:string)=>Number(r.slice(0,4))*12+Number(r.slice(5))-1;
  const pontos:LinhaMunicipal[]=[];
  for(let k=numeroMes(refs[0]);k<=numeroMes(refs.at(-1)!);k+=anual?12:1) {
    const r=`${Math.floor(k/12)}-${String(k%12+1).padStart(2,"0")}`;
    pontos.push(mapa.get(r)??{referencia:r,valor:null,extras:Array(INDICADORES_MUNICIPAIS[id].medidas.length-1).fill(null),atualizado:""});
  }
  return pontos;
}

export function serieMunicipalPublicavel(id:IndicadorMunicipal,pontos:LinhaMunicipal[],referencia:string):boolean {
  const minimo=INDICADORES_MUNICIPAIS[id].anual?2:12;
  return pontos.at(-1)?.referencia===referencia && pontos.length>=minimo && pontos.slice(-minimo).every(l=>linhaMunicipalValida(id,l));
}
