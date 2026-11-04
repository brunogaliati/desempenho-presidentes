"use client";

import { useState } from "react";

import type { AbaId, DadosPainel } from "../_dados/tipos";
import { ultimoDado } from "./formatos";
import { PainelEconomia } from "./PainelEconomia";
import { TerminalEconomia } from "./TerminalEconomia";

/**
 * A aba de economia.
 *
 * Abre na sala da economia (`PainelEconomia`): o mapa solto na tela, com
 * setas, minigráficos e círculos; manchete à esquerda e indicadores num painel
 * único à direita, que abre com o detalhe. Tocar num indicador do país desce
 * para o histórico dele.
 *
 * Rolando, a sala continua no terminal (`TerminalEconomia`): o mesmo vidro com
 * todos os números de uma vez, das séries nacionais aos estados e aos governos
 * desde 1995. Tocar num estado ali sobe de volta para a sala com ele aberto.
 *
 * Tudo aqui é dado real. O selo EXEMPLO só aparece na ficha do estado, nos
 * blocos das outras abas.
 */

const quieto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AbaEconomia({
  dados,
  atual,
  sigla,
  setSigla,
  aoTrocarAba,
}: {
  dados: DadosPainel;
  /** O governo atual inteiro, para o que compara todos os governos. */
  atual: DadosPainel;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  aoTrocarAba: (a: AbaId) => void;
}) {
  const series = dados.economia.series.filter((s) => ultimoDado(s));
  const [foco, setFoco] = useState(series[0]?.id);
  // Com um estado escolhido, o gráfico de baixo mostra esta medida dele;
  // `null` deixa a série nacional de `foco`.
  const primeira = dados.leituras.economia[0]?.id ?? null;
  const [leituraFoco, setLeituraFoco] = useState<string | null>(primeira);

  // "Histórico completo" de um indicador na barra da sala: desce até o gráfico dele.
  const escolher = (id: string) => {
    setFoco(id);
    setLeituraFoco(null);
    document.getElementById("de-perto")?.scrollIntoView({ behavior: quieto() ? "auto" : "smooth", block: "start" });
  };
  // Abrir um indicador do país na barra da sala: o gráfico de baixo acompanha,
  // mas a página fica no mapa.
  const focar = (id: string) => {
    setFoco(id);
    setLeituraFoco(null);
  };
  // Escolher um estado põe o gráfico numa medida dele, se estava numa série do país.
  const escolherEstado = (s: string | null) => {
    setSigla(s);
    if (s && leituraFoco === null) setLeituraFoco(primeira);
  };
  const abrirEstado = (s: string) => {
    escolherEstado(s);
    window.scrollTo({ top: 0, behavior: quieto() ? "auto" : "smooth" });
  };

  return (
    <>
      <PainelEconomia
        dados={dados}
        sigla={sigla}
        setSigla={escolherEstado}
        aoTrocarAba={aoTrocarAba}
        aoEscolherSerie={escolher}
        aoFocarSerie={focar}
      />
      <TerminalEconomia
        dados={dados}
        atual={atual}
        foco={foco}
        setFoco={setFoco}
        sigla={sigla}
        leituraFoco={leituraFoco}
        setLeituraFoco={setLeituraFoco}
        aoSelecionarUf={abrirEstado}
      />
    </>
  );
}
