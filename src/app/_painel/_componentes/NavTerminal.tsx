"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O índice do terminal de um tema: uma faixa de vidro logo abaixo do
 * cabeçalho, com as seções da página e a que está na tela marcada.
 *
 * Só aparece depois do mapa: na sala, o mapa é a abertura e não divide a tela
 * com mais nada. Flutua fora do cabeçalho, em posição própria, porque a altura
 * dele empurra a página inteira (`--altura-cabecalho`): entrar nele faria a
 * página pular quando a faixa aparecesse. As seções descontam a altura dela
 * ao rolar (`.terminal-tema [id]` no CSS).
 *
 * Sem cor de veredito nos itens: em "Estados" e "Governo a governo" não há um
 * veredito só, e a cor perderia o sentido único que tem no resto da tela.
 */

export const SECOES = [
  { id: "agora", rotulo: "Agora" },
  { id: "de-perto", rotulo: "Histórico" },
  { id: "governo-a-governo", rotulo: "Governo a governo" },
  { id: "estados", rotulo: "Estados" },
  { id: "emprego-e-credito", rotulo: "Emprego e crédito" },
  { id: "fontes", rotulo: "Fontes" },
] as const;

const quieto = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function NavTerminal({
  secoes = SECOES,
  rotulo = "Seções da economia",
  mostrarDesde,
}: {
  secoes?: readonly { id: string; rotulo: string }[];
  rotulo?: string;
  /**
   * O id do que, ao passar da metade da tela, faz a faixa aparecer. Sem ele, vale a primeira
   * seção. Na página do parlamentar a primeira seção é o crachá, que já abre na tela: a faixa
   * cobriria a trilha, então ela espera o primeiro capítulo.
   */
  mostrarDesde?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const [ativa, setAtiva] = useState<string>(secoes[0].id);
  const faixa = useRef<HTMLDivElement>(null);
  // A seção clicada fica marcada até o leitor mexer na página. Sem isso, uma seção curta
  // deixava a seguinte cruzar a linha de leitura, e o destaque ia para outra que não a clicada.
  const clicada = useRef<string | null>(null);

  // No celular a faixa rola de lado: a seção ativa vem para o meio dela, senão
  // "Fontes" ficava marcada fora da tela.
  useEffect(() => {
    const f = faixa.current;
    const a = f?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!f || !a || f.scrollWidth <= f.clientWidth) return;
    f.scrollTo({ left: a.offsetLeft - (f.clientWidth - a.offsetWidth) / 2, behavior: quieto() ? "auto" : "smooth" });
  }, [ativa]);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const els = secoes.map((s) => document.getElementById(s.id));
      const primeira = els[0];
      if (!primeira) return;
      // Aparece quando o terminal passa da metade da tela; some de volta no mapa.
      const gatilho = (mostrarDesde && document.getElementById(mostrarDesde)) || primeira;
      setVisivel(gatilho.getBoundingClientRect().top < window.innerHeight * 0.55);
      // A seção ativa é a última cujo topo já passou de um quarto da tela
      // abaixo da faixa: a que o leitor está vendo, não só a que encostou nela.
      const cabecalho = parseFloat(getComputedStyle(primeira).getPropertyValue("--altura-cabecalho")) || 112;
      const linha = cabecalho + 60 + window.innerHeight * 0.25;
      let atual: string = secoes[0].id;
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= linha) atual = secoes[i].id;
      });
      // No fim da página a última seção pode não chegar à linha: ela vale.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) atual = secoes[secoes.length - 1].id;
      setAtiva(clicada.current ?? atual);
    };
    // Roda, toque, tecla ou clique: o leitor voltou a mexer, e a seção volta a seguir a rolagem.
    // O clique num item da faixa solta e prende de novo, nessa ordem.
    const soltar = () => { clicada.current = null; };
    const gestos = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    gestos.forEach((g) => window.addEventListener(g, soltar, { passive: true }));
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      gestos.forEach((g) => window.removeEventListener(g, soltar));
      cancelAnimationFrame(quadro);
    };
  }, [secoes, mostrarDesde]);

  return (
    <nav className="nav-terminal" data-visivel={visivel || undefined} aria-label={rotulo} aria-hidden={!visivel} inert={!visivel}>
      <div className="nav-terminal-vidro vidro">
      <div ref={faixa} className="nav-terminal-faixa">
        {secoes.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={ativa === s.id ? "true" : undefined}
            onClick={(e) => {
              const alvo = document.getElementById(s.id);
              if (!alvo) return;
              e.preventDefault();
              clicada.current = s.id;
              setAtiva(s.id);
              // Subindo, o cabeçalho do celular reabre por inteiro (`Topo.tsx`), e um pouso
              // medido pela altura recolhida deixava o título embaixo dele. Então, ao subir, o
              // título para abaixo do cabeçalho cheio e da faixa (36 px dela e 20 de folga).
              // Descendo, e no computador, onde as duas alturas são iguais, vale o scroll-margin.
              const css = getComputedStyle(alvo);
              const topo = alvo.getBoundingClientRect().top;
              const margem = parseFloat(css.scrollMarginTop) || 0;
              const cheia = parseFloat(css.getPropertyValue("--altura-cabecalho")) || 0;
              const pouso = topo < margem ? Math.max(margem, cheia + 56) : margem;
              window.scrollTo({ top: window.scrollY + topo - pouso, behavior: quieto() ? "auto" : "smooth" });
            }}
          >
            {s.rotulo}
          </a>
        ))}
      </div>
      </div>
    </nav>
  );
}
