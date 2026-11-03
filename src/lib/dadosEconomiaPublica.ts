import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { sql } from "@/lib/db";
import { catalogoEconomia, type PaginaEconomia } from "@/lib/catalogoEconomia";
import { prepararSeriePublica, seriePublicavel, ultimaReferenciaPublica, type SeriePublica } from "@/app/prototipo/_dados/economiaModelo";

export type { SeriePublica } from "@/app/prototipo/_dados/economiaModelo";
interface LinhaPublica { codigo: string; nome: string; mes: string; valor: number | null; cv?: number | null; postos?: number | null; minimo?: number | null; maximo?: number | null; atualizado_em: string }
const opcoes = { revalidate: 3600, tags: ["painel-economia"] };
const nacional = unstable_cache(async () => {
  const rows = await sql`select '1' as codigo, 'Brasil' as nome, to_char(o.data,'YYYY-MM') as mes,
    case when o.valor between 0 and 100 then o.valor::float8 end as valor,
    to_char(s.atualizado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
    from observacao o join serie s on s.id=o.serie_id where o.serie_id='desemprego' order by o.data`;
  return rows as LinhaPublica[];
}, ["paginas-desemprego-nacional-v1"], opcoes);

const estadual = unstable_cache(async () => {
  const rows = await sql`select r.codigo_territorio as codigo, r.nome_territorio as nome,
    to_char(r.periodo_inicio,'YYYY-MM') as mes,
    case when r.valor between 0 and 100 then r.valor::float8 end as valor,
    cv.valor::float8 as cv,
    to_char(r.coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
    from mart.pnad_trimestral r left join mart.pnad_trimestral cv
      on cv.nivel=r.nivel and cv.codigo_territorio=r.codigo_territorio and cv.periodo=r.periodo and cv.medida_codigo=4103
    where r.medida_codigo=4099 and r.tipo_medida='taxa' and r.unidade='%' and r.nivel in ('N1','N3')
    order by r.periodo_inicio,r.codigo_territorio`;
  return rows as LinhaPublica[];
}, ["paginas-desemprego-estadual-v1"], opcoes);

const gasolina = unstable_cache(async () => {
  const [rows,territorios] = await Promise.all([sql`select case when p.nivel='brasil' then '1' else p.localidade end as codigo,
    case when p.nivel='brasil' then 'Brasil' else initcap(p.localidade) end as nome,
    to_char(p.mes,'YYYY-MM') as mes,
    case when p.preco_medio_revenda>0 then p.preco_medio_revenda::float8 end as valor,
    to_char(p.coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
    from mart.preco_combustivel_mensal p
    where p.produto='GASOLINA COMUM' and p.nivel in ('brasil','estados')
      and p.unidade='R$/l' and not coalesce(p.mes_em_andamento,false)
      and p.mes < date_trunc('month',(now() at time zone 'America/Sao_Paulo'))::date order by p.mes,p.localidade`,
    sql`select codigo,nome from observatorio.territorio where tipo='uf' and ativo order by codigo`]);
  const ufs = new Map((territorios as {codigo:string;nome:string}[]).map((u) => [nomeNormal(u.nome),u]));
  return (rows as LinhaPublica[]).map((r) => {
    const uf = ufs.get(nomeNormal(r.nome));
    return r.codigo === "1" ? r : uf ? {...r,codigo:uf.codigo,nome:uf.nome} : r;
  });
}, ["paginas-gasolina-v1"], opcoes);

// Por UF para compartilhar consultas sem ultrapassar o limite do cache do Next.
const gasolinaMunicipal = unstable_cache(async (uf: string) => {
  return await sql`select g.codigo_ibge as codigo,m.nome,to_char(g.mes,'YYYY-MM') as mes,
    case when g.preco_medio>0 and g.postos>0 then g.preco_medio::float8 end as valor,
    g.postos,g.preco_minimo::float8 as minimo,g.preco_maximo::float8 as maximo,
    to_char(g.coletado_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as atualizado_em
    from mart.gasolina_municipal g join mart.municipio m on m.codigo_ibge=g.codigo_ibge
    where m.codigo_uf=${uf} and g.mes<date_trunc('month',now() at time zone 'America/Sao_Paulo')
    order by g.mes,g.codigo_ibge` as LinhaPublica[];
}, ["paginas-gasolina-municipal-v1"], opcoes);

export interface ComparacaoTerritorial { codigo: string; nome: string; valor: number | null; diferenca: number | null; cv: number | null }
export interface DadosPaginaEconomia {
  pagina: PaginaEconomia;
  series: SeriePublica[];
  principal: SeriePublica;
  ultimo: { mes: string; valor: number };
  atualizadoEm: string;
  trimestral: boolean;
  fonte: string;
  fonteUrl: string;
  territorio: string;
  comparacao: ComparacaoTerritorial[];
  brasil: number | null;
  amostra?: { postos: number | null; minimo: number | null; maximo: number | null };
}

const nomeNormal = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Cache por fonte, compartilhado por todas as páginas; nunca uma consulta por território. */
export const carregarPaginaEconomia = cache(async (pagina: PaginaEconomia): Promise<DadosPaginaEconomia | null> => {
  if (pagina.propria) return null;
  const uf = pagina.territorio?.uf;
  const rows = uf ? [...await gasolina(), ...await gasolinaMunicipal(uf.codigo)] : await (pagina.id === "gasolina" ? gasolina() : pagina.id === "estados" ? estadual() : nacional());
  const trimestral = pagina.id === "estados";
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const grupos = new Map<string, LinhaPublica[]>();
  for (const r of rows) { const g = grupos.get(r.codigo) ?? []; g.push(r); grupos.set(r.codigo, g); }
  let series: SeriePublica[] = [...grupos].map(([codigo, rs]) => ({ codigo, nome: rs[0].nome, pontos: prepararSeriePublica(rs.map((r) => ({ mes: r.mes, valor: r.valor })), trimestral, hoje) }));
  const brasilSerie = series.find((s) => s.codigo === "1");
  const principal = pagina.territorio
    ? series.find((s) => s.codigo === pagina.territorio!.codigo)
    : brasilSerie;
  if (!principal || (pagina.territorio && nomeNormal(principal.nome) !== nomeNormal(pagina.territorio.nome)) || !seriePublicavel(principal.pontos, pagina.minimoPontos)) return null;
  const ultimo = ultimaReferenciaPublica(principal.pontos);
  if (!ultimo || ultimo.valor === null) return null;
  // O município precisa acompanhar a última referência do agregado nacional.
  if (uf && ultimo.mes !== ultimaReferenciaPublica(brasilSerie?.pontos ?? [])?.mes) return null;
  const brasil = brasilSerie?.pontos.find((p) => p.mes === ultimo.mes)?.valor ?? null;
  const comparacao = series.filter((s) => s.codigo.length === 2).map((s) => {
    const valor = s.pontos.find((p) => p.mes === ultimo.mes)?.valor ?? null;
    const mesInicio = trimestral ? `${ultimo.mes.slice(0, 4)}-${String(Number(ultimo.mes.slice(5, 7)) - 2).padStart(2, "0")}` : ultimo.mes;
    const cv = grupos.get(s.codigo)?.find((r) => r.mes === mesInicio)?.cv ?? null;
    return { codigo: s.codigo, nome: s.nome, valor, diferenca: valor !== null && brasil !== null ? valor - brasil : null, cv };
  }).sort((a, b) => (a.valor ?? Infinity) - (b.valor ?? Infinity) || a.nome.localeCompare(b.nome,"pt-BR"));
  if (pagina.territorio) series = [principal];
  const usados = rows.filter((r) => r.codigo === principal.codigo && r.mes <= ultimo.mes);
  const atualizadoEm = usados.map((r) => r.atualizado_em).sort().at(-1);
  const ultimaLinha = usados.find((r) => r.mes === ultimo.mes);
  if (!atualizadoEm || !Number.isFinite(new Date(atualizadoEm).getTime())) throw new Error("Data de atualização ausente na fonte.");
  return {
    pagina, series, principal, ultimo: { mes: ultimo.mes, valor: ultimo.valor }, atualizadoEm, trimestral,
    fonte: pagina.id === "gasolina" ? "ANP, Levantamento de Preços de Combustíveis" : "IBGE, PNAD Contínua",
    fonteUrl: pagina.id === "gasolina" ? "https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos" : pagina.id === "estados" ? "https://sidra.ibge.gov.br/tabela/4099" : "https://sidra.ibge.gov.br/tabela/6381",
    territorio: pagina.territorio?.nome ?? "Brasil", comparacao, brasil,
    ...(uf ? {amostra:{postos:ultimaLinha?.postos ?? null,minimo:ultimaLinha?.minimo ?? null,maximo:ultimaLinha?.maximo ?? null}} : {}),
  };
});

export const paginasEconomiaPublicaveis = cache(async () => {
  // Preenche o cache por fonte/UF antes do próximo recorte, sem consultas idênticas simultâneas.
  const paginas: PaginaEconomia[] = [];
  for (const p of catalogoEconomia()) {
    if (p.propria || await carregarPaginaEconomia(p)) paginas.push(p);
  }
  return paginas;
});
