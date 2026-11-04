"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { destinoPainel } from "@/lib/rotasPainel";
import { RecortesCompartilhaveis } from "@/components/RecortesCompartilhaveis";

import { focoDoMandato, recortarAoMandato, TERMO_2015 } from "../_dados/mandatoRecorte";
import type { AbaId, DadosPainel } from "../_dados/tipos";
import { AbaDinheiro } from "./AbaDinheiro";
import { AbaAmbiente } from "./AbaAmbiente";
import { AbaEconomia } from "./AbaEconomia";
import { PosseContext } from "./GraficoLinha";
import { BarraMandato, Cabecalho } from "./Topo";
import { FiltroRefracao, useVidro } from "./Vidro";

/**
 * O governo atual, um tema por aba, numa página só.
 *
 * Cada aba tem o desenho que o seu dado pede, e a página rola: Economia e
 * Meio ambiente abrem na mesma sala (o mapa solto, a manchete, o placar na
 * barra de vidro) e descem para o terminal, cada uma com a sua paisagem de
 * fundo; Dinheiro abre num treemap, sem mapa, e Congresso usa o painel com mapa até
 * ganhar desenho próprio. Comum a todas: o cabeçalho, uma linha só com o mandato dentro, para
 * o tema começar logo abaixo dele.
 *
 * Aba e estado vão para a URL (`?uf=PA`, `?aba=congresso&uf=PA`).
 */

interface Props {
  publico?: boolean;
  descricao?: string;
  dados: DadosPainel;
  abaInicial: AbaId;
  ufInicial: string | null;
  /** O mandato de `?mandato=`; `null` é o em curso. */
  mandatoInicial: string | null;
  retrato: React.ReactNode;
}

export function Painel({ publico=false, descricao, dados: inteiros, abaInicial, ufInicial, mandatoInicial, retrato }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<AbaId>(abaInicial);
  const [sigla, setSiglaDireto] = useState<string | null>(ufInicial);
  const emCurso = inteiros.presidente.id;
  const mandatos = inteiros.economia.mandatos;
  // Dilma 2 e Temer cabem num governo estadual só: com um estado na tela, vale ele inteiro.
  const presidentesDe2015 = mandatos.filter((m) => m.inicio >= "2015" && m.inicio < "2019").map((m) => m.id);
  const [mandatoId, setMandatoId] = useState(() => {
    const id = mandatoInicial && focoDoMandato(mandatos, mandatoInicial) ? mandatoInicial : emCurso;
    if (ufInicial && presidentesDe2015.includes(id)) return TERMO_2015;
    return !ufInicial && id === TERMO_2015 ? presidentesDe2015[0] : id;
  });
  const presidenteAntes = useRef<string | null>(null);
  // O servidor manda a história inteira; a tela enxerga um mandato de cada vez, e
  // trocar é instantâneo. `atual` serve ao que sempre fala de hoje (os dias na
  // barra) e ao que compara todos os governos.
  const atual = useMemo(() => recortarAoMandato(inteiros, emCurso), [inteiros, emCurso]);
  const dados = useMemo(() => (mandatoId === emCurso ? atual : recortarAoMandato(inteiros, mandatoId)), [inteiros, mandatoId, emCurso, atual]);
  const setSigla = (s: string | null) => {
    setSiglaDireto(s);
    if (s && presidentesDe2015.includes(mandatoId)) {
      presidenteAntes.current = mandatoId;
      setMandatoId(TERMO_2015);
    }
    // Esse governo estadual não é um presidente: voltando ao Brasil, vale quem estava antes.
    if (!s && mandatoId === TERMO_2015) setMandatoId(presidenteAntes.current ?? presidentesDe2015[0] ?? emCurso);
  };
  const cabecalho = useRef<HTMLDivElement>(null);
  useVidro();

  useLayoutEffect(() => {
    const el = cabecalho.current;
    if (!el) return;
    const medir = () => el.parentElement?.style.setProperty("--altura-cabecalho", `${el.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (publico || aba === "economia") url.searchParams.delete("aba");
    else url.searchParams.set("aba", aba);
    if (sigla) url.searchParams.set("uf", sigla);
    else url.searchParams.delete("uf");
    if (mandatoId !== emCurso || url.searchParams.has('mandato') || url.searchParams.has('painel')) url.searchParams.set("mandato", mandatoId);
    else url.searchParams.delete("mandato");
    url.searchParams.delete("visao");
    window.history.replaceState(window.history.state, "", url);
  }, [aba, sigla, mandatoId, emCurso, publico]);

  const trocarAba = (a: AbaId) => {
    if (a !== "economia" && a !== "ambiente" && a !== "dinheiro") return;
    if (publico) {
      router.push(destinoPainel({ aba: a, uf: sigla ?? undefined, mandato: mandatoId !== emCurso ? mandatoId : undefined }));
      return;
    }
    setAba(a);
    window.scrollTo({ top: 0 });
  };

  return (
    <RecortesCompartilhaveis titulo={`${sigla ? 'Governo de '+(dados.ufs.find(u=>u.sigla===sigla)?.nome??sigla) : mandatos.find(m=>m.id===mandatoId)?.nomeCurto??'Governo'} · ${dados.foco.posse.slice(0,4)}–${dados.foco.fim.slice(0,4)}`} filtros={{uf:sigla,mandato:mandatoId}}>
    <PosseContext.Provider value={dados.foco.posse}>
    <div
      className="painel-governo min-h-dvh px-3 pb-10"
      data-aba={aba}
      data-visual="governo-v1"
    >
      <div aria-hidden className="fundo-painel" />
      <FiltroRefracao />
      <div ref={cabecalho} className="painel-cabecalho relative -mx-3 mb-3 border-b">
        <Cabecalho publico={publico} recorte={{uf:sigla??undefined,mandato:mandatoId!==emCurso?mandatoId:undefined}} aba={aba} aoTrocar={trocarAba} mandato={<BarraMandato dados={atual} foco={dados.foco} retrato={retrato} sigla={sigla} aba={aba} aoEscolher={setMandatoId} />} />
      </div>

      <main>
      {aba === "economia" && (
        <AbaEconomia dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} aoTrocarAba={trocarAba} />
      )}
      {aba === "ambiente" && <AbaAmbiente dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} />}
      {aba === "dinheiro" && <AbaDinheiro dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} aoEscolherMandato={setMandatoId} />}
      </main>

      {publico && aba === "economia" && <nav aria-label="Indicadores e territórios" className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-5 text-sm"><Link href="/economia">Todos os indicadores</Link><Link href="/economia/salario-minimo">Salário mínimo</Link><Link href="/economia/inflacao">Inflação</Link><Link href="/economia/desemprego">Desemprego</Link><Link href="/economia/gasolina">Gasolina</Link><Link href="/economia/municipios">Indicadores por município</Link></nav>}
      {publico && <nav aria-label="Sobre os dados" className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-5 text-sm"><Link href="/metodologia">Metodologia</Link><Link href="/sobre">Sobre o projeto</Link><Link href="/correcoes">Relatar um erro</Link></nav>}
      <footer className="mx-auto mt-6 max-w-6xl text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        {descricao && <p className="mb-3">{descricao} Os períodos e fontes aparecem em cada painel; ausência de informação não significa zero.</p>}
        {aba === "dinheiro" ? (<>Fontes: Tesouro Nacional · Siconfi e Transferegov · transferências especiais.</>) : aba === "ambiente" ? (
          <>
            Fontes: INPE (PRODES, DETER e Programa Queimadas), Ibama (dados abertos da fiscalização) e IBGE (malhas). Cada painel diz a data
            em que o dado entrou no banco; medida cuja fonte não respondeu sai da tela, nunca vira zero.
          </>
        ) : (
          <>
            Fontes: Banco Central, IBGE (SIDRA, estimativas e malhas), World Bank, Câmara, Senado e INPE.{" "}
            Dados das APIs públicas coletados em{" "}
            {new Date(inteiros.fontes.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
            Cada indicador identifica sua referência e os limites da comparação.
          </>
        )}
      </footer>
    </div>
    </PosseContext.Provider>
    </RecortesCompartilhaveis>
  );
}
