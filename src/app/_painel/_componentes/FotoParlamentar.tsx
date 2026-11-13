"use client";

import { useState } from "react";
import Image from "next/image";

import { retratoParlamentar, miniaturaParlamentar } from "../_dados/fotoParlamentar";
import estilos from "./FotoParlamentar.module.css";

/**
 * Retrato oficial com as iniciais enquanto carrega ou se a casa não tiver foto.
 * Redondo nas listas; `altura` maior que `tamanho` vira o retrato do crachá, em pé.
 */
export function FotoParlamentar({ casa, id, nome, tamanho, altura = tamanho, prioridade = false }: {
  casa: "deputados" | "senadores";
  id: number;
  nome: string;
  tamanho: number;
  altura?: number;
  prioridade?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const src = Math.max(tamanho, altura) <= 56 ? miniaturaParlamentar(casa, id) : retratoParlamentar(casa, id);
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("");
  return <span className={estilos.retrato} data-forma={altura > tamanho ? "cracha" : "redondo"} data-carregando={!!src && !falhou && !carregou}
    style={{ width: tamanho, height: altura, fontSize: Math.min(tamanho, altura) * .34 }} aria-hidden="true">
    {src && !falhou
      ? <Image src={src} alt="" width={tamanho} height={altura} unoptimized loading={prioridade ? "eager" : "lazy"} fetchPriority={prioridade ? "high" : undefined} className="h-full w-full object-cover object-top" onLoad={() => setCarregou(true)} onError={() => setFalhou(true)} />
      : iniciais}
  </span>;
}
