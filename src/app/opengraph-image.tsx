import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { carregarDados } from "@/lib/dados";
import { numero } from "@/lib/formatar";

/**
 * O card que aparece quando o link é colado no WhatsApp, no X ou no Telegram.
 *
 * Leva números reais dentro, não só o título: boa parte das pessoas lê o print
 * sem abrir o site, e um card genérico desperdiça a única impressão que teve.
 * Os valores vêm do mesmo banco da página, então nunca ficam defasados.
 */

export const alt =
  "Desempenho do Governo — indicadores econômicos por mandato presidencial";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Gerada sob demanda, não no build — uma imagem que só crawler busca não
 * precisa ocupar tempo de build, e o CDN guarda o resultado.
 */
export const dynamic = "force-dynamic";

/**
 * A fonte vai junto no repositório, em vez de deixar o `@vercel/og` resolver a
 * padrão sozinho.
 *
 * A resolução automática usa `fileURLToPath` num caminho que quebra no
 * Windows ("TypeError: Invalid URL"), derrubando tanto o build quanto o
 * runtime local. Carregar o arquivo explicitamente funciona igual em qualquer
 * sistema e ainda garante que o card saia com a mesma tipografia do site.
 */
async function fontes() {
  const dir = join(process.cwd(), "src", "assets");
  const [regular, semibold] = await Promise.all([
    readFile(join(dir, "Inter-Regular.ttf")),
    readFile(join(dir, "Inter-SemiBold.ttf")),
  ]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

export default async function Imagem() {
  const [dados, fontesCarregadas] = await Promise.all([carregarDados(), fontes()]);

  const destaques = [
    { serie: "ipca", rotulo: "Inflação", melhor: "menor" },
    { serie: "desemprego", rotulo: "Desemprego", melhor: "menor" },
    { serie: "salário mínimo real", id: "salario_minimo_real", rotulo: "Salário mínimo real", melhor: "maior" },
  ].map((d) => ({ ...d, serie: d.id ?? d.serie }));

  const lula3 = dados.presidentes.find((p) => p.id === "lula_3");
  const bolsonaro = dados.presidentes.find((p) => p.id === "bolsonaro");

  const pega = (p: typeof lula3, s: string) =>
    p?.indicadores.find((i) => i.serieId === s);

  const linhas = destaques.map((d) => {
    const ia = pega(lula3, d.serie);
    const ib = pega(bolsonaro, d.serie);
    return {
      rotulo: d.rotulo,
      // A unidade importa: "+4,80" de inflação e "−0,88" de desemprego não são
      // a mesma grandeza, e sem o rótulo o card compara coisas incomparáveis.
      unidade: ia?.unidadeAnualizada ?? ib?.unidadeAnualizada ?? "",
      melhor: d.melhor === "menor" ? "menor é melhor" : "maior é melhor",
      a: ia?.variacaoAnualizada ?? null,
      b: ib?.variacaoAnualizada ?? null,
    };
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#fcfcfb",
          color: "#0b0b0b",
          padding: "64px 72px",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
            Desempenho do Governo
          </div>
          <div style={{ fontSize: 24, color: "#52514e" }}>
            Nove mandatos desde o Plano Real, medidos com a mesma régua
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            paddingBottom: 12,
            borderBottom: "2px solid #e1e0d9",
            fontSize: 20,
            color: "#898781",
          }}
        >
          <div style={{ flex: 1 }} />
          <div style={{ width: 210, textAlign: "right" }}>Lula 3 · 2023–26</div>
          <div style={{ width: 210, textAlign: "right" }}>Bolsonaro · 2019–22</div>
        </div>

        {/* Os dois mandatos aparecem com o mesmo peso e a mesma cor. Dar a cor
            de destaque a um dos lados num card que circula em disputa
            eleitoral seria lido como favorecimento, por mais que a intenção
            fosse só marcar "mandato atual". */}
        {linhas.map((l, i) => (
          <div
            key={l.rotulo}
            style={{
              display: "flex",
              alignItems: "baseline",
              padding: "16px 0",
              // Sem régua na última linha: ela encostava no rodapé.
              borderBottom: i === linhas.length - 1 ? "none" : "1px solid #e1e0d9",
            }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 27 }}>{l.rotulo}</div>
              {/* Uma string só: o Satori trata cada trecho interpolado como um
                  filho separado e exige `display: flex` em div com mais de um. */}
              <div style={{ fontSize: 17, color: "#898781" }}>
                {`${l.unidade} · ${l.melhor}`}
              </div>
            </div>
            <div style={{ width: 210, textAlign: "right", fontSize: 34, fontWeight: 600 }}>
              {l.a === null ? "—" : `${l.a > 0 ? "+" : ""}${numero(l.a)}`}
            </div>
            <div style={{ width: 210, textAlign: "right", fontSize: 34, fontWeight: 600 }}>
              {l.b === null ? "—" : `${l.b > 0 ? "+" : ""}${numero(l.b)}`}
            </div>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: 24,
            borderTop: "1px solid #e1e0d9",
            justifyContent: "space-between",
            fontSize: 20,
            color: "#898781",
          }}
        >
          <div>desempenhodogoverno.com.br</div>
          <div>Fontes: Banco Central, IBGE e World Bank</div>
        </div>
      </div>
    ),
    { ...size, fonts: fontesCarregadas },
  );
}
