"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

import {
  type CasaCongresso, type CotaDoAno, type IndiceCota, type PeriodoCota,
  LEGISLATURA, MESES_POR_EXTENSO, VOTO_POR_LETRA, caminhoParlamentar, inteiro, noPeriodo, porcento, posicaoEntre, reaisCompactos,
} from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import type { DadosPainel } from "../_dados/tipos";
import { Bloco } from "./Bloco";
import { useFichaParlamentar } from "./CrachaParlamentar";
import type { Parlamentar } from "./DiretorioCongresso";
import { FotoParlamentar } from "./FotoParlamentar";
import { AnoAAno, Barras, EsqueletoDetalhe, FonteCota, MesAMes, SeletorAnoCota } from "./GraficosCota";
import { IdentidadePartido } from "./PainelEconomia";
import { BASE_MINIMA, taxaComBase, usePlenario } from "./PlenarioParlamentar";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";

/**
 * A página de um deputado ou senador como terminal: o crachá numa faixa, uma fita com os
 * números do período e, embaixo, painéis lado a lado (como votou, o plenário ano a ano, a
 * cota, as emendas e as bancadas). Cada número aparece uma vez; o período do topo vale
 * para tudo o que tem período. "Votou com o governo" não leva cor: não é melhor nem pior.
 */

const VOTOS_VISIVEIS = 10;
/** Junta as partes que existem com " · ". */
const junta = (...partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ");
const notas = (n: number) => `${inteiro(n)} ${n === 1 ? "nota" : "notas"}`;
const dataCurta = (d: string) => { const [a, m, dia] = d.slice(0, 10).split("-"); return `${dia}/${m}/${a.slice(2)}`; };
const turno = (descricao: string) => (/primeiro turno|1º turno/i.test(descricao) ? ", 1º turno" : /segundo turno|2º turno/i.test(descricao) ? ", 2º turno" : "");
const Seta = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7 17 17 7M7 7h10v10" /></svg>;

/** Link para a aba Congresso já com a casa e o que mais vier. */
export function linkCongresso(casa: CasaCongresso, extra: [string, string][] = []) {
  const consulta = new URLSearchParams([...extra, ...(casa === "senadores" ? [["r.congresso.casa", "senadores"] as [string, string]] : [])]);
  return `/congresso${consulta.size ? `?${consulta}` : ""}`;
}

export function TerminalParlamentar({ casa, pessoa, governos, ufs, cor, indice, cota, erroCota, periodo, anos, aoEscolherPeriodo, acoes }: {
  casa: CasaCongresso;
  pessoa: Parlamentar;
  governos: DadosPainel["governos"];
  ufs: DadosPainel["ufs"];
  cor: string;
  indice: IndiceCota | null;
  cota: CotaDoAno | null;
  erroCota: boolean;
  periodo: PeriodoCota;
  anos: number[];
  aoEscolherPeriodo: (periodo: PeriodoCota) => void;
  /** Ver na maquete, compartilhar. */
  acoes: ReactNode;
}) {
  const ficha = useFichaParlamentar({ casa, pessoa, periodo, indice, cota });
  const { p, perfil, gasto, quando } = ficha;
  const uf = ufs.find(u => u.sigla === pessoa.uf);
  const camara = casa === "deputados";
  const fatos = [
    ficha.anos !== null ? `${ficha.anos} anos` : null,
    p?.naturalidade ? `nasceu em ${p.naturalidade}` : null,
    p?.escolaridade ? p.escolaridade.charAt(0).toLocaleLowerCase("pt-BR") + p.escolaridade.slice(1) : null,
    ficha.textoTrajetoria,
  ].filter((x): x is string => Boolean(x));

  return <article id="cracha-parlamentar" className={t.pagina} aria-labelledby="cracha-nome" style={{ "--cor-partido": cor } as CSSProperties}>
    <header className={`vidro ${t.cabeca}`} data-lustro="fixo">
      <div className={t.identidade}>
        <FotoParlamentar casa={casa} id={pessoa.id} nome={pessoa.nome} tamanho={84} altura={112} prioridade />
        <div className={t.quem}>
          <p className={t.sobre}>{camara ? "Câmara dos Deputados" : "Senado Federal"} · {uf?.nome ?? pessoa.uf}</p>
          <h1 id="cracha-nome">{pessoa.nome}</h1>
          <div className={t.partido}>
            <IdentidadePartido governos={governos} sigla={pessoa.partido === "S/Partido" ? "SEM" : pessoa.partido} />
            {ficha.nomeCivil && <span>{ficha.nomeCivil}</span>}
          </div>
          <p className={t.fatos} aria-busy={perfil.carregando}>{perfil.carregando ? <span className={estilos.osso} style={{ width: 260 }} /> : fatos.join(" · ")}</p>
          <div className={t.links}>
            <a href={ficha.linkPerfil} target="_blank" rel="noreferrer">Perfil oficial<Seta /></a>
            {acoes}
          </div>
        </div>
        <div className={t.periodo}>
          <span>Período dos números</span>
          <SeletorAnoCota anos={anos} periodo={periodo} aoEscolher={aoEscolherPeriodo} />
        </div>
      </div>
      <Fita casa={casa} pessoa={pessoa} periodo={periodo} ficha={ficha} cota={cota} erroCota={erroCota} />
    </header>

    <div className={t.grade}>
      <div className={t.coluna}>
        <PainelVotacoes casa={casa} pessoa={pessoa} className={t.o1} />
        <Bloco titulo="Cota mês a mês" detalhe={gasto ? `${notas(gasto.n)} ${quando}` : quando} lustroFixo className={t.o3}>
          {erroCota ? <Aviso>Não deu para carregar a cota agora.</Aviso> : !cota || !indice ? <EsqueletoDetalhe />
            : !gasto ? <Aviso>Nenhuma nota de cota {quando}. Quem assumiu depois, se licenciou ou não usou a cota no período não aparece no arquivo.</Aviso>
            : <>
              <MesAMes valores={gasto.m} media={cota.mediaMes} situacao={ficha.situacao} meses={ficha.meses} rotuloSerie={pessoa.nome} rotuloMedia={`média dos ${ficha.rotuloCasa}`} />
              {ficha.chegouDepois && <p className={t.nota}>As notas começam em {MESES_POR_EXTENSO[ficha.chegouDepois.mes]} de {ficha.chegouDepois.ano}: a comparação com quem está desde 2023 é desigual.</p>}
            </>}
        </Bloco>
        <div className={`${t.par} ${t.o5}`}>
          <Bloco titulo="Com o que gastou" detalhe={quando} lustroFixo>
            {!cota ? <EsqueletoDetalhe /> : !gasto ? <Aviso>Sem notas {quando}.</Aviso>
              : <Barras rotuloLista={`Categorias de gasto de ${pessoa.nome} ${quando}`} nomeDoMais="categorias" feminino total={gasto.t}
                itens={gasto.c.map(([c, v]) => ({ chave: String(c), nome: cota.categorias[c], valor: v }))} />}
          </Bloco>
          <Bloco titulo="Quem mais recebeu" detalhe={quando} lustroFixo>
            {!cota ? <EsqueletoDetalhe /> : !gasto ? <Aviso>Sem notas {quando}.</Aviso>
              : <Barras rotuloLista={`Fornecedores que mais receberam de ${pessoa.nome} ${quando}`} nomeDoMais="fornecedores" total={gasto.t}
                itens={gasto.f.map(([nome, v, n]) => ({ chave: nome, nome: nome === "Pessoa física" ? "Pessoas físicas (nomes omitidos)" : nome, valor: v, detalhe: notas(n) }))} />}
          </Bloco>
        </div>
        <PainelFontes casa={casa} indice={indice} cota={cota} linkNotas={ficha.linkNotas} className={t.o9} />
      </div>

      <div className={t.coluna}>
        <PainelPlenarioAnos casa={casa} pessoa={pessoa} periodo={periodo} aoEscolher={aoEscolherPeriodo} className={t.o2} />
        <Bloco titulo="Cota ano a ano" detalhe="clique num ano para ver tudo nele" lustroFixo className={t.o4}>
          {erroCota ? <Aviso>Não deu para carregar a cota agora.</Aviso> : !indice ? <EsqueletoDetalhe /> : <>
            <p className={estilos.legendaGrafico}><span><i className={estilos.chaveSerie} />{pessoa.nome}</span><span><i className={estilos.chaveMedia} />média dos {ficha.rotuloCasa}</span>{ficha.anoParcial !== null && <span>* ano em curso</span>}</p>
            <AnoAAno anos={indice.anos} valores={indice.totais[pessoa.id] ?? indice.anos.map(() => null)} medias={indice.anos.map(a => indice.media[a]?.media ?? 0)}
              ativo={typeof periodo === "number" ? periodo : null} aoEscolher={aoEscolherPeriodo} rotuloMedia={`média dos ${ficha.rotuloCasa}`} parcial={ficha.anoParcial} />
          </>}
        </Bloco>
        <PainelEmendas ficha={ficha} carregando={perfil.carregando} erro={perfil.erro} className={t.o6} />
        {cota && <PainelBancadas casa={casa} pessoa={pessoa} cota={cota} deEstado={uf?.deNome ?? `de ${uf?.nome ?? pessoa.uf}`} classes={[t.o7, t.o8]} />}
      </div>
    </div>
  </article>;
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className={estilos.aviso}>{children}</p>;
}

type Ficha = ReturnType<typeof useFichaParlamentar>;

/** Os números do período numa fileira: plenário, cota e emendas, cada grupo com o nome em cima. */
function Fita({ casa, pessoa, periodo, ficha, cota, erroCota }: {
  casa: CasaCongresso;
  pessoa: Parlamentar;
  periodo: PeriodoCota;
  ficha: Ficha;
  cota: CotaDoAno | null;
  erroCota: boolean;
}) {
  const plenario = usePlenario(casa);
  const pl = plenario.dados;
  const camara = casa === "deputados";
  const daCasa = camara ? "da Câmara" : "do Senado";
  const linha = pl?.pessoas[pessoa.id]?.[String(periodo)];
  const mediana = pl?.totais[String(periodo)]?.mediana;
  const med = (x: number | null | undefined) => (x == null ? null : `mediana ${daCasa}: ${porcento(x)}`);
  const esperando = !pl && !plenario.erro;
  const semPlenario = plenario.erro ? "não carregou agora" : pl && !linha ? "fora do cargo no período" : null;
  const { gasto, media, posicao, comparacao, quando } = ficha;
  const cotaPendente = !cota && !erroCota;

  const plenarios: Celula[] = [
    camara
      ? { rotulo: "Presença nas sessões", valor: linha?.s ? porcento(taxaComBase(linha.s)) : "—", detalhe: semPlenario ?? (linha?.s ? junta(`${inteiro(linha.s[0])} de ${inteiro(linha.s[1])}`, med(mediana?.s)) : "sem sessões") }
      : { rotulo: "Ausências nas votações", valor: linha ? inteiro((linha.j ?? 0) + (linha.n ?? 0)) : "—", detalhe: semPlenario ?? `${inteiro(linha?.j ?? 0)} justificadas, ${inteiro(linha?.n ?? 0)} sem justificativa` },
    { rotulo: "Votou nas nominais", valor: linha ? porcento(taxaComBase(linha.v)) : "—", detalhe: semPlenario ?? (linha ? junta(`${inteiro(linha.v[0])} de ${inteiro(linha.v[1])}`, med(mediana?.v)) : "") },
    { rotulo: "Votou como o governo orientou", valor: linha ? porcento(taxaComBase(linha.g)) : "—",
      detalhe: semPlenario ?? (!linha ? "" : linha.g[1] >= BASE_MINIMA ? junta(`${inteiro(linha.g[0])} de ${inteiro(linha.g[1])}`, med(mediana?.g)) : `${inteiro(linha.g[1])} votos com orientação: pouco para comparar`) },
  ].map(c => (esperando ? { ...c, valor: "…", detalhe: "carregando" } : c));

  const cotas: Celula[] = cotaPendente ? [{ rotulo: "Gastou da cota", valor: "…", detalhe: "carregando" }, { rotulo: "Posição no gasto", valor: "…", detalhe: "carregando" }]
    : erroCota ? [{ rotulo: "Gastou da cota", valor: "—", detalhe: "não carregou agora" }]
    : [
      { rotulo: "Gastou da cota", valor: gasto ? reaisCompactos(gasto.t) : "R$ 0", detalhe: gasto ? (comparacao && media ? `${comparacao.texto} dos ${ficha.rotuloCasa} (${reaisCompactos(media.media)})` : notas(gasto.n)) : `nenhuma nota ${quando}` },
      { rotulo: "Posição no gasto", valor: posicao ? `${posicao.posicao}º` : "—", detalhe: posicao ? `entre ${inteiro(posicao.de)}, do maior gasto ao menor` : `sem notas ${quando}` },
    ];

  const emendas: Celula[] = [{
    rotulo: "Emendas Pix", valor: ficha.perfil.carregando ? "…" : ficha.emendas ? reaisCompactos(ficha.totalEmendas) : "R$ 0",
    detalhe: ficha.perfil.carregando ? "carregando" : ficha.perfil.erro ? "indisponível agora" : ficha.emendas ? `${inteiro(ficha.planosEmendas)} ${ficha.planosEmendas === 1 ? "plano" : "planos"} desde 2023` : "nenhum plano com este nome",
  }];

  return <div className={t.fita}>
    <Grupo nome={`No plenário · ${noPeriodo(periodo)}`} celulas={plenarios} />
    <Grupo nome={`Cota parlamentar · ${quando}`} celulas={cotas} />
    <Grupo nome="Emendas Pix · legislatura" celulas={emendas} />
  </div>;
}

type Celula = { rotulo: string; valor: string; detalhe: string };

function Grupo({ nome, celulas }: { nome: string; celulas: Celula[] }) {
  return <section className={t.grupo} style={{ "--n": celulas.length } as CSSProperties} aria-label={nome}>
    <h2 className={t.grupoNome}>{nome}</h2>
    <dl className={t.celulas}>
      {celulas.map(c => <div key={c.rotulo} className={t.celula}>
        <dt>{c.rotulo}</dt>
        <dd><strong className="tabular">{c.valor}</strong><span>{c.detalhe}</span></dd>
      </div>)}
    </dl>
  </section>;
}

/** As últimas votações de mérito numa tabela: uma linha por votação, o voto e o que o governo orientou. */
function PainelVotacoes({ casa, pessoa, className }: { casa: CasaCongresso; pessoa: Parlamentar; className: string }) {
  const plenario = usePlenario(casa);
  const [todas, setTodas] = useState(false);
  const p = plenario.dados;
  const camara = casa === "deputados";
  const titulo = "Como votou";
  if (plenario.erro) return <Bloco titulo={titulo} lustroFixo className={className}><Aviso>Não deu para carregar as votações agora.</Aviso></Bloco>;
  if (!p) return <Bloco titulo={titulo} lustroFixo className={className}><EsqueletoDetalhe /></Bloco>;

  const letras = p.votos[pessoa.id] ?? "";
  const lista = p.votacoes.map((v, i) => ({ v, letra: letras[i] ?? " " }));
  const noCargo = lista.filter(x => x.letra !== " ");
  const visiveis = todas ? lista : lista.slice(0, VOTOS_VISIVEIS);
  return <Bloco titulo={titulo} detalhe={`últimas ${lista.length} votações de mérito ${camara ? "da Câmara" : "do Senado"}`} lustroFixo className={className}>
    {!noCargo.length ? <Aviso>Não estava no cargo em nenhuma das últimas {lista.length} votações de mérito.</Aviso> : <>
      <table className={t.votos}>
        <thead>
          <tr><th scope="col">Data</th><th scope="col">Proposição</th><th scope="col">Resultado</th><th scope="col">Voto</th><th scope="col">Governo</th></tr>
        </thead>
        <tbody>
          {visiveis.map(({ v, letra }) => {
            const voto = letra === "S" ? "Sim" : letra === "N" ? "Não" : null;
            const seguiu = voto && v.governo ? voto === v.governo : null;
            const ementa = v.ementa || v.descricao;
            return <tr key={v.id}>
              <td className={`tabular ${t.data}`}><time dateTime={v.data.slice(0, 10)}>{dataCurta(v.data)}</time></td>
              <td className={t.proposicao}>
                {v.titulo && <strong>{v.titulo}{turno(v.descricao)}</strong>}
                <span title={ementa}>{ementa}</span>
              </td>
              <td className={`tabular ${t.resultado}`}>{v.aprovada ? "Aprovada" : "Rejeitada"}{v.sim + v.nao > 0 && <small>{inteiro(v.sim)} a {inteiro(v.nao)}</small>}</td>
              <td className={t.voto}><span className={estilos.voto} data-voto={letra === " " ? "fora" : voto ? "decidiu" : "outro"}>{VOTO_POR_LETRA[letra] ?? "Não votou"}</span></td>
              <td className={t.governo}>{v.governo ? <>orientou {v.governo}{seguiu !== null && <small>{seguiu ? "seguiu" : "contrariou"}</small>}</> : <span className={t.apagado}>sem orientação</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
      {lista.length > VOTOS_VISIVEIS && <button type="button" className={`${estilos.verTodos} ${t.verTodas}`} aria-expanded={todas} onClick={() => setTodas(x => !x)}>{todas ? "Mostrar menos" : `Ver as ${lista.length} votações`}</button>}
    </>}
  </Bloco>;
}

/** Presença, voto e voto com o governo em cada ano, com a mediana da casa embaixo. O ano escolhido acende. */
function PainelPlenarioAnos({ casa, pessoa, periodo, aoEscolher, className }: {
  casa: CasaCongresso;
  pessoa: Parlamentar;
  periodo: PeriodoCota;
  aoEscolher: (periodo: PeriodoCota) => void;
  className: string;
}) {
  const plenario = usePlenario(casa);
  const p = plenario.dados;
  const camara = casa === "deputados";
  const titulo = "Plenário ano a ano";
  if (plenario.erro) return <Bloco titulo={titulo} lustroFixo className={className}><Aviso>Não deu para carregar as votações agora.</Aviso></Bloco>;
  if (!p) return <Bloco titulo={titulo} lustroFixo className={className}><EsqueletoDetalhe /></Bloco>;

  const anos = p.anos;
  const daPessoa = p.pessoas[pessoa.id] ?? {};
  const medidas: { chave: string; rotulo: string; valor: (a: number) => string; mediana: (a: number) => string | null }[] = [
    camara
      ? { chave: "s", rotulo: "Presença", valor: a => porcento(taxaComBase(daPessoa[a]?.s)), mediana: a => porcento(p.totais[a]?.mediana.s) }
      : { chave: "a", rotulo: "Ausências", valor: a => (daPessoa[a] ? inteiro((daPessoa[a].j ?? 0) + (daPessoa[a].n ?? 0)) : "—"), mediana: () => null },
    { chave: "v", rotulo: "Votou", valor: a => porcento(taxaComBase(daPessoa[a]?.v)), mediana: a => porcento(p.totais[a]?.mediana.v) },
    { chave: "g", rotulo: "Com o governo", valor: a => porcento(taxaComBase(daPessoa[a]?.g)), mediana: a => porcento(p.totais[a]?.mediana.g) },
  ];
  return <Bloco titulo={titulo} detalhe={`embaixo, a mediana ${camara ? "da Câmara" : "do Senado"}`} lustroFixo className={className}>
    <table className={t.anos}>
      <thead>
        <tr>
          <th scope="col"><span className="sr-only">Medida</span></th>
          {anos.map(a => <th key={a} scope="col">
            <button type="button" aria-pressed={periodo === a} onClick={() => aoEscolher(periodo === a ? LEGISLATURA : a)}
              aria-label={periodo === a ? `${a}, escolhido; tocar volta à legislatura` : `Ver ${a}`}>{a}</button>
          </th>)}
        </tr>
      </thead>
      <tbody>
        {medidas.map(m => <tr key={m.chave}>
          <th scope="row">{m.rotulo}</th>
          {anos.map(a => {
            const mediana = m.mediana(a);
            return <td key={a} data-ativo={periodo === a || undefined}>
              <b className="tabular">{m.valor(a)}</b>
              {mediana && <small className="tabular">{mediana}</small>}
            </td>;
          })}
        </tr>)}
      </tbody>
    </table>
    <p className={t.nota}>
      {camara ? "Conta só o tempo no cargo; o arquivo aberto da Câmara não separa a ausência justificada da falta." : "Conta só o tempo no cargo; em votação secreta, entra se votou, mas não o voto."}
      {" "}Com o governo: votações em que o líder do governo orientou Sim ou Não e {camara ? "o deputado" : "o senador"} votou Sim ou Não.
    </p>
  </Bloco>;
}

/** As Emendas Pix da legislatura por ano, pelo nome registrado no Transferegov. */
function PainelEmendas({ ficha, carregando, erro, className }: { ficha: Ficha; carregando: boolean; erro: boolean; className: string }) {
  const e = ficha.emendas;
  return <Bloco titulo="Emendas Pix por ano" detalhe="Transferegov" lustroFixo className={className}>
    {carregando ? <EsqueletoDetalhe /> : erro ? <Aviso>As emendas não carregaram agora.</Aviso>
      : !e || !e.anos.length ? <Aviso>Nenhum plano de Emenda Pix com este nome desde 2023.</Aviso>
      : <>
        <Barras rotuloLista="Emendas Pix por ano" nomeDoMais="anos" total={ficha.totalEmendas} limite={8}
          itens={[...e.anos].sort((a, b) => a.ano - b.ano).map(a => ({ chave: String(a.ano), nome: String(a.ano), valor: a.valor, detalhe: `${inteiro(a.planos)} ${a.planos === 1 ? "plano" : "planos"}` }))} />
        {ficha.linkEmendas && <Link href={ficha.linkEmendas} className={t.linkPainel}>Ver os planos na aba Orçamento</Link>}
      </>}
  </Bloco>;
}

/** A posição na bancada do estado e na do partido, um painel para cada, do maior gasto ao menor. */
function PainelBancadas({ casa, pessoa, cota, deEstado, classes }: { casa: CasaCongresso; pessoa: Parlamentar; cota: CotaDoAno; deEstado: string; classes: [string, string] }) {
  const cadastro: Parlamentar[] = fotografia[casa];
  const singular = casa === "deputados" ? "deputado" : "senador";
  const quando = noPeriodo(cota.ano);
  const sufixoAno = cota.ano === LEGISLATURA ? "" : `?r.congresso.ano=${cota.ano}`;
  const temPartido = !!pessoa.partido && pessoa.partido !== "S/Partido";
  const bancadas = [
    { chave: "uf", titulo: `Bancada ${deEstado}`, membros: cadastro.filter(m => m.uf === pessoa.uf), link: linkCongresso(casa, [["uf", pessoa.uf]]) },
    ...(temPartido ? [{ chave: "partido", titulo: `Bancada do ${pessoa.partido}`, membros: cadastro.filter(m => m.partido === pessoa.partido), link: linkCongresso(casa, [["r.congresso.partido", pessoa.partido!]]) }] : []),
  ].filter(b => b.membros.length > 1);

  return <>{bancadas.map((b, i) => {
    const comNotas = b.membros.filter(m => cota.pessoas[m.id]).sort((x, y) => cota.pessoas[y.id].t - cota.pessoas[x.id].t);
    const soma = comNotas.reduce((s, m) => s + cota.pessoas[m.id].t, 0);
    const semNotas = b.membros.length - comNotas.length;
    const posicao = posicaoEntre(cota, b.membros.map(m => m.id), pessoa.id);
    let rank = 0;
    const itens = comNotas.map((m, j) => {
      const v = cota.pessoas[m.id].t;
      if (j === 0 || v !== cota.pessoas[comNotas[j - 1].id].t) rank = j + 1;
      const eu = m.id === pessoa.id;
      return {
        chave: String(m.id), valor: v, destaque: eu, href: `${caminhoParlamentar(casa, m)}${sufixoAno}`,
        detalhe: b.chave === "uf" ? (!m.partido || m.partido === "S/Partido" ? "sem partido" : m.partido) : m.uf,
        nome: <span className={estilos.pessoaBarra}><span className={`tabular ${estilos.posicaoBarra}`}>{rank}º</span><FotoParlamentar casa={casa} id={m.id} nome={m.nome} tamanho={24} /><span>{m.nome}</span></span>,
        rotulo: `${rank}º, ${m.nome}${eu ? " (esta página)" : ""}: ${reaisCompactos(v)} ${quando}`,
      };
    });
    const detalhe = posicao ? `${posicao.posicao}º de ${posicao.de} no gasto ${quando}` : `cota ${quando}`;
    return <Bloco key={b.chave} titulo={b.titulo} detalhe={detalhe} lustroFixo className={classes[i]}>
      {itens.length ? <Barras rotuloLista={`${b.titulo}, do maior para o menor gasto ${quando}`} nomeDoMais={casa} total={soma} itens={itens} limite={6} />
        : <Aviso>Ninguém desta bancada apresentou nota {quando}.</Aviso>}
      <div className={t.rodape}>
        <span>{comNotas.length ? `Média: ${reaisCompactos(soma / comNotas.length)} por ${singular}` : ""}{semNotas ? `${comNotas.length ? "; " : ""}${semNotas} sem notas` : ""}</span>
        <Link href={b.link} className={t.linkPainel}>Ver no Congresso</Link>
      </div>
    </Bloco>;
  })}</>;
}

/** As fontes da página num painel só: a cota e o plenário. */
function PainelFontes({ casa, indice, cota, linkNotas, className }: { casa: CasaCongresso; indice: IndiceCota | null; cota: CotaDoAno | null; linkNotas?: string; className: string }) {
  const plenario = usePlenario(casa);
  const p = plenario.dados;
  const camara = casa === "deputados";
  return <Bloco titulo="Fontes" lustroFixo className={className} corpo={t.fontes}>
    {indice && cota && <FonteCota casa={casa} indice={indice} cota={cota} linkNotas={linkNotas} />}
    {p && <p className={estilos.fonte}>
      Plenário: <a href={p.fontes.dados} target="_blank" rel="noreferrer">{camara ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos</a>, baixados em {new Date(p.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
      {" "}Votação de mérito é a do texto: proposta, projeto, substitutivo ou medida provisória, sem requerimentos nem destaques{camara ? "" : "; as secretas ficam fora"}.
    </p>}
  </Bloco>;
}
