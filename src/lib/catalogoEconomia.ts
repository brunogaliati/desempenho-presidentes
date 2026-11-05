import { MUNICIPIOS_GASOLINA } from "./municipiosGasolina.ts";

export const ROTA_SALARIO = "/economia/salario-minimo";
export const ROTA_INFLACAO = "/economia/inflacao";

export interface PaginaEconomia {
  id: "salario" | "inflacao" | "desemprego" | "gasolina" | "estados";
  slug: string;
  titulo: string;
  rotulo: string;
  minimoPontos: number;
  propria?: boolean;
  territorio?: { codigo: string; nome: string; localizacao: string; uf?: { codigo: string; nome: string; sigla: string; slug: string } };
}

/** Cadastro editorial: uma URL por intenção, independente das opções do gráfico. */
export const PAGINAS_ECONOMIA: PaginaEconomia[] = [
  { id: "salario", slug: "salario-minimo", titulo: "Salário mínimo: valor, reajuste e poder de compra", rotulo: "Salário mínimo", minimoPontos: 12, propria: true },
  { id: "inflacao", slug: "inflacao", titulo: "IPCA acumulado: inflação em 12 meses, no ano e mês a mês", rotulo: "Inflação", minimoPontos: 12, propria: true },
  { id: "desemprego", slug: "desemprego", titulo: "Taxa de desemprego no Brasil: último dado e histórico", rotulo: "Desemprego", minimoPontos: 12 },
  { id: "gasolina", slug: "gasolina", titulo: "Preço da gasolina: média mensal, histórico e comparação por estado", rotulo: "Gasolina", minimoPontos: 12 },
  { id: "estados", slug: "desemprego/estados", titulo: "Desemprego por estado: taxas, comparação e evolução", rotulo: "Desemprego por estado", minimoPontos: 4 },
];

export interface RecortePublicado {
  indicador: "gasolina" | "desemprego";
  codigo: string;
  nome: string;
  slug: string;
  localizacao?: string;
  uf?: { codigo: string; nome: string; sigla: string; slug: string };
}

/** UFs revisadas nas duas fontes; ordem alfabética para a navegação. */
const UFS_PUBLICADAS: Omit<RecortePublicado, "indicador">[] = [
  { codigo: "12", nome: "Acre", slug: "acre", localizacao: "no Acre" },
  { codigo: "27", nome: "Alagoas", slug: "alagoas", localizacao: "em Alagoas" },
  { codigo: "16", nome: "Amapá", slug: "amapa", localizacao: "no Amapá" },
  { codigo: "13", nome: "Amazonas", slug: "amazonas", localizacao: "no Amazonas" },
  { codigo: "29", nome: "Bahia", slug: "bahia", localizacao: "na Bahia" },
  { codigo: "23", nome: "Ceará", slug: "ceara", localizacao: "no Ceará" },
  { codigo: "53", nome: "Distrito Federal", slug: "distrito-federal", localizacao: "no Distrito Federal" },
  { codigo: "32", nome: "Espírito Santo", slug: "espirito-santo", localizacao: "no Espírito Santo" },
  { codigo: "52", nome: "Goiás", slug: "goias", localizacao: "em Goiás" },
  { codigo: "21", nome: "Maranhão", slug: "maranhao", localizacao: "no Maranhão" },
  { codigo: "51", nome: "Mato Grosso", slug: "mato-grosso", localizacao: "em Mato Grosso" },
  { codigo: "50", nome: "Mato Grosso do Sul", slug: "mato-grosso-do-sul", localizacao: "em Mato Grosso do Sul" },
  { codigo: "31", nome: "Minas Gerais", slug: "minas-gerais", localizacao: "em Minas Gerais" },
  { codigo: "15", nome: "Pará", slug: "para", localizacao: "no Pará" },
  { codigo: "25", nome: "Paraíba", slug: "paraiba", localizacao: "na Paraíba" },
  { codigo: "41", nome: "Paraná", slug: "parana", localizacao: "no Paraná" },
  { codigo: "26", nome: "Pernambuco", slug: "pernambuco", localizacao: "em Pernambuco" },
  { codigo: "22", nome: "Piauí", slug: "piaui", localizacao: "no Piauí" },
  { codigo: "33", nome: "Rio de Janeiro", slug: "rio-de-janeiro", localizacao: "no estado do Rio de Janeiro" },
  { codigo: "24", nome: "Rio Grande do Norte", slug: "rio-grande-do-norte", localizacao: "no Rio Grande do Norte" },
  { codigo: "43", nome: "Rio Grande do Sul", slug: "rio-grande-do-sul", localizacao: "no Rio Grande do Sul" },
  { codigo: "11", nome: "Rondônia", slug: "rondonia", localizacao: "em Rondônia" },
  { codigo: "14", nome: "Roraima", slug: "roraima", localizacao: "em Roraima" },
  { codigo: "42", nome: "Santa Catarina", slug: "santa-catarina", localizacao: "em Santa Catarina" },
  { codigo: "35", nome: "São Paulo", slug: "sao-paulo", localizacao: "no estado de São Paulo" },
  { codigo: "28", nome: "Sergipe", slug: "sergipe", localizacao: "em Sergipe" },
  { codigo: "17", nome: "Tocantins", slug: "tocantins", localizacao: "no Tocantins" },
];

const LOCAL_UF = new Map(UFS_PUBLICADAS.map((u) => [u.slug, u.localizacao ?? `em ${u.nome}`]));
/** "na Bahia", "em Goiás", "no estado de São Paulo". */
export const ufEm = (uf: { slug: string; nome: string }) => LOCAL_UF.get(uf.slug) ?? `em ${uf.nome}`;
/** "da Bahia", "de Goiás", "do estado de São Paulo". */
export const ufDe = (uf: { slug: string; nome: string }) => ufEm(uf).replace(/^no /, "do ").replace(/^na /, "da ").replace(/^em /, "de ");
/** "para a Bahia", "para Goiás", "para o estado de São Paulo". */
export const ufPara = (uf: { slug: string; nome: string }) => ufEm(uf).replace(/^no /, "para o ").replace(/^na /, "para a ").replace(/^em /, "para ");

/** Expansão aprovada das duas famílias. O carregador ainda exige cobertura real por UF. */
export const RECORTES_PUBLICADOS: RecortePublicado[] = [
  ...UFS_PUBLICADAS.flatMap((uf) => (["gasolina", "desemprego"] as const).map((indicador) => ({ ...uf, indicador }))),
  ...MUNICIPIOS_GASOLINA.map((m) => ({ ...m, indicador: "gasolina" as const, localizacao: `no município de ${m.nome} (${m.uf.sigla})` })),
];

export const rotaEconomia = (pagina: Pick<PaginaEconomia, "slug">) => `/economia/${pagina.slug}`;

export function catalogoEconomia(recortes: RecortePublicado[] = RECORTES_PUBLICADOS): PaginaEconomia[] {
  const paginas = [...PAGINAS_ECONOMIA];
  for (const r of recortes) {
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(r.slug) || r.slug === "estados" || !/^\d{2}(?:\d{5})?$/.test(r.codigo) || !r.nome.trim()) throw new Error("Recorte territorial inválido.");
    if ((r.codigo.length === 7 && !r.uf) || (r.uf && (r.indicador !== "gasolina" || !/^\d{7}$/.test(r.codigo) || r.codigo.slice(0,2) !== r.uf.codigo || !/^[A-Z]{2}$/.test(r.uf.sigla) || !UFS_PUBLICADAS.some((uf) => uf.codigo === r.uf!.codigo && uf.nome === r.uf!.nome && uf.slug === r.uf!.slug)))) throw new Error("Recorte municipal inválido.");
    const base = PAGINAS_ECONOMIA.find((p) => p.id === (r.indicador === "gasolina" ? "gasolina" : "estados"))!;
    const localizacao = r.localizacao ?? `em ${r.nome}`;
    paginas.push({ ...base, slug: `${r.indicador}/${r.uf ? `${r.uf.slug}/` : ""}${r.slug}`, titulo: r.uf ? `Preço da gasolina em ${r.nome} (${r.uf.sigla}): média mensal e histórico` : `${r.indicador === "gasolina" ? "Preço da gasolina" : "Taxa de desemprego"} ${localizacao}: histórico e comparação`, rotulo: r.nome, territorio: { codigo: r.codigo, nome: r.nome, localizacao, ...(r.uf ? {uf:r.uf} : {}) } });
  }
  if (new Set(paginas.map((p) => p.slug)).size !== paginas.length) throw new Error("URL duplicada no catálogo de economia.");
  if (new Set(recortes.map((r) => `${r.indicador}:${r.codigo}`)).size !== recortes.length) throw new Error("Território duplicado para o mesmo indicador.");
  return paginas;
}

export function buscarPaginaEconomia(segmentos: string[], recortes = RECORTES_PUBLICADOS) {
  return catalogoEconomia(recortes).find((p) => p.slug === segmentos.join("/")) ?? null;
}

