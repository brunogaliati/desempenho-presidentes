"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { gruposDeGovernadores, gruposDePresidentes, type FamiliaId, type PainelDinheiro } from "../_dados/dinheiroModelo";
import type { DadosPainel } from "../_dados/tipos";
import { termosDoGoverno } from "./governos";
import { NavTerminal } from "./NavTerminal";
import { SalaDinheiro } from "./SalaDinheiro";
import { TerminalDinheiro } from "./TerminalDinheiro";

/**
 * A aba do dinheiro. Aqui não há mapa do Brasil: a unidade do dado é o real, então o
 * palco é um treemap, "de cada R$ 100". O estado entra de dois jeitos: pela régua dos
 * 27 e pelo orçamento do próprio estado, que redesenha o treemap.
 *
 * Cor é a família do gasto, nunca verde ou vermelho: gastar mais não é bom nem ruim
 * por si só. A mudança desde a posse aparece em número, sem veredito.
 *
 * Os dados vêm à parte do painel (`/prototipo/api/dinheiro`), com cache no servidor.
 */

const SECOES = [
  { id: "ano-a-ano", rotulo: "Ano a ano" },
  { id: "de-onde-veio", rotulo: "De onde veio" },
  { id: "emendas", rotulo: "Emendas Pix" },
  { id: "todas-as-linhas", rotulo: "Todas as linhas" },
  { id: "fontes-dinheiro", rotulo: "Fontes" },
] as const;

export function AbaDinheiro({
  dados,
  atual,
  sigla,
  setSigla,
  aoEscolherMandato,
}: {
  dados: DadosPainel;
  /** O governo atual inteiro: a lista de mandatos não depende do escolhido. */
  atual: DadosPainel;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  aoEscolherMandato: (id: string) => void;
}) {
  const [painel, setPainel] = useState<PainelDinheiro | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [anoPedido, setAnoPedido] = useState<number | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [zoom, setZoom] = useState<FamiliaId | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    fetch("/prototipo/api/dinheiro?tipo=painel", { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<PainelDinheiro>;
      })
      .then((p) => {
        setPainel(p);
        setErro(false);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(true);
      });
    return () => controle.abort();
  }, [tentativa]);

  const grupos = useMemo(() => {
    if (!painel) return [];
    return sigla
      ? gruposDeGovernadores(painel.anos, termosDoGoverno(dados.governos, sigla, atual.economia.mandatos))
      : gruposDePresidentes(painel.anos, atual.economia.mandatos);
  }, [painel, sigla, dados.governos, atual.economia.mandatos]);

  const foco = dados.foco;
  const ano = useMemo(() => {
    if (!painel) return 0;
    // Quem governava em julho fica com o ano, a mesma regra do trilho.
    const doMandato = painel.anos.filter((a) => foco.posse <= `${a}-07` && (foco.ate === null || `${a}-07` < foco.ate));
    if (anoPedido !== null && (doMandato.length === 0 || doMandato.includes(anoPedido))) return anoPedido;
    if (doMandato.length === 0) return painel.anos[0];
    const fechados = doMandato.filter((a) => a !== painel.parcial?.ano);
    return fechados.at(-1) ?? doMandato[doMandato.length - 1];
  }, [painel, anoPedido, foco.posse, foco.ate]);

  const trilhoRef = useRef(grupos);
  trilhoRef.current = grupos;
  const escolherAno = (a: number) => {
    setAnoPedido(a);
    const grupo = trilhoRef.current.find((g) => g.anos.includes(a));
    if (grupo && grupo.id !== foco.id) aoEscolherMandato(grupo.id);
  };

  if (erro && !painel) {
    return (
      <div className="dn-aviso">
        <p>O orçamento não respondeu agora.</p>
        <button type="button" className="dn-acao" onClick={() => { setErro(false); setTentativa((t) => t + 1); }}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!painel) return <EsqueletoDinheiro />;

  const chave = sigla && painel.entes[sigla] ? sigla : "BR";

  return (
    <div className="dn-pagina terminal-tema relative -mx-3">
      <NavTerminal secoes={SECOES} rotulo="Seções do dinheiro público" />
      <SalaDinheiro
        painel={painel}
        sigla={chave === "BR" ? null : chave}
        setSigla={setSigla}
        ano={ano}
        grupos={grupos}
        escolherAno={escolherAno}
        selecionado={selecionado}
        setSelecionado={setSelecionado}
        zoom={zoom}
        setZoom={setZoom}
        governos={dados.governos}
      />
      <TerminalDinheiro painel={painel} sigla={chave === "BR" ? null : chave} ano={ano} grupos={grupos} escolherAno={escolherAno} />
    </div>
  );
}

/** Carregando não é indisponível: o espaço já tem o tamanho final, e nada pula quando o dado chega. */
function EsqueletoDinheiro() {
  return (
    <div className="dn-pagina relative -mx-3" aria-busy="true" aria-label="Carregando o orçamento">
      <div className="dn-sala">
        <div className="dn-esqueleto dn-esqueleto-coluna" />
        <div className="dn-esqueleto" />
        <div className="dn-esqueleto dn-esqueleto-barra" />
      </div>
    </div>
  );
}
