import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { carregarInflacao } from "@/lib/inflacao";
import { mesPorExtenso, numero } from "@/lib/formatar";

export const alt = "IPCA: inflação acumulada em 12 meses e referência dos dados";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function ImagemInflacao() {
  const [dados, fonte] = await Promise.all([carregarInflacao(), readFile(join(process.cwd(), "src/assets/Inter-Regular.ttf"))]);
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, width: "100%", height: "100%", background: "#f9f9f7", color: "#0b0b0b", fontFamily: "Inter" }}>
      <div style={{ display: "flex", fontSize: 44 }}>Inflação (IPCA) em 12 meses</div>
      <div style={{ display: "flex", fontSize: 100 }}>{dados.ultimo.dozeMeses === null ? "Indisponível" : `${numero(dados.ultimo.dozeMeses)}%`}</div>
      <div style={{ display: "flex", fontSize: 30 }}>Referência: {mesPorExtenso(dados.ultimo.mes)}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#52514e" }}>Fonte: IBGE, via Banco Central · Desempenho do Governo</div>
    </div>, { ...size, fonts: [{ name: "Inter", data: fonte, weight: 400, style: "normal" }] },
  );
}
