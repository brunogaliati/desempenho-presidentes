import { idCompartilhavel } from "@/lib/compartilhamento";

/** Só títulos editoriais conhecidos podem entrar na capa; nunca texto livre da URL. */
const SECOES = {
  economia: {
    'historico-serie': ['Histórico do indicador', 'Série histórica com o período e a visualização selecionados.'],
    'governo-a-governo': ['Economia governo a governo', 'Inflação, desemprego, dólar, dívida e outros indicadores na mesma régua. Abra a tabela com os filtros compartilhados.'],
    'estados': ['Indicadores econômicos por estado', 'Compare os estados, as referências e a variação desde a posse na tabela.'],
    'emprego-e-credito': ['Emprego com carteira', 'Saldo, admissões e desligamentos do emprego formal, com fonte e referência no painel.'],
    'bloco-credito-e-inadimplencia': ['Crédito e inadimplência', 'Crédito, juros e inadimplência de pessoas físicas e jurídicas. Abra o recorte selecionado.'],
    'bloco-ritmo-no-mandato': ['Ritmo no mandato', 'Compare o ritmo do indicador entre os mandatos. O link preserva a série selecionada.'],
    'bloco-governadores-por-partido': ['Governadores por partido', 'Veja a distribuição dos governos estaduais por partido e os estados de cada grupo.'],
    'bloco-brasil-e-o-mundo': ['Brasil e o mundo', 'Compare o Brasil com outras regiões, nas médias e referências apresentadas no painel.'],
    'bloco-ultimos-dados': ['Últimos dados', 'Consulte as divulgações recentes, com as referências e fontes de cada indicador.'],
    'fontes': ['Fontes dos indicadores econômicos', 'Consulte as fontes, referências e arquivos para download dos indicadores do painel.'],
  },
  ambiente: {
    'historico-serie': ['Histórico do indicador ambiental', 'Série histórica com o período e a visualização selecionados.'],
    'mapa-ambiente': ['Meio ambiente no mapa', 'Explore desmatamento, fogo, áreas protegidas e fiscalização. O link abre o mapa com os filtros compartilhados.'],
    'biomas': ['Indicadores dos biomas', 'Compare desmatamento, fogo e áreas protegidas nos biomas, respeitando as referências de cada fonte.'],
    'temporada': ['Temporada do fogo', 'Compare os focos de calor acumulados por mês com as temporadas anteriores, segundo o INPE.'],
    'protegidas': ['Desmatamento em áreas protegidas', 'Veja as séries de Terras Indígenas e Unidades de Conservação, e os territórios com maior área desmatada.'],
    'municipios': ['Onde se desmata e o que o Ibama fez lá', 'Consulte a tabela municipal de desmatamento e fiscalização, com referências e limites das fontes.'],
    'estados': ['Meio ambiente por estado', 'Compare os estados nos indicadores ambientais, com a referência e a fonte de cada medida.'],
    'fontes': ['Fontes dos indicadores ambientais', 'Consulte os dados do INPE e do Ibama, suas referências e limites.'],
    'bloco-ritmo-no-mandato': ['Ritmo ambiental no mandato', 'Compare o ritmo do indicador ambiental entre os governos. O link preserva a série selecionada.'],
  },
  dinheiro: {
    'orcamento': ['Para onde vai cada R$ 100', 'Explore a distribuição do orçamento por função e abra os valores e fontes de cada despesa.'],
    'orcamento-detalhe': ['Orçamento: detalhe da despesa', 'Abra a despesa selecionada para consultar valores, participação no orçamento e evolução.'],
    'ano-a-ano': ['Orçamento ano a ano', 'Compare a distribuição das despesas ao longo dos anos.'],
    'de-onde-veio': ['De onde veio o dinheiro público', 'Consulte as receitas da União, com valores e referência do orçamento.'],
    'emendas': ['Emendas Pix', 'Consulte os valores dos planos de ação de transferências especiais. Não representam necessariamente execução de obras.'],
    'todas-as-linhas': ['Todas as linhas do orçamento', 'Consulte a tabela de despesas, participação no orçamento e valores por habitante.'],
    'fontes-dinheiro': ['Fontes e limites do orçamento', 'Consulte as fontes do Tesouro, Siconfi e Transferegov e os limites das comparações.'],
  },
} satisfies Record<string, Record<string, readonly [string, string]>>;

export type TemaDeSecao = keyof typeof SECOES;

const FILTROS = ['serie','leitura','faixa','historico.tabela','comparar','partido','bioma','municipio','estados.modo','estados.ordem','fiscalizacao.modo','credito.pessoa','protegidas.tipo','protegidas.ano','mapa.lente','mapa.modo','mapa.recorte','mapa.anos','mapa.regiao','mapa.area','ano','orcamento.item','orcamento.familia','emendas.busca','emendas.modo','emendas.detalhe','emendas.pagina','emendas.plano'];
export function filtrosDaSecao(q: URLSearchParams): Record<string, string> {
  const secao=q.get('painel')??q.get('secao');
  const grupos:Record<string,string[]>={
    'governo-a-governo':['comparar'],estados:['estados.modo','estados.ordem'],biomas:['fiscalizacao.modo','bioma'],protegidas:['protegidas.tipo','protegidas.ano'],municipios:['bioma'],
    'de-perto':['serie','leitura','faixa','historico.tabela'],'historico-serie':['serie','leitura','faixa','historico.tabela'],
    'bloco-credito-e-inadimplencia':['credito.pessoa'],'bloco-ritmo-no-mandato':['serie','leitura'],
    orcamento:['ano','orcamento.familia'], 'orcamento-detalhe':['ano','orcamento.item'],
    emendas:['ano','emendas.busca','emendas.modo','emendas.detalhe','emendas.pagina','emendas.plano'],
    'ano-a-ano':['ano'],'de-onde-veio':['ano'],'todas-as-linhas':['ano'],'fontes-dinheiro':['ano'],
    'mapa-ambiente':['bioma','municipio','mapa.lente','mapa.modo','mapa.recorte','mapa.anos','mapa.regiao','mapa.area'],
  };
  const chaves=secao===null?FILTROS:Object.hasOwn(grupos,secao)?grupos[secao]:[];
  return Object.fromEntries(chaves.flatMap((id) => {
    const chave = `r.${id}`, v = q.get(chave);
    return v !== null && v.length <= 512 ? [[chave, v]] : [];
  }));
}

export function secaoCompartilhada(tema: TemaDeSecao, id: string, uf?: string | null): readonly [string, string] | null {
  const secoes = SECOES[tema] as Record<string, readonly [string, string]>;
  const secao = Object.hasOwn(secoes, id) ? secoes[id] : null;
  if (secao) return secao;
  if (tema === 'economia' && uf && id === idCompartilhavel(`Quem governou ${uf}`)) return [`Quem governou ${uf}`, 'Consulte os governadores e partidos ao longo dos mandatos do estado.'];
  if (tema === 'economia' && /^(bloco-orcamento-federal|bloco-orcamento-federal-em-\d{4})$/.test(id)) return ['Orçamento federal', 'Consulte receitas, despesas e resultado do orçamento federal, com as referências do painel.'];
  return null;
}
