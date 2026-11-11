"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";

import {
  type CasaCongresso, type CotaDoAno, type IndiceCota, type MesDaCota, type PeriodoCota, type SituacaoMes,
  LEGISLATURA, MESES, MESES_POR_EXTENSO, reaisCompactos, reaisInteiros, situacaoDaCota, textoPercentual,
} from "../_dados/congressoModelo";
import { Segmentos } from "./Vidro";
import estilos from "./Parlamentares.module.css";

/** Topo do eixo num número redondo: 45.200 vira 50.000. */
function topoDoEixo(maximo: number) {
  if (!(maximo > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(maximo));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= maximo) return m * p;
  return 10 * p;
}

/** Valor de destaque, rótulo em cima e uma linha de contexto embaixo. */
export function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return <div className={estilos.numero}>
    <dt>{rotulo}</dt>
    <dd><strong>{valor}</strong>{detalhe && <span>{detalhe}</span>}</dd>
  </div>;
}

/**
 * Uma coluna por mês: os 12 de um ano ou os 48 da legislatura. Com `media`, um traço marca a
 * média da casa no mesmo mês. Passe o ponteiro ou use as setas para ler cada mês.
 */
export function MesAMes({ valores, media, situacao, meses, rotuloSerie, rotuloMedia }: {
  valores: number[];
  media?: number[];
  situacao: SituacaoMes[];
  meses: MesDaCota[];
  rotuloSerie: string;
  rotuloMedia?: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const escala = topoDoEixo(Math.max(0, ...valores, ...(media ?? [])));
  const temParcial = situacao.includes("parcial");
  const maior = valores.reduce((m, v, i) => (v > valores[m] ? i : m), 0);
  const longo = meses.length > 12;
  const nomeMes = (i: number) => `${MESES_POR_EXTENSO[meses[i].mes]} de ${meses[i].ano}`;
  const primeiro = meses[0], ultimo = meses.at(-1);
  const periodo = !primeiro || !ultimo ? "" : longo ? `de ${MESES_POR_EXTENSO[primeiro.mes]} de ${primeiro.ano} a ${MESES_POR_EXTENSO[ultimo.mes]} de ${ultimo.ano}` : `em ${primeiro.ano}`;
  const texto = (i: number) => situacao[i] === "futuro" ? `${nomeMes(i)}: ainda não chegou`
    : `${nomeMes(i)}: ${reaisInteiros(valores[i])}${media ? `; ${rotuloMedia ?? "média"}: ${reaisInteiros(media[i])}` : ""}${situacao[i] === "parcial" ? " (notas ainda chegando)" : ""}`;
  const teclas = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const fim = Math.max(0, situacao.findLastIndex(s => s !== "futuro"));
    setAtivo(a => e.key === "Home" ? 0 : e.key === "End" ? fim : a === null ? (e.key === "ArrowRight" ? 0 : fim) : Math.min(fim, Math.max(0, a + (e.key === "ArrowRight" ? 1 : -1))));
  };
  return <figure className={estilos.grafico}>
    <figcaption className={estilos.legendaGrafico}>
      {media && <><span><i className={estilos.chaveSerie} />{rotuloSerie}</span><span><i className={estilos.chaveMedia} />{rotuloMedia}</span></>}
      {temParcial && <span><i className={estilos.chaveParcial} />notas ainda chegando</span>}
    </figcaption>
    <div className={estilos.meses} data-longo={longo || undefined} style={{ gridTemplateColumns: `repeat(${valores.length},minmax(0,1fr))` }} tabIndex={0} role="group"
      aria-label={`Gasto por mês ${periodo}. Use as setas para ler cada mês.`} onKeyDown={teclas} onBlur={() => setAtivo(null)} onPointerLeave={() => setAtivo(null)}>
      <span className={estilos.eixoTopo} aria-hidden="true">{reaisCompactos(escala)}</span>
      <span className={estilos.eixoMeio} aria-hidden="true">{reaisCompactos(escala / 2)}</span>
      {valores.map((v, i) => <div key={i} className={estilos.mes} data-situacao={situacao[i]} data-ativo={ativo === i} data-virada={(longo && i > 0 && meses[i].mes === 0) || undefined}
        onPointerEnter={() => setAtivo(i)} aria-hidden="true">
        <div className={estilos.areaMes}>
          {situacao[i] !== "futuro" && <span className={estilos.coluna} style={{ height: `${(Math.max(0, v) / escala) * 100}%` }} />}
          {media && situacao[i] !== "futuro" && <span className={estilos.marcaMedia} style={{ bottom: `${(Math.max(0, media[i]) / escala) * 100}%` }} />}
          {i === maior && v > 0 && ativo === null && <span className={estilos.rotuloColuna} style={{ bottom: `${(v / escala) * 100}%` }}>{reaisCompactos(v)}</span>}
          {ativo === i && <span className={estilos.dica} data-lado={i < valores.length / 4 ? "inicio" : i >= valores.length * 3 / 4 ? "fim" : undefined}>
            <strong>{longo ? nomeMes(i) : MESES_POR_EXTENSO[meses[i].mes]}</strong>
            {situacao[i] === "futuro" ? <span>ainda não chegou</span> : <>
              <span className="tabular">{reaisInteiros(v)}</span>
              {media && <span className="tabular">{rotuloMedia}: {reaisCompactos(media[i])}</span>}
              {situacao[i] === "parcial" && <span>notas ainda chegando</span>}
            </>}
          </span>}
        </div>
        {/* Na legislatura, só o ano marca a virada; num ano, o nome de cada mês. */}
        <span className={estilos.rotuloMes}>{!longo ? MESES[meses[i].mes] : i === 0 || meses[i].mes === 0 ? meses[i].ano : ""}</span>
      </div>)}
    </div>
    <p className="sr-only" aria-live="polite">{ativo === null ? "" : texto(ativo)}</p>
  </figure>;
}

/** Um ano por linha; o escolhido fica cheio e os outros, claros (na legislatura, todos cheios). Tocar num ano abre o ano. */
export function AnoAAno({ anos, valores, medias, ativo, aoEscolher, rotuloMedia, parcial }: {
  anos: number[];
  valores: (number | null)[];
  medias: number[];
  ativo: number | null;
  aoEscolher: (ano: number) => void;
  rotuloMedia: string;
  parcial: number | null;
}) {
  const escala = topoDoEixo(Math.max(0, ...valores.map(v => v ?? 0), ...medias));
  return <ul className={estilos.anos} data-todos={ativo === null || undefined}>
    {anos.map((ano, i) => {
      const v = valores[i];
      return <li key={ano}><button type="button" aria-pressed={ano === ativo} onClick={() => aoEscolher(ano)}
        aria-label={`${ano}${ano === parcial ? ", até agora" : ""}: ${v === null ? "sem notas" : reaisInteiros(v)}; ${rotuloMedia}: ${reaisInteiros(medias[i])}`}>
        <span className={`tabular ${estilos.anoRotulo}`}>{ano}{ano === parcial ? "*" : ""}</span>
        <span className={estilos.trilhoAno} aria-hidden="true">
          {v !== null && <span className={estilos.barraAno} style={{ width: `${(Math.max(0, v) / escala) * 100}%` }} />}
          <span className={estilos.marcaMediaAno} style={{ left: `${(medias[i] / escala) * 100}%` }} />
        </span>
        <span className={`tabular ${estilos.anoValor}`}>{v === null ? "sem notas" : reaisCompactos(v)}</span>
      </button></li>;
    })}
  </ul>;
}

export type ItemBarra = {
  chave: string; nome: ReactNode; valor: number; detalhe?: ReactNode; aoEscolher?: () => void; rotulo?: string;
  /** Leva à página do item. */
  href?: string;
  /** Fica à vista mesmo além do limite, com as outras barras mais claras. */
  destaque?: boolean;
};

/** Barras horizontais em ordem, com o valor na ponta e a parte do total. */
export function Barras({ itens, total, limite = 6, rotuloLista, nomeDoMais, feminino = false, valor = reaisCompactos, escala }: {
  itens: ItemBarra[];
  total: number;
  limite?: number;
  rotuloLista: string;
  nomeDoMais: string;
  /** "as categorias", "os fornecedores". */
  feminino?: boolean;
  valor?: (v: number) => string;
  /** Valor da barra cheia. Sem ele, a maior barra enche o trilho; porcentagens usam 100. */
  escala?: number;
}) {
  const [todos, setTodos] = useState(false);
  const maximo = escala ?? Math.max(1, ...itens.map(i => i.valor));
  const destacado = itens.findIndex(i => i.destaque);
  // Quem está em destaque além do limite aparece depois de uma reticência, na posição que tem.
  const visiveis = todos || destacado < limite ? itens.slice(0, todos ? undefined : limite) : [...itens.slice(0, limite - 1), null, itens[destacado]];
  return <>
    <ol className={estilos.barras} aria-label={rotuloLista} data-com-destaque={destacado >= 0 || undefined}>
      {visiveis.map(item => {
        if (!item) return <li key="reticencia" className={estilos.reticencia} aria-hidden="true">…</li>;
        const conteudo = <>
          <span className={estilos.barraTopo}>
            <span className={estilos.barraNome}>{item.nome}</span>
            <span className={`tabular ${estilos.barraValor}`}>{valor(item.valor)}<span> · {item.detalhe ?? textoPercentual(item.valor, total)}</span></span>
          </span>
          <span className={estilos.trilho} aria-hidden="true"><span style={{ width: `${(Math.max(0, item.valor) / maximo) * 100}%` }} /></span>
        </>;
        const destaque = item.destaque || undefined;
        return <li key={item.chave}>{item.href
          ? <Link href={item.href} className={estilos.barra} data-destaque={destaque} aria-current={item.destaque ? "page" : undefined} aria-label={item.rotulo}>{conteudo}</Link>
          : item.aoEscolher
          ? <button type="button" className={estilos.barra} data-destaque={destaque} onClick={item.aoEscolher} aria-label={item.rotulo}>{conteudo}</button>
          : <div className={estilos.barra} data-destaque={destaque}>{conteudo}</div>}</li>;
      })}
    </ol>
    {itens.length > limite && <button type="button" className={estilos.verTodos} aria-expanded={todos} onClick={() => setTodos(t => !t)}>{todos ? "Mostrar menos" : `Ver ${feminino ? "todas as" : "todos os"} ${itens.length} ${nomeDoMais}`}</button>}
  </>;
}

/** A legislatura inteira e os anos, lado a lado; vale para a cota e para o plenário, e um ano escolhido vai no link. */
export function SeletorAnoCota({ anos, periodo, aoEscolher }: { anos: number[]; periodo: PeriodoCota; aoEscolher: (periodo: PeriodoCota) => void }) {
  const opcoes = [{ id: LEGISLATURA as string, rotulo: "Legislatura" }, ...anos.map(a => ({ id: String(a), rotulo: String(a) }))];
  return <Segmentos opcoes={opcoes} ativo={String(periodo)} aoEscolher={id => aoEscolher(id === LEGISLATURA ? LEGISLATURA : Number(id))} rotulo="Período dos números" className={estilos.anosCota} classeBotao="px-3 py-1" />;
}

/** De onde vem a cota, o que o valor quer dizer e onde ver cada nota. */
export function FonteCota({ casa, indice, cota, linkNotas }: { casa: CasaCongresso; indice: IndiceCota; cota: CotaDoAno; linkNotas?: string }) {
  const coleta = new Date(cota.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const parcial = situacaoDaCota(cota).includes("parcial");
  const arquivos = cota.ano === LEGISLATURA ? `arquivos de ${indice.anos[0]} a ${indice.anos.at(-1)} baixados` : `arquivo de ${cota.ano} baixado`;
  return <p className={estilos.fonte}>
    Fonte: <a href={indice.fontes.dados} target="_blank" rel="noreferrer">{casa === "deputados" ? "Câmara dos Deputados, CEAP" : "Senado Federal, CEAPS"}</a>, {arquivos} em {coleta}.{cota.ano === LEGISLATURA ? " A legislatura começou em 1º de fevereiro de 2023: janeiro de 2023 fica fora da soma." : ""}{" "}
    {casa === "deputados" ? "Valor líquido de cada nota, já sem as glosas" : "Valor reembolsado de cada nota"}; estornos entram negativos.{" "}
    {parcial && "As notas entram com até três meses de atraso. "}
    Fornecedor pessoa física aparece sem nome.{" "}
    {linkNotas && <><a href={linkNotas} target="_blank" rel="noreferrer">Ver cada nota no site {casa === "deputados" ? "da Câmara" : "do Senado"}</a>.</>}
  </p>;
}

export function EsqueletoDetalhe() {
  return <div className={estilos.esqueletoDetalhe} aria-hidden="true">
    <span className={estilos.osso} style={{ width: "40%", height: 44 }} />
    <span className={estilos.osso} style={{ width: "70%" }} />
    <span className={estilos.osso} style={{ width: "100%", height: 168, marginTop: 16 }} />
  </div>;
}
