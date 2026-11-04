import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { buscarHubEconomia, tituloHub, resumoHub } from "@/lib/hubsEconomia";

const capas: Record<string, [string,string]> = {
  '/': ['O Brasil em dados,\ngoverno a governo.', 'Indicadores oficiais, séries históricas e comparações entre mandatos e territórios.'],
  '/economia': ['Economia do Brasil', 'Preços, renda, trabalho e indicadores dos estados e municípios.'],
  '/meio-ambiente': ['Meio ambiente', 'Desmatamento, queimadas e fiscalização, com fontes do INPE e do Ibama.'],
  '/dinheiro': ['Dinheiro público', 'Explore o orçamento e as transferências, com fontes e períodos identificados.'],
  '/metodologia': ['Como lemos os dados', 'Fontes, critérios e limites das comparações. A mesma régua para todos os governos.'],
  '/sobre': ['Sobre o projeto', 'Dados públicos organizados para compreender o Brasil. Conheça os critérios e a política editorial.'],
  '/correcoes': ['Ajude a conferir os dados', 'Encontrou um erro? Registre o problema para análise, sem informar dados pessoais.'],
  '/economia/municipios': ['O Brasil, município\npor município.', 'População, emprego formal e programas sociais, com histórico e fontes oficiais.'],
};

export const revalidate = 3600;
export async function GET(request: Request) {
  const caminho = new URL(request.url).searchParams.get('pagina') ?? '/';
  if (capas[caminho]) return imagemCompartilhamento({ titulo: capas[caminho][0], descricao: capas[caminho][1] });
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
