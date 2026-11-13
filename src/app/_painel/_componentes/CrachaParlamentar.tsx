"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import {
  type CasaCongresso, type CotaDoAno, type IndiceCota, type PerfilParlamentar, type PeriodoCota,
  HISTORICO, LEGISLATURA, MESES_POR_EXTENSO, caminhoParlamentar, comparadoAMedia, idade, inteiro, intervaloDaCota, mesesDaCota, noPeriodo, percentual, posicaoNaCota,
  primeiroMesComNota, reaisCompactos, reaisInteiros, situacaoDaCota, situacaoDosMeses,
} from "../_dados/congressoModelo";
import type { DadosPainel } from "../_dados/tipos";
import { useJson } from "../_dados/useJson";
import type { Parlamentar } from "./DiretorioCongresso";
import { FotoParlamentar } from "./FotoParlamentar";
import { AnoAAno, Barras, EsqueletoDetalhe, FonteCota, MesAMes, Numero } from "./GraficosCota";
import { IdentidadePartido } from "./PainelEconomia";
import { ComoVotou, NumerosPlenario } from "./PlenarioParlamentar";
import { titulo } from "./formatos";
import { anosDasEmendas } from "../_dados/emendasParlamentarModelo";
import estilos from "./Parlamentares.module.css";

const semAcento = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const minuscula = (t: string) => t.charAt(0).toLocaleLowerCase("pt-BR") + t.slice(1);
const notas = (n: number) => `${inteiro(n)} ${n === 1 ? "nota" : "notas"}`;
const Seta = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M7 17 17 7M7 7h10v10" /></svg>;

/** Legislatura que contém o ano (a 57ª vai de 2023 a 2026). */
const legislaturaDoAno = (ano: number) => Math.floor((ano - 1795) / 4);

/**
 * As contas do crachá, que a página do parlamentar (o terminal) também usa: o perfil, os links
 * e a cota do período escolhido. Um lugar só, para os dois mostrarem os mesmos números.
 */
export function useFichaParlamentar({ casa, pessoa, periodo, indice, cota }: {
  casa: CasaCongresso;
  pessoa: Parlamentar;
  periodo: PeriodoCota;
  indice: IndiceCota | null;
  cota: CotaDoAno | null;
}) {
  const perfil = useJson<PerfilParlamentar>(`/api/painel/congresso?casa=${casa}&id=${pessoa.id}`);
  const p = perfil.dados;
  const rotuloCasa = casa === "deputados" ? "deputados" : "senadores";
  const anos = idade(p?.nascimento ?? null);
  const nomeCivil = p?.nomeCivil && semAcento(p.nomeCivil) !== semAcento(pessoa.nome) ? titulo(p.nomeCivil) : null;
  const trajetoria = p?.trajetoria;
  const textoTrajetoria = !trajetoria ? null : casa === "deputados"
    ? trajetoria.periodos === 1 ? "Primeira legislatura na Câmara" : `${trajetoria.periodos} legislaturas na Câmara, desde ${trajetoria.desde}`
    : trajetoria.periodos === 1 ? `No Senado desde ${trajetoria.desde}, mandato até ${trajetoria.ate}` : `${trajetoria.periodos} mandatos no Senado, desde ${trajetoria.desde}`;
  const linkPerfil = casa === "deputados" ? `https://www.camara.leg.br/deputados/${pessoa.id}` : `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${pessoa.id}`;
  // Na legislatura, as notas abrem no ano mais recente; o site de cada casa separa por ano.
  const anoDasNotas = typeof periodo === "number" ? periodo : indice?.anos.at(-1);
  const linkNotas = anoDasNotas === undefined ? undefined : casa === "deputados"
    ? `https://www.camara.leg.br/transparencia/gastos-parlamentares?legislatura=${legislaturaDoAno(anoDasNotas)}&ano=${anoDasNotas}&mes=&por=deputado&deputado=${pessoa.id}&uf=&partido=`
    : `https://www6g.senado.leg.br/transparencia/sen/${pessoa.id}/?ano=${anoDasNotas}`;

  const linkPagina = `${caminhoParlamentar(casa, pessoa)}${periodo !== HISTORICO ? `?r.congresso.ano=${periodo}` : ""}`;

  const intervalo = anosDasEmendas(periodo);
  const emendas = p?.emendas ? { ...p.emendas, anos: p.emendas.anos.filter(a => a.ano >= intervalo.desde && a.ano <= intervalo.ate) } : null;
  const totalEmendas = emendas?.anos.reduce((s, a) => s + a.valor, 0) ?? 0;
  const planosEmendas = emendas?.anos.reduce((s, a) => s + a.planos, 0) ?? 0;
  const anoDasEmendas = emendas?.anos.reduce((m, a) => (a.valor > m.valor ? a : m), emendas.anos[0])?.ano;
  const linkEmendas = emendas && anoDasEmendas ? `/dinheiro?${new URLSearchParams({ "r.ano": String(anoDasEmendas), "r.emendas.detalhe": `parlamentar:${emendas.nome}` })}#emendas` : null;

  // Os textos seguem o arquivo que está na tela, que é sempre o do período escolhido.
  const gasto = cota?.pessoas[pessoa.id] ?? null;
  const media = indice && cota ? indice.media[String(cota.ano)] ?? null : null;
  const posicao = cota ? posicaoNaCota(cota, pessoa.id) : null;
  const comparacao = gasto && media ? comparadoAMedia(gasto.t, media.media) : null;
  const situacao = cota ? situacaoDaCota(cota) : [];
  const meses = cota ? mesesDaCota(cota) : [];
  const legislatura = cota?.ano === LEGISLATURA;
  const quando = noPeriodo(cota?.ano ?? periodo);
  const ultimoParcial = situacao.lastIndexOf("parcial");
  const anoParcial = indice ? indice.anos.find(a => situacaoDosMeses(a, indice.coletadoEm).includes("parcial")) ?? null : null;
  // Na legislatura, quem assumiu depois de abril de 2023 soma menos meses que os outros.
  const comeco = legislatura && cota && gasto ? primeiroMesComNota(cota, gasto) : null;
  const chegouDepois = comeco && meses[0] && (comeco.ano * 12 + comeco.mes) - (meses[0].ano * 12 + meses[0].mes) >= 3 ? comeco : null;

  return {
    perfil, p, rotuloCasa, anos, nomeCivil, trajetoria, textoTrajetoria, linkPerfil, anoDasNotas, linkNotas, linkPagina,
    emendas, totalEmendas, planosEmendas, anoDasEmendas, linkEmendas,
    gasto, media, posicao, comparacao, situacao, meses, legislatura, quando, ultimoParcial, anoParcial, comeco, chegouDepois,
  };
}

export function CrachaParlamentar({ modo = "lista", casa, pessoa, governos, ufs, cor, indice, cota, erroCota, periodo, seletorAno, aoEscolherAno, aoFechar, acoes }: {
  /** Na lista, ao lado do diretório; na página, sozinho e com o nome como título da página. */
  modo?: "lista" | "pagina";
  casa: CasaCongresso;
  pessoa: Parlamentar;
  governos: DadosPainel["governos"];
  ufs: DadosPainel["ufs"];
  cor: string;
  indice: IndiceCota | null;
  cota: CotaDoAno | null;
  erroCota: boolean;
  periodo: PeriodoCota;
  seletorAno: ReactNode;
  aoEscolherAno: (periodo: PeriodoCota) => void;
  aoFechar?: () => void;
  /** Botões que só a página tem: ver na maquete, compartilhar. */
  acoes?: ReactNode;
}) {
  const pagina = modo === "pagina";
  const Nome = pagina ? "h1" : "h3";
  const Titulo = pagina ? "h2" : "h4";
  const uf = ufs.find(u => u.sigla === pessoa.uf);
  const {
    perfil, p, rotuloCasa, anos, nomeCivil, textoTrajetoria, linkPerfil, linkNotas, linkPagina, emendas, totalEmendas, planosEmendas, linkEmendas,
    gasto, media, posicao, comparacao, situacao, meses, legislatura, quando, ultimoParcial, anoParcial, chegouDepois,
  } = useFichaParlamentar({ casa, pessoa, periodo, indice, cota });

  const frases: string[] = [];
  if (gasto && cota) {
    frases.push(`${quando.charAt(0).toLocaleUpperCase("pt-BR") + quando.slice(1)}${intervaloDaCota(cota)}, ${pessoa.nome} gastou ${reaisInteiros(gasto.t)} da cota parlamentar, em ${notas(gasto.n)} fiscais.`);
    if (comparacao && media && posicao) frases.push(`O valor fica ${comparacao.texto} dos ${rotuloCasa} (${reaisCompactos(media.media)}) e é o ${posicao.posicao === 1 ? "" : `${posicao.posicao}º `}maior gasto entre ${posicao.de}.`);
    if (chegouDepois) frases.push(`As notas começam em ${MESES_POR_EXTENSO[chegouDepois.mes]} de ${chegouDepois.ano}: por isso, a comparação com quem está desde 2023 é desigual.`);
    const [categoria, valorCategoria] = gasto.c[0] ?? [];
    if (categoria !== undefined && valorCategoria > 0) frases.push(`A maior parte, ${percentual(valorCategoria, gasto.t)}%, foi para ${minuscula(cota.categorias[categoria])}.`);
    const fornecedor = gasto.f.find(f => f[0] !== "Pessoa física");
    if (fornecedor) frases.push(`Quem mais recebeu foi ${fornecedor[0]}, com ${reaisCompactos(fornecedor[1])} em ${notas(fornecedor[2])}.`);
    const anterior = indice && typeof cota.ano === "number" ? indice.totais[pessoa.id]?.[indice.anos.indexOf(cota.ano - 1)] : null;
    if (typeof cota.ano === "number" && ultimoParcial < 0 && anterior) frases.push(`Em ${cota.ano - 1}, foram ${reaisCompactos(anterior)}.`);
  }

  return <article id="cracha-parlamentar" className={estilos.cracha} tabIndex={-1} aria-labelledby="cracha-nome" style={{ "--cor-partido": cor } as CSSProperties}>
    {!pagina && <button type="button" className={estilos.voltarLista} onClick={aoFechar}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="m14 6-6 6 6 6" /></svg>Voltar à lista
    </button>}
    <header className={estilos.crachaTopo}>
      <FotoParlamentar casa={casa} id={pessoa.id} nome={pessoa.nome} tamanho={112} altura={148} prioridade />
      <div className={estilos.crachaIdentidade}>
        <p className={estilos.sobretitulo}>{casa === "deputados" ? "Câmara dos Deputados" : "Senado Federal"} · {uf?.nome ?? pessoa.uf}</p>
        <Nome id="cracha-nome">{pessoa.nome}</Nome>
        {nomeCivil && <p className={estilos.nomeCivil}>{nomeCivil}</p>}
        <div className={estilos.crachaPartido}><IdentidadePartido governos={governos} sigla={pessoa.partido === "S/Partido" ? "SEM" : pessoa.partido} /></div>
        <ul className={estilos.fatos} aria-busy={perfil.carregando}>
          {perfil.carregando && <li className={estilos.fatoCarregando} aria-hidden="true"><span className={estilos.osso} /></li>}
          {anos !== null && <li>{anos} anos</li>}
          {p?.naturalidade && <li>Nasceu em {p.naturalidade}</li>}
          {p?.escolaridade && <li>Escolaridade: {minuscula(p.escolaridade)}</li>}
          {textoTrajetoria && <li>{textoTrajetoria}</li>}
        </ul>
        <div className={estilos.crachaLinks}>
          {!pagina && <Link href={linkPagina} className={estilos.linkPagina}>Página completa<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>}
          <a href={linkPerfil} target="_blank" rel="noreferrer">Perfil oficial<Seta /></a>
          {acoes}
        </div>
      </div>
      {!pagina && <button type="button" className={estilos.fecharCracha} aria-label="Fechar o crachá e voltar ao panorama" onClick={aoFechar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>}
    </header>

    {/* Um período só para o plenário e para a cota: a legislatura ou um ano. */}
    <div className={estilos.periodoTopo}>
      <p>{typeof periodo === "number" ? `Números de ${periodo}` : periodo === HISTORICO ? "Números do histórico disponível" : "Números da legislatura, desde fevereiro de 2023"}</p>
      {seletorAno}
    </div>
    <section className={estilos.bloco} aria-labelledby="cracha-plenario">
      <Titulo id="cracha-plenario" className={estilos.tituloBloco}>No plenário</Titulo>
      <NumerosPlenario casa={casa} pessoa={pessoa} periodo={periodo} />
      {/* Como votou fica com o plenário, antes da cota: no fim da página, depois da fonte da cota, passava despercebido. */}
      <ComoVotou casa={casa} pessoa={pessoa} Titulo={Titulo} />
    </section>
    <Titulo className={`${estilos.tituloBloco} ${estilos.blocoSeparado}`}>Cota parlamentar</Titulo>
    {erroCota ? <p className={estilos.aviso}>Não deu para carregar a cota agora. Tente de novo em instantes.</p>
      : !cota || !indice ? <EsqueletoDetalhe />
      : <>
        <dl className={estilos.numeros} data-colunas="4">
          <Numero rotulo={`Gastou ${quando}`} valor={gasto ? reaisCompactos(gasto.t) : "R$ 0"}
            detalhe={gasto ? `${notas(gasto.n)}${legislatura ? (chegouDepois ? ` desde ${MESES_POR_EXTENSO[chegouDepois.mes].slice(0, 3)}. ${chegouDepois.ano}` : " desde fev. 2023") : ultimoParcial >= 0 ? ` até ${MESES_POR_EXTENSO[meses[ultimoParcial].mes]}` : ""}` : `nenhuma nota ${quando}`} />
          <Numero rotulo="Comparado à média" valor={comparacao ? `${comparacao.diferenca > 0 ? "+" : comparacao.diferenca < 0 ? "−" : ""}${Math.abs(comparacao.diferenca)}%` : "—"} detalhe={media ? `média dos ${rotuloCasa}: ${reaisCompactos(media.media)}` : undefined} />
          <Numero rotulo="Posição no gasto" valor={posicao ? `${posicao.posicao}º` : "—"} detalhe={posicao ? `entre ${posicao.de}, do maior para o menor` : `sem notas ${quando}`} />
          <Numero rotulo="Emendas Pix desde 2023" valor={perfil.carregando ? "…" : emendas ? reaisCompactos(totalEmendas) : "R$ 0"}
            detalhe={linkEmendas ? <a href={linkEmendas}>{inteiro(planosEmendas)} {planosEmendas === 1 ? "plano" : "planos"} · ver no Orçamento</a> : perfil.carregando ? undefined : perfil.erro ? "indisponível agora" : "nenhum plano com este nome"} />
        </dl>
        {!gasto ? <p className={estilos.aviso}>Nenhuma nota de cota {quando}. Quem assumiu depois, se licenciou ou não usou a cota no período não aparece no arquivo.</p> : <>
          <section className={estilos.resumoCracha} aria-labelledby="cracha-resumo"><Titulo id="cracha-resumo">Em resumo</Titulo><p>{frases.join(" ")}</p></section>
          <section className={estilos.secaoCota} aria-labelledby="cracha-meses">
            <Titulo id="cracha-meses">Mês a mês</Titulo>
            <MesAMes valores={gasto.m} media={cota.mediaMes} situacao={situacao} meses={meses} rotuloSerie={pessoa.nome} rotuloMedia={`média dos ${rotuloCasa}`} />
          </section>
          <section className={estilos.secaoCota} aria-labelledby="cracha-anos">
            <div className={estilos.secaoCabecalho}>
              <Titulo id="cracha-anos">Ano a ano</Titulo>
              <p className={estilos.legendaGrafico}><span><i className={estilos.chaveSerie} />{pessoa.nome}</span><span><i className={estilos.chaveMedia} />média dos {rotuloCasa}</span>{anoParcial !== null && <span>* ano em curso</span>}</p>
            </div>
            <AnoAAno anos={indice.anos} valores={indice.totais[pessoa.id] ?? indice.anos.map(() => null)} medias={indice.anos.map(a => indice.media[a]?.media ?? 0)} ativo={typeof cota.ano === "number" ? cota.ano : null} aoEscolher={aoEscolherAno} rotuloMedia={`média dos ${rotuloCasa}`} parcial={anoParcial} />
          </section>
          <div className={estilos.colunas}>
            <section className={estilos.secaoCota} aria-labelledby="cracha-categorias">
              <Titulo id="cracha-categorias">Com o que gastou</Titulo>
              <Barras rotuloLista={`Categorias de gasto de ${pessoa.nome} ${quando}`} nomeDoMais="categorias" feminino total={gasto.t}
                itens={gasto.c.map(([c, v]) => ({ chave: String(c), nome: cota.categorias[c], valor: v }))} />
            </section>
            <section className={estilos.secaoCota} aria-labelledby="cracha-fornecedores">
              <Titulo id="cracha-fornecedores">Quem mais recebeu</Titulo>
              <Barras rotuloLista={`Fornecedores que mais receberam de ${pessoa.nome} ${quando}`} nomeDoMais="fornecedores" total={gasto.t}
                itens={gasto.f.map(([nome, v, n]) => ({ chave: nome, nome: nome === "Pessoa física" ? "Pessoas físicas (nomes omitidos)" : nome, valor: v, detalhe: notas(n) }))} />
            </section>
          </div>
        </>}
        <FonteCota casa={casa} indice={indice} cota={cota} linkNotas={linkNotas} />
      </>}
  </article>;
}
