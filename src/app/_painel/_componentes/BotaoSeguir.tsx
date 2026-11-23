"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { alternarSeguir } from "@/app/(conta)/acoes";
import { chaveSeguido, type ChaveSeguido } from "@/lib/seguindoChave";
import estilos from "./BotaoSeguir.module.css";

type Estado = "carregando" | "fora" | "sim" | "nao" | "indisponivel";

const Estrela = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
  <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
</svg>;
const Certo = () => <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
  <path d="m2.5 6.3 2.4 2.4 4.6-5" />
</svg>;

/**
 * "Seguir" na página do parlamentar. Pergunta à API se há sessão e quem a conta segue; sem
 * sessão, leva ao login, que devolve a pessoa à conta com este parlamentar sugerido.
 */
export function BotaoSeguir({ casa, id, nome }: ChaveSeguido & { nome: string }) {
  const chave = chaveSeguido({ casa, id });
  const [estado, setEstado] = useState<Estado>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/seguindo", { cache: "no-store" })
      .then(r => r.json() as Promise<{ logado: boolean; seguidos: string[]; indisponivel?: boolean }>)
      .then(d => { if (vivo) setEstado(!d.logado ? "fora" : d.indisponivel ? "indisponivel" : d.seguidos.includes(chave) ? "sim" : "nao"); })
      .catch(() => { if (vivo) setEstado("indisponivel"); });
    return () => { vivo = false; };
  }, [chave]);

  if (estado === "indisponivel") return null;
  if (estado === "fora") return <Link href={`/login?seguir=${chave}`} className={estilos.seguir} prefetch={false} title={`Entre na sua conta para seguir ${nome}`}>
    <Estrela />Seguir
  </Link>;

  const seguindo = estado === "sim";
  const alternar = () => {
    const novo = !seguindo;
    setErro(null);
    setEstado(novo ? "sim" : "nao");
    iniciar(async () => {
      const resposta = await alternarSeguir(casa, id, novo);
      if (resposta.erro) {
        setEstado(novo ? "nao" : "sim");
        setErro(resposta.erro);
      }
    });
  };
  return <>
    <button type="button" className={estilos.seguir} data-seguindo={seguindo || undefined} aria-pressed={seguindo}
      aria-label={`Seguir ${nome}`} disabled={estado === "carregando" || pendente} onClick={alternar}>
      {seguindo ? <Certo /> : <Estrela />}{seguindo ? "Seguindo" : "Seguir"}
    </button>
    {seguindo && !pendente && <Link href="/conta" className={estilos.conta} prefetch={false}>Ver na sua conta</Link>}
    {erro && <span className={estilos.erro} role="alert">{erro}</span>}
  </>;
}
