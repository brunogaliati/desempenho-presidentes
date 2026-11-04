"use client";

import Image from "next/image";
import { Compartilhar } from "@/components/Compartilhar";
import Link from "next/link";
import { destinoPainel } from "@/lib/rotasPainel";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { numero } from "@/lib/formatar";
import { Retrato } from "@/components/Retrato";

import type { AbaId, DadosPainel, FocoMandato, Governos } from "../_dados/tipos";
import { fimTimeline } from "../_dados/marcosModelo";
import {
  comoEntrou,
  corDoPartido,
  governoEm,
  inicioNoCargo,
  logoDoPartido,
  mesAno,
  nomePartido,
  rotuloPartido,
  semCorDePartido,
  termosDoGoverno,
  tintaDoPartido,
} from "./governos";
import { Segmentos } from "./Vidro";
import { RetratoGovernador } from "./RetratoGovernador";

/**
 * Cabeçalho do painel, com o mandato dentro, numa linha só: a altura que ele
 * toma sai do mapa. O mandato vai em dois andares baixos (quem e quanto falta;
 * embaixo, o trilho com os marcos). Datas, contagem completa e a ressalva dos
 * marcos ficam no título do trilho e no balão de cada marco.
 */

export const ABAS: { id: AbaId; rotulo: string; indisponivel?: boolean }[] = [
  { id: "economia", rotulo: "Economia" },
  { id: "ambiente", rotulo: "Meio ambiente" },
  { id: "congresso", rotulo: "Congresso", indisponivel: true },
  { id: "dinheiro", rotulo: "Dinheiro" },
];

export function Cabecalho({
  aba,
  aoTrocar,
  mandato,
  publico=false,
  recorte={},
  semTemaAtivo=false,
}: {
  aba: AbaId;
  aoTrocar: (a: AbaId) => void;
  mandato: React.ReactNode;
  publico?: boolean;
  recorte?: { uf?: string; mandato?: string };
  semTemaAtivo?: boolean;
}) {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.theme ??= "light";
    setEscuro(raiz.dataset.theme === "dark");
  }, []);

  const alternarTema = () => {
    const raiz = document.documentElement;
    const estavaEscuro = raiz.dataset.theme === "dark";
    raiz.dataset.theme = estavaEscuro ? "light" : "dark";
    setEscuro(!estavaEscuro);
  };

  return (
    <header className="cabecalho-painel vidro">
      <div className="cabecalho-principal">
        <Link href="/" className="marca-painel" aria-label="Desempenho do Governo — início">
          <Marca />
        </Link>
        <nav className="navegacao-temas" aria-label="Temas">
          {publico ? <div className="segmentos vidro inline-flex gap-1 p-1">{ABAS.map(a=>a.indisponivel?<button key={a.id} type="button" disabled className="px-3 py-2">{a.rotulo}</button>:<Link key={a.id} href={destinoPainel({aba:a.id,...recorte})} aria-current={!semTemaAtivo&&aba===a.id?'page':undefined} className="px-3 py-2">{a.rotulo}</Link>)}</div> : <Segmentos opcoes={ABAS} ativo={aba} aoEscolher={aoTrocar} rotulo="Temas" papel="pagina" classeBotao="px-3 py-2" />}
        </nav>
        {mandato}
        <div className="cabecalho-acoes">
          <Link href="/#governo-a-governo" className="acao-cabecalho" aria-label="Comparar governos" title="Comparar governos">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
              <path d="M5 19V9m7 10V4m7 15v-7" />
            </svg>
            <span className="rotulo-acao">Comparar governos</span>
          </Link>
          <Compartilhar mensagem="Painel do governo" compacto/>
          <button type="button" role="switch" aria-checked={escuro} onClick={alternarTema} className="tema-interruptor" aria-label="Alternar tema claro e escuro" title={escuro ? "Ativar tema claro" : "Ativar tema escuro"}>
            <span className="tema-marcador" aria-hidden />
            <svg className="tema-sol" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
            <svg className="tema-lua" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" /></svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * Logo original, preservada no PNG transparente. O viewport remove apenas
 * as margens vazias; os recortes permitem animar bandeira e escrita separadas.
 */
function Marca() {
  return (
    <svg className="marca-logo" width="2068" height="414" viewBox="56 150 2068 414" role="img" aria-label="Desempenho do governo">
      <defs>
        <clipPath id="marca-recorte-bandeira"><rect width="580" height="724" /></clipPath>
        <clipPath id="marca-recorte-escrita"><rect x="580" width="1592" height="724" /></clipPath>
      </defs>
      <g className="marca-bandeira" clipPath="url(#marca-recorte-bandeira)">
        <image href="/marca/desempenho-do-governo.png" width="2172" height="724" />
      </g>
      <g className="marca-escrita" clipPath="url(#marca-recorte-escrita)">
        <image href="/marca/desempenho-do-governo.png" width="2172" height="724" />
      </g>
    </svg>
  );
}

const DIA = 86_400_000;
const instante = (data: string) => new Date(`${data}T00:00:00-03:00`).getTime();

const ESCOPO = "Seleção revisada de marcos com fontes oficiais; não representa todas as decisões ou seus resultados.";

/** Uma linha da lista de mandatos. */
interface OpcaoMandato {
  id: string;
  retrato: React.ReactNode;
  titulo: string;
  detalhe: string;
}

/**
 * O mandato na tela, de presidente ou de governador. Escolher aqui muda a página
 * inteira (ver `mandatoRecorte.ts`), não só esta linha do tempo.
 */
function SeletorMandato({ opcoes, escolhida, retrato, rotulo, aoEscolher }: {
  opcoes: OpcaoMandato[];
  /** A da tela; `null` se o mandato escolhido não está na lista. */
  escolhida: string | null;
  /** O que o botão fechado mostra. */
  retrato: React.ReactNode;
  rotulo: { nome: string; complemento: string };
  aoEscolher: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const listaId = useId();

  useEffect(() => {
    if (!aberto) return;
    raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const fora = (e: PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && aberto) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
      gatilho.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!aberto) { setAberto(true); return; }
      const opcoes = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = opcoes.findIndex((o) => o === document.activeElement);
      const n = e.key === "Home" ? 0 : e.key === "End" ? opcoes.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + opcoes.length) % opcoes.length;
      opcoes[n]?.focus();
    }
  };

  return (
    <div ref={raiz} className="mandato-seletor" style={{ position: "relative", minWidth: 0 }} onKeyDown={teclado} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }}>
      <button
        ref={gatilho}
        type="button"
        className="mandato-seletor-botao"
        style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100% + 4px)", minHeight: 40 }}
        aria-label={`Mandato na tela: ${rotulo.nome} · ${rotulo.complemento}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-describedby="marcos-escopo"
        onClick={() => setAberto(!aberto)}
      >
        {retrato}
        <span className="mandato-seletor-nome"><strong>{rotulo.nome}</strong><span> · {rotulo.complemento}</span></span>
        <svg className="mandato-seta" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {aberto && (
        <div
          id={listaId}
          role="listbox"
          aria-label="Mandatos"
          className="mandato-opcoes vidro"
          // Fora do fluxo mesmo se uma atualização em desenvolvimento atrasar o CSS.
          style={{ position: "absolute", top: "calc(100% + 8px)", left: -8, zIndex: 60, width: "min(19rem, calc(100vw - 3rem))", maxHeight: "min(32rem, calc(100dvh - 12rem))", overflowY: "auto", padding: 6, borderRadius: 16 }}
        >
          {opcoes.map((m) => (
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={m.id === escolhida}
              aria-label={`${m.titulo} · ${m.detalhe}`}
              key={m.id}
              className="mandato-opcao"
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 50, padding: "7px 9px", textAlign: "left" }}
              onClick={() => { aoEscolher(m.id); setAberto(false); gatilho.current?.focus(); }}
            >
              {m.retrato}
              <span className="mandato-opcao-texto" style={{ display: "flex", flex: 1, flexDirection: "column", gap: 2, minWidth: 0 }}><strong>{m.titulo}</strong><span>{m.detalhe}</span></span>
              {m.id === escolhida && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 4 4 10-10" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O mandato de governador que está em curso: começou com o do presidente, em
 * janeiro de 2023, e termina na posse do próximo governador, que a EC 111/2021
 * passou para 6 de janeiro (a data vem de `governos.previstos`).
 */
const INICIO_GOVERNADOR = "2023-01-01";
const POSSE_GOVERNADOR = "2027-01-06";

/** A logo do partido num círculo, no lugar do retrato; sem logo, a pílula com a sigla. */
function MarcaPartido({ governos, sigla }: { governos: Governos; sigla: string | null }) {
  const logo = logoDoPartido(sigla);
  if (!logo) {
    // A pílula é mais larga que o círculo: vai sozinha, sem ele.
    return (
      <span
        className="pilula"
        title={nomePartido(governos, sigla)}
        data-vazada={semCorDePartido(sigla) || undefined}
        style={semCorDePartido(sigla) ? undefined : { background: corDoPartido(governos, sigla), color: tintaDoPartido(governos, sigla) }}
      >
        {rotuloPartido(governos, sigla, true)}
      </span>
    );
  }
  return (
    <span className="mandato-partido" title={nomePartido(governos, sigla)}>
      <Image src={logo} alt="" aria-hidden width={22} height={18} unoptimized className="h-[18px] w-[22px] object-contain" />
    </span>
  );
}

/** O que falta nesta aba: Congresso só tem o governo atual, e o orçamento por função começa em 2015. */
const avisoDaAba = (aba: AbaId, foco: FocoMandato) => {
  if (aba === "congresso" && !foco.emCurso) return "Esta aba ainda só tem o governo atual: a Economia e o Meio ambiente acompanham o mandato escolhido.";
  if (aba === "dinheiro" && foco.fim < "2015-07-01") return "O orçamento por função começa em 2015: esta aba mostra a partir daí.";
  return "";
};

/**
 * Com um estado escolhido, a linha do tempo é a do governo dele: quem governa,
 * quanto falta para a posse do próximo e, como marcos, as trocas no meio do
 * mandato (vice que assumiu, troca de partido), com data e fonte no balão. O
 * seletor mostra os governos do estado desde 1995.
 */
function BarraGovernador({ dados, foco, sigla, aba, aoEscolher }: { dados: DadosPainel; foco: FocoMandato; sigla: string; aba: AbaId; aoEscolher: (id: string) => void }) {
  const g = dados.governos;
  const hoje = dados.hoje.slice(0, 10);
  const uf = dados.ufs.find((u) => u.sigla === sigla);
  const termos = termosDoGoverno(g, sigla, dados.economia.mandatos);
  // Dilma 2 e Temer caem no mesmo governo estadual, o de 2015 a 2018.
  const termo = termos.find((x) => `${foco.posse}-01` >= x.inicio && `${foco.posse}-01` < x.fim) ?? termos.at(-1);
  const emCurso = Boolean(termo && hoje >= termo.inicio && hoje < termo.fim);
  const inicioTermo = termo?.inicio ?? INICIO_GOVERNADOR;
  const trecho = emCurso ? governoEm(g, sigla, hoje) : (termo?.trechos.at(-1) ?? null);
  const posse = emCurso ? (g.previstos[sigla]?.posse ?? POSSE_GOVERNADOR) : (termo?.fim ?? POSSE_GOVERNADOR);
  const inicio = instante(inicioTermo);
  const fim = instante(posse);
  const agora = new Date(dados.hoje).getTime();
  const total = Math.round((fim - inicio) / DIA);
  const decorridos = Math.max(0, Math.min(total, Math.floor((agora - inicio) / DIA) + 1));
  const faltam = Math.max(0, Math.ceil((fim - agora) / DIA));
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - inicio) / (fim - inicio)) * 100))}%`;
  const dataFim = new Date(fim).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const contagem = `${numero(decorridos, 0)} de ${numero(total, 0)} dias`;
  const desde = trecho ? inicioNoCargo(g, sigla, trecho) : null;
  const lista = g.ufs[sigla] ?? [];
  const trocas = lista.flatMap((t, i) => {
    if (t.inicio <= inicioTermo || t.inicio >= posse || t.inicio > hoje) return [];
    const antes = lista[i - 1];
    const texto =
      antes && antes.nome === t.nome
        ? `${t.nome} troca de partido: ${rotuloPartido(g, antes.partido)} para ${rotuloPartido(g, t.partido)}`
        : `${t.nome} assume (${comoEntrou(t)})`;
    return [{ inicio: t.inicio, texto: `${mesAno(t.inicio)}: ${texto}`, fonte: t.fontePartido ?? t.fonte }];
  });
  const nomeUf = uf?.deNome ?? sigla;
  const aviso = avisoDaAba(aba, foco);
  const quem = termo ? termo.nomes.join(" e ") : (trecho?.nome ?? "Governo");
  // No botão, um nome só: dois não cabem ao lado da contagem. A lista traz todos.
  const curto = termo && termo.nomes.length > 1 ? `${termo.nomes[0]} +${termo.nomes.length - 1}` : quem;
  const retrato = trecho ? <RetratoGovernador uf={sigla} nome={termo?.nomes[0] ?? trecho.nome} tamanho={32} /> : <MarcaPartido governos={g} sigla={null} />;

  return (
    <section className="mandato-faixa" aria-label={`Linha do tempo do governo ${nomeUf}`}>
      <div className="mandato-identidade" title={trecho ? `${quem}, ${rotuloPartido(g, trecho.partido)}. Governo ${nomeUf}${emCurso && desde && desde > INICIO_GOVERNADOR ? `, no cargo desde ${mesAno(desde)}` : ""}.` : undefined}>
        <SeletorMandato
          opcoes={termos.map((x) => ({
            id: x.id,
            retrato: <RetratoGovernador uf={sigla} nome={x.nomes[0]} tamanho={32} />,
            titulo: x.nomes.join(" e "),
            detalhe: `${x.ano}–${x.ano + 3} · ${rotuloPartido(g, x.trechos[0].partido, true)}`,
          }))}
          escolhida={termo?.id ?? null}
          retrato={retrato}
          rotulo={{ nome: curto, complemento: sigla }}
          aoEscolher={aoEscolher}
        />
      </div>
      <div className="mandato-grafico" title={`De ${mesAno(inicioTermo)} ${emCurso ? "à posse do próximo governo" : "ao fim do governo"}, em ${dataFim}: ${contagem}`}>
        <div className="mandato-trilho" role="progressbar" aria-label={`Dias decorridos do mandato do governo ${nomeUf}`} aria-valuemin={0} aria-valuemax={total} aria-valuenow={decorridos} aria-valuetext={`${contagem}${emCurso ? `; faltam ${faltam} dias` : ""}`}>
          <span className="mandato-progresso" style={{ width: pos(agora) }} />
          <span className="mandato-hoje" style={{ left: pos(agora) }} aria-hidden />
        </div>
        <div className="mandato-marcos" aria-label={`${trocas.length} trocas no governo durante o mandato`}>
          {trocas.map((t) => (
            <a
              key={t.inicio}
              href={t.fonte}
              target="_blank"
              rel="noopener noreferrer"
              className="mandato-marco"
              style={{ left: pos(instante(t.inicio)) }}
              aria-label={`${t.texto}. Abrir a fonte em nova aba.`}
              title={`${t.texto}. Abrir a fonte.`}
            />
          ))}
        </div>
      </div>
      <p className="mandato-contagem tabular" title={contagem}>
        {emCurso ? <>Faltam <strong>{numero(faltam, 0)}</strong> dias</> : "Encerrado"}
      </p>
      <p className={aviso ? "mandato-nota" : "sr-only"} role="status">{aviso}</p>
    </section>
  );
}

/** A linha do tempo do cabeçalho: a do presidente ou, com um estado escolhido, a do governador. */
export function BarraMandato({ dados, foco, retrato, sigla, aba, aoEscolher }: {
  /** O painel do governo atual: a barra sempre conta os dias de verdade, seja qual for o mandato na tela. */
  dados: DadosPainel;
  foco: FocoMandato;
  retrato: React.ReactNode;
  sigla: string | null;
  aba: AbaId;
  aoEscolher: (id: string) => void;
}) {
  return sigla
    ? <BarraGovernador dados={dados} foco={foco} sigla={sigla} aba={aba} aoEscolher={aoEscolher} />
    : <BarraPresidente dados={dados} foco={foco} retrato={retrato} aba={aba} aoEscolher={aoEscolher} />;
}

function BarraPresidente({ dados, foco, retrato, aba, aoEscolher }: { dados: DadosPainel; foco: FocoMandato; retrato: React.ReactNode; aba: AbaId; aoEscolher: (id: string) => void }) {
  const [marco, setMarco] = useState<number | null>(null);
  const mandatos = dados.economia.mandatos;
  const presidente = mandatos.find((m) => m.id === foco.id) ?? mandatos.find((m) => m.id === dados.presidente.id)!;
  const marcos = dados.marcosPorMandato[presidente.id] ?? [];
  const posse = fimTimeline(presidente, dados.posse);
  const inicio = instante(presidente.inicio);
  const fim = instante(posse);
  const agora = new Date(dados.hoje).getTime();
  const total = Math.round((fim - inicio) / DIA);
  const decorridos = Math.max(0, Math.min(total, Math.floor((agora - inicio) / DIA) + 1));
  const faltam = Math.max(0, Math.ceil((fim - agora) / DIA));
  const pos = (t: number) => `${Math.min(100, Math.max(0, ((t - inicio) / (fim - inicio)) * 100))}%`;
  const dataInicio = new Date(inicio).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "America/Sao_Paulo" });
  const dataFim = new Date(instante(presidente.emCurso ? posse : presidente.fim)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const quem = `${presidente.nome}, ${presidente.mandato}º mandato${presidente.partido ? `, ${presidente.partido}` : ""}`;
  const contagem = `${numero(decorridos, 0)} de ${numero(total, 0)} dias`;
  // Só o que muda a leitura aparece por escrito; a ressalva de sempre vai no
  // balão dos marcos e continua descrevendo o seletor para leitor de tela.
  const aviso = [
    avisoDaAba(aba, foco),
    marcos.length === 0 && "Ainda não há marcos revisados carregados para este mandato.",
  ].filter(Boolean).join(" ");

  return (
    <section className="mandato-faixa" aria-label={`Linha do tempo de marcos: ${quem}`}>
      <div className="mandato-identidade">
        <SeletorMandato
          opcoes={mandatos.map((m) => ({
            id: m.id,
            retrato: <Retrato presidente={m} tamanho="p" />,
            titulo: m.nomeCurto,
            detalhe: `${m.inicio.slice(0, 4)}–${m.fim.slice(0, 4)} · ${m.mandato}º mandato`,
          }))}
          escolhida={presidente.id}
          retrato={presidente.id === dados.presidente.id ? retrato : <Retrato presidente={presidente} tamanho="p" />}
          rotulo={{ nome: presidente.nomeCurto, complemento: presidente.inicio.slice(0, 4) }}
          aoEscolher={(id) => { aoEscolher(id); setMarco(null); }}
        />
      </div>
      <div className="mandato-grafico" title={`De ${dataInicio} a ${dataFim}${presidente.emCurso ? " (posse do próximo mandato)" : ""}: ${contagem}`}>
        <div className="mandato-trilho" role="progressbar" aria-label="Dias decorridos do mandato" aria-valuemin={0} aria-valuemax={total} aria-valuenow={decorridos} aria-valuetext={`${contagem}; faltam ${faltam} dias`}>
          <span className="mandato-progresso" style={{ width: pos(agora) }} />
          <span className="mandato-hoje" style={{ left: pos(agora) }} aria-hidden />
        </div>
        <div className="mandato-marcos" aria-label={`Seleção de ${marcos.length} marcos verificados do mandato; não é uma lista completa`}>
          {marcos.map((m, i) => (
            <a
              key={m.id}
              href={m.fonteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mandato-marco"
              style={{
                left: pos(instante(m.data)),
              }}
              aria-label={`${m.rotulo}, ${new Date(instante(m.data)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. ${m.documento}. Abrir fonte oficial em nova aba.`}
              title={`${m.documento} · ${m.responsavel}. Abrir fonte oficial.`}
              onPointerEnter={() => setMarco(i)}
              onPointerLeave={() => setMarco(null)}
              onFocus={() => setMarco(i)}
              onBlur={() => setMarco(null)}
            />
          ))}
          {marco !== null && <Marco marco={marcos[marco]} aDireita={parseFloat(pos(instante(marcos[marco].data))) > 50} />}
        </div>
      </div>
      <p className="mandato-contagem tabular" title={contagem}>
        {presidente.emCurso ? <>Faltam <strong>{numero(faltam, 0)}</strong> dias</> : "Encerrado"}
      </p>
      <p id="marcos-escopo" className={aviso ? "mandato-nota" : "sr-only"} role="status">
        {aviso || (marcos.length > 0 && ESCOPO)}
      </p>
    </section>
  );
}

/**
 * A caixa de um marco, presa à ponta da barra do lado dele. A barra é curta e
 * a caixa, larga: centrada no ponto, ela saía da tela no celular.
 */
function Marco({ marco, aDireita }: { marco: DadosPainel["marcosPorMandato"][string][number]; aDireita: boolean }) {
  return (
    <div
      role="status"
      className={`pointer-events-none absolute top-4 z-30 w-max max-w-[20rem] rounded-md border px-2.5 py-1.5 text-xs shadow-sm ${aDireita ? "right-0" : "left-0"}`}
      style={{ background: "var(--superficie)", borderColor: "var(--borda)" }}
    >
      <strong className="block">{marco.rotulo}</strong>
      <span className="mt-1 block" style={{ color: "var(--tinta-2)" }}>
        {new Date(instante(marco.data)).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        })}
        {" · "}{marco.etapa}
      </span>
      <span className="mt-1 block" style={{ color: "var(--tinta-2)" }}>{marco.documento} · {marco.responsavel}</span>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--tinta-2)" }}>{marco.contexto}</p>
      <span className="mt-2 block" style={{ color: "var(--tinta-3)" }}>Fonte: {marco.fonte}</span>
      <span className="mt-1 block font-medium">Clique no ponto para abrir a fonte ↗</span>
      <span className="mt-2 block border-t pt-1.5 text-[11px] leading-snug" style={{ color: "var(--tinta-3)", borderColor: "var(--borda)" }}>{ESCOPO}</span>
    </div>
  );
}
