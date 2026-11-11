"use client";
import { useEffect, useRef, useState } from "react";
import { useJson } from "@/lib/useJson";
import { numero } from "@/lib/formatar";
import type { DadosVotacoesAssembleia, VotacaoEstadual } from "@/lib/votacoesAssembleiaModelo";
import { Bloco } from "./Bloco";
import s from "./AbaResumo.module.css";

const dia = (data: string) => data.split("-").reverse().join("/");
const diaPorExtenso = (data: string) => new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/** Nome curto de cada fonte: a Alesp publica uma página por ano; as outras casas, o SAPL. */
function nomeDaFonte(c: { tipo: string; fonte_url: string }) {
  const ano = c.fonte_url.match(/anoSessao=(\d{4})/)?.[1];
  if (c.tipo === "alesp") return ano ? `Alesp ${ano}` : "Alesp";
  if (c.tipo === "sapl") return "SAPL da casa";
  return c.tipo.toUpperCase();
}

/** "20 a favor, 0 contra e 1 abstenção", dizendo o que a casa não publicou em vez de pôr zero. */
function placarPorExtenso(v: VotacaoEstadual) {
  const partes = [
    `${numero(v.sim ?? 0, 0)} a favor`,
    v.nao === null ? "votos contra não informados" : `${numero(v.nao, 0)} contra`,
    v.abstencoes === null ? "abstenções não informadas" : `${numero(v.abstencoes, 0)} ${v.abstencoes === 1 ? "abstenção" : "abstenções"}`,
  ];
  return `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** O título do bloco; o índice do resumo aponta para o id que sai dele. */
export const tituloVotacoes = (uf: string) => (uf === "DF" ? "Votações da Câmara Legislativa" : "Votações da Assembleia");

export function VotacoesAssembleia({ uf, posse, fim }: { uf: string; posse: string; fim: string }) {
  const [executivo, setExecutivo] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [pesquisa, setPesquisa] = useState("");
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement>(null);

  const aplicar = (texto: string) => {
    const v = texto.trim();
    if (v === busca) return;
    setBusca(v);
    setPagina(0);
    setAberta(null);
  };
  // A busca sai sozinha quando a pessoa para de digitar; Enter aplica na hora.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = pesquisa.trim();
      if (v !== busca) {
        setBusca(v);
        setPagina(0);
        setAberta(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [pesquisa, busca]);

  const q = new URLSearchParams({ uf, posse, fim, executivo: String(executivo), pagina: String(pagina), q: busca });
  const consulta = useJson<DadosVotacoesAssembleia>(`/api/painel/resumo/assembleia?${q}`);
  // Ao trocar de página ou de filtro, a lista anterior fica, esmaecida, até a nova chegar: nada pula.
  // A contagem e as mensagens descrevem a lista que está na tela, com os filtros dela, e não o botão
  // que acabou de ser apertado: senão "4.215 votações do Executivo" aparece enquanto carrega.
  type Mostrado = { dado: DadosVotacoesAssembleia; executivo: boolean; busca: string };
  const [visto, setVisto] = useState<Mostrado | null>(null);
  if (consulta.dado && consulta.dado !== visto?.dado) setVisto({ dado: consulta.dado, executivo, busca });
  const mostrado: Mostrado | null = consulta.dado ? { dado: consulta.dado, executivo, busca } : visto;
  const d = mostrado?.dado ?? null;
  const atualizando = !consulta.dado && !consulta.erro && Boolean(visto);

  const filtrar = (x: boolean) => {
    setExecutivo(x);
    setPagina(0);
    setAberta(null);
  };
  const limpar = () => {
    setPesquisa("");
    setBusca("");
    filtrar(false);
  };
  const irPara = (p: number) => {
    setPagina(p);
    setAberta(null);
    const el = lista.current;
    if (el && el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  };

  const casa = uf === "DF" ? "Câmara Legislativa" : "Assembleia";
  const temFonte = Boolean(d?.cobertura.length);
  const filtroDaLista = { executivo: mostrado?.executivo ?? false, busca: mostrado?.busca ?? "" };
  const filtrado = filtroDaLista.executivo || Boolean(filtroDaLista.busca);

  const dias: { data: string; itens: VotacaoEstadual[] }[] = [];
  for (const v of d?.votacoes ?? []) {
    const ultimo = dias.at(-1);
    if (ultimo?.data === v.data) ultimo.itens.push(v);
    else dias.push({ data: v.data, itens: [v] });
  }

  const campoBusca = temFonte ? (
    <form
      role="search"
      className={s.votBusca}
      onSubmit={(e) => {
        e.preventDefault();
        aplicar(pesquisa);
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </svg>
      <input type="search" maxLength={100} value={pesquisa} onChange={(e) => setPesquisa(e.target.value)} placeholder="Buscar matéria" aria-label="Buscar matéria pelo número, tipo ou assunto" />
      {pesquisa && (
        <button type="button" className={s.votLimpar} aria-label="Limpar a busca" onClick={() => { setPesquisa(""); aplicar(""); }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </form>
  ) : undefined;

  return (
    <Bloco titulo={tituloVotacoes(uf)} detalhe="registros oficiais · data da sessão" lustroFixo acao={campoBusca}>
      {!d ? (
        consulta.erro ? (
          <p className={s.votVazio} role="alert">
            A consulta não respondeu agora.
            <button type="button" onClick={consulta.tentar}>Tentar de novo</button>
          </p>
        ) : (
          <p className={s.votVazio} role="status">Carregando as votações…</p>
        )
      ) : !temFonte ? (
        <p className={s.votVazio} role="status">
          Ainda não lemos as votações da {casa} {uf === "DF" ? "do DF" : `de ${uf}`}. Isso não quer dizer que a casa não votou: só que o site ainda não tem a fonte. Quem foi eleito está no bloco Política, acima.
        </p>
      ) : (
        <>
          <div className={s.votFiltros}>
            <p role="status" className={s.votContagem}>
              <b>{numero(d.total, 0)}</b> {d.total === 1 ? "votação" : "votações"} {filtroDaLista.executivo ? "de matérias do Executivo" : "neste mandato"}
              {filtroDaLista.busca ? <> com “{filtroDaLista.busca}”</> : null}
            </p>
            <div className={s.esferas} role="group" aria-label="Autoria da matéria">
              <button type="button" className={s.esfera} aria-pressed={!executivo} onClick={() => filtrar(false)}>
                Todas
              </button>
              <button type="button" className={s.esfera} aria-pressed={executivo} onClick={() => filtrar(true)} title="Só as matérias em que a fonte registra o Executivo como autor">
                Do Executivo
              </button>
            </div>
          </div>

          {d.cobertura.some((c) => c.estado === "indisponivel") && (
            <p className={s.votAviso} role="status">Uma das fontes não respondeu na última coleta; o que já tínhamos dela continua aqui.</p>
          )}
          {consulta.erro && (
            <p className={s.votAviso} role="alert">
              A próxima página não respondeu.
              <button type="button" onClick={consulta.tentar}>Tentar de novo</button>
            </p>
          )}

          {d.total === 0 ? (
            <div className={s.votVazio} role="status">
              {filtrado ? (
                <>
                  Nenhuma votação {filtroDaLista.busca ? `com “${filtroDaLista.busca}”` : ""}
                  {filtroDaLista.executivo ? `${filtroDaLista.busca ? " e " : ""}com autoria do Executivo registrada na fonte` : ""}.{" "}
                  {filtroDaLista.executivo ? "Quando a fonte não registra o autor, não dá para dizer que a matéria não veio do governo." : ""}
                  <button type="button" onClick={limpar}>Limpar filtros</button>
                </>
              ) : (
                "A fonte não publicou votações neste mandato. Lacuna de publicação não é ausência de atividade."
              )}
            </div>
          ) : (
            <div ref={lista} className={s.votLista} aria-busy={atualizando || undefined} data-atualizando={atualizando || undefined}>
              {dias.map((g) => (
                <section key={g.data} aria-label={`Sessão de ${diaPorExtenso(g.data)}`}>
                  <h4 className={s.grupo}>
                    <time dateTime={g.data}>{diaPorExtenso(g.data)}</time>
                  </h4>
                  <ul className={s.linhas}>
                    {g.itens.map((v) => (
                      <LinhaVotacao key={v.id_fonte} v={v} aberta={aberta === v.id_fonte} alternar={() => setAberta((a) => (a === v.id_fonte ? null : v.id_fonte))} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {d.paginas > 1 && (
            <nav className={s.votPaginas} aria-label="Páginas de votações">
              <button type="button" disabled={pagina === 0} onClick={() => irPara(pagina - 1)}>
                Mais recentes
              </button>
              <span className="tabular">
                {numero(pagina + 1, 0)} de {numero(d.paginas, 0)}
              </span>
              <button type="button" disabled={pagina + 1 >= d.paginas} onClick={() => irPara(pagina + 1)}>
                Mais antigas
              </button>
            </nav>
          )}

          <p className={s.observacao}>
            Votar a favor, ou o partido de quem votou, não mostra apoio ao governo. “Do Executivo” só conta quando a fonte traz a autoria. O voto de cada deputado aparece quando a casa o publica.
            {d.inicio && d.fim ? ` Acervo da fonte: ${dia(d.inicio)} a ${dia(d.fim)}${d.coletadoEm ? `, coletado em ${dia(d.coletadoEm)}` : ""}.` : ""} Fonte:{" "}
            {d.cobertura.map((c, i) => (
              <span key={c.fonte_url}>
                {i ? ", " : ""}
                <a href={c.fonte_url} target="_blank" rel="noreferrer">
                  {nomeDaFonte(c)}
                </a>
              </span>
            ))}
            .
          </p>
        </>
      )}
    </Bloco>
  );
}

function LinhaVotacao({ v, aberta, alternar }: { v: VotacaoEstadual; aberta: boolean; alternar: () => void }) {
  const pdf = v.fonte.endsWith(".pdf");
  const ementa = v.ementa.trim();
  const placar =
    v.sim === null
      ? null
      : [`${numero(v.sim, 0)} sim`, v.nao === null ? null : `${numero(v.nao, 0)} não`, v.abstencoes ? `${numero(v.abstencoes, 0)} abst.` : null].filter(Boolean).join(" · ");
  const resultado = v.resultado ? (/rejeit/i.test(v.resultado) ? "rejeitada" : /aprov/i.test(v.resultado) ? "aprovada" : "outro") : null;
  return (
    <li>
      <button type="button" className={s.votLinha} aria-expanded={aberta} onClick={alternar}>
        <span className={s.votNome}>
          <b>{v.titulo}</b>
          {ementa && <small>{ementa}</small>}
        </span>
        {placar && <span className={s.votPlacar}>{placar}</span>}
        {v.resultado && (
          <span className={s.votResultado} data-resultado={resultado}>
            {v.resultado}
          </span>
        )}
        <i className={s.seta} aria-hidden />
      </button>
      {aberta && (
        <div className={s.detalhe}>
          {ementa && <p className={s.votEmenta}>{ementa}</p>}
          {v.sim !== null && <p>Placar publicado pela casa: {placarPorExtenso(v)}.</p>}
          {v.executivo && <p>Matéria de autoria do Executivo, segundo a fonte.</p>}
          {v.votos.length > 0 ? (
            <>
              <p className={s.votSubtitulo}>Votos publicados</p>
              <ul className={s.votVotos}>
                {v.votos.map((x) => (
                  <li key={x.id}>
                    <a href={x.fonte} target="_blank" rel="noreferrer">
                      {x.nome}
                    </a>
                    <b>{x.voto}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>
              {pdf
                ? "A casa publica o voto de cada deputado no PDF da votação nominal. O site ainda não lê esse PDF e não monta um placar sem ele."
                : "A fonte não traz o voto de cada deputado neste registro. Isso não quer dizer ausência nem abstenção."}
            </p>
          )}
          <div className={s.rodapeDetalhe}>
            <a href={v.fonte} target="_blank" rel="noreferrer">
              {pdf ? "Votação nominal (PDF)" : "Registro oficial"}
            </a>
            {v.proposicao && (
              <a href={v.proposicao} target="_blank" rel="noreferrer">
                A matéria na casa
              </a>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
