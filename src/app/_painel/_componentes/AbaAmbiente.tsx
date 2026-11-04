"use client";

import { useMemo, useState } from "react";

import type { DadosPainel } from "../_dados/tipos";
import { useMunicipiosAmbiente } from "./municipiosAmbiente";
import { placarDoAmbiente } from "./placarAmbiente";
import { SalaAmbiente } from "./SalaAmbiente";
import { TerminalAmbiente } from "./TerminalAmbiente";

/**
 * A aba de meio ambiente. Mesmo design system da economia, outra pergunta: lá,
 * como está o país e cada estado; aqui, onde está acontecendo.
 *
 * Abre na sala: o mapa dos municípios, as cinco formas de ver e o placar do
 * bioma escolhido. Rolando, o terminal: as séries, o ritmo, os biomas, o desmatamento
 * desde 1988 por governo, a temporada do fogo, as áreas protegidas, os municípios contra a
 * fiscalização e os estados.
 *
 * Tudo é dado real do INPE, do Ibama e do IBGE, pelo Neon. Medida cuja fonte
 * não respondeu sai da tela; nenhuma vira zero.
 */

const quieto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AbaAmbiente({
  dados,
  atual,
  sigla,
  setSigla,
}: {
  dados: DadosPainel;
  /** O governo atual inteiro, para o que compara todos os governos. */
  atual: DadosPainel;
  sigla: string | null;
  setSigla: (s: string | null) => void;
}) {
  const [foco, setFoco] = useState(dados.ambiente.series[0]?.id);
  const [bioma, setBioma] = useState<string | null>(null);
  const [municipio, setMunicipio] = useState<string | null>(null);
  const { formas, municipal } = useMunicipiosAmbiente(dados.foco);
  const placar = useMemo(() => placarDoAmbiente(dados), [dados]);

  if (!dados.leituras.ambiente.length) {
    return (
      <p className="mx-auto max-w-xl py-24 text-center text-sm" style={{ color: "var(--tinta-2)" }}>
        As fontes do meio ambiente não responderam agora. Tente de novo em alguns minutos.
      </p>
    );
  }

  const paraCima = () => window.scrollTo({ top: 0, behavior: quieto() ? "auto" : "smooth" });
  // "Histórico completo" no placar: desce até o gráfico dele.
  const verHistorico = (id: string) => {
    setFoco(id);
    document.getElementById("de-perto")?.scrollIntoView({ behavior: quieto() ? "auto" : "smooth", block: "start" });
  };
  const abrirEstado = (s: string) => {
    setSigla(s);
    setBioma(null);
    setMunicipio(null);
    paraCima();
  };
  const abrirBioma = (b: string | null) => {
    setBioma(b);
    setSigla(null);
    setMunicipio(null);
    paraCima();
  };
  const abrirMunicipio = (c: string) => {
    setMunicipio(c);
    paraCima();
  };

  return (
    <>
      <SalaAmbiente
        dados={dados}
        formas={formas}
        municipal={municipal}
        placar={placar}
        sigla={sigla}
        setSigla={setSigla}
        bioma={bioma}
        setBioma={setBioma}
        municipio={municipio}
        setMunicipio={setMunicipio}
        aoFocarSerie={setFoco}
        aoVerHistorico={verHistorico}
      />
      <TerminalAmbiente
        dados={dados}
        atual={atual}
        foco={foco}
        setFoco={setFoco}
        placar={placar}
        sigla={sigla}
        bioma={bioma}
        formas={formas}
        municipal={municipal}
        aoSelecionarUf={abrirEstado}
        aoSelecionarBioma={abrirBioma}
        aoSelecionarMunicipio={abrirMunicipio}
        aoVerSerie={verHistorico}
      />
    </>
  );
}
