"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";

import {
  type CasaCongresso, type CotaDoAno, type Grupo, type IndiceCota, type PeriodoCota,
  LEGISLATURA, NOME_UF, agruparPor, intervaloDaCota, inteiro, mesesDaCota, noPeriodo, porcento, reaisCompactos, resumirRecorte, situacaoDaCota, textoPercentual,
} from "../_dados/congressoModelo";
import type { DadosPainel } from "../_dados/tipos";
import { useCotaDoAno } from "../_dados/useCota";
import { CrachaParlamentar } from "./CrachaParlamentar";
import { FotoParlamentar } from "./FotoParlamentar";
import { Barras, EsqueletoDetalhe, FonteCota, MesAMes, Numero, SeletorAnoCota } from "./GraficosCota";
import { type MedidaPlenario, PlenarioPorPartido, medidaPlenarioValida, taxaComBase, usePlenario } from "./PlenarioParlamentar";
import { IdentidadePartido } from "./PainelEconomia";
import { Segmentos } from "./Vidro";
import estilos from "./Parlamentares.module.css";

export type Parlamentar = { id: number; nome: string; partido: string | null; uf: string };
type Ordem = "maior" | "menor" | "nome";
/** O que a lista mostra e ordena: o gasto da cota, a presença (no Senado, a participação) ou o voto com o governo. */
type MedidaLista = "cota" | "presenca" | "governo";
const medidaListaValida = (v: unknown) => v === "cota" || v === "presenca" || v === "governo";
/** Seta da coluna ordenada: para baixo do maior ao menor (e de A a Z), para cima ao contrário; as duas, apagadas, na coluna que não ordena. */
function SetaOrdem({ sentido }: { sentido: "desce" | "sobe" | null }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {sentido === "desce" ? <path d="M12 5v14M6 13l6 6 6-6" /> : sentido === "sobe" ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
  </svg>;
}
const LOTE = 40;
type Medida = "media" | "total";
const medidaValida = (v: unknown) => v === "media" || v === "total";
const ordemValida = (v: unknown) => v === "maior" || v === "menor" || v === "nome";
/** O que está filtrado na aba: some o ranking que só teria um grupo. */
export type FiltrosCongresso = { uf: boolean; partido: boolean; busca: boolean };
const siglaPartido = (p: { partido: string | null }) => (p.partido === "S/Partido" ? "SEM" : p.partido);

/** Leva o crachá para a vista se ele estiver fora dela e passa o foco para o nome. */
export function mostrarCracha(sempre = false) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cracha = document.getElementById("cracha-parlamentar");
    if (!cracha) return;
    const topo = cracha.getBoundingClientRect().top;
    const cabecalho = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--altura-cabecalho-visivel")) || 80;
    if (sempre || topo < cabecalho || topo > window.innerHeight * .55) {
      cracha.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    cracha.focus({ preventScroll: true });
  }));
}

/**
 * A lista de quem está no recorte, com o gasto da cota no ano, e ao lado o crachá de quem foi
 * escolhido. Sem ninguém escolhido, o lado mostra a cota do recorte inteiro.
 */
export function DiretorioCongresso({ casa, cadastro, encontrados, governos, ufs, corDe, pessoaId, aoEscolherPessoa, recorteNome, filtros, aoFiltrarPartido, aoFiltrarEstado }: {
  casa: CasaCongresso;
  cadastro: Parlamentar[];
  encontrados: Parlamentar[];
  governos: DadosPainel["governos"];
  ufs: DadosPainel["ufs"];
  /** Cor da bancada, a mesma da maquete. */
  corDe: (partido: string | null) => string;
  pessoaId: number | null;
  aoEscolherPessoa: (id: number | null) => void;
  /** "São Paulo · PL", vazio sem filtro. */
  recorteNome: string;
  filtros: FiltrosCongresso;
  aoFiltrarPartido: (partido: string) => void;
  aoFiltrarEstado: (uf: string) => void;
}) {
  const [ordem, setOrdem] = useEstadoCompartilhavel<Ordem>("congresso.ordem", "maior", ordemValida);
  const [medidaLista, setMedidaLista] = useEstadoCompartilhavel<MedidaLista>("congresso.lista", "cota", medidaListaValida);
  // O gráfico por partido tem a própria medida; escolher uma do plenário na lista leva o gráfico junto.
  const [medidaPlenario, setMedidaPlenario] = useEstadoCompartilhavel<MedidaPlenario>("congresso.plenario", "governo", medidaPlenarioValida);
  const { indice, cota, periodo, anos, setPeriodo, erro } = useCotaDoAno(casa);
  const plenario = usePlenario(casa).dados;
  const camara = casa === "deputados";
  // O valor de cada um sai do arquivo do período: um ano ou a legislatura somada. `undefined` enquanto carrega.
  const valorDe = useMemo(() => {
    if (medidaLista === "cota") return (id: number) => (cota ? cota.pessoas[id]?.t ?? null : undefined);
    const campo = medidaLista === "governo" ? "g" : camara ? "s" : "v";
    return (id: number) => (plenario ? taxaComBase(plenario.pessoas[id]?.[String(periodo)]?.[campo]) : undefined);
  }, [medidaLista, cota, plenario, periodo, camara]);
  const carregou = medidaLista === "cota" ? !!cota : !!plenario;

  const ordenados = useMemo(() => {
    const porNome = (a: Parlamentar, b: Parlamentar) => a.nome.localeCompare(b.nome, "pt-BR");
    if (ordem === "nome" || !carregou) return [...encontrados].sort(porNome);
    const sinal = ordem === "maior" ? -1 : 1;
    return [...encontrados].sort((a, b) => {
      const va = valorDe(a.id) ?? null, vb = valorDe(b.id) ?? null;
      if (va === null || vb === null) return va === vb ? porNome(a, b) : va === null ? 1 : -1;
      return sinal * (va - vb) || porNome(a, b);
    });
  }, [encontrados, ordem, valorDe, carregou]);
  // A cota enche a barra pelo maior gasto; as taxas, por 100%.
  const maximo = medidaLista === "cota" ? Math.max(1, ...encontrados.map(p => valorDe(p.id) ?? 0)) : 1;
  const texto = (v: number) => (medidaLista === "cota" ? reaisCompactos(v) : porcento(v));
  const semValor = medidaLista === "cota" ? "sem notas" : "—";
  const nomeMedida = medidaLista === "cota" ? "Cota" : medidaLista === "governo" ? "Com o governo" : camara ? "Presença" : "Participação";
  const escolherMedida = (m: MedidaLista) => {
    setMedidaLista(m);
    if (m !== "cota") setMedidaPlenario(m);
  };

  const chaveLista = `${casa}|${medidaLista}|${ordem}|${periodo}|${encontrados.map(p => p.id).join(",")}`;
  const [lote, setLote] = useState({ chave: "", n: LOTE });
  // Quem foi aberto por link ou pela maquete aparece na lista, mesmo além do primeiro lote.
  const posicaoEscolhido = pessoaId === null ? -1 : ordenados.findIndex(p => p.id === pessoaId);
  const limite = Math.max(lote.chave === chaveLista ? lote.n : LOTE, posicaoEscolhido + 1);

  const pessoa = pessoaId === null ? undefined : cadastro.find(p => p.id === pessoaId);
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Na lista que rola sozinha, o escolhido aparece sem mover a página.
    const linha = lista.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const caixa = lista.current;
    if (!linha || !caixa || caixa.scrollHeight <= caixa.clientHeight) return;
    const a = linha.offsetTop - caixa.offsetTop, b = a + linha.offsetHeight;
    if (a < caixa.scrollTop || b > caixa.scrollTop + caixa.clientHeight) caixa.scrollTop = a - caixa.clientHeight / 3;
  }, [pessoaId, posicaoEscolhido]);

  const escolher = (id: number) => { aoEscolherPessoa(id); mostrarCracha(); };
  const fechar = () => {
    const id = pessoaId;
    aoEscolherPessoa(null);
    requestAnimationFrame(() => {
      const linha = document.getElementById(`linha-parlamentar-${id}`);
      linha?.focus({ preventScroll: true });
      linha?.scrollIntoView({ block: "nearest" });
    });
  };
  const rotuloCasa = casa === "deputados" ? "deputados" : "senadores";
  const seletorAno = <SeletorAnoCota anos={anos} periodo={periodo} aoEscolher={setPeriodo} />;
  const quando = noPeriodo(periodo);

  return <div className={estilos.diretorio} data-aberto={!!pessoa}>
    <div className={estilos.lista}>
      {/* Um controle principal (o que a lista mostra); a ordem fica no cabeçalho das colunas, como numa planilha. */}
      <div className={estilos.listaTopo}>
        <Segmentos opcoes={[{ id: "cota", rotulo: "Cota" }, { id: "presenca", rotulo: camara ? "Presença" : "Participação" }, { id: "governo", rotulo: "Com o governo" }]}
          ativo={medidaLista} aoEscolher={escolherMedida} rotulo="O que a lista mostra" className={estilos.medidaLista} classeBotao="px-3 py-1" />
        <div className={estilos.cabecaLista} role="group" aria-label="Ordem da lista">
          <button type="button" className={estilos.ordenar} data-ativo={ordem === "nome" || undefined} onClick={() => setOrdem("nome")}
            aria-label={ordem === "nome" ? "Ordenado por nome, de A a Z" : "Ordenar por nome, de A a Z"}>
            Nome<SetaOrdem sentido={ordem === "nome" ? "desce" : null} />
          </button>
          <button type="button" className={estilos.ordenar} data-ativo={ordem !== "nome" || undefined} onClick={() => setOrdem(ordem === "maior" ? "menor" : "maior")}
            aria-label={ordem === "nome" ? `Ordenar por ${nomeMedida.toLocaleLowerCase("pt-BR")} ${quando}, do maior para o menor`
              : `Ordenado por ${nomeMedida.toLocaleLowerCase("pt-BR")} ${quando}, ${ordem === "maior" ? "do maior para o menor" : "do menor para o maior"}; inverter`}>
            {nomeMedida} {quando}<SetaOrdem sentido={ordem === "maior" ? "desce" : ordem === "menor" ? "sobe" : null} />
          </button>
        </div>
      </div>
      {encontrados.length ? <ol ref={lista} className={estilos.linhas} onScroll={e => { const c = e.currentTarget; c.dataset.fim = String(c.scrollTop + c.clientHeight >= c.scrollHeight - 4); }} aria-label={`${rotuloCasa} ${ordem === "nome" ? "em ordem alfabética" : `${ordem === "maior" ? "do maior para o menor valor" : "do menor para o maior valor"}: ${nomeMedida.toLocaleLowerCase("pt-BR")} ${quando}`}`}>
        {ordenados.slice(0, limite).map((p, i) => {
          const v = valorDe(p.id);
          const uf = ufs.find(u => u.sigla === p.uf)?.nome ?? p.uf;
          return <li key={p.id}>
            <button id={`linha-parlamentar-${p.id}`} type="button" className={estilos.linha} aria-pressed={pessoaId === p.id} onClick={() => (pessoaId === p.id ? fechar() : escolher(p.id))}
              aria-label={`${p.nome}, ${p.partido ?? "sem partido"}, ${uf}${v === undefined ? "" : v === null ? `: ${medidaLista === "cota" ? "sem notas de cota" : `sem base para ${nomeMedida.toLocaleLowerCase("pt-BR")}`} ${quando}` : `: ${texto(v)} ${medidaLista === "cota" ? "de cota" : medidaLista === "governo" ? "com o governo" : `de ${nomeMedida.toLocaleLowerCase("pt-BR")}`} ${quando}`}`}>
              {ordem !== "nome" && <span className={`tabular ${estilos.posicao}`} aria-hidden="true">{v === null || v === undefined ? "" : i + 1}</span>}
              <FotoParlamentar casa={casa} id={p.id} nome={p.nome} tamanho={40} />
              <span className={estilos.linhaNome}>
                <span>{p.nome}</span>
                <span className={estilos.linhaPartido}><IdentidadePartido governos={governos} sigla={siglaPartido(p)} /><span>· {p.uf}</span></span>
              </span>
              <span className={estilos.linhaValor} aria-hidden="true">
                <span className="tabular">{v === undefined ? "" : v === null ? semValor : texto(v)}</span>
                <span className={estilos.trilhoLinha}>{!!v && <span style={{ width: `${(Math.max(0, v) / maximo) * 100}%` }} />}</span>
              </span>
            </button>
          </li>;
        })}
        {ordenados.length > limite && <li className={estilos.maisLinhas}><button type="button" onClick={() => setLote({ chave: chaveLista, n: limite + LOTE * 2 })}>{ordenados.length - limite <= LOTE * 2 ? `Mostrar ${ordenados.length - limite === 1 ? "o outro" : `os outros ${ordenados.length - limite}`}` : `Mostrar mais ${LOTE * 2} de ${ordenados.length - limite}`}</button></li>}
      </ol> : <div className={estilos.vazio}><p>Nenhum parlamentar encontrado.</p><p>Tente outro nome ou limpe os filtros.</p></div>}
    </div>

    <div className={estilos.detalhe}>
      {pessoa
        ? <CrachaParlamentar key={`${casa}-${pessoa.id}`} casa={casa} pessoa={pessoa} governos={governos} ufs={ufs} cor={corDe(pessoa.partido)} indice={indice} cota={cota} erroCota={erro} periodo={periodo} seletorAno={seletorAno} aoEscolherAno={setPeriodo} aoFechar={fechar} />
        : <Panorama casa={casa} indice={indice} cota={cota} erro={erro} periodo={periodo} seletorAno={seletorAno} encontrados={encontrados} total={cadastro.length} recorteNome={recorteNome} rotuloCasa={rotuloCasa} aoEscolher={escolher} governos={governos}
          ufs={ufs} filtros={filtros} aoFiltrarPartido={aoFiltrarPartido} aoFiltrarEstado={aoFiltrarEstado} corDe={corDe}
          medidaPlenario={medidaPlenario} aoMudarMedidaPlenario={setMedidaPlenario} plenarioPrimeiro={medidaLista !== "cota"} />}
    </div>
  </div>;
}

/** A cota do recorte inteiro: quanto, quando, com o quê e quem mais gastou. */
function Panorama({ casa, indice, cota, erro, periodo, seletorAno, encontrados, total, recorteNome, rotuloCasa, aoEscolher, governos, ufs, filtros, aoFiltrarPartido, aoFiltrarEstado, corDe, medidaPlenario, aoMudarMedidaPlenario, plenarioPrimeiro }: {
  casa: CasaCongresso;
  indice: IndiceCota | null;
  cota: CotaDoAno | null;
  erro: boolean;
  periodo: PeriodoCota;
  seletorAno: React.ReactNode;
  encontrados: Parlamentar[];
  total: number;
  recorteNome: string;
  rotuloCasa: string;
  aoEscolher: (id: number) => void;
  governos: DadosPainel["governos"];
  ufs: DadosPainel["ufs"];
  filtros: FiltrosCongresso;
  aoFiltrarPartido: (partido: string) => void;
  aoFiltrarEstado: (uf: string) => void;
  corDe: (partido: string | null) => string;
  medidaPlenario: MedidaPlenario;
  aoMudarMedidaPlenario: (m: MedidaPlenario) => void;
  /** Com a lista ordenada por uma medida do plenário, o gráfico por partido abre o panorama. */
  plenarioPrimeiro: boolean;
}) {
  const resumo = useMemo(() => (cota ? resumirRecorte(cota, encontrados.map(p => p.id)) : null), [cota, encontrados]);
  const singular = casa === "deputados" ? "deputado" : "senador";
  const nomeCasa = casa === "deputados" ? "Câmara" : "Senado";
  // O arquivo pode ainda ser o do período anterior enquanto o novo chega: o texto segue o arquivo.
  const situacao = cota ? situacaoDaCota(cota) : [];
  const meses = cota ? mesesDaCota(cota) : [];
  const quando = noPeriodo(cota?.ano ?? periodo);
  const legislatura = cota?.ano === LEGISLATURA;
  const daCasa = indice && cota ? indice.media[String(cota.ano)] ?? null : null;
  const recortado = encontrados.length !== total;
  const porId = new Map(encontrados.map(p => [p.id, p]));
  const maior = resumo?.maiores[0];
  const [medida, setMedida] = useEstadoCompartilhavel<Medida>("congresso.medida", "media", medidaValida);
  // Bancada pequena demais faz a média pular com uma nota só: fica fora do ranking, com o nome no rodapé.
  const minimo = casa === "deputados" ? 3 : 2;
  const grupos = useMemo(() => {
    if (!cota) return null;
    const separar = (gs: Grupo[]) => ({
      dentro: gs.filter(g => g.comNotas >= minimo).sort((a, b) => (medida === "total" ? b.total - a.total : b.media - a.media)),
      fora: gs.filter(g => g.comNotas > 0 && g.comNotas < minimo).map(g => g.chave).sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
    return { partidos: separar(agruparPor(cota, encontrados, p => p.partido ?? "Sem informação")), estados: separar(agruparPor(cota, encontrados, p => p.uf)) };
  }, [cota, encontrados, medida, minimo]);
  const mostraPartidos = !filtros.partido && (grupos?.partidos.dentro.length ?? 0) >= 2;
  const mostraEstados = !filtros.uf && (grupos?.estados.dentro.length ?? 0) >= 2;
  const semFiltro = !filtros.uf && !filtros.partido && !filtros.busca;
  const quantos = (n: number) => `${n} ${n === 1 ? singular : rotuloCasa}`;
  const itemGrupo = (g: Grupo, nome: React.ReactNode, nomeTexto: string, filtrar: () => void) => {
    const v = medida === "total" ? g.total : g.media;
    return { chave: g.chave, nome, valor: v, detalhe: quantos(g.comNotas), aoEscolher: filtrar,
      rotulo: `Filtrar por ${nomeTexto}: ${reaisCompactos(v)} ${medida === "total" ? "no total" : `por ${singular}`}, ${quantos(g.comNotas)}` };
  };

  const porPartido = <PlenarioPorPartido casa={casa} periodo={periodo} encontrados={encontrados} governos={governos} corDe={corDe} medida={medidaPlenario}
    aoMudarMedida={aoMudarMedidaPlenario} aoEscolher={aoEscolher} aoFiltrarPartido={aoFiltrarPartido} segueLista={plenarioPrimeiro} />;

  return <section className={estilos.painelDetalhe} aria-labelledby="titulo-panorama-cota">
    {plenarioPrimeiro && porPartido}
    <header className={estilos.detalheTopo}>
      <div className={estilos.detalheTitulo}>
        <p className={estilos.sobretitulo}>Cota parlamentar · {nomeCasa}{recorteNome ? ` · ${recorteNome}` : ""}</p>
        <h3 id="titulo-panorama-cota">{`Quanto ${recortado ? "este grupo gastou" : `os ${rotuloCasa} gastaram`} ${noPeriodo(periodo)}`}</h3>
      </div>
      {seletorAno}
    </header>
    {erro ? <p className={estilos.aviso}>Não deu para carregar a cota agora. Tente de novo em instantes.</p>
      : !resumo || !cota ? <EsqueletoDetalhe />
      : resumo.pessoas === 0 ? <p className={estilos.aviso}>Ninguém deste recorte apresentou nota de cota {quando}.</p>
      : <>
        <p className={estilos.heroi}>
          <strong>{reaisCompactos(resumo.total)}</strong>
          <span>em {inteiro(resumo.notas)} notas de {resumo.pessoas} {resumo.pessoas === 1 ? singular : rotuloCasa}{intervaloDaCota(cota)}.{" "}
            Cada {singular} tem um teto mensal, que varia com o estado, para escritório, viagens, divulgação e outras despesas do mandato.
            {legislatura && " Quem assumiu depois de fevereiro de 2023 soma menos meses."}</span>
        </p>
        <dl className={estilos.numeros}>
          <Numero rotulo={`Média por ${singular}`} valor={reaisCompactos(resumo.media)} detalhe={recortado && daCasa ? `no ${nomeCasa}: ${reaisCompactos(daCasa.media)}` : daCasa ? `mediana: ${reaisCompactos(daCasa.mediana)}` : undefined} />
          {maior && <Numero rotulo="Maior gasto" valor={reaisCompactos(maior.valor)} detalhe={porId.get(maior.id)?.nome} />}
          <Numero rotulo="Valor médio por nota" valor={reaisCompactos(resumo.total / Math.max(1, resumo.notas))} detalhe={`${inteiro(resumo.notas)} notas ${quando}`} />
        </dl>
        <section className={estilos.secaoCota} aria-labelledby="titulo-panorama-meses">
          <h4 id="titulo-panorama-meses">Mês a mês</h4>
          <MesAMes valores={resumo.meses} situacao={situacao} meses={meses} rotuloSerie={`Total ${recortado ? "do grupo" : `da ${nomeCasa === "Câmara" ? "Câmara" : "casa"}`}`} />
        </section>
        <div className={estilos.colunas}>
          <section className={estilos.secaoCota} aria-labelledby="titulo-panorama-categorias">
            <h4 id="titulo-panorama-categorias">Com o que gastaram</h4>
            <Barras rotuloLista={`Categorias de gasto ${quando}`} nomeDoMais="categorias" feminino total={resumo.total}
              itens={resumo.categorias.map(c => ({ chave: c.nome, nome: c.nome, valor: c.valor }))} />
          </section>
          <section className={estilos.secaoCota} aria-labelledby="titulo-panorama-maiores">
            <h4 id="titulo-panorama-maiores">Quem mais gastou</h4>
            <Barras rotuloLista={`Quem mais gastou ${quando}`} nomeDoMais={rotuloCasa} total={resumo.total} limite={6}
              itens={resumo.maiores.slice(0, 20).map(m => {
                const p = porId.get(m.id)!;
                return {
                  chave: String(m.id), valor: m.valor, detalhe: <span className={estilos.partidoMini}><IdentidadePartido governos={governos} sigla={siglaPartido(p)} /> {p.uf}</span>,
                  nome: <span className={estilos.pessoaBarra}><FotoParlamentar casa={casa} id={p.id} nome={p.nome} tamanho={28} /><span>{p.nome}</span></span>,
                  aoEscolher: () => aoEscolher(p.id), rotulo: `Ver o crachá de ${p.nome}: ${reaisCompactos(m.valor)} ${quando}`,
                };
              })} />
          </section>
        </div>
        {grupos && (mostraPartidos || mostraEstados) && <section className={estilos.secaoCota} aria-labelledby="titulo-panorama-grupos">
          <div className={estilos.secaoCabecalho}>
            <h4 id="titulo-panorama-grupos">Partidos e estados que mais gastam</h4>
            <Segmentos opcoes={[{ id: "media", rotulo: `Por ${singular}` }, { id: "total", rotulo: "Total" }]} ativo={medida} aoEscolher={setMedida} rotulo="Comparar pela média ou pelo total" classeBotao="px-3 py-1" />
          </div>
          <p className={estilos.notaSecao}>{medida === "media"
            ? <>Média por {singular} que apresentou nota {quando}, para comparar bancadas de tamanhos diferentes. {recortado ? "Deste grupo" : nomeCasa === "Câmara" ? "Da Câmara inteira" : "Do Senado inteiro"}: {reaisCompactos(resumo.media)}.</>
            : <>Soma de cada bancada {quando}: quem tem mais cadeiras tende a somar mais.</>} Selecione uma barra para filtrar a lista.</p>
          <div className={estilos.colunas} data-uma={!(mostraPartidos && mostraEstados) || undefined}>
            {mostraPartidos && <div className={estilos.secaoCota}>
              <h5 className={estilos.subtitulo}>Por partido</h5>
              <Barras rotuloLista={`Partidos por gasto ${medida === "total" ? "total" : `médio por ${singular}`} ${quando}`} nomeDoMais="partidos" total={resumo.total}
                itens={grupos.partidos.dentro.map(g => itemGrupo(g, <IdentidadePartido governos={governos} sigla={g.chave === "S/Partido" ? "SEM" : g.chave} />, g.chave === "S/Partido" ? "sem partido" : g.chave, () => aoFiltrarPartido(g.chave)))} />
              {grupos.partidos.fora.length > 0 && <p className={estilos.notaSecao}>Fora do ranking, com menos de {minimo} {rotuloCasa} com notas: {grupos.partidos.fora.map(p => (p === "S/Partido" ? "sem partido" : p)).join(", ")}.</p>}
            </div>}
            {mostraEstados && <div className={estilos.secaoCota}>
              <h5 className={estilos.subtitulo}>Por estado</h5>
              <Barras rotuloLista={`Estados por gasto ${medida === "total" ? "total" : `médio por ${singular}`} ${quando}`} nomeDoMais="estados" total={resumo.total}
                itens={grupos.estados.dentro.map(g => { const nome = ufs.find(u => u.sigla === g.chave)?.nome ?? NOME_UF[g.chave] ?? g.chave; return itemGrupo(g, nome, nome, () => aoFiltrarEstado(g.chave)); })} />
              <p className={estilos.notaSecao}>O teto mensal da cota muda de estado para estado, conforme a distância até Brasília.</p>
            </div>}
          </div>
        </section>}
        {semFiltro && !!cota?.fornecedores?.length && <section className={estilos.secaoCota} aria-labelledby="titulo-panorama-fornecedores">
          <h4 id="titulo-panorama-fornecedores">Empresas que mais receberam</h4>
          <Barras rotuloLista={`Empresas que mais receberam da cota ${quando}`} nomeDoMais="fornecedores" total={resumo.total} limite={8}
            itens={cota.fornecedores.map(([nome, v, , pessoas], i) => ({ chave: `${i}-${nome}`, nome, valor: v, detalhe: `${textoPercentual(v, resumo.total)} · ${quantos(pessoas)}` }))} />
          <p className={estilos.notaSecao}>Notas da mesma empresa somadas pela raiz do CNPJ; pagamentos a pessoas físicas ficam de fora.</p>
        </section>}
        {indice && <FonteCota casa={casa} indice={indice} cota={cota} />}
      </>}
    {/* Com um partido escolhido, sobra a linha dele: os pontos mostram como a bancada se divide. */}
    {!plenarioPrimeiro && porPartido}
  </section>;
}
