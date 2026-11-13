"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

import {
  type CasaCongresso, type CotaDoAno, type IndiceCota, type PeriodoCota,
  HISTORICO, LEGISLATURA, MESES_POR_EXTENSO, VOTO_POR_LETRA, caminhoParlamentar, inteiro, noPeriodo, porcento, posicaoEntre, reaisCompactos, textoPercentual,
} from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import type { DadosPainel } from "../_dados/tipos";
import { Bloco, Opcoes } from "./Bloco";
import { useEscolhaImediata } from "./Vidro";
import { useFichaParlamentar } from "./CrachaParlamentar";
import type { Parlamentar } from "./DiretorioCongresso";
import { FotoParlamentar } from "./FotoParlamentar";
import { AnoAAno, Barras, EsqueletoDetalhe, FonteCota, MesAMes, SeletorAnoCota } from "./GraficosCota";
import { IdentidadePartido } from "./PainelEconomia";
import { BASE_MINIMA, taxaComBase, usePlenario } from "./PlenarioParlamentar";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";
import { EmendasMunicipiosParlamentar } from "./EmendasMunicipiosParlamentar";

/**
 * A página de um deputado ou senador como terminal: o crachá numa faixa, uma fita com os
 * números do período e, embaixo, três capítulos, um assunto cada, com o símbolo, o nome e o
 * que é numa frase. Cota (por mês, por ano, categorias, fornecedores, bancada); plenário
 * (presença e votos por ano, como votou); emendas. As fontes ficam no rodapé. Nenhuma linha da
 * grade mistura capítulos, e o título de cada painel diz o assunto ("Gasto da cota por mês").
 * Cada número aparece uma vez; o período do topo vale para tudo o que tem período.
 *
 * Os painéis têm altura fixa por linha da grade; "ver todos" não estica o painel, abre uma
 * rolagem dentro dele.
 *
 * Cada cor tem um trabalho: o azul da série é a cota da pessoa; as categorias levam a cor da
 * família de gasto; as bancadas, a cor do partido de cada um (a da maquete); as Emendas Pix,
 * o verde-azulado das transferências no Orçamento; os fornecedores ficam neutros. Verde e
 * vermelho, só nos selos de "Como votou" (Sim/Não, Aprovada/Rejeitada; ver `Selo`). Presença
 * e "com o governo" não levam cor: não são melhores nem piores.
 */

/**
 * Famílias de gasto da cota, pelo nome da categoria (os índices mudam de arquivo para
 * arquivo). Três cores conferidas no validador de daltonismo da skill de dataviz, todos os
 * pares, nos dois temas; o gabinete e o resto ficam em cinza. Nada de verde nem vermelho:
 * gastar não é bom nem ruim por si só. A ordem importa: "Locomoção, hospedagem e
 * alimentação", do Senado, é viagem, e não carro.
 */
const FAMILIAS = [
  { chave: "divulgacao", nome: "Divulgação", teste: /divulga/i },
  { chave: "carro", nome: "Carro", teste: /veícul|combust|táxi/i },
  { chave: "viagem", nome: "Viagens", teste: /passage|fretamento|hospedagem|alimenta|locomo/i },
  { chave: "gabinete", nome: "Escritório", teste: /escrit|telefon|correio|assinatura|certificad|consultori|curso/i },
  { chave: "outros", nome: "Outros", teste: /./ },
] as const;
type Familia = (typeof FAMILIAS)[number];
const familiaDe = (categoria: string): Familia => FAMILIAS.find(f => f.teste.test(categoria)) ?? FAMILIAS[FAMILIAS.length - 1];
const corDaFamilia = (f: Familia) => `var(--familia-${f.chave})`;

/** Quantas cabem em "Como votou" sem rolar, abaixo do placar, na altura da linha do plenário. */
const VOTOS_VISIVEIS = 11;
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

export function TerminalParlamentar({ casa, pessoa, governos, ufs, cor, corDe, indice, cota, erroCota, periodo, anos, aoEscolherPeriodo, acoes }: {
  casa: CasaCongresso;
  pessoa: Parlamentar;
  governos: DadosPainel["governos"];
  ufs: DadosPainel["ufs"];
  cor: string;
  /** A cor de cada bancada, a mesma da maquete. */
  corDe: (partido: string | null) => string;
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
  const singular = camara ? "deputado" : "senador";
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
            <a href="#emendas-municipios">Emendas por município</a>
            {acoes}
          </div>
        </div>
        <div className={t.periodo}>
          <span>Período dos números</span>
          <SeletorAnoCota anos={anos} periodo={periodo} aoEscolher={aoEscolherPeriodo} />
        </div>
      </div>
      <Fita casa={casa} pessoa={pessoa} periodo={periodo} ficha={ficha} cota={cota} erroCota={erroCota} />
      <p className={t.nota}>Histórico disponível nesta casa: cota desde 2008; plenário desde {camara ? "2001" : "1991"}; emendas desde 2014 e planos Pix desde 2020. A soma usa os registros disponíveis, em valores da época. Lacunas de cobertura não significam R$ 0. Comparações usam a composição atual.</p>
      {cota?.semCobertura && <p className={t.nota}>A fonte da cota não cobre {String(periodo)}. Consulte os outros indicadores ou escolha um ano a partir de 2008.</p>}
    </header>

    {/*
      Três capítulos, um assunto cada: a cota, o plenário e as emendas. Cada um abre com o que
      é, numa frase, e tem a sua grade de linhas de altura fixa (ver `.grade` no CSS): nenhuma
      linha mistura assuntos, painéis da mesma linha têm a mesma altura, e o que não cabe (ou o
      que se expande) rola dentro do painel. A ordem do HTML é a do celular.
    */}
    <Capitulo id="capitulo-cota" icone="cota" titulo="Cota parlamentar"
      frase={`Verba mensal de cada ${singular} para as despesas do mandato, como passagens, escritório, divulgação e carro. Cada gasto precisa de nota, e as notas são públicas.`}>
      <div className={`${t.grade} ${t.gradeCota}`}>
        <Bloco titulo="Gasto da cota por mês" detalhe={gasto ? `${notas(gasto.n)} ${quando}` : quando} lustroFixo className={`${t.painel} ${t.aMes}`}>
          {erroCota ? <Aviso>Não deu para carregar a cota agora.</Aviso> : !cota || !indice ? <EsqueletoDetalhe />
            : cota.semCobertura ? <Aviso>A fonte de cota não cobre {String(periodo)}. Os dados começam em 2008.</Aviso>
            : !gasto ? <Aviso>Nenhuma nota de cota {quando}. Quem assumiu depois, se licenciou ou não usou a cota no período não aparece no arquivo.</Aviso>
            : <>
              <MesAMes valores={gasto.m} media={cota.mediaMes} situacao={ficha.situacao} meses={ficha.meses} rotuloSerie={pessoa.nome} rotuloMedia={`média dos ${ficha.rotuloCasa}`} />
              {ficha.chegouDepois && <p className={t.nota}>As notas começam em {MESES_POR_EXTENSO[ficha.chegouDepois.mes]} de {ficha.chegouDepois.ano}: a comparação com quem está desde 2023 é desigual.</p>}
            </>}
        </Bloco>
        <Bloco titulo="Gasto da cota por ano" detalhe="clique num ano" lustroFixo className={`${t.painel} ${t.aAno}`}>
          {erroCota ? <Aviso>Não deu para carregar a cota agora.</Aviso> : !indice ? <EsqueletoDetalhe /> : <>
            <p className={estilos.legendaGrafico}><span><i className={estilos.chaveSerie} />{pessoa.nome}</span><span><i className={estilos.chaveMedia} />média dos {ficha.rotuloCasa}</span>{ficha.anoParcial !== null && <span>* ano em curso</span>}</p>
            <AnoAAno anos={anos.filter(a => indice.anos.includes(a))} valores={anos.filter(a => indice.anos.includes(a)).map(a => indice.totais[pessoa.id]?.[indice.anos.indexOf(a)] ?? null)} medias={anos.filter(a => indice.anos.includes(a)).map(a => indice.media[a]?.media ?? 0)}
              ativo={typeof periodo === "number" ? periodo : null} aoEscolher={aoEscolherPeriodo} rotuloMedia={`média dos ${ficha.rotuloCasa}`} parcial={ficha.anoParcial} />
          </>}
        </Bloco>
        {/* Categorias e fornecedores lado a lado: a faixa com a mesma altura e um nome por linha, para as barras andarem juntas. */}
        <Bloco titulo="Com o que gastou a cota" detalhe={quando} lustroFixo className={`${t.painel} ${t.aCat}`}>
          {!cota ? <EsqueletoDetalhe /> : cota.semCobertura ? <Aviso>Sem cobertura da fonte da cota para este ano.</Aviso> : !gasto ? <Aviso>Sem notas {quando}.</Aviso>
            : (() => {
              const categorias = gasto.c.map(([c, v]) => ({ chave: String(c), nome: cota.categorias[c] ?? "Sem categoria", valor: v }));
              return <>
                <Faixa partes={partesPorFamilia(categorias)} />
                <Barras rotuloLista={`Categorias de gasto de ${pessoa.nome} ${quando}`} nomeDoMais="categorias" feminino total={gasto.t} umaLinha
                  itens={categorias.map(c => ({ ...c, cor: corDaFamilia(familiaDe(c.nome)) }))} />
              </>;
            })()}
        </Bloco>
        <Bloco titulo="Quem mais recebeu da cota" detalhe={quando} lustroFixo className={`${t.painel} ${t.aFor}`}>
          {!cota ? <EsqueletoDetalhe /> : cota.semCobertura ? <Aviso>Sem cobertura da fonte da cota para este ano.</Aviso> : !gasto ? <Aviso>Sem notas {quando}.</Aviso>
            : <>
              <Faixa partes={partesDosFornecedores(gasto.f, gasto.t)} />
              <Barras rotuloLista={`Fornecedores que mais receberam de ${pessoa.nome} ${quando}`} nomeDoMais="fornecedores" total={gasto.t} cor="var(--cor-fornecedores)" umaLinha
                itens={gasto.f.map(([nome, v, n]) => ({ chave: nome, nome: nome === "Pessoa física" ? "Pessoas físicas (nomes omitidos)" : nome, valor: v, detalhe: notas(n) }))} />
            </>}
        </Bloco>
        {cota && <PainelBancada casa={casa} pessoa={pessoa} cota={cota} corDe={corDe} nomeUf={uf?.nome ?? pessoa.uf} className={`${t.painel} ${t.aBan}`} />}
      </div>
    </Capitulo>

    <Capitulo id="capitulo-plenario" icone="plenario" titulo="No plenário"
      frase={`O que ${camara ? "a Câmara" : "o Senado"} registra nas votações: ${camara ? "a presença nas sessões, " : "as ausências, "}se o ${singular} votou e como votou nas votações de mérito, ao lado do que o governo orientou.`}>
      <div className={`${t.grade} ${t.gradePlenario}`}>
        <PainelPlenarioAnos casa={casa} pessoa={pessoa} periodo={periodo} aoEscolher={aoEscolherPeriodo} className={`${t.painel} ${t.aPle}`} />
        <PainelVotacoes casa={casa} pessoa={pessoa} periodo={periodo} className={`${t.painel} ${t.aVot}`} />
      </div>
    </Capitulo>

    <Capitulo id="capitulo-emendas" icone="emendas" titulo="Emendas"
      frase={`Dinheiro do Orçamento federal que o ${singular} indica para cidades, estados e entidades. A Emenda Pix cai direto na conta da prefeitura ou do estado, que decide onde usar.`}>
      <div className={`${t.grade} ${t.gradeEmendas}`}>
        <PainelEmendas ficha={ficha} carregando={perfil.carregando} erro={perfil.erro} className={`${t.painel} ${t.aEme}`} />
        <EmendasMunicipiosParlamentar casa={casa} id={pessoa.id} periodo={periodo} uf={pessoa.uf} className={`${t.painel} ${t.aMun}`} />
      </div>
    </Capitulo>

    <Fontes casa={casa} indice={indice} cota={cota} linkNotas={ficha.linkNotas} />
  </article>;
}

type Icone = "cota" | "plenario" | "emendas";

/** O símbolo de cada capítulo, o mesmo no cabeçalho dele e no grupo da fita: uma nota fiscal, uma urna, um pino no mapa. */
const DESENHOS: Record<Icone, ReactNode> = {
  cota: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  plenario: <><path d="M4 12h16v8H4z" /><path d="M8 12V4h8v8" /><path d="m10 8 1.6 1.6L14.5 6.6" /></>,
  emendas: <><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
};
function Simbolo({ icone, tamanho = 18 }: { icone: Icone; tamanho?: number }) {
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{DESENHOS[icone]}</svg>;
}

/**
 * Um assunto da página: o símbolo, o nome e, numa frase, o que é. Fica fora dos painéis, no
 * fundo da página, para separar os assuntos pelo título e pelo espaço, sem fio nem cor.
 * Sem número: o total de cada assunto está na fita do topo, e cada número aparece uma vez.
 */
function Capitulo({ id, icone, titulo, frase, children }: { id: string; icone: Icone; titulo: string; frase: string; children: ReactNode }) {
  return <section id={id} className={t.capitulo} aria-labelledby={`${id}-titulo`}>
    <header className={t.capituloCabeca}>
      <span className={t.simbolo}><Simbolo icone={icone} /></span>
      <h2 id={`${id}-titulo`}>{titulo}</h2>
      <p>{frase}</p>
    </header>
    {children}
  </section>;
}

function Aviso({ children }: { children: ReactNode }) {
  return <p className={estilos.aviso}>{children}</p>;
}

type Parte = { chave: string; nome: string; valor: number; cor: string };

/** A cota do período por família de gasto, da maior para a menor. */
function partesPorFamilia(categorias: { nome: string; valor: number }[]): Parte[] {
  return FAMILIAS
    .map(f => ({ chave: f.chave, nome: f.nome, cor: corDaFamilia(f), valor: categorias.filter(c => familiaDe(c.nome) === f).reduce((s, c) => s + Math.max(0, c.valor), 0) }))
    .sort((a, b) => b.valor - a.valor);
}

/** Quanto da cota foi para os fornecedores da lista (o arquivo guarda os 6 maiores) e quanto para os outros. */
function partesDosFornecedores(fornecedores: [string, number, number][], total: number): Parte[] {
  const maiores = fornecedores.reduce((s, [, v]) => s + Math.max(0, v), 0);
  return [
    { chave: "maiores", nome: fornecedores.length === 1 ? "O maior" : `Os ${fornecedores.length} maiores`, valor: maiores, cor: "var(--cor-fornecedores)" },
    { chave: "demais", nome: "Todos os outros", valor: Math.max(0, total - maiores), cor: "var(--cor-fornecedores-outros)" },
  ];
}

/** Um todo numa faixa, com a legenda dizendo a parte de cada pedaço. */
function Faixa({ partes }: { partes: Parte[] }) {
  const visiveis = partes.filter(p => p.valor > 0);
  const soma = visiveis.reduce((s, p) => s + p.valor, 0);
  if (!(soma > 0)) return null;
  return <figure className={t.composicao}>
    <div className={t.faixaComposicao} aria-hidden="true">
      {visiveis.map(p => <span key={p.chave} style={{ flexGrow: p.valor, "--cor": p.cor } as CSSProperties}
        title={`${p.nome}: ${reaisCompactos(p.valor)} (${textoPercentual(p.valor, soma)})`} />)}
    </div>
    <figcaption className={t.legendaComposicao}>
      {visiveis.map(p => <span key={p.chave}><i style={{ "--cor": p.cor } as CSSProperties} />{p.nome} <b className="tabular">{textoPercentual(p.valor, soma)}</b></span>)}
    </figcaption>
  </figure>;
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
  const semPlenario = plenario.erro ? "não carregou agora" : pl && typeof periodo === "number" && !pl.anos.includes(periodo) ? "sem cobertura da fonte neste ano" : pl && !linha ? "sem registros no período" : null;
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
      { rotulo: "Gastou da cota", valor: gasto ? reaisCompactos(gasto.t) : "—", detalhe: cota?.semCobertura ? "sem cobertura da fonte neste ano" : gasto ? (comparacao && media ? `${comparacao.texto} dos ${ficha.rotuloCasa} (${reaisCompactos(media.media)})` : notas(gasto.n)) : `nenhuma nota ${quando}` },
      { rotulo: "Posição no gasto", valor: posicao ? `${posicao.posicao}º` : "—", detalhe: posicao ? `entre ${inteiro(posicao.de)}, do maior gasto ao menor` : `sem notas ${quando}` },
    ];

  const emendas: Celula[] = [{
    rotulo: "Emendas Pix previstas", valor: ficha.perfil.carregando ? "…" : ficha.emendas?.anos.length ? reaisCompactos(ficha.totalEmendas) : "—",
    detalhe: ficha.perfil.carregando ? "carregando" : ficha.perfil.erro ? "indisponível agora" : ficha.emendas?.anos.length ? `${inteiro(ficha.planosEmendas)} ${ficha.planosEmendas === 1 ? "plano" : "planos"} ${quando}` : "sem planos identificados no período",
  }];

  return <div className={t.fita}>
    <Grupo nome={`Cota parlamentar · ${quando}`} icone="cota" ancora="capitulo-cota" celulas={cotas} />
    <Grupo nome={`No plenário · ${noPeriodo(periodo)}`} icone="plenario" ancora="capitulo-plenario" celulas={plenarios} />
    <Grupo nome={`Emendas Pix · ${quando}`} icone="emendas" ancora="capitulo-emendas" celulas={emendas} />
  </div>;
}

type Celula = { rotulo: string; valor: string; detalhe: string };

/** Um grupo da fita, com o símbolo do capítulo dele; o nome leva até o capítulo. */
function Grupo({ nome, icone, ancora, celulas }: { nome: string; icone: Icone; ancora: string; celulas: Celula[] }) {
  return <section className={t.grupo} style={{ "--n": celulas.length } as CSSProperties} aria-label={nome}>
    <a href={`#${ancora}`} className={t.grupoNome}><Simbolo icone={icone} tamanho={14} />{nome}</a>
    <dl className={t.celulas}>
      {celulas.map(c => <div key={c.rotulo} className={t.celula}>
        <dt>{c.rotulo}</dt>
        <dd><strong className="tabular">{c.valor}</strong><span>{c.detalhe}</span></dd>
      </div>)}
    </dl>
  </section>;
}

/** As últimas votações de mérito numa tabela: uma linha por votação, o voto e o que o governo orientou. */
function PainelVotacoes({ casa, pessoa, periodo, className }: { casa: CasaCongresso; pessoa: Parlamentar; periodo: PeriodoCota; className: string }) {
  const plenario = usePlenario(casa);
  const [todas, setTodas] = useState(false);
  const p = plenario.dados;
  const camara = casa === "deputados";
  const titulo = "Como votou";
  if (plenario.erro) return <Bloco titulo={titulo} lustroFixo className={className}><Aviso>Não deu para carregar as votações agora.</Aviso></Bloco>;
  if (!p) return <Bloco titulo={titulo} lustroFixo className={className}><EsqueletoDetalhe /></Bloco>;

  const letras = p.votos[pessoa.id] ?? "";
  const lista = p.votacoes.map((v, i) => ({ v, letra: letras[i] ?? " " })).filter(({ v }) => typeof periodo === "number" ? Number(v.data.slice(0, 4)) === periodo : periodo === LEGISLATURA ? v.data >= "2023-02-01" : true).slice(0, 30);
  const noCargo = lista.filter(x => x.letra !== " ");
  const visiveis = todas ? lista : lista.slice(0, VOTOS_VISIVEIS);
  return <Bloco titulo={titulo} detalhe={`últimas ${lista.length} votações de mérito ${camara ? "da Câmara" : "do Senado"}`} lustroFixo className={className}>
    {!noCargo.length ? <Aviso>Não estava no cargo em nenhuma das últimas {lista.length} votações de mérito.</Aviso> : <>
      <PlacarVotos letras={noCargo.map(x => x.letra)} />
      <table className={t.votos}>
        <thead>
          <tr><th scope="col">Data</th><th scope="col">Voto</th><th scope="col">Proposição</th><th scope="col">Resultado</th><th scope="col">Governo</th></tr>
        </thead>
        <tbody>
          {visiveis.map(({ v, letra }) => {
            const voto = letra === "S" ? "Sim" : letra === "N" ? "Não" : null;
            const seguiu = voto && v.governo ? voto === v.governo : null;
            const ementa = v.ementa || v.descricao;
            return <tr key={v.id}>
              <td className={`tabular ${t.data}`}><time dateTime={v.data.slice(0, 10)}>{dataCurta(v.data)}</time></td>
              <td className={t.voto}>{letra === "S" || letra === "N"
                ? <Selo sim={letra === "S"}>{voto}</Selo>
                : <span className={t.seloNeutro} data-fora={letra === " " || undefined}>{VOTO_POR_LETRA[letra] ?? "Não votou"}</span>}</td>
              <td className={t.proposicao}>
                {v.titulo && <strong>{v.titulo}{turno(v.descricao)}</strong>}
                <span title={ementa}>{ementa}</span>
              </td>
              <td className={`tabular ${t.resultado}`}><Selo sim={v.aprovada} leve>{v.aprovada ? "Aprovada" : "Rejeitada"}</Selo>{v.placarInformado === false ? <small>Placar não informado</small> : v.sim + v.nao > 0 && <small>{inteiro(v.sim)} a {inteiro(v.nao)}</small>}</td>
              <td className={t.governo}>{v.governo ? <>orientou {v.governo}{seguiu !== null && <small>{seguiu ? "seguiu" : "contrariou"}</small>}</> : <span className={t.apagado}>sem orientação</span>}</td>
            </tr>;
          })}
        </tbody>
      </table>
      {lista.length > VOTOS_VISIVEIS && <button type="button" className={`${estilos.verTodos} ${t.verTodas}`} aria-expanded={todas} onClick={() => setTodas(x => !x)}>{todas ? "Mostrar menos" : `Ver as ${lista.length} votações`}</button>}
    </>}
  </Bloco>;
}

/**
 * O voto (e o resultado) como no painel do plenário: ✓ verde para Sim e Aprovada, ✗ vermelho
 * para Não e Rejeitada. É a única exceção à regra do site de que verde e vermelho querem dizer
 * melhorou e piorou, pedida pelo dono, e fica só nestes selos: o símbolo e a palavra dizem o
 * mesmo que a cor, para quem não distingue as duas. O resultado é `leve` (fundo claro), para o
 * voto, cheio, mandar na linha.
 */
function Selo({ sim, leve = false, children }: { sim: boolean; leve?: boolean; children: ReactNode }) {
  return <span className={t.selo} data-sim={sim || undefined} data-leve={leve || undefined}>
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {sim ? <path d="m2.5 6.3 2.4 2.4 4.6-5" /> : <path d="m3 3 6 6M9 3 3 9" />}
    </svg>
    {children}
  </span>;
}

/** No topo de "Como votou": quantas vezes votou Sim, Não, outra coisa ou não votou, em número e numa faixa. */
function PlacarVotos({ letras }: { letras: string[] }) {
  const conta = (teste: (l: string) => boolean) => letras.filter(teste).length;
  const partes = [
    { chave: "sim", nome: "Sim", n: conta(l => l === "S") },
    { chave: "nao", nome: "Não", n: conta(l => l === "N") },
    { chave: "outro", nome: "Abstenção e outros", n: conta(l => !"SN-FJ".includes(l)) },
    { chave: "ausente", nome: "Não votou", n: conta(l => "-FJ".includes(l)) },
  ].filter(p => p.n > 0 || p.chave === "sim" || p.chave === "nao");
  return <figure className={t.placarVotos}>
    <dl>
      {partes.map(p => <div key={p.chave} data-parte={p.chave}>
        <dd className="tabular">{inteiro(p.n)}</dd>
        <dt><i aria-hidden="true" />{p.nome}</dt>
      </div>)}
    </dl>
    <div className={t.faixaVotos} aria-hidden="true">
      {partes.filter(p => p.n > 0).map(p => <span key={p.chave} data-parte={p.chave} style={{ flexGrow: p.n }} />)}
    </div>
  </figure>;
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
  // O ano acende no clique; o resto da página vem depois (ver `useEscolhaImediata`).
  const [escolhido, escolher] = useEscolhaImediata(periodo, aoEscolher);
  const p = plenario.dados;
  const camara = casa === "deputados";
  const titulo = camara ? "Presença e votos por ano" : "Ausências e votos por ano";
  if (plenario.erro) return <Bloco titulo={titulo} lustroFixo className={className}><Aviso>Não deu para carregar as votações agora.</Aviso></Bloco>;
  if (!p) return <Bloco titulo={titulo} lustroFixo className={className}><EsqueletoDetalhe /></Bloco>;

  const daPessoa = p.pessoas[pessoa.id] ?? {};
  const anos = p.anos.filter(a => !!daPessoa[a]).toReversed();
  const medidas: { chave: string; rotulo: string; valor: (a: number) => string; mediana: (a: number) => string | null }[] = [
    camara
      ? { chave: "s", rotulo: "Presença", valor: a => porcento(taxaComBase(daPessoa[a]?.s)), mediana: a => porcento(p.totais[a]?.mediana.s) }
      : { chave: "a", rotulo: "Ausências", valor: a => (daPessoa[a] ? inteiro((daPessoa[a].j ?? 0) + (daPessoa[a].n ?? 0)) : "—"), mediana: () => null },
    { chave: "v", rotulo: "Votou", valor: a => porcento(taxaComBase(daPessoa[a]?.v)), mediana: a => porcento(p.totais[a]?.mediana.v) },
    { chave: "g", rotulo: "Com o governo", valor: a => porcento(taxaComBase(daPessoa[a]?.g)), mediana: a => porcento(p.totais[a]?.mediana.g) },
  ];
  return <Bloco titulo={titulo} lustroFixo className={className} corpo={t.notaNaBase}>
    <table className={t.anos}>
      <thead>
        <tr>
          <th scope="col">Ano</th>
          {medidas.map(m => <th key={m.chave} scope="col">{m.rotulo}</th>)}
        </tr>
      </thead>
      <tbody>
        {anos.map(a => <tr key={a}>
          <th scope="row"><button type="button" aria-pressed={escolhido === a} onClick={() => escolher(escolhido === a ? HISTORICO : a)}
            aria-label={escolhido === a ? `${a}, escolhido; tocar volta ao histórico` : `Ver ${a}`}>{a}</button></th>
          {medidas.map(m => {
            const mediana = m.mediana(a);
            return <td key={m.chave} data-ativo={escolhido === a || undefined}>
              <b className="tabular">{m.valor(a)}</b>
              {mediana && <small className="tabular">{mediana}</small>}
            </td>;
          })}
        </tr>)}
      </tbody>
    </table>
    <p className={t.nota}>
      Embaixo de cada número, em cinza, a mediana {camara ? "da Câmara" : "do Senado"}.{" "}
      {camara ? "Conta só o tempo no cargo; o arquivo aberto da Câmara não separa a ausência justificada da falta." : "Conta só o tempo no cargo; em votação secreta, entra se votou, mas não o voto."}
      {" "}Com o governo: votações em que o líder do governo orientou Sim ou Não e {camara ? "o deputado" : "o senador"} votou Sim ou Não.
      {" "}Arquivos antigos podem ter lacunas de presença, orientação e votos individuais. O histórico soma contagens; porcentagens não são somadas nem calculadas pela média dos anos.
    </p>
  </Bloco>;
}

/**
 * As Emendas Pix por ano, pelo nome registrado no Transferegov, numa faixa larga no topo do
 * capítulo: um ano por célula, com o valor e uma barra na escala do maior ano. É o resumo; os
 * municípios, embaixo, são o detalhe.
 */
function PainelEmendas({ ficha, carregando, erro, className }: { ficha: Ficha; carregando: boolean; erro: boolean; className: string }) {
  const e = ficha.emendas;
  const anos = e ? [...e.anos].sort((a, b) => a.ano - b.ano) : [];
  const maximo = Math.max(1, ...anos.map(a => a.valor));
  const acao = !carregando && !erro && anos.length && ficha.linkEmendas ? <Link href={ficha.linkEmendas} className={t.linkPainel}>Ver os planos na aba Orçamento</Link> : null;
  return <Bloco titulo="Emendas Pix por ano" detalhe="Transferegov" acao={acao} lustroFixo className={className}>
    {carregando ? <EsqueletoDetalhe /> : erro ? <Aviso>As emendas não carregaram agora.</Aviso>
      : !anos.length ? <Aviso>Nenhum plano de Emenda Pix identificado {ficha.quando}.</Aviso>
      : <ol className={t.anosEmendas} aria-label="Emendas Pix por ano">
        {anos.map(a => <li key={a.ano}>
          <span className="tabular">{a.ano}</span>
          <strong className="tabular">{reaisCompactos(a.valor)}</strong>
          <small>{inteiro(a.planos)} {a.planos === 1 ? "plano" : "planos"}</small>
          <i aria-hidden="true"><b style={{ width: `${(Math.max(0, a.valor) / maximo) * 100}%` }} /></i>
        </li>)}
      </ol>}
  </Bloco>;
}

type Bancada = "uf" | "partido";

/**
 * O gasto da cota na bancada do estado ou na do partido, do maior ao menor, com a pessoa
 * acesa; cada barra na cor do partido. Um painel só, com o seletor Estado | Partido, para
 * fechar o capítulo da cota ao lado de categorias e fornecedores.
 */
function PainelBancada({ casa, pessoa, cota, corDe, nomeUf, className }: {
  casa: CasaCongresso; pessoa: Parlamentar; cota: CotaDoAno; corDe: (partido: string | null) => string; nomeUf: string; className: string;
}) {
  const [escolhida, setEscolhida] = useState<Bancada>("uf");
  const cadastro: Parlamentar[] = fotografia[casa];
  const singular = casa === "deputados" ? "deputado" : "senador";
  const quando = noPeriodo(cota.ano);
  const sufixoAno = cota.ano === HISTORICO ? "" : `?r.congresso.ano=${cota.ano}`;
  const temPartido = !!pessoa.partido && pessoa.partido !== "S/Partido";
  const bancadas = [
    { chave: "uf" as const, opcao: "Estado", nome: nomeUf, membros: cadastro.filter(m => m.uf === pessoa.uf), link: linkCongresso(casa, [["uf", pessoa.uf]]) },
    ...(temPartido ? [{ chave: "partido" as const, opcao: "Partido", nome: pessoa.partido!, membros: cadastro.filter(m => m.partido === pessoa.partido), link: linkCongresso(casa, [["r.congresso.partido", pessoa.partido!]]) }] : []),
  ].filter(b => b.membros.length > 1);
  const b = bancadas.find(x => x.chave === escolhida) ?? bancadas[0];
  if (!b) return null;

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
      chave: String(m.id), valor: v, destaque: eu, href: `${caminhoParlamentar(casa, m)}${sufixoAno}`, cor: corDe(m.partido),
      detalhe: b.chave === "uf" ? (!m.partido || m.partido === "S/Partido" ? "sem partido" : m.partido) : m.uf,
      nome: <span className={estilos.pessoaBarra}><span className={`tabular ${estilos.posicaoBarra}`}>{rank}º</span><FotoParlamentar casa={casa} id={m.id} nome={m.nome} tamanho={24} /><span>{m.nome}</span></span>,
      rotulo: `${rank}º, ${m.nome}${eu ? " (esta página)" : ""}: ${reaisCompactos(v)} ${quando}`,
    };
  });
  const titulo = bancadas.length > 1 ? "Gasto da cota na bancada" : `Gasto da cota na bancada ${b.chave === "uf" ? `de ${b.nome}` : `do ${b.nome}`}`;
  return <Bloco titulo={titulo} detalhe={quando} lustroFixo className={className}>
    <div className={t.bancadaTopo}>
      {bancadas.length > 1 && <Opcoes rotulo="Qual bancada" ativa={b.chave} aoEscolher={setEscolhida} opcoes={bancadas.map(x => ({ id: x.chave, rotulo: x.opcao }))} />}
      <span>{b.nome}{posicao ? <>: <b className="tabular">{posicao.posicao}º</b> de {inteiro(posicao.de)}</> : ""}</span>
    </div>
    {itens.length ? <Barras key={b.chave} rotuloLista={`Bancada ${b.chave === "uf" ? `de ${b.nome}` : `do ${b.nome}`}, do maior para o menor gasto da cota ${quando}`} nomeDoMais={casa} total={soma} itens={itens} limite={5} />
      : <Aviso>Ninguém desta bancada apresentou nota {quando}.</Aviso>}
    <div className={t.rodape}>
      <span>{comNotas.length ? `Média: ${reaisCompactos(soma / comNotas.length)} por ${singular}` : ""}{semNotas ? `${comNotas.length ? "; " : ""}${semNotas} sem notas` : ""}</span>
      <Link href={b.link} className={t.linkPainel}>Ver no Congresso</Link>
    </div>
  </Bloco>;
}

/** As fontes da página, no rodapé, fora dos capítulos: a cota e o plenário (as emendas trazem as suas no painel). */
function Fontes({ casa, indice, cota, linkNotas }: { casa: CasaCongresso; indice: IndiceCota | null; cota: CotaDoAno | null; linkNotas?: string }) {
  const plenario = usePlenario(casa);
  const p = plenario.dados;
  const camara = casa === "deputados";
  return <footer className={t.fontes} aria-labelledby="fontes-titulo">
    <h2 id="fontes-titulo">Fontes</h2>
    {indice && cota && <FonteCota casa={casa} indice={indice} cota={cota} linkNotas={linkNotas} />}
    {p && <p className={estilos.fonte}>
      Plenário: <a href={p.fontes.dados} target="_blank" rel="noreferrer">{camara ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos</a>, baixados em {new Date(p.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
      {" "}Votação de mérito é a do texto: proposta, projeto, substitutivo ou medida provisória, sem requerimentos nem destaques{camara ? "" : "; as secretas ficam fora"}.
    </p>}
  </footer>;
}
