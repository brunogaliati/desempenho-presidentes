"use client";

import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";
import { opcaoCompartilhada } from "@/lib/compartilhamento";

import { corDoVeredito } from "@/components/GraficoTempo";
import { comSinal, numero, sentido, type Sentido, mesLegivel } from "@/lib/formatar";

import { criarCsv } from "../_dados/economiaModelo";
import type { DadosPainel, SerieEconomia } from "../_dados/tipos";
import { Bloco, Opcoes, ROTULO } from "./Bloco";
import { formatar, mudanca, pessoas, recebido, referencia, ultimoDado, vereditoDaSerie } from "./formatos";
import { empregoEm12 } from "./visualizacaoSecao";
import { GraficoLinha } from "./GraficoLinha";
import { Numero } from "./PainelEconomia";
import { PilulaVeredito } from "./Placar";

/**
 * Emprego com carteira, crédito e o orçamento federal: as séries que não
 * cabem no gráfico grande, no padrão do terminal.
 *
 * Os três quadros têm o mesmo esqueleto, para alinharem lado a lado:
 *
 * 1. O número que responde à pergunta. A mudança desde a posse sai sempre
 *    chapada na cor do placar; o nível, em tinta.
 * 2. Três números de apoio, no estilo dos totais do histórico, sem caixas.
 * 3. O mandato num gráfico de uma cor só, todos da mesma altura.
 * 4. Uma linha de rodapé: o que o número é, a fonte, um CSV e a coleta.
 *
 * O que não tem lado bom (saldo de crédito, orçamento) fica sem cor.
 */

const ALTURA_GRAFICO = 180;

const pontosDe = (s: SerieEconomia) => s.datas.flatMap((d, i) => (s.valores[i] === null ? [] : [{ d, v: s.valores[i]! }]));
const dia = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
/** "+5,5 mi", "−120 mil". */
const pessoasComSinal = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${pessoas(Math.abs(v))}`;

/** Todas as séries do quadro num CSV só, uma linha por mês e série. */
function baixarCsv(nome: string, series: SerieEconomia[]) {
  const csv = criarCsv(
    ["referencia", "indicador", "valor", "unidade", "fonte", "coletado_em"],
    series.flatMap((s) => s.datas.map((d, i) => [d, s.rotulo, s.valores[i], s.unidade, s.fonteUrl, s.coletadoEm])),
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "+5,5 mi" com o "mi" menor, numa pílula grande na cor do veredito, como os blocos do placar. */
function Chapado({ texto, sentido: s }: { texto: string; sentido: Sentido }) {
  const m = texto.match(/^([+\-−]?[\d.,]+)\s?(.*)$/);
  return (
    <span
      className="tabular inline-block rounded-lg px-2 py-0.5 text-[26px] font-bold leading-tight"
      style={s === "neutro" ? { background: "var(--faixa-a)" } : { background: corDoVeredito(s), color: "var(--placar-texto, #fff)" }}
    >
      {m ? m[1] : texto}
      {m?.[2] && <span className="ml-[0.12em] text-[0.6em] font-semibold opacity-85">{m[2]}</span>}
    </span>
  );
}

/**
 * O número principal do quadro: o rótulo em caixa alta, o número e uma nota.
 * Um seletor, quando há, vai à direita dele e não no cabeçalho: lá ele deixava
 * o quadro mais alto que os vizinhos e desalinhava a fileira.
 */
function Principal({
  rotulo,
  nota,
  acao,
  children,
}: {
  rotulo: string;
  nota: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={ROTULO} style={{ color: "var(--tinta-3)" }}>
          {rotulo}
        </p>
        <div className="mt-1 flex min-h-[38px] flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
        <p className="tabular mt-0.5 text-[11px]" style={{ color: "var(--tinta-3)" }}>
          {nota}
        </p>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}

interface Apoio {
  rotulo: string;
  valor: string;
  pilula?: { texto: string; sentido: Sentido } | null;
  nota?: string | null;
}

/** O rótulo dos números de apoio: o do histórico, com menos espaço entre letras para caber num terço do quadro. */
const ROTULO_APOIO = "mono text-[9.5px] font-medium uppercase tracking-[0.07em]";

/** Os três números de apoio, como os totais do histórico: rótulo em caixa alta, sem caixa em volta. */
function Apoios({ itens }: { itens: Apoio[] }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-x-3 border-t pt-2.5" style={{ borderColor: "var(--borda)" }}>
      {itens.map((x) => (
        <div key={x.rotulo} className="min-w-0">
          <dt className={`${ROTULO_APOIO} truncate`} style={{ color: "var(--tinta-3)" }} title={x.rotulo}>
            {x.rotulo}
          </dt>
          <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
            <Numero texto={x.valor} className="tabular text-[15px] font-bold" />
            {x.pilula && <PilulaVeredito texto={x.pilula.texto} sentido={x.pilula.sentido} className="text-[10px]" />}
          </dd>
          {x.nota && (
            <dd className="tabular truncate text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
              {x.nota}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** O nome do gráfico, numa linha acima dele, com a legenda quando há. */
function Legenda({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 mt-4 flex flex-wrap items-center justify-between gap-x-3 text-[11px]" style={{ color: "var(--tinta-3)" }}>
      {children}
    </p>
  );
}

/** O rodapé: a nota curta e, na mesma linha, a fonte, um CSV e a coleta. `mt-auto` joga a sobra para cima dele. */
function Rodape({ nota, nome, series }: { nota: string; nome: string; series: SerieEconomia[] }) {
  const s = series[0];
  return (
    <div className="mt-auto pt-3">
      <p className="border-t pt-2.5 text-[10.5px] leading-snug" style={{ borderColor: "var(--borda)", color: "var(--tinta-3)" }}>
        {nota}{" "}
        <a href={s.fonteUrl} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap hover:underline" style={{ color: "var(--serie)" }}>
          {s.fonte} ↗
        </a>
        {" · "}
        <button type="button" onClick={() => baixarCsv(nome, series)} className="hover:underline" style={{ color: "var(--serie)" }}>
          CSV
        </button>
        {s.coletadoEm && <span className="whitespace-nowrap"> · coleta {dia(s.coletadoEm)}</span>}
      </p>
    </div>
  );
}

function Indisponivel({ id, titulo, encerrado, className }: { id?: string; titulo: string; encerrado: boolean; className: string }) {
  return (
    <Bloco id={id} titulo={titulo} className={className}>
      <p className="py-6 text-sm" style={{ color: "var(--tinta-2)" }} role="status">
        {encerrado ? "Esta fonte não tem dado deste mandato." : "A fonte não respondeu nesta consulta. Tente atualizar a página."}
      </p>
    </Bloco>
  );
}

const achar = (dados: DadosPainel, id: string) => {
  const s = dados.economia.complemento.series.find((x) => x.id === id);
  return s && ultimoDado(s) ? s : undefined;
};

/** Do último dado antes da posse em diante: o gráfico do mandato, como o "Mandato" do histórico. */
const doMandato = <T extends { d: string }>(pontos: T[], posse: string) => {
  const i = pontos.findIndex((p) => p.d >= posse);
  return i < 0 ? [] : pontos.slice(Math.max(0, i - 1));
};

// ---------------------------------------------------------------------------
// Emprego com carteira
// ---------------------------------------------------------------------------

/**
 * Quantas vagas com carteira o país abriu desde a posse: a soma dos saldos do
 * Caged. O gráfico soma 12 meses em vez de mostrar o mês: todo dezembro fecha
 * vagas, em qualquer governo, e o saldo mensal pintava o mandato de vermelho
 * uma vez por ano sem notícia nenhuma.
 */
export function EmpregoFormal({ id, dados, className }: { id?: string; dados: DadosPainel; className: string }) {
  const POSSE = dados.foco.posse;
  const saldo = achar(dados, "caged_saldo");
  const estoque = achar(dados, "caged_estoque");
  if (!saldo) return <Indisponivel encerrado={!dados.foco.emCurso} id={id} titulo="Emprego com carteira" className={className} />;
  const pontos = pontosDe(saldo);

  const ultimo = pontos[pontos.length - 1];
  const desdeAPosse = pontos.filter((p) => p.d >= POSSE).reduce((a, p) => a + p.v, 0);
  const cobreOMandato = pontos[0].d <= POSSE;
  // Só parte do mandato não dá veredito sobre ele.
  const veredito = cobreOMandato ? sentido(desdeAPosse, "maior_melhor") : "neutro";

  // A soma dos 12 meses até cada mês; só onde os 12 existem.
  const em12 = empregoEm12(saldo);
  const doze = em12.at(-1)?.d === ultimo.d ? em12.at(-1)!.v : null;
  const grafico = doMandato(em12, POSSE);

  const est = estoque ? ultimoDado(estoque) : null;
  const estAntes = estoque ? recebido(estoque) : null;
  const estMuda = est && estAntes ? Math.round(((est.valor - estAntes.valor) / estAntes.valor) * 1000) / 10 : null;

  return (
    <Bloco id={id} titulo="Emprego com carteira" className={`flex flex-col ${className}`} corpo="flex flex-1 flex-col">
      <Principal
        rotulo={cobreOMandato ? "Vagas abertas desde a posse" : `Vagas abertas desde ${mesLegivel(pontos[0].d)}`}
        nota={`${mesLegivel(cobreOMandato ? POSSE : pontos[0].d)} a ${referencia(saldo, ultimo.d)}, admissões menos desligamentos${cobreOMandato ? "" : "; antes disso, sem dado carregado"}`}
      >
        <Chapado texto={pessoasComSinal(desdeAPosse)} sentido={veredito} />
      </Principal>
      <Apoios
        itens={[
          { rotulo: "Em 12 meses", valor: doze === null ? "—" : pessoasComSinal(doze), nota: "vagas abertas" },
          { rotulo: `Em ${referencia(saldo, ultimo.d)}`, valor: pessoasComSinal(ultimo.v), nota: "saldo do mês" },
          ...(est
            ? [
                {
                  rotulo: "Vínculos",
                  valor: pessoas(est.valor),
                  pilula: estMuda === null ? null : { texto: `${comSinal(estMuda, 1)}%`, sentido: sentido(estMuda, "maior_melhor") },
                  nota: estAntes ? `na posse ${pessoas(estAntes.valor)}` : null,
                },
              ]
            : []),
        ]}
      />
      <Legenda>Vagas abertas em 12 meses</Legenda>
      {grafico.length > 1 && (
        <GraficoLinha
          datas={grafico.map((p) => p.d)}
          valores={grafico.map((p) => p.v)}
          formato="inteiro"
          altura={ALTURA_GRAFICO}
          mostrarPosse={false}
          rotulo="Vagas com carteira abertas em 12 meses"
          veredito={{ referencia: 0, direcao: "maior_melhor", desde: POSSE, rotulo: null, sentido: veredito }}
        />
      )}
      <Rodape
        nota="Só emprego com carteira; vínculos são contratos, não pessoas."
        nome="emprego-com-carteira"
        series={[saldo, ...(estoque ? [estoque] : [])]}
      />
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// Crédito
// ---------------------------------------------------------------------------

type Quem = "pf" | "pj";
const QUEM: Record<Quem, { nome: string; de: string; as: string }> = {
  pf: { nome: "Famílias", de: "das famílias", as: "às famílias" },
  pj: { nome: "Empresas", de: "das empresas", as: "às empresas" },
};

/**
 * A inadimplência contra a da posse, com a régua do placar (menos é melhor),
 * e o tamanho da carteira, que não tem lado bom: crédito crescendo pode ser
 * consumo e investimento ou endividamento. O seletor troca famílias e
 * empresas no número principal e no gráfico; a outra fica nos de apoio.
 */
export function Credito({ dados, className }: { dados: DadosPainel; className: string }) {
  const [escolha, setEscolha] = useEstadoCompartilhavel<Quem>("credito.pessoa", "pf", opcaoCompartilhada(["pf","pj"]));
  const inad: Record<Quem, SerieEconomia | undefined> = {
    pf: achar(dados, "credito_pf_inadimplencia"),
    pj: achar(dados, "credito_pj_inadimplencia"),
  };
  const saldos: Record<Quem, SerieEconomia | undefined> = { pf: achar(dados, "credito_pf_saldo"), pj: achar(dados, "credito_pj_saldo") };
  const disponiveis = (["pf", "pj"] as const).filter((q) => inad[q]);
  const quem = inad[escolha] ? escolha : disponiveis[0];
  if (!quem) return <Indisponivel encerrado={!dados.foco.emCurso} titulo="Crédito e inadimplência" className={className} />;
  const outro: Quem = quem === "pf" ? "pj" : "pf";

  // A série complementar chega sem lado; aqui menos inadimplência é melhor, como no placar.
  const inadimplencia = (q: Quem) => {
    const x = inad[q];
    const agora = x ? ultimoDado(x) : null;
    if (!x || !agora) return null;
    const antes = recebido(x);
    return { x, agora, antes, muda: antes ? mudanca({ ...x, direcao: "menor_melhor" }, antes.valor, agora.valor) : null };
  };
  const credito = (q: Quem): Apoio | null => {
    const x = saldos[q];
    const agora = x ? ultimoDado(x) : null;
    if (!x || !agora) return null;
    const antes = recebido(x);
    const v = antes ? Math.round(((agora.valor - antes.valor) / antes.valor) * 1000) / 10 : null;
    return {
      rotulo: `Crédito ${QUEM[q].as}`,
      valor: `R$ ${numero(agora.valor, 2)} tri`,
      // Sem lado bom: a pílula fica cinza.
      pilula: v === null ? null : { texto: `${comSinal(v, 1)}%`, sentido: "neutro" },
      nota: antes ? `na posse R$ ${numero(antes.valor, 2)} tri` : null,
    };
  };
  const p = inadimplencia(quem)!;
  const o = inadimplencia(outro);
  const grafico = doMandato(pontosDe(p.x), dados.foco.posse);

  return (
    <Bloco titulo="Crédito e inadimplência" className={`flex flex-col ${className}`} corpo="flex flex-1 flex-col">
      <Principal
        rotulo={`Inadimplência ${QUEM[quem].de}`}
        nota={`${referencia(p.x, p.agora.data)}, % do total emprestado`}
        acao={
          disponiveis.length > 1 ? (
            <Opcoes opcoes={disponiveis.map((q) => ({ id: q, rotulo: QUEM[q].nome }))} ativa={quem} aoEscolher={setEscolha} rotulo="Famílias ou empresas" />
          ) : undefined
        }
      >
        <Numero texto={formatar(p.agora.valor, p.x.formato)} className="tabular text-[30px] font-bold leading-tight" />
        {p.muda && <PilulaVeredito texto={p.muda.texto} sentido={p.muda.sentido} className="text-[12px]" />}
        {p.antes && (
          <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            na posse {formatar(p.antes.valor, p.x.formato)}
          </span>
        )}
      </Principal>
      <Apoios
        itens={[
          credito(quem),
          o
            ? {
                rotulo: `${QUEM[outro].nome} em atraso`,
                valor: formatar(o.agora.valor, o.x.formato),
                pilula: o.muda,
                nota: o.antes ? `na posse ${formatar(o.antes.valor, o.x.formato)}` : null,
              }
            : null,
          credito(outro),
        ].filter((x): x is Apoio => x !== null)}
      />
      <Legenda>Inadimplência {QUEM[quem].de}, % do total emprestado</Legenda>
      {grafico.length > 1 && (
        <GraficoLinha
          key={p.x.id}
          datas={grafico.map((x) => x.d)}
          valores={grafico.map((x) => x.v)}
          formato={p.x.formato}
          altura={ALTURA_GRAFICO}
          mostrarPosse={false}
          rotulo={p.x.rotulo}
          veredito={vereditoDaSerie(p.x, { direcao: "menor_melhor" })}
        />
      )}
      <Rodape
        nota="Inadimplência é o atraso acima de 90 dias, não a parcela de pessoas; saldos sem descontar a inflação."
        nome="credito-e-inadimplencia"
        series={[...disponiveis.map((q) => inad[q]!), ...disponiveis.flatMap((q) => (saldos[q] ? [saldos[q]!] : []))]}
      />
    </Bloco>
  );
}

// ---------------------------------------------------------------------------
// Orçamento federal
// ---------------------------------------------------------------------------

const BIMESTRES = ["jan–fev", "mar–abr", "mai–jun", "jul–ago", "set–out", "nov–dez"];
const bimestre = (mes: string) => BIMESTRES[Number(mes.slice(5)) / 2 - 1] ?? mes;

/**
 * O que a União arrecadou e pagou no ano, bimestre a bimestre. A fonte só traz
 * o ano corrente acumulado: o quadro desfaz o acúmulo para mostrar cada
 * bimestre e não compara com a posse. Sem cor: as duas contas incluem
 * operações da dívida, e a diferença entre elas não é o resultado primário.
 */
export function Orcamento({ dados, className }: { dados: DadosPainel; className: string }) {
  const rec = achar(dados, "fiscal_receitas");
  const pag = achar(dados, "fiscal_pagas");
  if (!rec || !pag) return <Indisponivel encerrado={!dados.foco.emCurso} titulo="Orçamento federal" className={className} />;
  const ano = ultimoDado(rec)!.data.slice(0, 4);
  // Do acumulado no ano para o valor de cada bimestre.
  const doBimestre = (s: SerieEconomia) => {
    const acc = pontosDe(s).filter((p) => p.d.startsWith(ano));
    return new Map(
      acc.map((p, i) => {
        const anterior = acc[i - 1];
        if (!anterior) return [p.d, p.d.endsWith("-02") ? p.v : null] as const;
        return [p.d, Number(p.d.slice(5)) - Number(anterior.d.slice(5)) === 2 ? p.v - anterior.v : null] as const;
      }),
    );
  };
  const r = doBimestre(rec);
  const p = doBimestre(pag);
  const meses = [...r.keys()].filter((m) => p.has(m)).sort();
  const ultimoMes = meses[meses.length - 1];
  const max = Math.max(...meses.flatMap((m) => [r.get(m) ?? 0, p.get(m) ?? 0]), 1);
  const ate = referencia(rec, ultimoMes ?? ultimoDado(rec)!.data);
  const bi = (v: number | null | undefined) => (v == null ? "—" : `R$ ${numero(v, 0)} bi`);
  const barras = [
    { id: "arrecadou", rotulo: "arrecadado", cor: "var(--serie)", valores: r },
    { id: "pagou", rotulo: "pago", cor: "var(--tinta-3)", valores: p },
  ];

  return (
    <Bloco titulo={`Orçamento federal em ${ano}`} className={`flex flex-col ${className}`} corpo="flex flex-1 flex-col">
      <Principal rotulo="Arrecadou" nota={`jan a ${ate}, em reais de cada mês`}>
        <Numero texto={bi(ultimoDado(rec)!.valor)} className="tabular text-[30px] font-bold leading-tight" />
      </Principal>
      <Apoios
        itens={[
          { rotulo: "Pagou", valor: bi(ultimoDado(pag)!.valor), nota: `jan a ${ate}` },
          ...(ultimoMes
            ? [
                { rotulo: `Arrecadou em ${bimestre(ultimoMes)}`, valor: bi(r.get(ultimoMes)), nota: "último bimestre" },
                { rotulo: `Pagou em ${bimestre(ultimoMes)}`, valor: bi(p.get(ultimoMes)), nota: "último bimestre" },
              ]
            : []),
        ]}
      />
      <Legenda>
        <span>Por bimestre, R$ bilhões</span>
        <span className="flex items-center gap-3" aria-hidden>
          {barras.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.cor }} /> {b.rotulo}
            </span>
          ))}
        </span>
      </Legenda>
      <div
        className="flex items-end gap-4 border-b px-1"
        style={{ height: ALTURA_GRAFICO - 22, borderColor: "var(--grade)" }}
        role="img"
        aria-label={meses.map((m) => `${bimestre(m)}: arrecadou ${bi(r.get(m))}, pagou ${bi(p.get(m))}`).join("; ")}
      >
        {meses.map((m) => (
          <div key={m} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1">
            {barras.map((b) => {
              const v = b.valores.get(m) ?? null;
              return (
                <span key={b.id} className="flex h-full w-full max-w-[26px] flex-col justify-end">
                  <span className="tabular block text-center text-[9.5px] leading-tight" style={{ color: "var(--tinta-3)" }}>
                    {v === null ? "" : numero(v, 0)}
                  </span>
                  <span className="block rounded-t-[4px]" style={{ height: `${((v ?? 0) / max) * 82}%`, background: b.cor }} />
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-4 px-1 pt-1">
        {meses.map((m) => (
          <span key={m} className="tabular min-w-0 flex-1 text-center text-[10.5px]" style={{ color: "var(--tinta-3)" }}>
            {bimestre(m)}
          </span>
        ))}
      </div>
      <Rodape
        nota="União, sem operações internas do orçamento. As duas contas incluem a dívida: a diferença não é o resultado primário."
        nome={`orcamento-federal-${ano}`}
        series={[rec, pag]}
      />
    </Bloco>
  );
}
