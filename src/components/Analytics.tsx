"use client";

import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHAVE_ANALYTICS, ID_ANALYTICS, dominioComAnalytics, enderecoAnalytics, paginaAnalytics } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type Escolha = "aceito" | "recusado";

export function Analytics() {
  const caminho = usePathname();
  const [ativo, setAtivo] = useState(false);
  const [escolha, setEscolha] = useState<Escolha | null>(null);
  const [preferencias, setPreferencias] = useState(false);
  const [preparado, setPreparado] = useState(false);
  const ultimaPagina = useRef<string | null>(null);

  useEffect(() => {
    setAtivo(process.env.NODE_ENV === "production" && dominioComAnalytics(location.hostname));
    try {
      const salva = localStorage.getItem(CHAVE_ANALYTICS);
      if (salva === "aceito" || salva === "recusado") setEscolha(salva);
    } catch { /* Sem armazenamento, a preferência vale nesta visita. */ }
    const sincronizar = (e: StorageEvent) => { if (e.key === CHAVE_ANALYTICS || e.key === null) location.reload(); };
    window.addEventListener("storage", sincronizar);
    return () => window.removeEventListener("storage", sincronizar);
  }, []);

  useEffect(() => {
    if (!ativo || escolha !== "aceito") return;
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params -- Formato da fila oficial do gtag.
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
    window.gtag("config", ID_ANALYTICS, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 60 * 60 * 24 * 180,
      page_location: enderecoAnalytics(location.href),
      page_referrer: enderecoAnalytics(document.referrer) ?? "",
    });
    setPreparado(true);
  }, [ativo, escolha]);

  useEffect(() => {
    if (!ativo || escolha !== "aceito" || !preparado) return;
    const pagina = paginaAnalytics(location.origin + caminho, ultimaPagina.current);
    if (!pagina) return;
    const parametros = { page_location: pagina, page_referrer: ultimaPagina.current ?? enderecoAnalytics(document.referrer) ?? "", page_title: document.title };
    window.gtag?.("set", parametros);
    window.gtag?.("event", "page_view", parametros);
    ultimaPagina.current = pagina;
  }, [ativo, escolha, preparado, caminho]);

  function escolher(valor: Escolha) {
    try { localStorage.setItem(CHAVE_ANALYTICS, valor); } catch { /* A escolha continua válida em memória. */ }
    if (valor === "recusado") {
      Reflect.set(window, `ga-disable-${ID_ANALYTICS}`, true);
      for (const cookie of document.cookie.split(";")) {
        const nome = cookie.split("=")[0].trim();
        if (!/^_ga(?:_|$)/.test(nome)) continue;
        for (const dominio of ["", `; domain=${location.hostname}`, "; domain=.desempenhodogoverno.com.br"])
          document.cookie = `${nome}=; Max-Age=0; path=/${dominio}`;
      }
    } else Reflect.set(window, `ga-disable-${ID_ANALYTICS}`, false);
    setEscolha(valor);
    setPreferencias(false);
    // Recarregar ao revogar remove também a biblioteca já carregada nesta visita.
    if (valor === "recusado" && escolha === "aceito") location.reload();
  }

  if (!ativo) return null;
  return <>
    {escolha === "aceito" && preparado && <Script id="google-analytics" src={`https://www.googletagmanager.com/gtag/js?id=${ID_ANALYTICS}`} strategy="afterInteractive" />}
    <nav className="analytics-preferencias" aria-label="Privacidade">
      <Link href="/sobre#privacidade">Privacidade</Link>
      <button type="button" onClick={() => setPreferencias(true)}>Preferências de estatísticas</button>
    </nav>
    {(escolha === null || preferencias) && <aside className="analytics-aviso" aria-labelledby="analytics-titulo">
      <div><h2 id="analytics-titulo">Estatísticas de acesso</h2><p>Podemos usar cookies do Google Analytics para entender quais páginas são úteis? Você pode mudar sua escolha em Preferências de estatísticas. <Link href="/sobre#privacidade">Saiba mais</Link>.</p></div>
      <div className="analytics-acoes"><button type="button" onClick={() => escolher("recusado")}>Não permitir</button><button type="button" onClick={() => escolher("aceito")}>Permitir estatísticas</button></div>
    </aside>}
  </>;
}
