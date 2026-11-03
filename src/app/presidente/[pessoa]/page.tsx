import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { metadataPagina } from "@/lib/seo";

import { CapaPessoa } from "@/components/CapaPessoa";
import { ComparacaoPropriosMandatos } from "@/components/ComparacaoPropriosMandatos";
import { Compartilhar } from "@/components/Compartilhar";
import { FichaIndicadores } from "@/components/FichaIndicadores";
import { Narrativa, type Ato } from "@/components/Narrativa";
import { PosicaoEntreMandatos } from "@/components/PosicaoEntreMandatos";
import { anualizado, numero, rotuloMandato } from "@/lib/formatar";
import { carregarDados } from "@/lib/dados";
import { seriesDoMandato } from "@/lib/recorte";
import { ancoraMandato, rotaPessoa } from "@/lib/rotas";
import type { DadosSite, Presidente } from "@/types/dados";

/**
 * A página de uma pessoa, dividida por mandato.
 *
 * A versão anterior era uma página por mandato, e isso partia o que o leitor
 * pensa como uma unidade: "o governo FHC" são oito anos, não dois endereços.
 * Aqui os mandatos são seções com âncora, então um link para "Lula 3" cai na
 * seção certa e ainda deixa os outros dois ao alcance da rolagem.
 */

export const revalidate = 3600;

export async function generateStaticParams() {
  const dados = await carregarDados();
  return [...new Set(dados.presidentes.map((p) => p.pessoaId))].map(
    (pessoa) => ({ pessoa }),
  );
}

interface Achado {
  dados: DadosSite;
  mandatos: Presidente[];
  anterior: Presidente | null;
  proximo: Presidente | null;
}

async function buscar(pessoaId: string): Promise<Achado | null> {
  const dados = await carregarDados();
  const mandatos = dados.presidentes.filter((p) => p.pessoaId === pessoaId);
  if (mandatos.length === 0) return null;

  // Vizinhos são a pessoa anterior e a seguinte na ordem cronológica, não o
  // mandato: navegar de FHC para "FHC 2" seria andar em círculo.
  const pessoas = [...new Set(dados.presidentes.map((p) => p.pessoaId))];
  const idx = pessoas.indexOf(pessoaId);
  const daPessoa = (id?: string) =>
    id ? (dados.presidentes.find((p) => p.pessoaId === id) ?? null) : null;

  return {
    dados,
    mandatos,
    anterior: daPessoa(pessoas[idx - 1]),
    proximo: daPessoa(pessoas[idx + 1]),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ pessoa: string }>;
}): Promise<Metadata> {
  const { pessoa } = await params;
  const achado = await buscar(pessoa);
  if (!achado) return {};

  const { mandatos } = achado;
  const nome = mandatos[0].nome;
  const periodo = `${mandatos[0].inicio.slice(0, 4)}–${mandatos[mandatos.length - 1].fim.slice(0, 4)}`;

  return metadataPagina(`${nome} · Desempenho do Governo`,
      `Os indicadores econômicos dos ${mandatos.length} mandatos de ${nome} ` +
      `(${periodo}), calculados com o mesmo critério aplicado a todos os ` +
      `governos desde o Plano Real.`, rotaPessoa(pessoa));
}

const MS_POR_ANO = 365.25 * 24 * 3600 * 1000;

function anosDecorridos(p: Presidente, agora: Date): number {
  const fim = Math.min(new Date(p.fim).getTime(), agora.getTime());
  return Math.max(0, (fim - new Date(p.inicio).getTime()) / MS_POR_ANO);
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t py-10" style={{ borderColor: "var(--borda)" }}>
      <h3 className="text-lg font-semibold">{titulo}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PaginaPessoa({
  params,
}: {
  params: Promise<{ pessoa: string }>;
}) {
  const { pessoa } = await params;
  const achado = await buscar(pessoa);
  if (!achado) notFound();

  const { dados, mandatos, anterior, proximo } = achado;
  const agora = new Date(dados.geradoEm);
  const anosNoCargo = mandatos.reduce((s, m) => s + anosDecorridos(m, agora), 0);

  const periodos = dados.periodos.filter((p) => p.pessoaId === pessoa);
  const periodosCompostos = periodos.filter((p) => p.nMandatos > 1);

  // Um ato por mandato, com o gráfico recortado naquele período: a mesma
  // narrativa de rolagem da página inicial, aplicada à trajetória da pessoa.
  const atos: Ato[] = mandatos.map((m) => {
    const sm = m.indicadores.find((i) => i.serieId === "salario_minimo_real");
    const ipca = m.indicadores.find((i) => i.serieId === "ipca");
    return {
      id: `ato-${m.mandato}`,
      serieId: "salario_minimo_real",
      recorte: m.id,
      destaque: m.id,
      titulo: `${m.mandato}º mandato · ${m.inicio.slice(0, 4)}–${m.fim.slice(0, 4)}`,
      numero: sm ? anualizado(sm) : undefined,
      numeroLegenda: sm
        ? "no poder de compra do salário mínimo, a cada ano"
        : undefined,
      texto: (
        <>
          <p>
            {/* `anualizado()` já devolve a unidade ("+8,89% ao ano"); somar
                outro "ao ano" aqui produzia a frase duplicada. */}
            {m.observacao ??
              `Neste mandato o poder de compra do salário mínimo variou ${
                sm ? anualizado(sm) : "—"
              }.`}
          </p>
          {ipca?.variacaoAnualizada !== null && ipca && (
            <p>
              A inflação correu a <strong>{anualizado(ipca)}</strong> no mesmo
              período.
            </p>
          )}
        </>
      ),
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24">
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b py-3 text-sm"
        style={{ borderColor: "var(--borda)" }}
      >
        <Link href="/" className="font-semibold tracking-tight hover:underline">
          desempenhodogoverno.com.br
        </Link>
        <nav className="flex gap-4" style={{ color: "var(--tinta-2)" }}>
          <Link href="/#tabela" className="hover:underline">Tabela</Link>
          <Link href="/metodologia" className="hover:underline">Metodologia</Link>
        </nav>
      </header>

      <CapaPessoa
        pessoa={{ nome: mandatos[0].nome, partido: mandatos[0].partido }}
        mandatos={mandatos}
        todos={dados.presidentes}
        anosNoCargo={anosNoCargo}
      />

      {/* A narrativa de rolagem, com o gráfico dando zoom em cada mandato. */}
      <Narrativa dados={dados} atos={atos} />

      {/* Consolidado, só onde os mandatos foram seguidos. */}
      {periodosCompostos.map((per) => {
        const ipca = per.indicadores.find((i) => i.serieId === "ipca");
        const sm = per.indicadores.find(
          (i) => i.serieId === "salario_minimo_real",
        );
        return (
          <section
            key={per.id}
            className="rounded-lg border p-5"
            style={{ borderColor: "var(--borda)", background: "var(--superficie)" }}
          >
            <h2 className="text-lg font-semibold">
              Os {per.nMandatos} mandatos seguidos, de {per.inicio.slice(0, 4)} a{" "}
              {per.fim.slice(0, 4)}
            </h2>
            <p
              className="mt-1.5 max-w-prose text-[15px] leading-relaxed"
              style={{ color: "var(--tinta-2)" }}
            >
              Governo ininterrupto, então o período inteiro pode ser medido de
              uma vez. O cálculo é o mesmo dos mandatos, aplicado ao intervalo
              completo.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
              {[
                ["Inflação", ipca],
                ["Salário mínimo real", sm],
              ].map(([rot, ind]) =>
                ind && typeof ind !== "string" && ind.variacaoAnualizada !== null ? (
                  <div key={String(rot)}>
                    <dt className="text-xs" style={{ color: "var(--tinta-3)" }}>
                      {String(rot)}
                    </dt>
                    <dd className="manchete text-2xl font-bold">
                      {anualizado(ind)}
                    </dd>
                  </div>
                ) : null,
              )}
            </dl>
          </section>
        );
      })}

      {periodos.length > 1 && (
        <p
          className="mt-4 max-w-prose text-sm leading-relaxed"
          style={{ color: "var(--tinta-3)" }}
        >
          Os mandatos desta pessoa não foram seguidos: há {periodos.length}{" "}
          períodos separados por um intervalo fora do cargo. Um número único
          atravessando esse intervalo não descreveria governo nenhum, então cada
          período é medido por conta.
        </p>
      )}

      {mandatos.length > 1 && (
        <ComparacaoPropriosMandatos
          mandatos={mandatos}
          todos={dados.presidentes}
        />
      )}

      {/* Uma seção âncora por mandato. */}
      {mandatos.map((m) => (
        <div
          key={m.id}
          id={ancoraMandato(m.mandato)}
          className="scroll-mt-4 border-t pt-10"
          style={{ borderColor: "var(--eixo)" }}
        >
          <h2 className="text-2xl font-bold tracking-tight">
            {m.mandato}º mandato
            <span
              className="ml-3 text-base font-normal"
              style={{ color: "var(--tinta-2)" }}
            >
              {m.inicio.slice(0, 4)}–{m.fim.slice(0, 4)}
              {m.emCurso ? " · em curso" : ""}
            </span>
          </h2>

          {m.observacao && (
            <p
              className="mt-4 rounded-lg border p-4 text-[15px] leading-relaxed"
              style={{
                borderColor: "var(--borda)",
                background: "var(--superficie)",
                color: "var(--tinta-2)",
              }}
            >
              {m.observacao}
            </p>
          )}

          <Secao titulo="Os números">
            <FichaIndicadores
              presidente={m}
              series={seriesDoMandato(dados, m)}
            />
          </Secao>

          <Secao titulo="Onde este mandato cai entre os nove">
            <PosicaoEntreMandatos presidente={m} todos={dados.presidentes} />
          </Secao>

          <Secao titulo="O que herdou">
            <ul className="space-y-2">
              {m.indicadores
                .filter(
                  (i) =>
                    i.tendenciaPrevia !== null && i.variacaoAnualizada !== null,
                )
                .map((i) => {
                  const un =
                    i.unidadeAnualizada === "p.p./ano"
                      ? "pontos/ano"
                      : "% ao ano";
                  const inverteu =
                    Math.sign(i.tendenciaPrevia!) !==
                    Math.sign(i.variacaoAnualizada!);
                  return (
                    <li
                      key={i.serieId}
                      className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 border-b pb-2 text-sm sm:grid-cols-[1fr_8rem_8rem]"
                      style={{ borderColor: "var(--grade)" }}
                    >
                      <span className="col-span-2 sm:col-span-1">
                        {i.serieNome}
                        <span
                          className="ml-2 text-xs"
                          style={{ color: "var(--tinta-3)" }}
                        >
                          {un}
                        </span>
                        {inverteu && (
                          <span
                            className="ml-2 rounded px-1.5 py-0.5 text-[11px]"
                            style={{
                              background: "var(--faixa-a)",
                              color: "var(--tinta-2)",
                            }}
                          >
                            inverteu a direção
                          </span>
                        )}
                      </span>
                      <span
                        className="tabular text-right"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        {numero(i.tendenciaPrevia, 2)}
                        <span className="ml-1 text-xs">antes</span>
                      </span>
                      <span className="tabular text-right font-medium">
                        {numero(i.variacaoAnualizada, 2)}
                        <span
                          className="ml-1 text-xs font-normal"
                          style={{ color: "var(--tinta-3)" }}
                        >
                          no mandato
                        </span>
                      </span>
                    </li>
                  );
                })}
            </ul>
          </Secao>

          {m.benchmark.length > 0 && (
            <Secao titulo="O mundo no mesmo período">
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(
                  m.benchmark.reduce<Record<string, typeof m.benchmark>>(
                    (acc, b) => {
                      (acc[b.indicadorNome] ??= []).push(b);
                      return acc;
                    },
                    {},
                  ),
                ).map(([nome, linhas]) => (
                  <div
                    key={nome}
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: "var(--borda)",
                      background: "var(--superficie)",
                    }}
                  >
                    <span
                      className="text-xs uppercase tracking-wide"
                      style={{ color: "var(--tinta-3)" }}
                    >
                      {nome}
                    </span>
                    <ul className="mt-2 space-y-1 text-sm">
                      {linhas
                        .slice()
                        .sort((a, b) =>
                          a.regiao === "BRA" ? -1 : b.regiao === "BRA" ? 1 : 0,
                        )
                        .map((b) => (
                          <li key={b.regiao} className="flex justify-between gap-3">
                            <span
                              style={{
                                color:
                                  b.regiao === "BRA"
                                    ? "var(--tinta)"
                                    : "var(--tinta-2)",
                                fontWeight: b.regiao === "BRA" ? 600 : 400,
                              }}
                            >
                              {b.regiaoNome}
                            </span>
                            <span className="tabular">
                              {numero(b.mediaPeriodo, 2)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Secao>
          )}
        </div>
      ))}

      <section className="border-t py-8" style={{ borderColor: "var(--borda)" }}>
        <Compartilhar
          mensagem={
            `Os ${mandatos.length} mandatos de ${mandatos[0].nome}, medidos com a ` +
            `mesma régua de todos os governos desde o Plano Real.`
          }
        />
      </section>

      <nav
        className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm"
        style={{ borderColor: "var(--borda)" }}
      >
        {anterior ? (
          <Link href={rotaPessoa(anterior.pessoaId)} className="hover:underline">
            ← {anterior.nomeCurto}
          </Link>
        ) : (
          <span />
        )}
        <Link href="/" style={{ color: "var(--tinta-2)" }} className="hover:underline">
          Todos os governos
        </Link>
        {proximo ? (
          <Link href={rotaPessoa(proximo.pessoaId)} className="hover:underline">
            {proximo.nomeCurto} →
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p className="mt-6 text-xs" style={{ color: "var(--tinta-3)" }}>
        {rotuloMandato(dados.presidentes, mandatos[0])} e demais mandatos.
        Fontes: Banco Central, IBGE e World Bank.
      </p>
    </div>
  );
}
