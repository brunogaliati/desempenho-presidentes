"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

import { FotoParlamentar } from "@/app/_painel/_componentes/FotoParlamentar";
import { type CasaCongresso, type Plenario, inteiro, porcento } from "@/app/_painel/_dados/congressoModelo";
import { chaveSeguido } from "@/lib/seguindoChave";
import {
  ALTURA_MAPA, ESTADOS, ESTADO_POR_SIGLA, LARGURA_MAPA, SIGLAS, type Estado, type Pergunta,
  atrasoDaOnda, enquadrar, fraseDoPlacar, montarDesafio, pesoDaBancada,
} from "./montagemModelo";
import type { Pessoa } from "./painelContaModelo";
import { type Alternar, type InfoPartido, Partido, Voto, casaCurta, dataDoFeed, siglaDe, turno } from "./partesConta";
import m from "./montagem.module.css";

export type InicioMontagem = "estado" | "desafio";
type Passo = "estado" | "bancada" | "desafio";

const semMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const corDoPartido = (info: InfoPartido | undefined) => (info && !info.vazado ? info.cor : "var(--tinta-3)");
const plural = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;

/**
 * A montagem da lista, em três passos: o estado no mapa, a bancada em rostos (um toque segue) e
 * um desafio com votações de verdade de quem a pessoa escolheu. Seguir grava na hora, como no
 * resto da conta; fechar a qualquer momento leva ao painel com o que já foi escolhido.
 */
export function Montagem({ inicio, nome, pessoas, seguindo, partidos, alternar, plenarios, carregando, busca, aoFechar }: {
  inicio: InicioMontagem;
  nome: string | null;
  /** Quem a conta já segue, na ordem em que seguiu. */
  pessoas: Pessoa[];
  seguindo: Set<string>;
  partidos: Record<string, InfoPartido>;
  alternar: Alternar;
  plenarios: Partial<Record<CasaCongresso, Plenario | null>>;
  /** Ainda baixando as votações de alguma casa de quem a conta segue. */
  carregando: boolean;
  busca: ReactNode;
  aoFechar: () => void;
}) {
  const [passo, setPasso] = useState<Passo>(inicio);
  const [uf, setUf] = useState<string | null>(null);
  const caixa = useRef<HTMLElement>(null);
  const irPara = (novo: Passo) => {
    setPasso(novo);
    const topo = caixa.current?.getBoundingClientRect().top ?? 0;
    if (topo < 0) caixa.current?.scrollIntoView({ block: "start", behavior: semMovimento() ? "auto" : "smooth" });
  };
  const estado = uf ? ESTADO_POR_SIGLA.get(uf) ?? null : null;
  const passos: [Passo, string, boolean][] = [
    ["estado", "Seu estado", true],
    ["bancada", "Sua bancada", !!estado],
    ["desafio", "Desafio", pessoas.length > 0],
  ];
  const indiceAtual = passos.findIndex(([p]) => p === passo);

  return <section ref={caixa} className={`vidro ${m.montagem}`} data-lustro="fixo" aria-labelledby="titulo-montagem" data-passo={passo}>
    <header className={m.topo}>
      <ol className={m.passos} aria-label="Passos">
        {passos.map(([valor, rotulo, liberado], i) => <li key={valor} data-feito={i < indiceAtual || undefined}>
          <button type="button" disabled={!liberado} aria-current={passo === valor ? "step" : undefined} onClick={() => irPara(valor)}>
            <span className={m.numeroPasso} aria-hidden="true">{i < indiceAtual ? "✓" : i + 1}</span><span className={m.rotuloPasso}>{rotulo}</span>
          </button>
        </li>)}
      </ol>
      <button type="button" className={m.fechar} onClick={aoFechar}>{pessoas.length ? "Ir para a minha página" : "Agora não"}</button>
    </header>

    {passo === "estado" && <PassoEstado nome={nome} busca={busca} aoEscolher={sigla => { setUf(sigla); irPara("bancada"); }} />}
    {passo === "bancada" && estado && <PassoBancada estado={estado} seguindo={seguindo} partidos={partidos} alternar={alternar}
      aoVoltar={() => irPara("estado")} />}
    {passo === "desafio" && (carregando
      ? <div className={m.ossoDesafio} aria-busy="true"><p className={m.frase}>Separando votações de quem você escolheu…</p></div>
      : <Desafio pessoas={pessoas} plenarios={plenarios} partidos={partidos} aoTerminar={aoFechar} />)}

    {passo !== "desafio" && (passo === "bancada" || pessoas.length > 0) && <Bandeja pessoas={pessoas} aoContinuar={() => irPara("desafio")} />}
  </section>;
}

// ---------------------------------------------------------------------------
// 1. O estado
// ---------------------------------------------------------------------------

function PassoEstado({ nome, busca, aoEscolher }: { nome: string | null; busca: ReactNode; aoEscolher: (sigla: string) => void }) {
  const [sobre, setSobre] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const escolher = (sigla: string) => {
    if (escolhido) return;
    setEscolhido(sigla);
    // O estado pula e acende antes de abrir a bancada.
    window.setTimeout(() => aoEscolher(sigla), semMovimento() ? 0 : 480);
  };
  const destaque = ESTADO_POR_SIGLA.get(escolhido ?? sobre ?? "");
  return <div className={m.estado}>
    <div className={m.estadoCabeca}>
      <p className={m.sobretitulo}>Vamos montar sua lista</p>
      <h2 id="titulo-montagem" className={m.titulo}>{nome ? `${nome}, de` : "De"} onde você vota?</h2>
      <p className={m.frase}>Cada estado elege 3 senadores e de 8 a 70 deputados federais. Comece por quem representa você: toque no mapa ou na sigla.</p>
    </div>
    <div className={m.estadoControles}>
      <div className={m.siglas} role="group" aria-label="Estados">
        {SIGLAS.map(sigla => {
          const e = ESTADO_POR_SIGLA.get(sigla)!;
          return <button key={sigla} type="button" aria-label={`${e.nome}: ${e.senadores.length} senadores e ${e.deputados.length} deputados`}
            data-ativo={destaque?.sigla === sigla || undefined} disabled={!!escolhido && escolhido !== sigla}
            onPointerEnter={() => setSobre(sigla)} onPointerLeave={() => setSobre(null)} onFocus={() => setSobre(sigla)} onBlur={() => setSobre(null)}
            onClick={() => escolher(sigla)}>{sigla}</button>;
        })}
      </div>
      <p className={m.leitura} aria-hidden="true">
        {destaque
          ? <><strong>{destaque.nome}</strong> {destaque.senadores.length} senadores · {destaque.deputados.length} deputados</>
          : <>Passe o mouse no mapa para ver o tamanho de cada bancada.</>}
      </p>
      {buscando
        ? <div className={m.buscaSolta}>{busca}</div>
        : <button type="button" className={m.link} onClick={() => setBuscando(true)}>Prefiro buscar pelo nome <span aria-hidden="true">→</span></button>}
    </div>
    <div className={m.mapa} data-escolhido={escolhido ?? undefined} onPointerLeave={() => setSobre(null)}>
      <svg viewBox={`0 0 ${LARGURA_MAPA} ${ALTURA_MAPA}`} aria-hidden="true">
        {ESTADOS.map(e => <path key={e.sigla} d={e.d} className={m.uf}
          style={{ animationDelay: `${atrasoDaOnda(e)}ms`, "--peso": pesoDaBancada(e).toFixed(3) } as CSSProperties}
          data-apagado={(!!escolhido && escolhido !== e.sigla) || undefined}
          onPointerEnter={() => setSobre(e.sigla)} onClick={() => escolher(e.sigla)} />)}
        {/* O estado em foco por cima dos vizinhos, levantado. */}
        {destaque && <path key={`l-${destaque.sigla}`} d={destaque.d} className={m.ufLevantado} data-escolhido={escolhido === destaque.sigla || undefined} />}
      </svg>
      {destaque && <span key={destaque.sigla} className={m.etiqueta}
        style={{ left: `${(destaque.centro[0] / LARGURA_MAPA) * 100}%`, top: `${(destaque.centro[1] / ALTURA_MAPA) * 100}%` }}>
        {destaque.sigla}<small>{inteiro(destaque.senadores.length + destaque.deputados.length)} no Congresso</small>
      </span>}
      <p className={m.legenda} aria-hidden="true"><i />Cor mais forte, bancada maior</p>
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// 2. A bancada
// ---------------------------------------------------------------------------

function PassoBancada({ estado, seguindo, partidos, alternar, aoVoltar }: {
  estado: Estado; seguindo: Set<string>; partidos: Record<string, InfoPartido>; alternar: Alternar; aoVoltar: () => void;
}) {
  const [filtro, setFiltro] = useState<string | null>(null);
  // A última pessoa seguida, com um carimbo de tempo para a animação recomeçar a cada toque.
  const [estouro, setEstouro] = useState<string | null>(null);
  const todos = [...estado.senadores, ...estado.deputados];
  const contagem = new Map<string, number>();
  for (const x of todos) contagem.set(siglaDe(x), (contagem.get(siglaDe(x)) ?? 0) + 1);
  const siglas = [...contagem].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const visivel = (x: Pessoa) => !filtro || siglaDe(x) === filtro;
  const tocar = (x: Pessoa) => {
    const seguir = !seguindo.has(chaveSeguido(x));
    if (seguir) setEstouro(`${chaveSeguido(x)}@${Date.now()}`);
    alternar(x, seguir);
  };
  const seguidosAqui = todos.filter(x => seguindo.has(chaveSeguido(x))).length;
  const senadoresFora = estado.senadores.filter(x => !seguindo.has(chaveSeguido(x)));
  const grupos: [string, string, Pessoa[]][] = [
    ["senado", "Senado", estado.senadores.filter(visivel)],
    ["camara", "Câmara", estado.deputados.filter(visivel)],
  ];

  return <div className={m.bancada}>
    <div className={m.bancadaTopo}>
      <svg viewBox={enquadrar(estado)} className={m.silhueta} aria-hidden="true"><path d={estado.d} /></svg>
      <div className={m.bancadaTexto}>
        <button type="button" className={m.voltar} onClick={aoVoltar}><span aria-hidden="true">←</span> Trocar de estado</button>
        <h2 id="titulo-montagem" className={m.titulo}>A bancada {estado.deNome}</h2>
        <p className={m.frase}>
          {plural(estado.senadores.length, "senador", "senadores")} e {plural(estado.deputados.length, "deputado federal", "deputados federais")}. Toque em quem você quer acompanhar.
          {seguidosAqui > 0 && <> <strong className={m.contador}>{plural(seguidosAqui, "escolhido", "escolhidos")} aqui</strong></>}
        </p>
      </div>
    </div>

    <div className={m.filtroPartidos} role="radiogroup" aria-label="Filtrar por partido">
      <button type="button" role="radio" aria-checked={filtro === null} onClick={() => setFiltro(null)}>Todos <span className="tabular">{inteiro(todos.length)}</span></button>
      {siglas.map(([sigla, n]) => <button key={sigla} type="button" role="radio" aria-checked={filtro === sigla}
        style={{ "--cor-partido": corDoPartido(partidos[sigla]) } as CSSProperties}
        onClick={() => setFiltro(atual => (atual === sigla ? null : sigla))}>
        <i aria-hidden="true" />{partidos[sigla]?.rotulo ?? sigla} <span className="tabular">{inteiro(n)}</span>
      </button>)}
    </div>

    {grupos.map(([chave, titulo, lista]) => !lista.length ? null : <section key={chave} className={m.grupo} aria-labelledby={`grupo-${chave}`}>
      <div className={m.grupoTopo}>
        <h3 id={`grupo-${chave}`}>{titulo} <span className="tabular">{inteiro(lista.length)}</span></h3>
        {chave === "senado" && !filtro && senadoresFora.length > 1 && <button type="button" className={m.todos}
          onClick={() => { setEstouro(`senado@${Date.now()}`); senadoresFora.forEach(x => alternar(x, true)); }}>
          Seguir {senadoresFora.length === estado.senadores.length ? `os ${senadoresFora.length}` : `os outros ${senadoresFora.length}`}
        </button>}
      </div>
      <ul className={m.rostos} data-grande={chave === "senado" || undefined}>
        {lista.map(x => {
          const k = chaveSeguido(x);
          const estourou = !!estouro && (estouro.startsWith(`${k}@`) || (x.casa === "senadores" && estouro.startsWith("senado@")));
          return <li key={k}>
            <Rosto pessoa={x} info={partidos[siglaDe(x)]} seguindo={seguindo.has(k)} estouro={estourou && seguindo.has(k) ? estouro : null}
              grande={chave === "senado"} aoTocar={() => tocar(x)} />
          </li>;
        })}
      </ul>
    </section>)}
  </div>;
}

function Rosto({ pessoa, info, seguindo, estouro, grande, aoTocar }: {
  pessoa: Pessoa; info: InfoPartido | undefined; seguindo: boolean; estouro: string | null; grande: boolean; aoTocar: () => void;
}) {
  return <button type="button" className={m.rosto} aria-pressed={seguindo} aria-label={`Seguir ${pessoa.nome}${info ? `, ${info.rotulo}` : ""}`}
    onClick={aoTocar} style={{ "--cor-partido": corDoPartido(info) } as CSSProperties}>
    <span className={m.foto} data-estouro={estouro ? "" : undefined}>
      <FotoParlamentar casa={pessoa.casa} id={pessoa.id} nome={pessoa.nome} tamanho={grande ? 72 : 56} />
      <span className={m.marca} aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.3 2.4 2.4 4.6-5" /></svg>
      </span>
      {estouro && <span key={estouro} className={m.estouro} aria-hidden="true">{Array.from({ length: 10 }, (_, k) => <i key={k} style={{ "--k": k } as CSSProperties} />)}</span>}
    </span>
    <span className={m.rostoNome}>{pessoa.nome}</span>
    <Partido info={info} />
  </button>;
}

/** O rodapé da montagem: quem já está na lista, em fotos empilhadas, e o próximo passo. */
function Bandeja({ pessoas, aoContinuar }: { pessoas: Pessoa[]; aoContinuar: () => void }) {
  // A mais nova primeiro, por cima das outras: quem acabou de entrar aparece na hora.
  const ultimos = pessoas.slice(-7).reverse();
  return <div className={m.bandeja}>
    <span className={m.pilha} aria-hidden="true">
      {ultimos.map((x, i) => <span key={chaveSeguido(x)} className={m.pilhaFoto} style={{ zIndex: ultimos.length - i }}>
        <FotoParlamentar casa={x.casa} id={x.id} nome={x.nome} tamanho={34} />
      </span>)}
      {pessoas.length > ultimos.length && <span className={m.pilhaMais}>+{inteiro(pessoas.length - ultimos.length)}</span>}
    </span>
    <p className={m.bandejaTexto} aria-live="polite">
      {pessoas.length ? <><strong className="tabular">{inteiro(pessoas.length)}</strong> {pessoas.length === 1 ? "pessoa na sua lista" : "pessoas na sua lista"}</> : "Ninguém na lista ainda. Toque num rosto."}
    </p>
    <button type="button" className={m.continuar} disabled={!pessoas.length} onClick={aoContinuar}>
      Continuar <span aria-hidden="true">→</span>
    </button>
  </div>;
}

// ---------------------------------------------------------------------------
// 3. O desafio
// ---------------------------------------------------------------------------

function Desafio(props: { pessoas: Pessoa[]; plenarios: Partial<Record<CasaCongresso, Plenario | null>>; partidos: Record<string, InfoPartido>; aoTerminar: () => void }) {
  // Cada partida sorteia de novo; a chave remonta o jogo.
  const [partida, setPartida] = useState(0);
  return <Jogo key={partida} {...props} aoRecomecar={() => setPartida(n => n + 1)} />;
}

type Resposta = { escolha: "S" | "N"; comDica: boolean };

function Jogo({ pessoas, plenarios, partidos, aoTerminar, aoRecomecar }: {
  pessoas: Pessoa[]; plenarios: Partial<Record<CasaCongresso, Plenario | null>>; partidos: Record<string, InfoPartido>;
  aoTerminar: () => void; aoRecomecar: () => void;
}) {
  // Sorteadas uma vez por partida: seguir mais alguém no meio não troca as perguntas.
  const [perguntas] = useState(() => montarDesafio(plenarios, pessoas));
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<(Resposta | undefined)[]>([]);
  const [dica, setDica] = useState(false);
  const acertos = perguntas.filter((q, i) => respostas[i]?.escolha === q.letra).length;
  const fim = indice >= perguntas.length;
  const respondida = !fim && !!respostas[indice];

  // Pelo teclado: S e N respondem, D abre a dica (Enter segue, no botão que recebe o foco).
  useEffect(() => {
    if (fim || respondida) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      if (k === "s" || k === "n") setRespostas(r => { const novo = [...r]; novo[indice] = { escolha: k === "s" ? "S" : "N", comDica: dica }; return novo; });
      else if (k === "d") setDica(true);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fim, respondida, indice, dica]);

  if (fim) return <Fim acertos={acertos} perguntas={perguntas} respostas={respostas} pessoas={pessoas} partidos={partidos}
    aoTerminar={aoTerminar} aoRecomecar={perguntas.length ? aoRecomecar : null} />;

  const q = perguntas[indice];
  const resposta = respostas[indice];
  const responder = (escolha: "S" | "N") => setRespostas(r => { const novo = [...r]; novo[indice] = { escolha, comDica: dica }; return novo; });
  const proxima = () => { setDica(false); setIndice(i => i + 1); };

  return <div className={m.desafio}>
    <div className={m.desafioTopo}>
      <p className={m.sobretitulo}>Desafio · você conhece quem escolheu?</p>
      <ol className={m.rodadas} aria-label={`Pergunta ${indice + 1} de ${perguntas.length}`}>
        {perguntas.map((p, i) => {
          const r = respostas[i];
          const estado = r ? (r.escolha === p.letra ? "acerto" : "erro") : i === indice ? "atual" : undefined;
          return <li key={i} data-estado={estado} aria-label={r ? (r.escolha === p.letra ? "acertou" : "errou") : i === indice ? "agora" : "falta"}>
            {estado === "acerto" ? <Estrela tamanho={12} /> : null}
          </li>;
        })}
      </ol>
    </div>
    <article key={indice} className={m.pergunta}>
      <Cartinha q={q} info={partidos[siglaDe(q.pessoa)]} />
      {!resposta
        ? <div className={m.escolha}>
          <div className={m.botoesVoto}>
            <button type="button" onClick={() => responder("S")}>
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 6.3 2.4 2.4 4.6-5" /></svg>
              Votou Sim <kbd className={m.tecla}>S</kbd>
            </button>
            <button type="button" onClick={() => responder("N")}>
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" /></svg>
              Votou Não <kbd className={m.tecla}>N</kbd>
            </button>
          </div>
          {dica ? <Dica q={q} info={partidos[siglaDe(q.pessoa)]} /> : <button type="button" className={m.link} onClick={() => setDica(true)}>
            <Lampada /> Quer uma dica? <kbd className={m.tecla}>D</kbd>
          </button>}
        </div>
        : <Revelacao q={q} resposta={resposta} sequencia={sequencia(perguntas, respostas, indice)} ultima={indice === perguntas.length - 1} aoSeguir={proxima} />}
    </article>
    <button type="button" className={m.pular} onClick={aoTerminar}>Pular o desafio</button>
  </div>;
}

function Cartinha({ q, info }: { q: Pergunta; info: InfoPartido | undefined }) {
  const v = q.votacao;
  const d = dataDoFeed(v.data);
  return <>
    <div className={m.quemPergunta} style={{ "--cor-partido": corDoPartido(info) } as CSSProperties}>
      <span className={m.fotoGrande}><FotoParlamentar casa={q.pessoa.casa} id={q.pessoa.id} nome={q.pessoa.nome} tamanho={88} prioridade /></span>
      <div>
        <h2 id="titulo-montagem" className={m.tituloPergunta}>Como <strong>{q.pessoa.nome}</strong> votou?</h2>
        <span className={m.onde}><Partido info={info} /> {casaCurta(q.pessoa.casa)} · {q.pessoa.uf}</span>
      </div>
    </div>
    <div className={m.materia}>
      <p className={m.materiaTopo}>
        <strong>{v.titulo ? `${v.titulo}${turno(v.descricao)}` : "Votação nominal"}</strong>
        <time dateTime={v.data.slice(0, 10)}>{Number(d.dia)} {d.mes} {d.ano}</time>
      </p>
      <p className={m.ementa}>{v.ementa || v.descricao}</p>
    </div>
  </>;
}

function Dica({ q, info }: { q: Pergunta; info: InfoPartido | undefined }) {
  const { partido, comGoverno } = q.dica;
  const partidoRotulo = info?.rotulo ?? q.pessoa.partido;
  const governo = q.votacao.governo;
  return <div className={m.dica} role="note">
    <p className={m.dicaTitulo}><Lampada /> Dica</p>
    <ul>
      {partido && <li>Colegas de partido ({partidoRotulo}): {partido.sim ? `${inteiro(partido.sim)} ${partido.sim === 1 ? "votou" : "votaram"}` : "nenhum votou"} Sim e {partido.nao ? `${inteiro(partido.nao)} ${partido.nao === 1 ? "votou" : "votaram"}` : "nenhum votou"} Não.</li>}
      <li>{governo ? `O governo orientou ${governo}.` : "O governo não orientou o voto nessa."}</li>
      {comGoverno && <li>{q.pessoa.nome.split(" ")[0]} votou como o governo orientou em {porcento(comGoverno.taxa)} das votações de {comGoverno.ano}.</li>}
    </ul>
  </div>;
}

/** Quantos acertos seguidos terminam na pergunta `ate`. */
function sequencia(perguntas: Pergunta[], respostas: (Resposta | undefined)[], ate: number) {
  let n = 0;
  for (let i = ate; i >= 0 && respostas[i]?.escolha === perguntas[i].letra; i--) n++;
  return n;
}

function Revelacao({ q, resposta, sequencia, ultima, aoSeguir }: { q: Pergunta; resposta: Resposta; sequencia: number; ultima: boolean; aoSeguir: () => void }) {
  const acertou = resposta.escolha === q.letra;
  const v = q.votacao;
  const casa = q.pessoa.casa === "deputados" ? "A Câmara" : "O Senado";
  return <div className={m.revelacao} data-acerto={acertou || undefined}>
    <p className={m.veredito} role="status">
      {acertou
        ? <><span className={m.selo}><Estrela tamanho={18} /><span className={m.estouroEstrela} aria-hidden="true" /></span>Acertou!{resposta.comDica && <small>com dica</small>}{sequencia >= 2 && <span className={m.sequencia}>{sequencia} seguidas</span>}</>
        : <>Não foi dessa vez</>}
    </p>
    <p className={m.fato}>
      {q.pessoa.nome} votou <Voto letra={q.letra} />.{" "}
      {v.placarInformado !== false && v.sim + v.nao > 0
        ? `${casa} ${v.aprovada ? "aprovou" : "rejeitou"} por ${inteiro(v.sim)} a ${inteiro(v.nao)}.`
        : `${casa} ${v.aprovada ? "aprovou" : "rejeitou"}.`}
      {v.governo ? ` O governo orientou ${v.governo}.` : ""}
    </p>
    <button type="button" className={m.continuar} onClick={aoSeguir} autoFocus>
      {ultima ? "Ver o resultado" : "Próxima"} <span aria-hidden="true">→</span>
    </button>
  </div>;
}

function Fim({ acertos, perguntas, respostas, pessoas, partidos, aoTerminar, aoRecomecar }: {
  acertos: number; perguntas: Pergunta[]; respostas: (Resposta | undefined)[]; pessoas: Pessoa[]; partidos: Record<string, InfoPartido>;
  aoTerminar: () => void; aoRecomecar: (() => void) | null;
}) {
  const total = perguntas.length;
  const frase = fraseDoPlacar(acertos, total);
  return <div className={m.fim}>
    <Confete />
    <p className={m.sobretitulo}>{total ? "Desafio concluído" : "Tudo certo"}</p>
    {total > 0 && <p className={m.placarGrande}><strong className="tabular">{inteiro(acertos)}</strong> de {inteiro(total)}</p>}
    <h2 id="titulo-montagem" className={m.titulo}>{frase.titulo}</h2>
    <p className={m.frase}>{frase.texto}</p>
    {total > 0 && <ol className={m.recap} aria-label="Suas respostas">
      {perguntas.map((q, i) => {
        const acertou = respostas[i]?.escolha === q.letra;
        return <li key={i} style={{ "--i": i } as CSSProperties}>
          <span className={m.recapMarca} data-acerto={acertou || undefined} role="img" aria-label={acertou ? "Acertou" : "Errou"}>
            {acertou ? <Estrela tamanho={12} /> : <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" /></svg>}
          </span>
          <FotoParlamentar casa={q.pessoa.casa} id={q.pessoa.id} nome={q.pessoa.nome} tamanho={28} />
          <span className={m.recapTexto}><strong>{q.pessoa.nome}</strong><small>{q.votacao.titulo ? `${q.votacao.titulo}${turno(q.votacao.descricao)}` : "Votação nominal"}</small></span>
          <Voto letra={q.letra} />
        </li>;
      })}
    </ol>}
    {total === 0 && <ul className={m.fimRostos} aria-label="Quem você segue">
      {pessoas.slice(0, 12).map((x, i) => <li key={chaveSeguido(x)} style={{ "--i": i, "--cor-partido": corDoPartido(partidos[siglaDe(x)]) } as CSSProperties} title={x.nome}>
        <FotoParlamentar casa={x.casa} id={x.id} nome={x.nome} tamanho={44} />
      </li>)}
      {pessoas.length > 12 && <li className={m.pilhaMais}>+{inteiro(pessoas.length - 12)}</li>}
    </ul>}
    <div className={m.acoesFim}>
      <button type="button" className={m.continuar} onClick={aoTerminar} autoFocus>Ver minha página <span aria-hidden="true">→</span></button>
      {aoRecomecar && <button type="button" className={m.secundario} onClick={aoRecomecar}>Jogar de novo <span aria-hidden="true">↻</span></button>}
    </div>
  </div>;
}

/** Confete da marca: amarelo, azul, coral e violeta. Sorteado uma vez, ao montar. */
function Confete() {
  const [pedacos] = useState(() => Array.from({ length: 56 }, (_, i) => ({
    x: Math.round((Math.random() - 0.5) * 620),
    y: Math.round(-90 - Math.random() * 200),
    queda: Math.round(220 + Math.random() * 220),
    giro: Math.round((Math.random() - 0.5) * 1080),
    atraso: Math.round(Math.random() * 160),
    cor: ["#EFFF00", "#2A78D6", "#FF6448", "#BFA7FF"][i % 4],
    forma: i % 3,
  })));
  return <span className={m.confete} aria-hidden="true">
    {pedacos.map((c, i) => <i key={i} data-forma={c.forma} style={{
      "--x": `${c.x}px`, "--y": `${c.y}px`, "--queda": `${c.queda}px`, "--giro": `${c.giro}deg`, "--cor": c.cor, animationDelay: `${c.atraso}ms`,
    } as CSSProperties} />)}
  </span>;
}

const Estrela = ({ tamanho }: { tamanho: number }) => <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
  <path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9Z" fill="currentColor" />
</svg>;

const Lampada = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
</svg>;
