"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { type CSSProperties, type ReactNode, useActionState, useDeferredValue, useMemo, useOptimistic, useState, useTransition } from "react";

import { FotoParlamentar } from "@/app/_painel/_componentes/FotoParlamentar";
import {
  type CasaCongresso, type IndiceCota, type Plenario,
  caminhoParlamentar, inteiro, porcento, reaisCompactos,
} from "@/app/_painel/_dados/congressoModelo";
import { useJson } from "@/app/_painel/_dados/useJson";
import { chaveSeguido, type ChaveSeguido } from "@/lib/seguindoChave";
import { alternarSeguir, sair } from "./acoes";
import type { InicioMontagem } from "./Montagem";
import {
  type ItemFeed, type Par, type Pessoa,
  PESSOA_POR_CHAVE, buscarParlamentares, feedDeVotacoes, mesmaChave, numerosDaPessoa, quemVotaJunto,
} from "./painelContaModelo";
import { type Alternar, type InfoPartido, MESES_CURTOS, Partido, Voto, casaCurta, dataDoFeed, siglaDe, turno } from "./partesConta";
import p from "./painel.module.css";

export type { InfoPartido };
type Seguido = ChaveSeguido & { desde: string };

const VOTACOES_POR_VEZ = 12;

/** A montagem (mapa, bancada e desafio) só baixa para quem abre: conta nova ou quem pede. */
const Montagem = dynamic(() => import("./Montagem").then(x => x.Montagem), {
  loading: () => <div className={`vidro ${p.bloco} ${p.ossoMontagem}`} data-lustro="fixo" aria-busy="true" />,
});

/**
 * "Minha conta": quem a pessoa segue no Congresso, como cada um votou nas últimas votações de
 * mérito, presença, voto com o governo e cota, e quem vota junto. Seguir e deixar de seguir
 * aparecem na hora (`useOptimistic`) e o servidor confirma.
 */
export function PainelConta({ usuario, seguidos, partidos, sugestao }: {
  usuario: { nome: string | null; email: string };
  /** null: a lista não pôde ser lida (banco fora do ar ou tabela ainda não criada). */
  seguidos: Seguido[] | null;
  partidos: Record<string, InfoPartido>;
  sugestao: ChaveSeguido | null;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const [lista, mudarLista] = useOptimistic(seguidos ?? [], (atual, { chave, seguir }: { chave: ChaveSeguido; seguir: boolean }) =>
    seguir
      ? atual.some(s => mesmaChave(s, chave)) ? atual : [...atual, { ...chave, desde: new Date().toISOString().slice(0, 10) }]
      : atual.filter(s => !mesmaChave(s, chave)));
  const alternar: Alternar = (pessoa, seguir) => {
    setErro(null);
    iniciar(async () => {
      mudarLista({ chave: pessoa, seguir });
      const resposta = await alternarSeguir(pessoa.casa, pessoa.id, seguir);
      if (resposta.erro) setErro(resposta.erro);
    });
  };

  const pessoas = lista.map(s => PESSOA_POR_CHAVE.get(chaveSeguido(s))).filter((x): x is Pessoa => !!x);
  const seguindo = new Set(lista.map(chaveSeguido));
  const temCasa = (casa: CasaCongresso) => pessoas.some(x => x.casa === casa);
  const plenarios = {
    deputados: useJson<Plenario>(temCasa("deputados") ? "/painel/congresso/plenario-deputados.json" : null),
    senadores: useJson<Plenario>(temCasa("senadores") ? "/painel/congresso/plenario-senadores.json" : null),
  };
  const cotas = {
    deputados: useJson<IndiceCota>(temCasa("deputados") ? "/painel/congresso/cota-deputados.json" : null).dados,
    senadores: useJson<IndiceCota>(temCasa("senadores") ? "/painel/congresso/cota-senadores.json" : null).dados,
  };
  const dados = { deputados: plenarios.deputados.dados, senadores: plenarios.senadores.dados };
  const carregando = pessoas.some(x => !dados[x.casa] && !plenarios[x.casa].erro);
  const falhou = plenarios.deputados.erro || plenarios.senadores.erro;
  const feed = useMemo(() => feedDeVotacoes(dados, pessoas), [dados.deputados, dados.senadores, lista]); // eslint-disable-line react-hooks/exhaustive-deps
  const pares = useMemo(() => quemVotaJunto(dados, pessoas), [dados.deputados, dados.senadores, lista]); // eslint-disable-line react-hooks/exhaustive-deps
  const atualizado = [dados.deputados?.coletadoEm, dados.senadores?.coletadoEm].filter(Boolean).sort().at(-1);

  const sugerida = sugestao ? PESSOA_POR_CHAVE.get(chaveSeguido(sugestao)) : undefined;
  const indisponivel = seguidos === null;
  const busca = (foco = false) => <Busca seguindo={seguindo} partidos={partidos} alternar={alternar} foco={foco} />;
  // Conta sem ninguém começa na montagem; depois ela abre pelo mapa ou pelo desafio.
  const [montagem, setMontagem] = useState<InicioMontagem | null>(() => (seguidos?.length === 0 ? "estado" : null));
  const abrirMontagem = (inicio: InicioMontagem | null) => {
    setMontagem(inicio);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return <div className={p.painel} data-largura="painel">
    <header className={`vidro ${p.cabeca}`} data-lustro="fixo">
      <span className={p.avatar} aria-hidden="true">{iniciais(usuario.nome ?? usuario.email)}</span>
      <div className={p.saudacao}>
        <p className={p.sobretitulo}>Minha conta</p>
        <h1>{usuario.nome ? `Olá, ${usuario.nome.split(" ")[0]}` : "Olá!"}</h1>
        <p className={p.email}>{usuario.email}</p>
      </div>
      {pessoas.length > 0 && <dl className={p.resumo}>
        <div><dt>Seguindo</dt><dd className="tabular">{inteiro(pessoas.length)}</dd></div>
        <div><dt>Votações</dt><dd className="tabular">{carregando ? "…" : inteiro(feed.length)}</dd></div>
        <div><dt>Atualizado</dt><dd className="tabular">{atualizado ? <time dateTime={atualizado.slice(0, 10)} title={dataCurta(atualizado)}>{diaMes(atualizado)}</time> : "—"}</dd></div>
      </dl>}
      <Sair />
    </header>

    {erro && <p className={p.erro} role="alert">{erro}</p>}

    {sugerida && !indisponivel && <Sugestao pessoa={sugerida} info={partidos[siglaDe(sugerida)]} seguindo={seguindo.has(chaveSeguido(sugerida))} alternar={alternar} />}

    {indisponivel ? <section className={`vidro ${p.bloco} ${p.indisponivel}`} data-lustro="fixo">
      <h2>Seguir parlamentares está fora do ar</h2>
      <p>Não deu para ler a sua lista agora. Sua conta está funcionando; tente de novo em instantes.</p>
    </section> : montagem ? <Montagem inicio={montagem} nome={usuario.nome?.split(" ")[0] ?? null} pessoas={pessoas} seguindo={seguindo}
      partidos={partidos} alternar={alternar} plenarios={dados} carregando={carregando} busca={busca(true)} aoFechar={() => abrirMontagem(null)} />
      : !pessoas.length ? <Vazio busca={busca(true)} aoMontar={() => abrirMontagem("estado")} /> : <div className={p.colunas}>
      <div className={p.principal}>
        <section aria-labelledby="titulo-seguidos">
          <Capitulo id="titulo-seguidos" titulo="Quem você segue"
            frase={`${inteiro(pessoas.length)} ${pessoas.length === 1 ? "parlamentar" : "parlamentares"}. Presença, votos e cota ${anoDosNumeros(dados) ? `em ${anoDosNumeros(dados)}` : "no ano"}, com a mediana da casa ao lado.`} />
          <ul className={p.cartoes}>
            {pessoas.map(pessoa => <Cartao key={chaveSeguido(pessoa)} pessoa={pessoa} info={partidos[siglaDe(pessoa)]}
              plenario={dados[pessoa.casa]} indice={cotas[pessoa.casa]} alternar={alternar} />)}
          </ul>
        </section>
        <section aria-labelledby="titulo-feed">
          <Capitulo id="titulo-feed" titulo="Como votaram"
            frase="As últimas votações de mérito do plenário, com o voto de cada pessoa que você segue. Verde e vermelho são só o Sim e o Não." />
          <Feed itens={feed} carregando={carregando} falhou={falhou} partidos={partidos} />
        </section>
      </div>
      <aside className={p.lateral} aria-label="Seguir e comparar">
        <section className={`vidro ${p.bloco}`} data-lustro="fixo" aria-labelledby="titulo-busca">
          <h2 id="titulo-busca" className={p.tituloBloco}>Seguir mais alguém</h2>
          {busca()}
          <button type="button" className={p.peloMapa} onClick={() => abrirMontagem("estado")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14m6-12v14" /></svg>
            Escolher pela bancada do estado <span aria-hidden="true">→</span>
          </button>
        </section>
        <section className={`vidro ${p.bloco} ${p.convite}`} data-lustro="fixo" aria-labelledby="titulo-convite">
          <span className={p.conviteIcone} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2-4.6-4.4 6.3-.9Z" fill="currentColor" /></svg>
          </span>
          <div>
            <h2 id="titulo-convite" className={p.tituloBloco}>Você conhece quem segue?</h2>
            <p className={p.detalheBloco}>Cinco votações de verdade: adivinhe como cada um votou.</p>
          </div>
          <button type="button" className={p.botaoConvite} onClick={() => abrirMontagem("desafio")}>Jogar <span aria-hidden="true">→</span></button>
        </section>
        <VotamJunto pares={pares} carregando={carregando} total={pessoas.length} />
      </aside>
    </div>}
  </div>;
}

const iniciais = (texto: string) => texto.trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(t => t[0]?.toLocaleUpperCase("pt-BR")).join("");
const dataCurta = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
/** "13 nov": a coleta é sempre recente, o ano só ocupa espaço (fica no title). */
const diaMes = (d: string) => { const { dia, mes } = dataDoFeed(d); return `${dia} ${mes}`; };
function anoDosNumeros(dados: Partial<Record<CasaCongresso, Plenario | null>>) {
  const anos = (["deputados", "senadores"] as const).map(c => dados[c]?.anos.at(-1)).filter((a): a is number => !!a);
  return anos.length ? Math.max(...anos) : null;
}

function Capitulo({ id, titulo, frase }: { id: string; titulo: string; frase: string }) {
  return <header className={p.capitulo}>
    <h2 id={id}>{titulo}</h2>
    <p>{frase}</p>
  </header>;
}

/** Toggle de seguir: o nome acessível fica fixo ("Seguir Fulano") e o estado vai no aria-pressed. */
function BotaoSeguir({ pessoa, seguindo, alternar, destaque = false }: { pessoa: Pessoa; seguindo: boolean; alternar: Alternar; destaque?: boolean }) {
  return <button type="button" className={p.seguir} data-seguindo={seguindo || undefined} data-destaque={destaque || undefined}
    aria-pressed={seguindo} aria-label={`Seguir ${pessoa.nome}`} onClick={() => alternar(pessoa, !seguindo)}>
    {seguindo
      ? <><span className={p.seguindoTexto}><svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m2.5 6.3 2.4 2.4 4.6-5" /></svg>Seguindo</span>
        <span className={p.deixarTexto}>Deixar de seguir</span></>
      : <><svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 2.5v7M2.5 6h7" /></svg>Seguir</>}
  </button>;
}

function Sair() {
  const [erro, acao, enviando] = useActionState(sair, null);
  return <form action={acao} className={p.sair}>
    <button className={p.botaoSair} disabled={enviando}>{enviando ? "Saindo…" : "Sair"}</button>
    {erro && <p className={p.erroPequeno} role="alert">{erro}</p>}
  </form>;
}

/** Quem veio do botão "Seguir" de um parlamentar sem estar logado: depois de entrar, um clique segue. */
function Sugestao({ pessoa, info, seguindo, alternar }: { pessoa: Pessoa; info: InfoPartido | undefined; seguindo: boolean; alternar: Alternar }) {
  return <section className={`vidro ${p.sugestao}`} data-lustro="fixo" aria-label="Parlamentar sugerido">
    <FotoParlamentar casa={pessoa.casa} id={pessoa.id} nome={pessoa.nome} tamanho={44} />
    <p>{seguindo
      ? <>Agora você segue <strong>{pessoa.nome}</strong>. Os votos aparecem abaixo.</>
      : <>Você veio da página de <strong>{pessoa.nome}</strong>. <span className={p.onde}><Partido info={info} /> {casaCurta(pessoa.casa)} · {pessoa.uf}</span></>}</p>
    {!seguindo && <BotaoSeguir pessoa={pessoa} seguindo={false} alternar={alternar} destaque />}
  </section>;
}

function Vazio({ busca, aoMontar }: { busca: ReactNode; aoMontar: () => void }) {
  const itens: [ReactNode, string, string][] = [
    [<path key="u" d="M5 10h14v9H5zM8 10V6.5A1.5 1.5 0 0 1 9.5 5h5A1.5 1.5 0 0 1 16 6.5V10M10 14h4" />, "Como cada um votou", "Sim, Não, abstenção ou ausência em cada votação de mérito, ao lado do que o governo orientou."],
    [<path key="p" d="M4 19V5m0 14h16M8 15l3-4 3 2 5-6" />, "Presença e voto com o governo", "No ano, com a mediana da casa ao lado para comparar."],
    [<path key="c" d="M7 4h10v16l-2.5-1.5L12 20l-2.5-1.5L7 20zM10 9h4m-4 3h4" />, "Gasto da cota parlamentar", "Quanto usou no ano e se ficou acima ou abaixo da média."],
    [<path key="j" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5 0a2.5 2.5 0 1 0 0-5M3.5 19a5.5 5.5 0 0 1 11 0m2-4.6A5 5 0 0 1 20.5 19" />, "Quem vota junto", "Entre os que você segue na mesma casa, quem vota igual e quem não."],
  ];
  return <section className={`vidro ${p.vazio}`} data-lustro="fixo" aria-labelledby="titulo-vazio">
    <div className={p.vazioTexto}>
      <p className={p.sobretitulo}>Comece por aqui</p>
      <h2 id="titulo-vazio">Siga quem representa você</h2>
      <p className={p.vazioFrase}>Escolha deputados e senadores para acompanhar num lugar só.</p>
      <button type="button" className={`${p.seguir} ${p.vazioMapa}`} data-destaque onClick={aoMontar}>
        Escolher pelo mapa <span aria-hidden="true">→</span>
      </button>
      <ul className={p.beneficios}>
        {itens.map(([icone, titulo, texto]) => <li key={titulo}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icone}</svg>
          <span><strong>{titulo}</strong>{texto}</span>
        </li>)}
      </ul>
    </div>
    <div className={p.vazioBusca}>{busca}</div>
  </section>;
}

function Busca({ seguindo, partidos, alternar, foco }: { seguindo: Set<string>; partidos: Record<string, InfoPartido>; alternar: Alternar; foco: boolean }) {
  const [texto, setTexto] = useState("");
  const [casa, setCasa] = useState<CasaCongresso | null>(null);
  const consulta = useDeferredValue(texto);
  const { lista, uf } = useMemo(() => buscarParlamentares(consulta, casa), [consulta, casa]);
  const visiveis = uf ? lista : lista.slice(0, 8);
  const opcoes: [CasaCongresso | null, string][] = [[null, "Todos"], ["deputados", "Câmara"], ["senadores", "Senado"]];
  return <div className={p.busca}>
    <label className={p.campoBusca}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
      <span className="sr-only">Buscar deputado ou senador</span>
      <input type="search" value={texto} onChange={e => setTexto(e.target.value)} autoFocus={foco}
        placeholder="Nome, partido ou estado" autoComplete="off" spellCheck={false} />
    </label>
    <div className={`segmentos ${p.casas}`} role="radiogroup" aria-label="Casa">
      {opcoes.map(([valor, rotulo]) => <button key={rotulo} type="button" role="radio" aria-checked={casa === valor} onClick={() => setCasa(valor)}>{rotulo}</button>)}
    </div>
    {!consulta.trim()
      ? <p className={p.dica}>Digite um nome, um partido (PT, PL, MDB…) ou a sigla do estado, como <button type="button" className={p.exemplo} onClick={() => setTexto("SP")}>SP</button>, para ver a bancada inteira.</p>
      : !lista.length
        ? <p className={p.dica}>Ninguém encontrado na composição atual{casa ? ` ${casa === "deputados" ? "da Câmara" : "do Senado"}` : ""}.</p>
        : <>
          {uf && <p className={p.dica}>Bancada de {uf}: {inteiro(lista.length)} {lista.length === 1 ? "parlamentar" : "parlamentares"}.</p>}
          <ul className={p.resultados} data-rola={uf ? true : undefined} aria-live="polite">
            {visiveis.map(pessoa => <li key={chaveSeguido(pessoa)} className={p.resultado}>
              <FotoParlamentar casa={pessoa.casa} id={pessoa.id} nome={pessoa.nome} tamanho={36} />
              <span className={p.resultadoTexto}>
                <Link href={caminhoParlamentar(pessoa.casa, pessoa)}>{pessoa.nome}</Link>
                <span className={p.onde}><Partido info={partidos[siglaDe(pessoa)]} /> {casaCurta(pessoa.casa)} · {pessoa.uf}</span>
              </span>
              <BotaoSeguir pessoa={pessoa} seguindo={seguindo.has(chaveSeguido(pessoa))} alternar={alternar} />
            </li>)}
          </ul>
          {lista.length > visiveis.length && <p className={p.dica}>E mais {inteiro(lista.length - visiveis.length)}. Escreva mais do nome para achar quem procura.</p>}
        </>}
  </div>;
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string | null }) {
  return <div className={p.numero}>
    <dt>{rotulo}</dt>
    <dd className="tabular">{valor}</dd>
    {detalhe && <dd className={p.numeroDetalhe}>{detalhe}</dd>}
  </div>;
}

function Cartao({ pessoa, info, plenario, indice, alternar }: {
  pessoa: Pessoa; info: InfoPartido | undefined; plenario: Plenario | null; indice: IndiceCota | null; alternar: Alternar;
}) {
  const n = useMemo(() => numerosDaPessoa(pessoa, plenario, indice), [pessoa, plenario, indice]);
  const camara = pessoa.casa === "deputados";
  const med = (t: number | null | undefined) => (t == null ? null : `mediana ${porcento(t)}`);
  const ultimo = n.ultimo;
  return <li className={`vidro ${p.cartao}`} data-lustro="fixo" style={{ "--cor-partido": info?.vazado ? "var(--borda)" : info?.cor } as CSSProperties}>
    <div className={p.quem}>
      <FotoParlamentar casa={pessoa.casa} id={pessoa.id} nome={pessoa.nome} tamanho={56} />
      <div className={p.quemTexto}>
        <Link href={caminhoParlamentar(pessoa.casa, pessoa)} className={p.nome}>{pessoa.nome}</Link>
        <span className={p.onde}><Partido info={info} /> {casaCurta(pessoa.casa)} · {pessoa.uf}</span>
      </div>
      <BotaoSeguir pessoa={pessoa} seguindo alternar={alternar} />
    </div>
    {!plenario ? <div className={p.ossoNumeros} aria-hidden="true" /> : <dl className={p.numeros}>
      {camara
        ? <Numero rotulo="Presença" valor={porcento(n.presenca)} detalhe={med(n.mediana?.s)} />
        : <Numero rotulo="Ausências" valor={n.ausencias === null ? "—" : inteiro(n.ausencias)} detalhe="nas votações" />}
      <Numero rotulo="Votou" valor={porcento(n.votou)} detalhe={med(n.mediana?.v)} />
      <Numero rotulo="Com o governo" valor={porcento(n.governo)} detalhe={med(n.mediana?.g)} />
      <Numero rotulo={n.cota ? `Cota${n.cota.ate ? ` até ${MESES_CURTOS[n.cota.ate - 1]}` : ` em ${n.cota.ano}`}` : "Cota"}
        valor={n.cota ? reaisCompactos(n.cota.total) : "—"} detalhe={n.cota?.comparacao} />
    </dl>}
    {ultimo && <p className={p.ultimo}>
      <span className={p.ultimoRotulo}>Última votação</span>
      <Voto letra={ultimo.letra} />
      <span className={p.ultimoTitulo} title={ultimo.votacao.ementa || ultimo.votacao.descricao}>{ultimo.votacao.titulo ?? ultimo.votacao.descricao}</span>
      <time className="tabular" dateTime={ultimo.votacao.data.slice(0, 10)}>{dataCurta(ultimo.votacao.data).slice(0, 5)}</time>
    </p>}
  </li>;
}

function Resultado({ aprovada }: { aprovada: boolean }) {
  return <span className={p.selo} data-sim={aprovada || undefined} data-leve>
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {aprovada ? <path d="m2.5 6.3 2.4 2.4 4.6-5" /> : <path d="m3 3 6 6M9 3 3 9" />}
    </svg>
    {aprovada ? "Aprovada" : "Rejeitada"}
  </span>;
}

type Filtro = "todas" | "divergiram" | "governo";

function Feed({ itens, carregando, falhou, partidos }: { itens: ItemFeed[]; carregando: boolean; falhou: boolean; partidos: Record<string, InfoPartido> }) {
  const [escolhido, setFiltro] = useState<Filtro>("todas");
  const [quantas, setQuantas] = useState(VOTACOES_POR_VEZ);
  // Com uma pessoa só em cada casa, ninguém vota na mesma votação que outra: "Divergiram" some.
  const comparaveis = itens.some(x => x.votos.length > 1);
  const filtro = escolhido === "divergiram" && !comparaveis ? "todas" : escolhido;
  const filtrados = itens.filter(x => filtro === "todas" || (filtro === "divergiram" ? x.divergiram : x.contraGoverno));
  const visiveis = filtrados.slice(0, quantas);
  const opcoes = ([
    ["todas", "Todas", itens.length],
    ["divergiram", "Divergiram", comparaveis ? itens.filter(x => x.divergiram).length : -1],
    ["governo", "Contra o governo", itens.filter(x => x.contraGoverno).length],
  ] as [Filtro, string, number][]).filter(([, , n]) => n >= 0);
  const casas = new Set(itens.map(x => x.casa));
  if (falhou && !itens.length) return <div className={`vidro ${p.bloco}`} data-lustro="fixo"><p className={p.dica}>Não deu para carregar as votações agora. Tente de novo em instantes.</p></div>;
  if (carregando) return <div className={`vidro ${p.bloco}`} data-lustro="fixo" aria-busy="true"><div className={p.ossoFeed} /></div>;
  return <div className={`vidro ${p.bloco}`} data-lustro="fixo">
    <div className={`segmentos ${p.filtros}`} role="radiogroup" aria-label="Quais votações">
      {opcoes.map(([valor, rotulo, n]) => <button key={valor} type="button" role="radio" aria-checked={filtro === valor}
        onClick={() => { setFiltro(valor); setQuantas(VOTACOES_POR_VEZ); }}>{rotulo} <span className="tabular">{inteiro(n)}</span></button>)}
    </div>
    <p className={p.notaFiltro}>{filtro === "divergiram" ? "Votações em que alguém que você segue votou Sim e outra pessoa votou Não."
      : filtro === "governo" ? "Votações em que alguém que você segue votou ao contrário do que o governo orientou."
      : `Da mais recente para a mais antiga, ${casas.size > 1 ? "nas duas casas" : casas.has("senadores") ? "no Senado" : "na Câmara"}.`}</p>
    {!visiveis.length ? <p className={p.dica}>Nenhuma votação com esse recorte entre as mais recentes.</p> : <ol className={p.feed}>
      {visiveis.map(({ casa, votacao: v, votos }) => {
        const d = dataDoFeed(v.data);
        const ementa = v.ementa || v.descricao;
        return <li key={`${casa}-${v.id}`} className={p.item}>
          <div className={p.quando}>
            <time dateTime={v.data.slice(0, 10)}><strong className="tabular">{d.dia}</strong>{d.mes}<small className="tabular">{d.ano}</small></time>
            <span className={p.casa}>{casaCurta(casa)}</span>
          </div>
          <div className={p.materia}>
            <p className={p.materiaTopo}>
              <strong>{v.titulo ? `${v.titulo}${turno(v.descricao)}` : "Votação nominal"}</strong>
              <Resultado aprovada={v.aprovada} />
              {v.placarInformado !== false && v.sim + v.nao > 0 && <span className={`tabular ${p.placar}`}>{inteiro(v.sim)} a {inteiro(v.nao)}</span>}
              <span className={p.orientacao}>{v.governo ? `Governo orientou ${v.governo}` : "Sem orientação do governo"}</span>
            </p>
            <p className={p.ementa} title={ementa}>{ementa}</p>
            <ul className={p.votos}>
              {votos.map(({ pessoa, letra }) => {
                const contrario = !!v.governo && (letra === "S" || letra === "N") && (letra === "S" ? "Sim" : "Não") !== v.governo;
                return <li key={pessoa.id} style={{ "--cor-partido": partidos[siglaDe(pessoa)]?.cor } as CSSProperties}>
                  <FotoParlamentar casa={pessoa.casa} id={pessoa.id} nome={pessoa.nome} tamanho={26} />
                  <Link href={caminhoParlamentar(pessoa.casa, pessoa)} className={p.votoNome}>{pessoa.nome}</Link>
                  <Voto letra={letra} />
                  {contrario && <span className={p.contrario}>contra o governo</span>}
                </li>;
              })}
            </ul>
          </div>
        </li>;
      })}
    </ol>}
    {filtrados.length > visiveis.length && <button type="button" className={p.mais} onClick={() => setQuantas(q => q + VOTACOES_POR_VEZ)}>
      Ver mais votações <span aria-hidden>⌄</span>
    </button>}
  </div>;
}

function VotamJunto({ pares, carregando, total }: { pares: Par[]; carregando: boolean; total: number }) {
  return <section className={`vidro ${p.bloco}`} data-lustro="fixo" aria-labelledby="titulo-junto">
    <h2 id="titulo-junto" className={p.tituloBloco}>Quem vota junto</h2>
    <p className={p.detalheBloco}>Entre quem você segue na mesma casa: em quantas votações os dois votaram igual, contando só as que os dois votaram Sim ou Não.</p>
    {carregando ? <div className={p.ossoPares} aria-hidden="true" /> : !pares.length
      ? <p className={p.dica}>{total < 2 ? "Siga pelo menos duas pessoas da mesma casa para comparar." : "Siga mais alguém da mesma casa para comparar, ou espere votações em que os dois tenham votado."}</p>
      : <ul className={p.pares}>
        {pares.slice(0, 8).map(({ a, b, iguais, comparadas }) => {
          const t = iguais / comparadas;
          return <li key={`${a.id}-${b.id}`}>
            <span className={p.duasFotos} aria-hidden="true">
              <FotoParlamentar casa={a.casa} id={a.id} nome={a.nome} tamanho={28} />
              <FotoParlamentar casa={b.casa} id={b.id} nome={b.nome} tamanho={28} />
            </span>
            <span className={p.parNomes}>{a.nome} <span>e</span> {b.nome}</span>
            <strong className="tabular">{porcento(t)}</strong>
            <span className={p.parBarra} aria-hidden="true"><i style={{ width: `${t * 100}%` }} /></span>
            <small className="tabular">igual em {inteiro(iguais)} de {inteiro(comparadas)}</small>
          </li>;
        })}
      </ul>}
  </section>;
}
