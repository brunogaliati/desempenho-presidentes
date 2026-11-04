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
}: {
  secoes?: readonly { id: string; rotulo: string }[];
  rotulo?: string;
}) {
  const [visivel, setVisivel] = useState(false);
  const [ativa, setAtiva] = useState<string>(secoes[0].id);
  const faixa = useRef<HTMLDivElement>(null);

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
      setVisivel(primeira.getBoundingClientRect().top < window.innerHeight * 0.55);
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
      setAtiva(atual);
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
      cancelAnimationFrame(quadro);
    };
  }, [secoes]);

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
              setAtiva(s.id);
              alvo.scrollIntoView({ behavior: quieto() ? "auto" : "smooth", block: "start" });
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
