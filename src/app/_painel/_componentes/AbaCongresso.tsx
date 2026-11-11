"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compartilhar } from "@/components/Compartilhar";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";
import { SeletorDados } from "@/components/SeletorDados";
import { TEMAS_PAINEL } from "@/lib/temasPainel";
import { rotaParlamentar } from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import type { DadosPainel } from "../_dados/tipos";
import { Bloco } from "./Bloco";
import { DiretorioCongresso, mostrarCracha } from "./DiretorioCongresso";
import { FotoParlamentar } from "./FotoParlamentar";
import { Segmentos } from "./Vidro";
import { corDaBancada, partidoDe } from "./bancada";
import { IdentidadePartido } from "./PainelEconomia";
import { PaginaParlamentar } from "./PaginaParlamentar";
import { Plenario3D, type Assento } from "./Plenario3D";
import estilos from "./AbaCongresso.module.css";

type Casa = "deputados" | "senadores";
const casas: { id: Casa; rotulo: string }[] = [
  { id: "deputados", rotulo: `Câmara · ${fotografia.deputados.length}` },
  { id: "senadores", rotulo: `Senado · ${fotografia.senadores.length}` },
];
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
const referencia = new Date(fotografia.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
/** Até quantos parlamentares em destaque a maquete mostra os retratos sobre as cadeiras. */
const limiteRetratos = 90;
type PropsAba = { dados: DadosPainel; sigla: string | null; setSigla: (sigla: string | null) => void };

/** Em /congresso, a maquete e o diretório; em /congresso/deputados/nome-id, a página da pessoa. */
export function AbaCongresso(props: PropsAba) {
  const rota = rotaParlamentar(usePathname());
  if (!rota) return <SalaCongresso {...props} />;
  return <section className={estilos.sala} aria-label={rota.casa === "deputados" ? "Deputado federal" : "Senador"}>
    <PaginaParlamentar key={`${rota.casa}-${rota.id}`} casa={rota.casa} id={rota.id} dados={props.dados} corDe={s => corDaBancada(props.dados.governos, s)} />
  </section>;
}

function SalaCongresso({ dados, sigla, setSigla }: PropsAba) {
  const sala = useRef<HTMLElement>(null);
  useEffect(() => {
    const painel = sala.current?.querySelector<HTMLElement>("#bloco-parlamentares");
    if (!painel) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
    let chegada: Animation | undefined;
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting) return;
      observador.disconnect();
      if (reduzir.matches || document.hidden) return;
      chegada = painel.animate([{ opacity: .65, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.16,1,.3,1)" });
    }, { threshold: .08 });
    const interromper = () => { if (reduzir.matches || document.hidden) chegada?.cancel(); };
    observador.observe(painel);
    reduzir.addEventListener("change", interromper);
    document.addEventListener("visibilitychange", interromper);
    return () => { observador.disconnect(); chegada?.cancel(); reduzir.removeEventListener("change", interromper); document.removeEventListener("visibilitychange", interromper); };
  }, []);
  const [casa, setCasa] = useEstadoCompartilhavel<Casa>("congresso.casa", "deputados", v => v === "deputados" || v === "senadores");
  const [partido, setPartido] = useEstadoCompartilhavel("congresso.partido", "", v => typeof v === "string" && (v === "" || [...fotografia.deputados, ...fotografia.senadores].some(p => partidoDe(p) === v)));
  const [busca, setBusca] = useEstadoCompartilhavel("congresso.busca", "", v => typeof v === "string" && v.length <= 150);
  const [pessoaId, setPessoaId] = useEstadoCompartilhavel<number | null>("congresso.pessoa", null, v => v === null || (typeof v === "number" && [...fotografia.deputados, ...fotografia.senadores].some(p => p.id === v)));
  const [sobPonteiro, setSobPonteiro] = useState<number | null>(null);
  const [assentoId, setAssentoId] = useState<number | null>(null);
  const [realce, setRealce] = useState<string | null>(null);
  const cadastro = fotografia[casa];
  const partidos = useMemo(() => [...new Set(cadastro.map(partidoDe))].map(nome => ({
    nome, total: cadastro.filter(p => partidoDe(p) === nome).length,
  })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR")), [cadastro]);
  const cor = (sigla: string | null) => corDaBancada(dados.governos, sigla);
  // Uma cadeira por parlamentar, em blocos de partido do maior para o menor.
  const assentos = useMemo<Assento[]>(() => partidos.flatMap(b => cadastro.filter(p => partidoDe(p) === b.nome).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")))
    .map(p => ({ id: p.id, nome: p.nome, partido: partidoDe(p), cor: corDaBancada(dados.governos, p.partido) })), [cadastro, partidos, dados.governos]);
  const termo = normalizar(busca);
  const noLugar = cadastro.filter(p => (!sigla || p.uf === sigla) && (!termo || normalizar(p.nome).includes(termo)));
  const encontrados = noLugar.filter(p => !partido || partidoDe(p) === partido).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  // Com estado ou busca, a legenda conta a bancada dentro desse recorte.
  const recortaLegenda = !!(sigla || termo);
  const naLegenda = new Map<string, number>();
  for (const p of noLugar) naLegenda.set(partidoDe(p), (naLegenda.get(partidoDe(p)) ?? 0) + 1);
  const ids = new Set(encontrados.map(p => p.id));
  const recorte = JSON.stringify([casa, sigla, partido, busca]);
  // O cartão da maquete fecha quando o recorte muda; o crachá aberto continua, mesmo fora do recorte.
  useEffect(() => { setAssentoId(null); }, [recorte]);
  const apontado = cadastro.find(p => p.id === sobPonteiro);
  const escolhidoNaSala = assentoId ?? pessoaId;
  const idCartao = sobPonteiro ?? assentoId;
  const noCartao = idCartao == null ? undefined : cadastro.find(p => p.id === idCartao);
  const estado = dados.ufs.find(u => u.sigla === sigla);
  const fonte = casa === "deputados" ? "Câmara dos Deputados" : "Senado Federal";
  const rotuloCasa = casa === "deputados" ? "deputados" : "senadores";
  const recorteAtivo = [estado?.nome, partido, busca && `“${busca}”`].filter(Boolean).join(" · ");
  const filtrado = !!(sigla || partido || busca);
  // O "de N" é a bancada do estado escolhido, não a casa inteira: "4 de 10 deputados · Piauí", não "4 de 513".
  // Quando o recorte é a bancada toda, só o número: "10 deputados · Piauí".
  const base = sigla ? cadastro.filter(p => p.uf === sigla).length : cadastro.length;
  const deBase = encontrados.length === base ? "" : `de ${base} `;
  const limpar =() => { setBusca(""); setPartido(""); setSigla(null); setPessoaId(null); setAssentoId(null); };
  // O caminho de volta: o Resumo mostra quem foi eleito (TSE); aqui é quem está no cargo hoje. O partido vai junto e fica destacado lá.
  const consultaResumo = new URLSearchParams([...(estado ? [["uf", estado.sigla]] : []), ...(partido && partido !== "S/Partido" ? [["r.resumo.partido", partido]] : [])]);
  const linkResumo = `/${consultaResumo.size ? `?${consultaResumo}` : ""}`;
  const rotuloResumo = partido && partido !== "S/Partido" ? `Eleitos do ${partido}${estado ? ` ${estado.deNome}` : ""}, no Resumo` : estado ? `Resumo do governo ${estado.deNome}` : "Resumo do governo federal";
  const verCracha = (id: number) => {
    setAssentoId(null);
    setPessoaId(id);
    mostrarCracha(true);
  };

  return <section ref={sala} className={estilos.sala} aria-label="Congresso Nacional">
    <header className={estilos.cabecalho}>
      <div className={estilos.tituloCasa}>
      <h1 className="titulo-painel">Congresso</h1>
      <Segmentos opcoes={casas} ativo={casa} aoEscolher={id => { setCasa(id); setPartido(""); setBusca(""); setPessoaId(null); setSobPonteiro(null); setAssentoId(null); setRealce(null); }} rotulo="Casa legislativa" className={estilos.casas} classeBotao="px-3 py-2" />
      </div>
      <div className={estilos.acoes}><Compartilhar mensagem={TEMAS_PAINEL.congresso.titulo} compacto /></div>
    </header>

    <div className={estilos.composicao}>
      {/* O recorte numa frase só, ao lado da maquete: cada pedaço é o controle que o muda.
          O estado é a pílula; o partido se escolhe na legenda e aparece aqui para tirar. */}
      <div className={estilos.recorte}>
        <div className={estilos.total}>
          <strong key={`${casa}-${encontrados.length}`} className={`tabular ${estilos.numero}`}>{encontrados.length}</strong>
          <div className={estilos.frase}>
            {/* "deputados" fica só para o leitor de tela: a casa já está no seletor acima. O "de N" fica à vista. */}
            {deBase && <span>{deBase.trim()}</span>}<span className="sr-only">{rotuloCasa}</span>
            <SeletorDados compacto rotulo="Estado" valor={sigla ?? ""} rotuloFechado={sigla ? undefined : "Brasil"} opcoes={[{ valor: "", rotulo: "Todo o Brasil" }, ...[...dados.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(u => ({ valor: u.sigla, rotulo: u.nome }))]} aoEscolher={v => { setSigla(v || null); setPessoaId(null); }} placeholderBusca="Buscar estado" />
            {partido && <button type="button" className={estilos.chipRecorte} onClick={() => { setPartido(""); setPessoaId(null); setRealce(null); }} aria-label={`Tirar o filtro do partido ${partido}`}>
              <span className={estilos.corPartido} style={{ background: cor(partido) }} />{partido === "S/Partido" ? "Sem partido" : partido}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6 6 18"/></svg>
            </button>}
            {busca && <button type="button" className={estilos.chipRecorte} onClick={() => { setBusca(""); setPessoaId(null); }} aria-label={`Tirar a busca “${busca}”`}>“{busca}”<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6 6 18"/></svg></button>}
          </div>
        </div>
      </div>

      <figure className={estilos.figura}>
        <Plenario3D key={casa} casa={casa} assentos={assentos} destaque={filtrado ? ids : null} realce={realce} escolhido={escolhidoNaSala} fotos={encontrados.length <= limiteRetratos}
          rotulo={`Plenário ${casa === "deputados" ? "da Câmara" : "do Senado"} em 3D: ${cadastro.length} cadeiras agrupadas por partido, ${encontrados.length} no recorte selecionado.`}
          aoApontar={setSobPonteiro} aoEscolher={setAssentoId}
          cartaoId={noCartao ? noCartao.id : null} cartaoFixo={!!noCartao && noCartao.id === assentoId && sobPonteiro == null}
          cartao={noCartao && <div className={estilos.cartaoPessoa}>
            <FotoParlamentar key={`${casa}-${noCartao.id}`} casa={casa} id={noCartao.id} nome={noCartao.nome} tamanho={56} />
            <div className={estilos.cartaoTexto}>
              <strong>{noCartao.nome}</strong>
              <span className={estilos.partidoPessoa}><IdentidadePartido governos={dados.governos} sigla={noCartao.partido === "S/Partido" ? "SEM" : noCartao.partido} /><span>· {dados.ufs.find(u => u.sigla === noCartao.uf)?.nome ?? noCartao.uf}</span></span>
              {noCartao.id === assentoId && sobPonteiro == null && <span className={estilos.cartaoAcoes}>
                <button type="button" className={estilos.verFicha} onClick={() => verCracha(noCartao.id)}>Ver crachá<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 5v14M6 13l6 6 6-6"/></svg></button>
                <button type="button" className={estilos.fecharCartao} aria-label="Fechar" onClick={() => setAssentoId(null)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M6 6l12 12M18 6 6 18"/></svg></button>
              </span>}
            </div>
          </div>} />
        <figcaption className={estilos.leitura}>{apontado ? <><strong>{apontado.nome}</strong> · {partidoDe(apontado)} · {apontado.uf}</> : <>Uma cadeira por parlamentar, em blocos de partido do maior para o menor, sem posição ideológica.</>}</figcaption>
        <p className={estilos.referencia}>Fonte: <a href={fotografia.fontes[casa === "deputados" ? "camara" : "senado"]} target="_blank" rel="noreferrer">{fonte}</a> · coleta de <time dateTime={fotografia.coletadoEm}>{referencia}</time>. A composição pode ter mudado desde então.</p>
      </figure>

      <aside className={estilos.lateral} aria-label={`Bancadas ${casa === "deputados" ? "na Câmara" : "no Senado"}`}>
      <div className={estilos.legendaCabecalho}><h2>Partidos {casa === "deputados" ? "na Câmara" : "no Senado"}</h2><span>Selecione para filtrar</span></div>
      <ul className={estilos.legenda} aria-label="Bancadas por partido">{partidos.map(b => <li key={b.nome}><button type="button" aria-label={recortaLegenda ? `${b.nome}: ${naLegenda.get(b.nome) ?? 0} de ${b.total}` : `${b.nome} ${b.total}`} aria-pressed={partido === b.nome} data-vazio={recortaLegenda && !naLegenda.get(b.nome)} onClick={() => { setPartido(partido === b.nome ? "" : b.nome); setPessoaId(null); setRealce(null); }}
        onPointerEnter={e => { if (e.pointerType === "mouse" && partido !== b.nome) setRealce(b.nome); }} onPointerLeave={() => setRealce(null)} onFocus={() => { if (partido !== b.nome) setRealce(b.nome); }} onBlur={() => setRealce(null)}>
        <span className={estilos.corPartido} style={{ background: cor(b.nome) }} /><IdentidadePartido governos={dados.governos} sigla={b.nome === "S/Partido" ? "SEM" : b.nome} /><span className={`tabular ${estilos.bancadaTotal}`}>{recortaLegenda ? naLegenda.get(b.nome) ?? 0 : b.total}</span>
      </button></li>)}</ul>
      </aside>
    </div>

    <Bloco id="bloco-parlamentares" titulo="Parlamentares" detalhe={`${casa === "deputados" ? "Câmara" : "Senado"} · ${estado?.sigla ?? "Brasil"} · crachá e cota parlamentar`} className={estilos.parlamentares} lustroFixo acao={<label className={estilos.busca}><span className="sr-only">Buscar por nome</span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <input type="search" maxLength={150} value={busca} onChange={e => { setBusca(e.target.value); setPessoaId(null); }} placeholder="Buscar parlamentar" />
      </label>}>
      <div className={estilos.resultado}>
        <p role="status" className="tabular">{encontrados.length} {deBase}parlamentares{estado ? ` ${estado.deNome}` : ""}{partido ? ` · ${partido}` : ""}</p>
        <span className={estilos.acoesResultado}>
          {filtrado && <button type="button" onClick={limpar}>Limpar filtros</button>}
          <Link href={linkResumo} className={estilos.verResumo}>{rotuloResumo} →</Link>
        </span>
      </div>
      <DiretorioCongresso casa={casa} cadastro={cadastro} encontrados={encontrados} governos={dados.governos} ufs={dados.ufs} corDe={cor}
        pessoaId={pessoaId} aoEscolherPessoa={id => { setAssentoId(null); setPessoaId(id); }} recorteNome={recorteAtivo}
        filtros={{ uf: !!sigla, partido: !!partido, busca: !!termo }} aoFiltrarPartido={p => { setPartido(p); setPessoaId(null); }} aoFiltrarEstado={uf => { setSigla(uf); setPessoaId(null); }} />
    </Bloco>
  </section>;
}
