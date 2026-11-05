"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { destinoPainel } from "@/lib/rotasPainel";
import { TEMAS_PAINEL, temaDoCaminho } from "@/lib/temasPainel";
import { mandatoDoPerfil, migrarLinkPerfil } from "@/lib/perfisPainel";
import { ContextoPerfil } from "./ContextoPerfil";
import { ContextoPresidente, TrilhaPerfil } from "./PerfilPresidente";
import estilosPerfil from "./PerfilPresidente.module.css";
import { Compartilhar } from "@/components/Compartilhar";
import { RecortesCompartilhaveis } from "@/components/RecortesCompartilhaveis";
import { fraseDoPlacar } from "@/lib/fraseCompartilhamento";
import { placarDaEconomia } from "./Placar";

import { mandatoDoEndereco, recortarAoMandato, TERMO_2015 } from "../_dados/mandatoRecorte";
import { capaDoLink } from "./capaRecorte";
import type { AbaId, DadosPainel } from "../_dados/tipos";
import { AbaDinheiro } from "./AbaDinheiro";
import { AbaAmbiente } from "./AbaAmbiente";
import { AbaEconomia } from "./AbaEconomia";
import { PosseContext } from "./GraficoLinha";
import { BarraMandato, Cabecalho } from "./Topo";
import { FiltroRefracao, useVidro } from "./Vidro";

/**
 * O governo atual, um tema por aba, numa página só.
 *
 * Cada aba tem o desenho que o seu dado pede, e a página rola: Economia e
 * Meio ambiente abrem na mesma sala (o mapa solto, a manchete, o placar na
 * barra de vidro) e descem para o terminal, cada uma com a sua paisagem de
 * fundo; Dinheiro abre num treemap. O layout mantém o cabeçalho e os dados
 * comuns montados durante a troca; só o conteúdo do tema muda.
 *
 * O caminho escolhe a aba; `uf` e `mandato` preservam o recorte também no voltar/avançar.
 */

interface Props {
  dados: DadosPainel;
  retrato: React.ReactNode;
  children: React.ReactNode;
}

export function Painel({ dados: inteiros, retrato, children }: Props) {
  const router = useRouter(), parametros=useSearchParams();
  const navegar=(url:string)=>{window.scrollTo({top:0,behavior:"instant"});router.push(url,{scroll:false});};
  const caminho=usePathname(), pessoaId=caminho.match(/^\/presidente\/([^/]+)$/)?.[1];
  const aba=temaDoCaminho(caminho), descricao=TEMAS_PAINEL[aba].descricao;
  const sigla=pessoaId?null:inteiros.ufs.find(u=>u.sigla===parametros.get('uf')?.toUpperCase())?.sigla??null;
  const emCurso = inteiros.presidente.id, mandatos = inteiros.economia.mandatos;
  const presidentesDe2015 = mandatos.filter(m=>m.inicio>="2015"&&m.inicio<"2019").map(m=>m.id);
  const pedido=parametros.get('mandato');
  const perfil=pessoaId?mandatoDoPerfil(mandatos,pessoaId,pedido):undefined;
  const mandatoId=mandatoDoEndereco(inteiros,{pessoaId,sigla,pedido});
  const presidenteAntes=useRef<string|null>(null);
  const atual=useMemo(()=>recortarAoMandato(inteiros,emCurso),[inteiros,emCurso]);
  const dados=useMemo(()=>mandatoId===emCurso?atual:recortarAoMandato(inteiros,mandatoId),[inteiros,mandatoId,emCurso,atual]);
  // A frase do botão do painel: a contagem do placar, pela mesma conta dele. No estado, o placar é outro.
  const fraseDoPainel=useMemo(()=>{
    const governo=mandatos.find(m=>m.id===mandatoId)?.nomeCurto;
    if(aba!=="economia"||sigla||!governo)return null;
    const itens=placarDaEconomia(dados).grupos.flatMap(g=>g.itens);
    if(!itens.length)return null;
    const quantos=(s:string)=>itens.filter(x=>x.sentido===s).length;
    return fraseDoPlacar({governo,periodo:`${dados.foco.posse.slice(0,4)}–${dados.foco.fim.slice(0,4)}`,bons:quantos("bom"),iguais:quantos("neutro"),ruins:quantos("ruim")});
  },[aba,sigla,dados,mandatos,mandatoId]);
  const setMandatoId=(id:string)=>{
    const proximo=mandatos.find(m=>m.id===id);
    if(pessoaId&&proximo&&proximo.pessoaId!==pessoaId){navegar(`/presidente/${proximo.pessoaId}?mandato=${encodeURIComponent(id)}`);return;}
    const url=new URL(location.href);url.searchParams.set('mandato',id);
    // O Next copia o estado interno e notifica useSearchParams nesta chamada pública.
    window.history.replaceState(null,'',url);
  };
  const setSigla=(s:string|null)=>{
    const url=new URL(location.href);
    if(s)url.searchParams.set('uf',s);else url.searchParams.delete('uf');
    if(pessoaId){url.pathname='/';url.searchParams.set('mandato',mandatoId);}
    if(s&&presidentesDe2015.includes(mandatoId)){presidenteAntes.current=mandatoId;url.searchParams.set('mandato',TERMO_2015);}
    if(!s&&mandatoId===TERMO_2015)url.searchParams.set('mandato',presidenteAntes.current??presidentesDe2015[0]??emCurso);
    if(pessoaId)navegar(url.pathname+url.search+url.hash);else window.history.replaceState(null,'',url);
  };
  const cabecalho = useRef<HTMLDivElement>(null);
  useVidro();

  useLayoutEffect(()=>{
    const migrar=()=>{const nova=migrarLinkPerfil(new URL(location.href),mandatos,inteiros.economia.series);if(nova){window.history.replaceState(null,'',nova);window.dispatchEvent(new PopStateEvent('popstate'));}};
    migrar();window.addEventListener('hashchange',migrar);
    return()=>window.removeEventListener('hashchange',migrar);
  },[caminho,mandatos,inteiros.economia.series]);

  useLayoutEffect(() => {
    const el = cabecalho.current;
    if (!el) return;
    const medir = () => el.parentElement?.style.setProperty("--altura-cabecalho", `${el.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const trocarAba = (a: AbaId) => {
    if(a!=="economia"&&a!=="ambiente"&&a!=="dinheiro")return;
    navegar(destinoPainel({aba:a,uf:sigla??undefined,mandato:mandatoId}));
  };

  return (
    <RecortesCompartilhaveis capaDoLink={(link)=>capaDoLink(link,inteiros)} titulo={`${sigla ? 'Governo de '+(dados.ufs.find(u=>u.sigla===sigla)?.nome??sigla) : mandatos.find(m=>m.id===mandatoId)?.nomeCurto??'Governo'} · ${dados.foco.posse.slice(0,4)}–${dados.foco.fim.slice(0,4)}`} filtros={{uf:sigla,mandato:mandatoId}}>
    <PosseContext.Provider value={dados.foco.posse}>
    <ContextoPerfil.Provider value={perfil?{pessoaId:perfil.pessoaId,nome:perfil.nomeCurto}:null}>
    <div
      className="painel-governo min-h-dvh px-3 pb-10"
      data-aba={aba}
      data-visual="governo-v1"
    >
      <div aria-hidden className="fundo-painel" />
      <FiltroRefracao />
      <div ref={cabecalho} className="painel-cabecalho relative -mx-3 mb-3 border-b">
        <Cabecalho publico recorte={{uf:sigla??undefined,mandato:mandatoId}} aba={aba} aoTrocar={trocarAba} mandato={<BarraMandato dados={atual} foco={dados.foco} retrato={retrato} sigla={sigla} aba={aba} aoEscolher={setMandatoId} />} />
      </div>

      {/* Antes dos painéis de propósito: ao entrar numa rota, o Next rola até o primeiro elemento dela. Depois deles, o perfil abria no rodapé. */}
      {children}
      <div className={`relative z-[2] mx-auto flex items-center justify-end gap-4 py-1 text-xs text-[var(--tinta-2)] ${perfil?`px-3 ${estilosPerfil.barra}`:"max-w-6xl px-2"}`}>
        {perfil&&<TrilhaPerfil proprios={mandatos.filter(m=>m.pessoaId===perfil.pessoaId).sort((a,b)=>a.inicio.localeCompare(b.inicio))} atual={perfil.id} aoEscolher={setMandatoId}/>}
        <Compartilhar {...(fraseDoPainel?{contexto:"",mensagem:fraseDoPainel}:{mensagem:perfil?`${aba==="economia"?"Economia":TEMAS_PAINEL[aba].titulo} no governo ${perfil.nomeCurto}`:TEMAS_PAINEL[aba].titulo})} compacto/>
      </div>
      <main>
      {aba === "economia" && (
        <AbaEconomia dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} aoTrocarAba={trocarAba} />
      )}
      {aba === "ambiente" && <AbaAmbiente dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} />}
      {aba === "dinheiro" && <AbaDinheiro dados={dados} atual={atual} sigla={sigla} setSigla={setSigla} aoEscolherMandato={setMandatoId} />}
      </main>
      {perfil&&<ContextoPresidente nome={perfil.nome}/>}

      {aba === "economia" && <nav aria-label="Indicadores e territórios" className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-5 text-sm"><Link href="/explorar">Todos os indicadores</Link><Link href="/economia/salario-minimo">Salário mínimo</Link><Link href="/economia/inflacao">Inflação</Link><Link href="/economia/desemprego">Desemprego</Link><Link href="/economia/gasolina">Gasolina</Link><Link href="/economia/municipios">Indicadores por município</Link></nav>}
      <nav aria-label="Sobre os dados" className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-5 text-sm"><Link href="/metodologia">Metodologia</Link><Link href="/sobre">Sobre o projeto</Link><Link href="/correcoes">Relatar um erro</Link></nav>
      <footer className="mx-auto mt-6 max-w-6xl text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        {descricao && <p className="mb-3">{descricao} Os períodos e fontes aparecem em cada painel; ausência de informação não significa zero.</p>}
        {aba === "dinheiro" ? (<>Fontes: Tesouro Nacional · Siconfi e Transferegov · transferências especiais.</>) : aba === "ambiente" ? (
          <>
            Fontes: INPE (PRODES, DETER e Programa Queimadas), Ibama (dados abertos da fiscalização) e IBGE (malhas). Cada painel diz a data
            em que o dado entrou no banco; medida cuja fonte não respondeu sai da tela, nunca vira zero.
          </>
        ) : (
          <>
            Fontes: Banco Central, IBGE (SIDRA, estimativas e malhas), World Bank, Câmara, Senado e INPE.{" "}
            Dados das APIs públicas coletados em{" "}
            {new Date(inteiros.fontes.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.
            Cada indicador identifica sua referência e os limites da comparação.
          </>
        )}
      </footer>
    </div>
    </ContextoPerfil.Provider>
    </PosseContext.Provider>
    </RecortesCompartilhaveis>
  );
}
