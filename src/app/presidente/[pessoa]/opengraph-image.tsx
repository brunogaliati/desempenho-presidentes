import { fonteCompartilhamento } from "@/lib/fonteCompartilhamento";

import { ImageResponse } from "next/og";

import { carregarDados } from "@/lib/dados";
import { anualizado } from "@/lib/formatar";

/**
 * O card de cada pessoa, com o rosto e os números dela.
 *
 * A página da pessoa virou a unidade de compartilhamento do site, então o
 * preview genérico do site inteiro desperdiçaria a única impressão que muita
 * gente terá: boa parte lê o print sem abrir o link.
 */

export const alt = "Indicadores econômicos dos mandatos deste presidente";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

// Sem `generateImageMetadata`: ela serve para gerar VÁRIAS imagens na mesma
// rota e acrescenta um id ao caminho, o que dava 404. Aqui é uma imagem por
// pessoa, e o segmento dinâmico da rota já dá conta disso.

async function fontes() {
  const [regular, semibold] = await Promise.all([
    fonteCompartilhamento("Inter-Regular.ttf"),
    fonteCompartilhamento("Inter-SemiBold.ttf"),
  ]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: semibold, weight: 600 as const, style: "normal" as const },
  ];
}

export default async function Imagem({
  params,
}: {
  params: Promise<{ pessoa: string }>;
}) {
  const { pessoa } = await params;
  const [dados, fontesCarregadas] = await Promise.all([
    carregarDados(),
    fontes(),
  ]);

  const mandatos = dados.presidentes.filter((p) => p.pessoaId === pessoa);
  if (mandatos.length === 0) {
    return new ImageResponse(<div />, { ...size, fonts: fontesCarregadas });
  }

  const nome = mandatos[0].nome;
  const periodo = `${mandatos[0].inicio.slice(0, 4)}–${
    mandatos[mandatos.length - 1].fim.slice(0, 4)
  }`;

  const linhas = mandatos.map((m) => {
    const pega = (s: string) => m.indicadores.find((i) => i.serieId === s);
    const ipca = pega("ipca");
    const sm = pega("salario_minimo_real");
    return {
      rotulo: `${m.mandato}º mandato · ${m.inicio.slice(0, 4)}–${m.fim.slice(0, 4)}`,
      ipca: ipca?.variacaoAnualizada !== null && ipca ? anualizado(ipca) : "—",
      sm: sm?.variacaoAnualizada !== null && sm ? anualizado(sm) : "—",
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
          padding: "56px 72px",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: -1 }}>
            {nome}
          </div>
          <div style={{ fontSize: 23, color: "#52514e" }}>
            {`${mandatos.length} mandato${mandatos.length > 1 ? "s" : ""} · ${periodo} · medidos com a mesma régua de todos`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            paddingBottom: 10,
            borderBottom: "2px solid #e1e0d9",
            fontSize: 19,
            color: "#898781",
          }}
        >
          <div style={{ flex: 1 }} />
          <div style={{ width: 250, textAlign: "right" }}>Inflação</div>
          <div style={{ width: 250, textAlign: "right" }}>Salário mínimo real</div>
        </div>

        {linhas.map((l, i) => (
          <div
            key={l.rotulo}
            style={{
              display: "flex",
              alignItems: "baseline",
              padding: "18px 0",
              borderBottom:
                i === linhas.length - 1 ? "none" : "1px solid #e1e0d9",
            }}
          >
            <div style={{ flex: 1, fontSize: 25 }}>{l.rotulo}</div>
            <div style={{ width: 250, textAlign: "right", fontSize: 30, fontWeight: 600 }}>
              {l.ipca}
            </div>
            <div style={{ width: 250, textAlign: "right", fontSize: 30, fontWeight: 600 }}>
              {l.sm}
            </div>
          </div>
        ))}

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            paddingTop: 20,
            borderTop: "1px solid #e1e0d9",
            justifyContent: "space-between",
            fontSize: 19,
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
