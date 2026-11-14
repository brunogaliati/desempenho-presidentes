"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { type CasaCongresso, caminhoParlamentar } from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import { FotoParlamentar } from "./FotoParlamentar";
import s from "./TrocarParlamentar.module.css";

type Pessoa = { id: number; nome: string; partido: string | null; uf: string };
type Opcao = Pessoa & { casa: CasaCongresso; chave: string };

const LIMITE = 60;
const semAcento = (x: string) => x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const TODOS: (Opcao & { busca: string[] })[] = (["deputados", "senadores"] as const).flatMap(casa => fotografia[casa].map(p => ({
  ...p, casa, chave: `${casa}-${p.id}`, busca: semAcento(p.nome).split(/[\s-]+/),
})));

/**
 * O nome no topo da página do parlamentar é também a troca de pessoa: clicar abre uma busca
 * com todos os deputados e senadores. Sem nada digitado, a lista mostra a bancada do estado na
 * mesma casa. Ao digitar, procura nas duas casas, pelo começo de cada palavra do nome, pelo
 * partido ou pela UF. Setas escolhem, Enter abre, Esc fecha. A seta ⌄ ao lado do nome mostra que
 * ele abre alguma coisa.
 */
export function TrocarParlamentar({ id, casa, pessoa, rotuloBancada }: { id: string; casa: CasaCongresso; pessoa: Pessoa; rotuloBancada: string }) {
  const router = useRouter();
  const idLista = useId(), idPainel = useId();
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);

  const opcoes = useMemo(() => {
    const termos = semAcento(busca).trim().split(/\s+/).filter(Boolean);
    if (!termos.length) return TODOS.filter(p => p.casa === casa && p.uf === pessoa.uf && p.id !== pessoa.id).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const acha = (p: (typeof TODOS)[number]) => termos.every(t => p.busca.some(b => b.startsWith(t)) || semAcento(p.partido ?? "") === t || p.uf.toLocaleLowerCase("pt-BR") === t);
    const comeca = (p: (typeof TODOS)[number]) => (p.busca[0].startsWith(termos[0]) ? 0 : 1);
    return TODOS.filter(acha).sort((a, b) => comeca(a) - comeca(b) || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, LIMITE);
  }, [busca, casa, pessoa.id, pessoa.uf]);

  const posicionar = () => {
    const b = botao.current, p = painel.current;
    if (!b || !p) return;
    const r = b.getBoundingClientRect();
    const largura = Math.min(400, window.innerWidth - 16);
    p.style.width = `${largura}px`;
    p.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - largura - 8)}px`;
    p.style.top = `${r.bottom + 8}px`;
    p.style.maxHeight = `${Math.max(240, Math.min(480, window.innerHeight - r.bottom - 16))}px`;
  };
  const abrir = () => {
    painel.current?.showPopover();
    posicionar();
    setBusca(""); setAtivo(0); setAberto(true);
    requestAnimationFrame(() => campo.current?.focus());
  };
  const fechar = (devolverFoco = false) => {
    if (painel.current?.matches(":popover-open")) painel.current.hidePopover();
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };
  const ir = (o: Opcao | undefined) => {
    if (!o) return;
    fechar();
    router.push(caminhoParlamentar(o.casa, o));
  };

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !painel.current?.contains(alvo)) fechar();
    };
    document.addEventListener("pointerdown", fora);
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [aberto]);
  // A opção escolhida pelas setas fica sempre à vista.
  useEffect(() => { lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: "nearest" }); }, [ativo]);

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo(i => Math.min(i + 1, opcoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); ir(opcoes[ativo]); }
    else if (e.key === "Escape") { e.preventDefault(); fechar(true); }
  };
  const idOpcao = (i: number) => `${idLista}-${i}`;

  // O título fica só com o nome (é o que a busca do Google lê), e o painel, fora dele. A lista
  // só existe aberta, e os ids do `useId` só aparecem aí: o servidor e o navegador montam árvores
  // um pouco diferentes acima daqui, e um id no HTML inicial dava aviso de hidratação.
  return <>
    <h1 id={id}>
      <button ref={botao} type="button" className={s.nome} aria-haspopup="dialog" aria-expanded={aberto} title="Trocar de deputado ou senador" aria-controls={aberto ? idPainel : undefined}
        onClick={() => (aberto ? fechar() : abrir())}>
        <span>{pessoa.nome}</span>
        <span className={s.seta} aria-hidden="true" />
      </button>
    </h1>
    <div ref={painel} id={aberto ? idPainel : undefined} popover="manual" role="dialog" aria-label="Trocar de parlamentar" className={s.painel}
      onBlur={e => { if (aberto && !painel.current?.contains(e.relatedTarget as Node) && e.relatedTarget !== botao.current) fechar(); }}>
      {aberto && <>
      <input ref={campo} type="search" className={s.campo} value={busca} placeholder="Buscar deputado ou senador"
        role="combobox" aria-expanded="true" aria-controls={idLista} aria-autocomplete="list" aria-label="Buscar deputado ou senador por nome, partido ou UF"
        aria-activedescendant={opcoes.length ? idOpcao(ativo) : undefined}
        onChange={e => { setBusca(e.target.value); setAtivo(0); }} onKeyDown={tecla} />
      <p className={s.grupo} aria-live="polite">{busca.trim() ? `${opcoes.length === LIMITE ? `Primeiros ${LIMITE}` : opcoes.length} ${opcoes.length === 1 ? "resultado" : "resultados"}` : rotuloBancada}</p>
      {opcoes.length ? <ul ref={lista} id={idLista} role="listbox" aria-label="Parlamentares" className={s.lista}>
        {opcoes.map((o, i) => <li key={o.chave} id={idOpcao(i)} role="option" aria-selected={i === ativo} data-indice={i} className={s.opcao}
          onPointerMove={() => setAtivo(i)} onClick={() => ir(o)}>
          <FotoParlamentar casa={o.casa} id={o.id} nome={o.nome} tamanho={32} />
          <span className={s.quem}>
            <b>{o.nome}</b>
            <small>{!o.partido || o.partido === "S/Partido" ? "sem partido" : o.partido}-{o.uf} · {o.casa === "deputados" ? "Câmara" : "Senado"}</small>
          </span>
        </li>)}
      </ul> : <p className={s.vazio}>Ninguém com esse nome, partido ou UF.</p>}
      </>}
    </div>
  </>;
}
