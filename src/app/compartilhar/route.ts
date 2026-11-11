import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { UFS_MUNICIPAIS, buscarMunicipioCaminho } from "@/lib/catalogoMunicipal";
import { buscarHubEconomia, tituloHub, resumoHub } from "@/lib/hubsEconomia";
import { imagemEmCache } from "@/lib/imagemEmCache";

const capas: Record<string, [string,string]> = {
  '/resumo': ['Resumo do governo', 'Segurança, educação, saúde, contas públicas e política do Brasil e dos estados, com fontes oficiais.'],
  '/resumo/municipios': ['Resumo por município', 'Indicadores locais, hospitais, leitos SUS e contas municipais, com períodos e fontes oficiais.'],
  '/': ['Resumo do governo', 'Segurança, educação, saúde, contas públicas e política do Brasil e dos estados, com fontes oficiais.'],
  '/economia': ['O Brasil em dados,\ngoverno a governo.', 'Indicadores oficiais, séries históricas e comparações entre mandatos e territórios.'],
  '/explorar': ['Explorar dados', 'Presidentes, indicadores, estados e municípios. Encontre históricos e fontes oficiais.'],
  '/meio-ambiente': ['Meio ambiente', 'Desmatamento, queimadas e fiscalização, com fontes do INPE e do Ibama.'],
  '/dinheiro': ['Orçamento público', 'Explore o orçamento e as transferências, com fontes e períodos identificados.'],
  '/congresso': ['Congresso Nacional', 'Deputados federais e senadores por estado, partido e nome. Consulte a referência do cadastro e as fontes oficiais.'],
  '/metodologia': ['Como lemos os dados', 'Fontes, critérios e limites das comparações. A mesma régua para todos os governos.'],
  '/sobre': ['Sobre o projeto', 'Dados públicos organizados para compreender o Brasil. Conheça os critérios e a política editorial.'],
  '/correcoes': ['Ajude a conferir os dados', 'Encontrou um erro? Registre o problema para análise, sem informar dados pessoais.'],
  '/economia/municipios': ['O Brasil, município\npor município.', 'População, emprego formal e programas sociais, com histórico e fontes oficiais.'],
};

export const revalidate = 3600;
export function GET(request: Request) {
  return imagemEmCache(request, () => gerar(request));
}

async function gerar(request: Request) {
  const caminho = new URL(request.url).searchParams.get('pagina') ?? '/';
  if (capas[caminho]) return imagemCompartilhamento({ titulo: capas[caminho][0], descricao: capas[caminho][1] });
  const resumoMunicipal = caminho.match(/^\/resumo\/municipios\/([^/]+)\/([^/]+)$/);
  if (resumoMunicipal) {
    const m = buscarMunicipioCaminho(resumoMunicipal[1],resumoMunicipal[2]);
    if (m) return imagemCompartilhamento({titulo:`Resumo de ${m.nome} (${m.uf.sigla})`,descricao:'Indicadores locais, hospitais e leitos SUS e contas municipais, com períodos e fontes oficiais.',uf:m.uf.codigo});
  }
  const diretorio = caminho.match(/^\/economia\/municipios\/([^/]+)$/);
  if (diretorio) {
    const uf = UFS_MUNICIPAIS.find(u => u.slug === diretorio[1]);
    if (uf) return imagemCompartilhamento({titulo:`Municípios de ${uf.nome}`,descricao:'Encontre indicadores e séries históricas do seu município, com referência e fonte.',uf:uf.codigo});
  }
  if (caminho.startsWith('/economia/')) {
    const hub = await buscarHubEconomia(caminho.slice('/economia/'.length));
    if (hub) return imagemCompartilhamento({titulo:tituloHub(hub),descricao:resumoHub(hub)});
  }
  return new Response(null,{status:404,headers:{'X-Robots-Tag':'noindex'}});
}
