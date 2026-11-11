"use client";

import { useMemo, useState, type ElementType } from "react";

import { type CasaCongresso, type PeriodoCota, type Plenario, VOTO_POR_LETRA, inteiro, noPeriodo, porcento, taxa } from "../_dados/congressoModelo";
import type { DadosPainel } from "../_dados/tipos";
import { useJson } from "../_dados/useJson";
import type { Parlamentar } from "./DiretorioCongresso";
import { EnxamePartidos, type LinhaEnxame, type PontoEnxame } from "./EnxamePartidos";
import { Numero } from "./GraficosCota";
import { Segmentos } from "./Vidro";
import estilos from "./Parlamentares.module.css";

export const usePlenario = (casa: CasaCongresso) => useJson<Plenario>(`/painel/congresso/plenario-${casa}.json`);

/** Abaixo de 10 sessões ou votos, a porcentagem diz pouco: fica "—". */
export const BASE_MINIMA = 10;
export const taxaComBase = (par: [number, number] | undefined) => (par && par[1] >= BASE_MINIMA ? taxa(par) : null);
const contagem = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;
const dataCurta = (d: string) => d.slice(0, 10).split("-").reverse().join("/");
/** PEC vota duas vezes no mesmo dia; o turno separa as duas linhas. */
const turno = (descricao: string) => (/primeiro turno|1º turno/i.test(descricao) ? ", 1º turno" : /segundo turno|2º turno/i.test(descricao) ? ", 2º turno" : "");
const VOTOS_VISIVEIS = 8;

function Esqueleto() {
  return <div className={estilos.esqueletoDetalhe} aria-hidden="true">
    <span className={estilos.osso} style={{ width: "100%", height: 64 }} />
  </div>;
}

/** Presença, votações nominais e voto com o governo no período, cada um ao lado da mediana da casa. */
export function NumerosPlenario({ casa, pessoa, periodo }: { casa: CasaCongresso; pessoa: Parlamentar; periodo: PeriodoCota }) {
  const plenario = usePlenario(casa);
  const p = plenario.dados;
  if (plenario.erro) return <p className={estilos.aviso}>Não deu para carregar as votações agora. Tente de novo em instantes.</p>;
  if (!p) return <Esqueleto />;

  const camara = casa === "deputados";
  const daCasa = camara ? "da Câmara" : "do Senado";
  const quando = noPeriodo(periodo);
  const linha = p.pessoas[pessoa.id]?.[String(periodo)];
  const mediana = p.totais[String(periodo)]?.mediana;
  const comMediana = (t: number | null | undefined) => (t == null ? "" : ` · mediana ${daCasa}: ${porcento(t)}`);
  if (!linha) return <p className={estilos.aviso}>Nenhuma sessão ou votação nominal {quando} enquanto estava no cargo.</p>;
  const ausencias = (linha.j ?? 0) + (linha.n ?? 0);

  return <>
    <dl className={estilos.numeros}>
      {camara
        ? <Numero rotulo="Presença nas sessões deliberativas" valor={porcento(taxaComBase(linha.s))}
          detalhe={linha.s ? `${inteiro(linha.s[0])} de ${contagem(linha.s[1], "sessão", "sessões")}${comMediana(mediana?.s)}` : "sem sessões no período"} />
        : <Numero rotulo="Ausências nas votações" valor={inteiro(ausencias)}
          detalhe={`${contagem(linha.j ?? 0, "justificada", "justificadas")} (licença, missão), ${contagem(linha.n ?? 0, "sem justificativa", "sem justificativa")}`} />}
      <Numero rotulo="Votou nas votações nominais" valor={porcento(taxaComBase(linha.v))}
        detalhe={`${inteiro(linha.v[0])} de ${contagem(linha.v[1], "votação", "votações")}${comMediana(mediana?.v)}`} />
      <Numero rotulo="Votou como o governo orientou" valor={porcento(taxaComBase(linha.g))}
        detalhe={linha.g[1] >= BASE_MINIMA ? `${inteiro(linha.g[0])} de ${contagem(linha.g[1], "voto", "votos")}${comMediana(mediana?.g)}` : `${contagem(linha.g[1], "voto", "votos")} com orientação do governo: pouco para comparar`} />
    </dl>
    <p className={estilos.notaSecao}>
      {camara
        ? "Conta só o tempo no cargo. O arquivo aberto da Câmara não separa a ausência justificada da falta. "
        : "Conta só o tempo no cargo. Em votação secreta, entra se votou, mas não o voto. "}
      O voto com o governo considera as votações em que o líder do governo orientou Sim ou Não e {camara ? "o deputado" : "o senador"} votou Sim ou Não.
    </p>
  </>;
}

/** As últimas votações de mérito, com o voto da pessoa e a orientação do governo. */
export function ComoVotou({ casa, pessoa, Titulo }: { casa: CasaCongresso; pessoa: Parlamentar; Titulo: ElementType }) {
  const plenario = usePlenario(casa);
  const [todas, setTodas] = useState(false);
  const p = plenario.dados;
  if (!p || p.votacoes.length === 0) return null;

  const camara = casa === "deputados";
  const letras = p.votos[pessoa.id] ?? "";
  const lista = p.votacoes.map((v, i) => ({ v, letra: letras[i] ?? " " }));
  // Quem não estava no cargo em nenhuma delas não tem o que mostrar.
  if (lista.every(x => x.letra === " ")) return null;
  const visiveis = todas ? lista : lista.slice(0, VOTOS_VISIVEIS);
  const coletado = new Date(p.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return <section className={estilos.secaoCota} aria-labelledby="cracha-votacoes">
    <Titulo id="cracha-votacoes" className={estilos.tituloBloco}>Como votou nas últimas votações de mérito</Titulo>
    <ol className={estilos.votacoes}>
      {visiveis.map(({ v, letra }) => {
        const voto = letra === "S" ? "Sim" : letra === "N" ? "Não" : null;
        const alinhado = voto && v.governo ? (voto === v.governo ? "com o governo" : "contra o governo") : null;
        return <li key={v.id} className={estilos.votacao}>
          <div className={estilos.votacaoTexto}>
            <p className={estilos.votacaoMeta}>
              <time dateTime={v.data.slice(0, 10)}>{dataCurta(v.data)}</time>
              {v.titulo && <strong>{v.titulo}{turno(v.descricao)}</strong>}
              <span>{v.aprovada ? "Aprovada" : "Rejeitada"}{v.sim + v.nao > 0 ? `, ${inteiro(v.sim)} a ${inteiro(v.nao)}` : ""}</span>
            </p>
            <p className={estilos.votacaoEmenta}>{v.ementa || v.descricao}</p>
          </div>
          <div className={estilos.votacaoVoto}>
            <span className={estilos.voto} data-voto={letra === " " ? "fora" : voto ? "decidiu" : "outro"}>{VOTO_POR_LETRA[letra] ?? "Não votou"}</span>
            <span className={estilos.votoGoverno}>{v.governo ? `Governo orientou ${v.governo}` : "Sem orientação do governo"}{alinhado && <><br />{alinhado}</>}</span>
          </div>
        </li>;
      })}
    </ol>
    {lista.length > VOTOS_VISIVEIS && <button type="button" className={estilos.verTodos} aria-expanded={todas} onClick={() => setTodas(t => !t)}>{todas ? "Mostrar menos" : `Ver as ${lista.length} votações`}</button>}
    <p className={estilos.fonte}>
      Fonte: <a href={p.fontes.dados} target="_blank" rel="noreferrer">{camara ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos</a>, baixados em {coletado}.
      Votação de mérito é a do texto: proposta, projeto, substitutivo ou medida provisória, sem requerimentos nem destaques{camara ? "" : "; as secretas ficam fora"}.
    </p>
  </section>;
}

/** O que o gráfico por partido mede: o voto com o governo ou a presença (no Senado, a participação). */
export type MedidaPlenario = "governo" | "presenca";
export const medidaPlenarioValida = (v: unknown) => v === "governo" || v === "presenca";

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b), m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Quem está no recorte, por partido, com a taxa do período; só quem tem base mínima. */
function pontosPorPartido(p: Plenario, pessoas: Parlamentar[], periodo: PeriodoCota, campo: "s" | "v" | "g", base: (par: [number, number]) => string): LinhaEnxame[] {
  const porPartido = new Map<string, PontoEnxame[]>();
  for (const pessoa of pessoas) {
    const par = p.pessoas[pessoa.id]?.[String(periodo)]?.[campo];
    const t = taxaComBase(par);
    if (t === null || !par) continue;
    const chave = pessoa.partido ?? "S/Partido";
    porPartido.set(chave, [...(porPartido.get(chave) ?? []), { pessoa, valor: t, base: base(par) }]);
  }
  return [...porPartido]
    .map(([partido, pontos]) => ({ partido, pontos, mediana: mediana(pontos.map((x) => x.valor)) }))
    .sort((a, b) => b.mediana - a.mediana || b.pontos.length - a.pontos.length);
}

/**
 * No panorama: por partido, um ponto por parlamentar do recorte, no voto com o governo ou na
 * presença. A média por partido escondia o principal: há quem vote com o governo dentro da
 * oposição e quem vote contra dentro da base. Com um partido filtrado, sobra a linha dele.
 */
export function PlenarioPorPartido({ casa, periodo, encontrados, governos, corDe, medida, aoMudarMedida, aoEscolher, aoFiltrarPartido, segueLista = false }: {
  casa: CasaCongresso;
  periodo: PeriodoCota;
  encontrados: Parlamentar[];
  governos: DadosPainel["governos"];
  corDe: (partido: string | null) => string;
  medida: MedidaPlenario;
  aoMudarMedida: (m: MedidaPlenario) => void;
  aoEscolher: (id: number) => void;
  aoFiltrarPartido: (partido: string) => void;
  /**
   * A lista está numa medida do plenário: o gráfico abre o panorama e mede o mesmo que ela,
   * sem seletor próprio (o da lista manda). Com a lista na cota, fica no fim, com o seletor dele.
   */
  segueLista?: boolean;
}) {
  const p = usePlenario(casa).dados;
  const camara = casa === "deputados";
  const campo = medida === "governo" ? "g" : camara ? "s" : "v";
  const linhas = useMemo(() => p && pontosPorPartido(p, encontrados, periodo, campo, ([a, b]) =>
    campo === "g" ? `${inteiro(a)} de ${contagem(b, "voto", "votos")}` : campo === "s" ? `${inteiro(a)} de ${contagem(b, "sessão", "sessões")}` : `${inteiro(a)} de ${contagem(b, "votação", "votações")}`,
  ), [p, encontrados, periodo, campo]);
  if (!linhas || linhas.length === 0) return null;

  const quem = camara ? "deputados" : "senadores";
  const singular = camara ? "deputado" : "senador";
  const quando = noPeriodo(periodo);
  const daCasa = camara ? "da Câmara" : "do Senado";
  const medianaCasa = p?.totais[String(periodo)]?.mediana[campo] ?? null;
  const presenca = camara ? "Presença" : "Participação";
  const oQue = medida === "governo" ? "com o governo" : camara ? "de presença" : "de participação";
  const comoLer = medida === "governo"
    ? `Cada ponto é um ${singular}: a parte dos votos em que seguiu a orientação do governo ${quando}.`
    : camara
    ? `Cada ponto é um deputado: a parte das sessões deliberativas ${quando} em que registrou presença.`
    : `Cada ponto é um senador: a parte das votações nominais ${quando} em que votou.`;
  return <section className={`${estilos.bloco} ${segueLista ? estilos.blocoPrimeiro : estilos.blocoSeparado}`} aria-labelledby="titulo-panorama-plenario">
    <div className={estilos.secaoCabecalho}>
      <h4 id="titulo-panorama-plenario" className={estilos.tituloBloco}>No plenário, por partido</h4>
      {!segueLista && <Segmentos opcoes={[{ id: "governo", rotulo: "Com o governo" }, { id: "presenca", rotulo: presenca }]} ativo={medida} aoEscolher={aoMudarMedida} rotulo="Medida do gráfico por partido" classeBotao="px-3 py-1" />}
    </div>
    <p className={estilos.notaSecao}>
      {comoLer} O traço escuro marca a mediana do partido; o tracejado, a {daCasa}{medianaCasa !== null ? ` (${porcento(medianaCasa)})` : ""}.
      {" "}Passe o mouse num ponto para ver quem é e clique para abrir o crachá; o partido filtra a lista. Conta só o tempo no cargo e quem teve pelo menos {BASE_MINIMA} {medida === "governo" ? "votos com orientação" : camara ? "sessões" : "votações"}.
    </p>
    <EnxamePartidos casa={casa} linhas={linhas} governos={governos} corDe={corDe} medianaCasa={medianaCasa} rotuloCasa={quem} oQue={oQue} aoEscolher={aoEscolher} aoFiltrarPartido={aoFiltrarPartido} />
    {p && <p className={estilos.fonte}>
      Fonte: <a href={p.fontes.dados} target="_blank" rel="noreferrer">{camara ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos</a>, baixados em {new Date(p.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
      {camara ? " Presença nas sessões deliberativas do plenário; o arquivo aberto não separa a ausência justificada da falta." : " Participação: votou, inclusive em votação secreta; licença e missão oficial contam como ausência."}
      {" "}Voto com o governo: votações em que o líder do governo orientou Sim ou Não e {camara ? "o deputado" : "o senador"} votou Sim ou Não.
    </p>}
  </section>;
}
