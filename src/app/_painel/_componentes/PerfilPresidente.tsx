"use client";

import Link from "next/link";
import { TituloCompartilhavel } from "@/components/TituloCompartilhavel";
import styles from "@/app/economia/indicador.module.css";
import estilos from "./PerfilPresidente.module.css";
import type { MandatoVisual } from "../_dados/tipos";

const periodo = (m: MandatoVisual) => `${m.inicio.slice(0, 4)}–${m.emCurso ? "hoje" : m.fim.slice(0, 4)}`;

/** No topo do perfil: a volta ao catálogo e os mandatos da pessoa. */
export function TrilhaPerfil({ proprios, atual, aoEscolher }: { proprios: MandatoVisual[]; atual: string; aoEscolher: (id: string) => void }) {
  return (
    <nav aria-label={`Mandatos de ${proprios[0].nomeCurto}`} className={estilos.trilha}>
      <Link href="/explorar#presidentes" className={estilos.voltar}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
        Presidentes
      </Link>
      {proprios.length === 1
        ? <span className={estilos.unico}>{proprios[0].nomeCurto} · {periodo(proprios[0])}</span>
        : (
          <ul className={estilos.mandatos}>
            {proprios.map((m) => (
              <li key={m.id}>
                <a
                  href={`/presidente/${m.pessoaId}?mandato=${encodeURIComponent(m.id)}`}
                  aria-current={m.id === atual ? "true" : undefined}
                  aria-label={`${m.mandato}º mandato, ${periodo(m)}`}
                  onClick={(e) => {
                    // Com modificador, o navegador abre outra aba; o clique simples troca sem sair da posição.
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    aoEscolher(m.id);
                  }}
                >
                  {m.mandato}º<i> mandato</i> <span>{periodo(m)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
    </nav>
  );
}

/** Abaixo dos dados: o que muda a leitura dos mandatos. Os números ficam no painel. */
export function ContextoPresidente({ nome }: { nome: string }) {
  return (
    <div className={`${styles.pagina} mx-auto max-w-6xl pb-8`}>
      <section id="contexto-presidente" className="vidro" data-lustro="fixo">
        <TituloCompartilhavel>Como ler os mandatos de {nome}</TituloCompartilhavel>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">Mandatos encerrados antes do prazo não equivalem a quatro anos completos. O mandato em curso usa somente os dados já publicados. Mandatos separados por um intervalo fora do cargo são comparados individualmente; não somamos esse intervalo ao governo.</p>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">As fontes e referências aparecem junto de cada indicador. Cobertura e frequência podem variar entre séries; ausência permanece sem dado. Mudança durante um governo não demonstra, sozinha, que ele a causou.</p>
        <nav aria-label="Continuar explorando" className="mt-5 flex flex-wrap gap-5 text-sm"><a href="#governo-a-governo">Comparar os governos</a><a href="#fontes">Fontes dos indicadores</a><Link href="/metodologia">Metodologia</Link></nav>
      </section>
    </div>
  );
}
