"use client";

import { createContext, useContext, useEffect } from "react";

export const DefinirFrase = createContext<((frase: string | null) => void) | null>(null);

/**
 * O botão de compartilhar das páginas de indicador mora no layout, que não vê os dados.
 * A página, que vê, diz aqui a frase dele, escrita com os números dela.
 */
export function FraseDaPagina({ texto }: { texto: string }) {
  const definir = useContext(DefinirFrase);
  useEffect(() => {
    definir?.(texto);
    return () => definir?.(null);
  }, [definir, texto]);
  return null;
}
