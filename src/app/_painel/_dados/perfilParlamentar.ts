import { unstable_cache } from "next/cache";

import { sql } from "@/lib/db";

import type { CasaCongresso, PerfilParlamentar } from "./congressoModelo";
import fotografia from "./fotografia.json";

/** Emendas Pix a partir desta legislatura: nome parlamentar igual ao da fotografia não confunde com homônimos antigos. */
const PRIMEIRO_ANO_EMENDAS = 2023;
const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

const emendasPorNome = unstable_cache(async () => {
  const linhas = (await sql`select nome_parlamentar_emenda_plano_acao as nome, ano_plano_acao::int as ano,
      sum(coalesce(valor_custeio_plano_acao, 0) + coalesce(valor_investimento_plano_acao, 0))::float8 as valor, count(*)::int as planos
    from mart.transferegov_plano_acao_especial
    where ano_plano_acao >= ${PRIMEIRO_ANO_EMENDAS} and nome_parlamentar_emenda_plano_acao is not null
    group by 1, 2`) as { nome: string; ano: number; valor: number; planos: number }[];
  return linhas.map(l => [l.nome, l.ano, Math.round(l.valor), l.planos] as const);
}, ["congresso-emendas-por-nome-v2"], { revalidate: 3600, tags: ["painel-economia"] });

/** Ano em que começa a legislatura (a 57ª começou em 2023). */
const inicioDaLegislatura = (l: number) => 1795 + 4 * l;

async function perfilSemCache(casa: CasaCongresso, id: number): Promise<PerfilParlamentar | null> {
  const pessoa = fotografia[casa].find(p => p.id === id);
  if (!pessoa) return null;
  const casaBanco = casa === "deputados" ? "camara" : "senado";
  const [cadastros, periodos, emendas] = await Promise.all([
    sql`select nome_civil, to_char(nascimento, 'YYYY-MM-DD') as nascimento, naturalidade_municipio, naturalidade_uf, escolaridade
      from mart.parlamentar_cadastro where casa = ${casaBanco} and parlamentar_id = ${id} limit 1`,
    casa === "deputados"
      ? sql`select legislatura::int as inicio, legislatura::int as fim from mart.deputado_federal_intervalo where deputado_id = ${id} group by legislatura order by legislatura`
      : sql`select extract(year from inicio_previsto)::int as inicio, extract(year from fim_previsto)::int as fim
          from mart.parlamentar_mandato where casa = 'senado' and parlamentar_id = ${id} order by inicio_previsto`,
    emendasPorNome(),
  ]);
  const c = cadastros[0] as { nome_civil: string | null; nascimento: string | null; naturalidade_municipio: string | null; naturalidade_uf: string | null; escolaridade: string | null } | undefined;
  const p = periodos as { inicio: number; fim: number }[];
  const trajetoria = p.length ? casa === "deputados"
    ? { periodos: p.length, desde: inicioDaLegislatura(p[0].inicio), ate: inicioDaLegislatura(p[p.length - 1].fim) + 4 }
    : { periodos: p.length, desde: p[0].inicio, ate: p[p.length - 1].fim }
    : null;
  const chave = normalizar(pessoa.nome);
  const minhas = emendas.filter(([nome]) => normalizar(nome) === chave);
  return {
    nomeCivil: c?.nome_civil ?? null,
    nascimento: c?.nascimento ?? null,
    naturalidade: c?.naturalidade_municipio ? `${c.naturalidade_municipio}${c.naturalidade_uf ? ` (${c.naturalidade_uf})` : ""}` : null,
    escolaridade: c?.escolaridade ?? null,
    trajetoria,
    emendas: minhas.length ? { nome: minhas[0][0], anos: minhas.map(([, ano, valor, planos]) => ({ ano, valor, planos })).sort((a, b) => a.ano - b.ano) } : null,
  };
}

export const carregarPerfilParlamentar = unstable_cache(perfilSemCache, ["congresso-perfil-v2"], { revalidate: 3600, tags: ["painel-congresso"] });
