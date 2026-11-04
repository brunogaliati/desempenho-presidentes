"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { emendasMunicipioExemplo } from "../_dados/exemplos";
import type { AbaId, DadosPainel, FormaMunicipio, Municipio } from "../_dados/tipos";
import { reguaDeCor } from "./formatos";
import { Mapa, type CamadaMunicipal } from "./Mapa";
import { Feed, Ficha, PainelEsquerdo, PorRegiao } from "./Paineis";
import { Legenda, ReguaTempo } from "./Regua";

/**
 * O painel em formato de apuração: país à esquerda, mapa no centro com a régua
 * do tempo, regiões e atualizações à direita. Escolher um estado aproxima o
 * mapa até os municípios e troca a direita pela ficha.
 *
 * Serve às abas cujo assunto é distribuído pelo território e ainda não tem
 * página própria (Congresso e Dinheiro). Economia e Queimadas têm desenhos
 * próprios, feitos para o dado delas.
 */

interface Props {
  dados: DadosPainel;
  aba: "congresso" | "dinheiro";
  sigla: string | null;
  setSigla: (s: string | null) => void;
  aoTrocarAba: (a: AbaId) => void;
}

interface CacheMunicipal {
  formas: FormaMunicipio[];
  dados: Map<string, Municipio>;
}

export function PainelMapa({ dados, aba, sigla, setSigla, aoTrocarAba }: Props) {
  const [indiceLeitura, setIndiceLeitura] = useState(0);
  const leituras = dados.leituras[aba];
  const leitura = leituras[Math.min(indiceLeitura, leituras.length - 1)];
  const [periodo, setPeriodo] = useState(leitura.periodos.length - 1);
  const uf = dados.ufs.find((u) => u.sigla === sigla) ?? null;

  // Leitura nova começa no período mais recente: é o "hoje" de cada tema.
  useEffect(() => setPeriodo(leitura.periodos.length - 1), [leitura]);
  useEffect(() => setIndiceLeitura(0), [aba]);

  // --- Municípios: só quando o leitor entra num estado ------------------------

  const cache = useRef(new Map<string, CacheMunicipal>());
  const [municipal, setMunicipal] = useState<CacheMunicipal | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!uf) {
      setMunicipal(null);
      return;
    }
    const guardado = cache.current.get(uf.codigo);
    if (guardado) {
      setMunicipal(guardado);
      return;
    }
    let vivo = true;
    setMunicipal(null);
    setCarregando(true);
    Promise.all([
      fetch(`/painel/municipios/${uf.codigo}.json`).then((r) => r.json()),
      fetch(`/api/painel/municipios/${uf.codigo}`).then((r) => r.json()),
    ])
      .then(([formas, numeros]: [{ municipios: FormaMunicipio[] }, { municipios: Municipio[] }]) => {
        const valor: CacheMunicipal = {
          formas: formas.municipios,
          dados: new Map(numeros.municipios.map((m) => [m.codigo, m])),
        };
        cache.current.set(uf.codigo, valor);
        if (vivo) setMunicipal(valor);
      })
      .catch(() => {
        // Sem os municípios o estado continua navegável, só sem o detalhe.
      })
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [uf]);

  // --- Cores ------------------------------------------------------------------

  const regua = useMemo(
    () => reguaDeCor(Object.values(leitura.ufs).flat(), leitura.escala),
    [leitura],
  );

  /**
   * O que pinta os municípios. Votações só existem por estado; aí os municípios
   * herdam a cor da UF e servem para navegar.
   */
  const camadaMunicipal = useMemo<CamadaMunicipal | null>(() => {
    if (!municipal || aba !== "dinheiro") return null;
    const lista = [...municipal.dados.values()];
    const todos = lista.flatMap((m) =>
      leitura.periodos.map((_, i) => emendasMunicipioExemplo(m.codigo, m.populacao, i)),
    );
    return {
      titulo: `Emendas por habitante, até ${leitura.periodos[periodo].rotulo}`,
      exemplo: true,
      formato: "reais0",
      valor: (m) => emendasMunicipioExemplo(m.codigo, m.populacao, periodo),
      regua: reguaDeCor(todos, "log"),
    };
  }, [municipal, aba, leitura, periodo]);

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-var(--altura-cabecalho,4rem)-2.5rem)] lg:min-h-[620px] lg:grid-cols-[300px_minmax(0,1fr)_340px]">
      <aside className="order-3 min-h-0 lg:order-1 lg:overflow-y-auto lg:pr-1" aria-label="O país">
        <PainelEsquerdo dados={dados} aba={aba} leitura={leitura} periodo={periodo} />
      </aside>

      <main
        className="relative order-1 flex min-h-[72vh] flex-col overflow-hidden rounded-2xl border lg:order-2 lg:min-h-0"
        style={{ background: "var(--superficie)", borderColor: "var(--borda)" }}
      >
        <div className="absolute left-3 right-3 top-3 z-20 flex flex-wrap items-center gap-2">
          <nav
            className="flex items-center gap-1 rounded-full border px-3 py-1 text-sm"
            style={{ background: "var(--superficie)", borderColor: "var(--borda)" }}
            aria-label="Onde você está"
          >
            <button
              onClick={() => setSigla(null)}
              className={uf ? "hover:underline" : "font-semibold"}
              style={{ color: uf ? "var(--serie)" : "var(--tinta)" }}
            >
              Brasil
            </button>
            {uf && (
              <>
                <span style={{ color: "var(--tinta-3)" }}>›</span>
                <span className="font-semibold">{uf.nome}</span>
              </>
            )}
          </nav>
          {leituras.length > 1 && (
            <div className="flex gap-1" role="radiogroup" aria-label="Leitura do mapa">
              {leituras.map((l, i) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={l.id === leitura.id}
                  onClick={() => setIndiceLeitura(i)}
                  className="rounded-full px-3 py-1 text-sm"
                  style={{
                    background: l.id === leitura.id ? "var(--faixa-ativa)" : "transparent",
                    color: l.id === leitura.id ? "var(--tinta)" : "var(--tinta-2)",
                    fontWeight: l.id === leitura.id ? 600 : 400,
                  }}
                >
                  {l.titulo}
                </button>
              ))}
            </div>
          )}
          {uf && carregando && (
            <span className="text-xs" style={{ color: "var(--tinta-3)" }}>
              carregando municípios…
            </span>
          )}
          {/* Os valores de exemplo estão escritos dentro do mapa; um recorte
              de tela só do mapa precisa levar a marca junto. */}
          {(camadaMunicipal ? camadaMunicipal.exemplo : leitura.exemplo) && (
            <span
              className="ml-auto rounded-md border border-dashed px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ borderColor: "var(--tinta-3)", color: "var(--tinta-2)", background: "var(--superficie)" }}
              data-selo-exemplo
            >
              Mapa com dados de exemplo
            </span>
          )}
        </div>

        <div className="relative min-h-0 flex-1 px-2 pb-2 pt-14">
          <Mapa
            ufs={dados.ufs}
            largura={dados.mapa.largura}
            altura={dados.mapa.altura}
            leitura={leitura}
            periodo={periodo}
            regua={regua}
            selecionada={uf}
            aoSelecionar={setSigla}
            formasMunicipais={municipal?.formas ?? null}
            dadosMunicipais={municipal?.dados ?? null}
            camadaMunicipal={camadaMunicipal}
          />

          <div
            className="absolute bottom-3 left-3 z-20 max-w-[280px] rounded-xl border px-3 py-2"
            style={{ background: "var(--superficie)", borderColor: "var(--borda)" }}
          >
            {camadaMunicipal ? (
              <Legenda
                titulo={camadaMunicipal.titulo}
                exemplo={camadaMunicipal.exemplo}
                formato={camadaMunicipal.formato}
                escala="log"
                regua={camadaMunicipal.regua}
              />
            ) : (
              <Legenda
                titulo={leitura.titulo}
                exemplo={leitura.exemplo}
                formato={leitura.formato}
                escala={leitura.escala}
                regua={regua}
              />
            )}
            {uf && !camadaMunicipal && municipal && (
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
                Este dado só existe por estado; os municípios aparecem para navegação.
              </p>
            )}
          </div>
        </div>

        <div className="border-t px-3 py-2.5" style={{ borderColor: "var(--borda)" }}>
          {leitura.periodos.length > 1 ? (
            <ReguaTempo leitura={leitura} periodo={periodo} setPeriodo={setPeriodo} />
          ) : (
            <p className="py-1.5 text-xs" style={{ color: "var(--tinta-3)" }}>
              {leitura.descricao}
            </p>
          )}
        </div>
      </main>

      <aside className="order-2 min-h-0 space-y-3 lg:order-3 lg:overflow-y-auto lg:pr-1" aria-label="Detalhe">
        {uf ? (
          <>
            <Ficha
              dados={dados}
              uf={uf}
              aba={aba}
              periodo={periodo}
              leitura={leitura}
              municipios={municipal ? [...municipal.dados.values()] : null}
              aoSelecionar={setSigla}
              aoTrocarAba={aoTrocarAba}
            />
            <Feed itens={dados.feed.filter((f) => f.uf === uf.sigla)} aba={aba} titulo={`Atualizações ${uf.deNome}`} />
          </>
        ) : (
          <>
            <PorRegiao dados={dados} leitura={leitura} periodo={periodo} />
            <Feed itens={dados.feed} aba={aba} />
          </>
        )}
      </aside>
    </div>
  );
}
