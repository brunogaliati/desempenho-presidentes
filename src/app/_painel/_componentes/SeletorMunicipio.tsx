"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import type { OpcaoMunicipio } from "../_dados/resumoMunicipalModelo";
import s from "./AbaResumo.module.css";
import m from "./ResumoMunicipal.module.css";

/**
 * Abre o resumo de uma prefeitura no próprio painel. O endereço guarda o código
 * do IBGE (`municipio`) e a UF dele; `gestao` só aparece fora da gestão em curso.
 */
export function irParaMunicipio(o: OpcaoMunicipio) {
  const url = new URL(location.href);
  url.searchParams.set("uf", o.uf);
  url.searchParams.set("municipio", o.codigo);
  url.searchParams.delete("gestao");
  url.searchParams.delete("r.resumo.linha");
  window.scrollTo({ top: 0, behavior: "instant" });
  // Um passo no histórico: voltar leva ao estado ou ao Brasil de antes.
  window.history.pushState(null, "", url);
}

/**
 * A terceira esfera do resumo, ao lado de Brasil e Estados: uma busca de vidro
 * no mesmo molde do seletor de estados. Sem texto, lista as maiores cidades da
 * UF escolhida (ou do país); com texto, procura em todo o Brasil, a UF primeiro.
 */
export function SeletorMunicipio({
  uf,
  municipio,
  aoEscolher = irParaMunicipio,
}: {
  uf: string | null;
  municipio: { codigo: string; nome: string } | null;
  aoEscolher?: (o: OpcaoMunicipio) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<OpcaoMunicipio[] | null>(null);
  const [erro, setErro] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const listaId = useId();

  // Espera a pessoa parar de digitar antes de perguntar.
  useEffect(() => {
    const t = setTimeout(() => setBusca(texto.trim()), 140);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    if (!aberto) return;
    const controle = new AbortController();
    const q = new URLSearchParams({ ...(uf ? { uf } : {}), ...(busca ? { q: busca } : {}) });
    setErro(false);
    fetch(`/api/painel/resumo/municipios?${q}`, { signal: controle.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ municipios: OpcaoMunicipio[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setLista(d.municipios);
        setAtivo(0);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setErro(true);
      });
    return () => controle.abort();
  }, [aberto, uf, busca]);

  useEffect(() => {
    if (!aberto) return;
    campo.current?.focus();
    const fora = (e: globalThis.PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const escolher = (o: OpcaoMunicipio) => {
    setAberto(false);
    setTexto("");
    aoEscolher(o);
  };

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && aberto) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
      gatilho.current?.focus();
      return;
    }
    if (!aberto || !lista?.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = lista[ativo];
      if (o) escolher(o);
    }
  };

  const opcaoId = (i: number) => `${listaId}-${i}`;
  const titulo = uf && !busca ? `Maiores cidades · ${uf}` : busca ? "Resultados" : "Maiores cidades";

  return (
    <div
      ref={raiz}
      className={s.seletorUf}
      onKeyDown={teclado}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <button
        ref={gatilho}
        type="button"
        className={s.esfera}
        aria-pressed={Boolean(municipio)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={municipio ? `Município: ${municipio.nome}. Trocar de município` : "Escolher um município"}
        onClick={() => setAberto(!aberto)}
      >
        {municipio ? <span className={m.nomeMunicipio}>{municipio.nome}</span> : "Municípios"}
        <svg className={s.setaMenu} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        <div className={`mandato-opcoes vidro ${s.listaUf} ${m.listaMunicipio}`} role="dialog" aria-label="Escolher um município">
          <div className={m.busca}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              ref={campo}
              type="search"
              role="combobox"
              aria-label="Buscar município pelo nome"
              aria-autocomplete="list"
              aria-expanded={Boolean(lista?.length)}
              aria-controls={listaId}
              aria-activedescendant={lista?.length ? opcaoId(ativo) : undefined}
              placeholder={uf ? `Buscar cidade (${uf} primeiro)` : "Buscar cidade"}
              value={texto}
              maxLength={80}
              onChange={(e) => setTexto(e.target.value)}
            />
          </div>
          <div className={s.listaUfRolagem}>
            <div className={s.regiao} aria-hidden>
              {titulo}
            </div>
            <div id={listaId} role="listbox" aria-label={titulo} className={m.grade}>
              {lista?.map((o, i) => (
                <button
                  key={o.codigo}
                  id={opcaoId(i)}
                  data-indice={i}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={o.codigo === municipio?.codigo}
                  data-ativo={i === ativo || undefined}
                  className={`mandato-opcao ${s.opcaoUf}`}
                  onPointerEnter={() => setAtivo(i)}
                  onClick={() => escolher(o)}
                >
                  <span>{o.nome}</span>
                  <small>{o.uf}</small>
                </button>
              ))}
            </div>
            {lista && !lista.length && <p className={m.vazio} role="status">Nenhum município com esse nome. Tente outra grafia.</p>}
            {!lista && !erro && <p className={m.vazio} role="status">Carregando…</p>}
            {erro && <p className={m.vazio} role="alert">A lista não respondeu agora.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
