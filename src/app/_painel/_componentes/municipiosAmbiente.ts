"use client";

import { useEffect, useState } from "react";

import { chaveDaArea, type MunicipiosAmbiente, type ValoresDasAreas } from "../_dados/ambienteMunicipal";
import type { FocoMandato, MunicipioNacional } from "../_dados/tipos";

/**
 * Os contornos dos 5.570 municípios (2 MB) e os números de cada um, baixados
 * quando a aba abre. Ficam guardados fora do componente: trocar de aba e voltar
 * não baixa de novo. Se falhar, a sala fica no mapa por estado, que já veio com
 * a página. Os números são de um mandato: cada um baixa uma vez, quando é escolhido.
 */

let cacheFormas: MunicipioNacional[] | null = null;
const cacheDados = new Map<string, MunicipiosAmbiente>();

export function useMunicipiosAmbiente(foco: FocoMandato) {
  const [formas, setFormas] = useState(cacheFormas);
  const chave = foco.emCurso ? "" : `?posse=${foco.posse}&ate=${foco.ate}`;
  // Só a versão que chega muda a tela; quem lê o cache é a próxima renderização.
  const [, setChegou] = useState(0);
  const dados = cacheDados.get(chave) ?? null;

  useEffect(() => {
    let vivo = true;
    if (!cacheFormas) {
      fetch("/painel/municipios-brasil.json")
        .then((r) => r.json())
        .then((malha: { municipios: MunicipioNacional[] }) => {
          cacheFormas = malha.municipios;
          if (vivo) setFormas(cacheFormas);
        })
        .catch(() => {});
    }
    if (!cacheDados.has(chave)) {
      fetch(`/api/painel/ambiente/municipios${chave}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: MunicipiosAmbiente) => {
          cacheDados.set(chave, d);
          if (vivo) setChegou((n) => n + 1);
        })
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, [chave]);

  return { formas, municipal: dados };
}

/** Uma Terra Indígena ou Unidade de Conservação no mapa. */
export interface AreaDesenhada {
  r: "ti" | "uc";
  b: string;
  n: string;
  d: string;
  chave: string;
}

let cacheAreas: AreaDesenhada[] | null = null;
let cacheValores: ValoresDasAreas | null = null;

/**
 * Os contornos das áreas protegidas (perto de 1 MB) e o desmatamento de cada uma.
 * Só baixam quando alguém pede para ver essas áreas no mapa: a maioria das visitas
 * não precisa deles.
 */
export function useAreasProtegidas(ligado: boolean) {
  const [areas, setAreas] = useState(cacheAreas);
  const [valores, setValores] = useState(cacheValores);

  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    if (!cacheAreas) {
      fetch("/painel/areas-protegidas.json")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { areas: Omit<AreaDesenhada, "chave">[] }) => {
          cacheAreas = j.areas.map((a) => ({ ...a, chave: chaveDaArea(a.r, a.b, a.n) }));
          if (vivo) setAreas(cacheAreas);
        })
        .catch(() => {});
    }
    if (!cacheValores) {
      fetch("/api/painel/ambiente/protegidas")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((v: ValoresDasAreas) => {
          cacheValores = v;
          if (vivo) setValores(v);
        })
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, [ligado]);

  return { areas, valores };
}
