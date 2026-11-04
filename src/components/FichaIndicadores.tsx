"use client";

import { useEstadoCompartilhavel } from "./RecortesCompartilhaveis";
import { Compartilhar } from "./Compartilhar";

import { GraficoTempo } from "@/components/GraficoTempo";
import { Minigrafico } from "@/components/Minigrafico";
import { anualizado, nivel, sentido } from "@/lib/formatar";
import { CATEGORIAS, seriesPorCategoria } from "@/lib/registroSeries";
import type { Presidente, Serie } from "@/types/dados";

/**
 * Os indicadores de um mandato, agrupados por assunto.
 *
 * Cada cartão traz o número comparável, o caminho percorrido, a silhueta do
 * período e um botão que abre o gráfico inteiro. A silhueta existe porque a
 * versão anterior era só número solto: "+3,09 pontos por ano" não distingue
 * uma subida em linha reta de um salto na pandemia.
 *
 * Onde não há dado, o espaço fica visivelmente vazio com a explicação. A
 * versão de 2024 deste projeto preenchia com zero, e a página afirmava
 * "variação de 0%" sobre governos que simplesmente não têm a medida.
 */

interface Props {
  presidente: Presidente;
  /**
   * Séries JÁ RECORTADAS neste mandato, indexadas por id.
   *
   * Recebe o recorte pronto, e não a base inteira, porque este é um componente
   * de cliente: passar o objeto completo de dados serializava as 14 séries com
   * ~3.400 pontos para dentro do bundle, uma vez por mandato. Na página do
   * Lula isso acontecia três vezes e a hidratação quebrava em silêncio, sem
   * erro no console — os botões simplesmente não respondiam.
   */
  series: Record<string, Serie>;
}

export function FichaIndicadores({ presidente, series }: Props) {
  const [aberto, setAberto] = useEstadoCompartilhavel<string | null>(`ficha.${presidente.id}`, null, v => v === null || presidente.indicadores.some(i => i.serieId === v));
  const porId = new Map(presidente.indicadores.map((i) => [i.serieId, i]));

  return (
    <div className="space-y-8">
      {/* `seriesDaCategoria` e não `series`: o nome do parâmetro seria
          sombreado aqui dentro, e `series[s.id]` passaria a buscar num array
          de metadados em vez do mapa de séries. */}
      {seriesPorCategoria().map(([categoria, seriesDaCategoria]) => {
        const comDado = seriesDaCategoria.filter((s) => porId.has(s.id));
        if (comDado.length === 0) return null;

        return (
          <section key={categoria}>
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--tinta-3)" }}
            >
              {CATEGORIAS[categoria]}
            </h3>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {comDado.map((s) => {
                const i = porId.get(s.id)!;
                const serie = series[s.id];
                const indisponivel =
                  i.cobertura === "indisponivel" || i.variacaoAnualizada === null;

                const sent =
                  s.semDirecao || indisponivel
                    ? "neutro"
                    : sentido(i.variacaoAnualizada, i.direcao);
                const cor =
                  sent === "bom"
                    ? "var(--bom)"
                    : sent === "ruim"
                      ? "var(--ruim)"
                      : "var(--tinta)";
                const estaAberto = aberto === s.id;

                return (
                  <li
                    key={s.id}
                    id={`indicador-${presidente.id}-${s.id}`}
                    className={`border-b px-1 py-4 ${estaAberto ? "sm:col-span-2" : ""}`}
                    style={{
                      borderColor: estaAberto ? "var(--serie)" : "var(--borda)",
                      background: "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{s.rotulo}</p><Compartilhar mensagem={`${s.rotulo} · ${presidente.nome} · ${presidente.inicio.slice(0,4)}–${presidente.fim.slice(0,4)}`} contexto="" ancora={`indicador-${presidente.id}-${s.id}`} filtros={{[`r.ficha.${presidente.id}`]:s.id}} compacto/></div>
                    <p className="text-xs" style={{ color: "var(--tinta-3)" }}>
                      {s.pergunta}
                    </p>

                    {indisponivel ? (
                      <p
                        className="mt-2 text-sm leading-snug"
                        style={{ color: "var(--tinta-3)" }}
                      >
                        Sem dado nesta metodologia.
                        {i.ressalva ? ` ${i.ressalva}` : ""}
                      </p>
                    ) : (
                      <>
                        <p
                          className="manchete mt-2 text-2xl font-bold leading-none"
                          style={{ color: cor }}
                        >
                          {/* Seta junto da cor: verde e vermelho não se
                              distinguem na forma mais comum de daltonismo. */}
                          {sent !== "neutro" && (
                            <span aria-hidden className="mr-1 text-lg">
                              {sent === "bom" ? "↑" : "↓"}
                            </span>
                          )}
                          {anualizado(i)}
                        </p>

                        <p
                          className="tabular mt-1.5 text-xs"
                          style={{ color: "var(--tinta-3)" }}
                        >
                          {/* `nivel` põe o símbolo no lugar certo da língua:
                              "R$ 1.468,10", não "1.468,1 R$". */}
                          {i.valorInicial !== null && i.valorFinal !== null ? (
                            <>
                              de {nivel(i.valorInicial, i.unidade, s.simbolo)}{" "}
                              para {nivel(i.valorFinal, i.unidade, s.simbolo)}
                            </>
                          ) : null}
                        </p>

                        {serie && !estaAberto && (
                          <Minigrafico
                            serie={serie}
                            cor={cor === "var(--tinta)" ? "var(--serie)" : cor}
                          />
                        )}

                        {serie && (
                          <button
                            onClick={() => setAberto(estaAberto ? null : s.id)}
                            aria-expanded={estaAberto}
                            className="mt-2 text-xs hover:underline"
                            style={{ color: "var(--serie)" }}
                          >
                            {estaAberto
                              ? "fechar gráfico"
                              : "ver o gráfico completo"}
                          </button>
                        )}

                        {estaAberto && serie && (
                          <div className="mt-3">
                            <GraficoTempo
                              serie={serie}
                              presidentes={[presidente]}
                              altura={260}
                            />
                            <p
                              className="mt-2 text-xs"
                              style={{ color: "var(--tinta-3)" }}
                            >
                              {s.pergunta} Fonte: {i.fonteNome}.
                            </p>
                          </div>
                        )}

                        {i.cobertura === "parcial" && (
                          <p
                            className="mt-1 text-xs leading-snug"
                            style={{ color: "var(--tinta-3)" }}
                          >
                            Dados parciais.{" "}
                            {i.fracaoMandatoCoberta !== null
                              ? `Cobrem ${Math.round(i.fracaoMandatoCoberta * 100)}% do mandato.`
                              : ""}
                          </p>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
