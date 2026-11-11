"use client";

import { useEffect, useState } from "react";

/** Uma busca por endereço na sessão: trocar de ano e voltar não baixa o arquivo de novo. */
const pedidos = new Map<string, Promise<unknown>>();

function buscar<T>(url: string): Promise<T> {
  let pedido = pedidos.get(url);
  if (!pedido) {
    pedido = fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} em ${url}`);
      return r.json();
    });
    pedido.catch(() => pedidos.delete(url));
    pedidos.set(url, pedido);
  }
  return pedido as Promise<T>;
}

export function useJson<T>(url: string | null): { dados: T | null; erro: boolean; carregando: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; dados: T | null; erro: boolean }>({ url: null, dados: null, erro: false });
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    buscar<T>(url).then(dados => { if (vivo) setEstado({ url, dados, erro: false }); }, () => { if (vivo) setEstado({ url, dados: null, erro: true }); });
    return () => { vivo = false; };
  }, [url]);
  const atual = estado.url === url;
  return { dados: atual ? estado.dados : null, erro: atual && estado.erro, carregando: !!url && !atual };
}
