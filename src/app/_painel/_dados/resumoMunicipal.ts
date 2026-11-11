import "server-only";
import { unstable_cache } from "next/cache";
import { sql } from "@/lib/db";
import { carregarIndicadorMunicipal } from "@/lib/dadosIndicadoresMunicipais";
import { carregarRedeSaude } from "@/lib/dadosRedeSaude";
import { comSinal, numero } from "@/lib/formatar";
import { INDICADORES_MUNICIPAIS, idsMunicipais, rotaMunicipal, rotuloReferenciaMunicipal, type IndicadorMunicipal, type MunicipioIndicadores } from "@/lib/indicadoresMunicipais";
import { linhasRedeSaude } from "@/lib/redeSaudeModelo";
import { caminhoResumoMunicipal, normalizarNomeMunicipal, recorteMunicipal } from "@/lib/resumoMunicipalModelo";
import fotosPrefeitos from "@/lib/fotosPrefeitos.json";
import type { Eleicao, LinhaResumo } from "./resumoModelo";
import { focoDaGestao, gestoesMunicipais, PRIMEIRA_GESTAO, type DadosResumoMunicipal, type EleitoMunicipal, type GestaoMunicipal } from "./resumoMunicipalModelo";

const DETALHE: Record<IndicadorMunicipal, string> = {
  populacao: "estimativa anual · IBGE",
  "emprego-formal": "vínculos formais · Novo Caged",
  cadunico: "famílias cadastradas · Seade/MDS",
  bpc: "pessoas beneficiárias · Seade/MDS",
};
const FOTOS = new Map(Object.entries(fotosPrefeitos as Record<string, string[]>).map(([ano, ids]) => [ano, new Set(ids)]));
const RETRATO: Record<IndicadorMunicipal, string> = {
  populacao: "habitantes",
  "emprego-formal": "empregos formais",
  cadunico: "famílias no CadÚnico",
  bpc: "pessoas com BPC",
};

/**
 * O TSE identifica o município por um código próprio, que não é o do IBGE. O nome,
 * dentro da UF, faz a ponte; só vale se apontar para uma unidade só.
 */
const unidadesDaUf = unstable_cache(
  async (uf: string) =>
    (await sql`select distinct unidade_tse, nome_unidade from mart.eleitos_tse
      where uf=${uf} and cargo='PREFEITO' and ano_eleicao>=${PRIMEIRA_GESTAO - 1}`) as { unidade_tse: string; nome_unidade: string }[],
  ["resumo-municipal-unidades-v1"],
  { revalidate: 3600 * 24 },
);

const eleicoesDaUnidade = unstable_cache(
  async (uf: string, unidade: string) => {
    const [executivo, camara] = (await Promise.all([
      // O último resultado de cada ano: a eleição suplementar do ano substitui a regular.
      sql`select distinct on (ano_eleicao, cargo) ano_eleicao::int as ano, cargo, nome, nome_urna, partido_sigla as partido,
            to_char(data_eleicao,'YYYY-MM-DD') as data, tipo_eleicao ilike '%suplementar%' as suplementar, candidato_id::text as candidato
          from mart.eleitos_tse
         where uf=${uf} and unidade_tse=${unidade} and cargo in ('PREFEITO','VICE-PREFEITO')
           and ano_eleicao>=${PRIMEIRA_GESTAO - 1} and resultado like 'ELEITO%' and data_eleicao<=current_date
         order by ano_eleicao, cargo, data_eleicao desc, turno desc`,
      // Um vereador por linha: o arquivo pode repetir o candidato.
      sql`select ano, partido, count(*)::int as n from (
            select distinct on (ano_eleicao, coalesce(candidato_id::text, nome)) ano_eleicao::int as ano, partido_sigla as partido
              from mart.eleitos_tse
             where uf=${uf} and unidade_tse=${unidade} and cargo='VEREADOR' and ano_eleicao>=${PRIMEIRA_GESTAO - 1}
               and resultado like 'ELEITO%' and tipo_eleicao not ilike '%suplementar%'
             order by ano_eleicao, coalesce(candidato_id::text, nome), turno desc) x
          group by 1, 2`,
    ])) as [
      { ano: number; cargo: string; nome: string; nome_urna: string | null; partido: string | null; data: string; suplementar: boolean; candidato: string | null }[],
      { ano: number; partido: string; n: number }[],
    ];
    return { executivo, camara };
  },
  ["resumo-municipal-eleicoes-v2"],
  { revalidate: 3600 },
);

/** "RICARDO NUNES" vira "Ricardo Nunes"; preposições ficam minúsculas. */
function nomeProprio(nome: string): string {
  return nome
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((p, i) => (i > 0 && /^(da|das|de|do|dos|e)$/.test(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

/**
 * Onde a grafia do TSE e a do IBGE não batem em eleição alguma: código IBGE → unidade TSE.
 * Conferido à mão; a mesma tabela, ao contrário, está em backend/desempenho/prefeitos_fotos.py.
 */
const UNIDADE_TSE: Record<string, string> = {
  "2905602": "34118", // Camacan · CAMACÃ
  "3105509": "41092", // Barão do Monte Alto · BARÃO DE MONTE ALTO
  "3122900": "44571", // Dona Euzébia · DONA EUSÉBIA
  "3165206": "53031", // São Tomé das Letras · SÃO THOMÉ DAS LETRAS
  "5107800": "91553", // Santo Antônio de Leverger · SANTO ANTÔNIO DO LEVERGER
  "1502954": "04120", // Eldorado do Carajás · ELDORADO DOS CARAJÁS
  "1506500": "05290", // Santa Izabel do Pará · SANTA ISABEL DO PARÁ
  "2405306": "17035", // Januário Cicco · BOA SAÚDE
  "1100098": "00256", // Espigão D'Oeste · ESPIGÃO DO OESTE
  "1100346": "00337", // Alvorada D'Oeste · ALVORADA DO OESTE
  "1400605": "03158", // São Luiz do Anauá · SÃO LUIZ
  "2800100": "31011", // Amparo do São Francisco · AMPARO DE SÃO FRANCISCO
  "3550001": "71013", // São Luiz do Paraitinga · SÃO LUÍS DO PARAITINGA
};

async function eleicoes(m: MunicipioIndicadores) {
  const fixa = UNIDADE_TSE[m.codigo];
  if (fixa) return eleicoesDaUnidade(m.uf.sigla, fixa);
  const alvo = normalizarNomeMunicipal(m.nome);
  const unidades = [...new Set((await unidadesDaUf(m.uf.sigla)).filter((u) => normalizarNomeMunicipal(u.nome_unidade) === alvo).map((u) => u.unidade_tse))];
  if (unidades.length !== 1) return null;
  return eleicoesDaUnidade(m.uf.sigla, unidades[0]);
}

function linhaIndicador(id: IndicadorMunicipal, m: MunicipioIndicadores, d: Awaited<ReturnType<typeof carregarIndicadorMunicipal>>, ano: number): LinhaResumo {
  const cfg = INDICADORES_MUNICIPAIS[id];
  const rot = (r: string) => rotuloReferenciaMunicipal(r, cfg.anual);
  const { base, atual } = recorteMunicipal(id, d?.pontos ?? [], ano);
  const de = base?.valor ?? null, para = atual?.valor ?? null;
  const pct = de && para !== null ? (para / de - 1) * 100 : null;
  const ultimoMes = id === "emprego-formal" && atual
    ? `Em ${rot(atual.referencia)}: ${numero(atual.extras[0], 0)} admissões, ${numero(atual.extras[1], 0)} desligamentos, saldo de ${comSinal(atual.extras[2] ?? 0, 0)}.`
    : null;
  // Milhões de habitantes não cabem no eixo: acima de 100 mil, o gráfico conta em milhares.
  const valores = d?.pontos.map((p) => p.valor) ?? [];
  const mil = Math.max(0, ...valores.filter((v): v is number => v !== null)) >= 100_000;
  return {
    id: `mun-${id}`,
    nome: cfg.nome,
    detalhe: DETALHE[id],
    de: de === null ? null : numero(de, 0),
    para: para === null ? null : numero(para, 0),
    mudanca: pct === null ? null : `${comSinal(pct, 1)}%`,
    sentido: "neutro",
    brasil: null,
    comparacao: null,
    periodo: atual ? `${rot(atual.referencia)}${base && de !== null && para !== null ? ` contra ${rot(base.referencia)}: ${comSinal(para - de, 0)} ${cfg.unidade}` : ""}` : "",
    falta: !d ? "A consulta não trouxe dados agora." : para === null ? "Sem referência válida nesta gestão." : de === null ? "Sem referência válida antes da posse." : undefined,
    fonte: `${cfg.fonte}${d ? ` · coleta ${d.atualizado.slice(0, 10)}` : ""}`,
    urlFonte: cfg.url,
    nota: [ultimoMes, ...cfg.limites.slice(0, 2)].filter(Boolean).join(" "),
    grafico: d && d.pontos.length > 1
      ? {
          series: [{ rotulo: m.nome, datas: d.pontos.map((p) => p.referencia), valores: mil ? valores.map((v) => (v === null ? null : v / 1000)) : valores, principal: true }],
          casas: 0,
          sufixo: mil ? " mil" : "",
          titulo: `${cfg.medidas[0]} · ${cfg.unidade}${mil ? ", em milhares" : ""}`,
          pontos: cfg.anual || undefined,
        }
      : null,
  };
}

export async function carregarResumoMunicipalPainel(m: MunicipioIndicadores, ano: number): Promise<DadosResumoMunicipal> {
  const foco = focoDaGestao(ano);
  const ids = idsMunicipais.filter((id) => m.indicadores.includes(id));
  const [indicadores, tse, rede] = await Promise.all([
    Promise.all(ids.map((id) => carregarIndicadorMunicipal(id, m).catch(() => null))),
    eleicoes(m).then((e) => ({ e, erro: false })).catch((e) => {
      console.error("Eleições municipais indisponíveis", e);
      return { e: null, erro: true };
    }),
    carregarRedeSaude(m.codigo).catch(() => null),
  ]);

  // As miniaturas saem de scripts/gerar-fotos-prefeitos.mjs; a lista diz quais existem.
  type Linha = NonNullable<typeof tse.e>["executivo"][number];
  const fotoDa = (r: Linha) => (r.candidato && FOTOS.get(String(r.ano))?.has(r.candidato) ? `/painel/prefeitos/${r.ano}/${r.candidato}.webp` : null);
  // Como nos governadores, vale a foto eleitoral mais recente da pessoa: o mesmo nome civil
  // completo, na mesma cidade, leva a foto de 2024 para a gestão anterior de quem se reelegeu.
  const fotoDaPessoa = new Map<string, string>();
  for (const r of tse.e?.executivo ?? []) {
    const f = fotoDa(r);
    if (f) fotoDaPessoa.set(normalizarNomeMunicipal(r.nome), f);
  }
  const eleito = (anoGestao: number, cargo: string): EleitoMunicipal | null => {
    const r = tse.e?.executivo.find((x) => x.ano === anoGestao - 1 && x.cargo === cargo);
    if (!r) return null;
    const foto = fotoDa(r) ?? fotoDaPessoa.get(normalizarNomeMunicipal(r.nome)) ?? null;
    return { nome: nomeProprio(r.nome_urna || r.nome), partido: r.partido, data: r.data, suplementar: r.suplementar, foto };
  };
  const gestoes: GestaoMunicipal[] = gestoesMunicipais().map((a) => ({ ano: a, prefeito: eleito(a, "PREFEITO"), vice: eleito(a, "VICE-PREFEITO") }));
  const camaraLinhas = (tse.e?.camara ?? []).filter((c) => c.ano === ano - 1);
  const camara: Eleicao | null = camaraLinhas.length
    ? {
        ano: ano - 1,
        cargo: "prefeito",
        partidos: camaraLinhas.map((c) => [c.partido, c.n] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
        total: camaraLinhas.reduce((s, c) => s + c.n, 0),
      }
    : null;

  const semPrefeitura = m.uf.sigla === "DF"
    ? "Brasília é uma unidade equivalente a município no cadastro do IBGE. O Distrito Federal não tem prefeito: o governo é distrital."
    : m.codigo === "2605459"
      ? "Fernando de Noronha é um distrito estadual e não elege prefeito."
      : null;

  const linhas = ids.map((id, i) => linhaIndicador(id, m, indicadores[i], ano));
  const retrato = ids.flatMap((id, i) => {
    const d = indicadores[i];
    if (!d || d.ultimo.valor === null) return [];
    const v = d.ultimo.valor;
    const valor = v >= 1_000_000 ? `${numero(v / 1_000_000, 1)} mi` : v >= 10_000 ? `${numero(v / 1000, 0)} mil` : numero(v, 0);
    return [{ rotulo: RETRATO[id], valor, quando: rotuloReferenciaMunicipal(d.ultimo.referencia, INDICADORES_MUNICIPAIS[id].anual) }];
  });

  return {
    municipio: { codigo: m.codigo, nome: m.nome, slug: m.slug, uf: m.uf },
    caminho: caminhoResumoMunicipal(m),
    ano,
    gestoes,
    semPrefeitura,
    erroEleicao: tse.erro,
    camara,
    indicadores: linhas,
    paginasIndicadores: ids.filter((_, i) => indicadores[i]).map((id) => ({ nome: INDICADORES_MUNICIPAIS[id].nome, caminho: rotaMunicipal(id, m) })),
    rede: rede ? linhasRedeSaude(rede, foco) : null,
    retrato,
  };
}
