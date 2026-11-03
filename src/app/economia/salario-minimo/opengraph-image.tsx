import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { carregarSalarioMinimo } from "@/lib/salarioMinimo";
import { mesPorExtenso, reais } from "@/lib/formatar";

export const alt = "Salário mínimo nacional: valor e histórico do poder de compra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function ImagemSalario() {
  const [dados, fonte] = await Promise.all([
    carregarSalarioMinimo(), readFile(join(process.cwd(), "src/assets/Inter-Regular.ttf")),
  ]);
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, width: "100%", height: "100%", background: "#f9f9f7", color: "#0b0b0b", fontFamily: "Inter" }}>
      <div style={{ display: "flex", fontSize: 44 }}>Salário mínimo nacional</div>
      <div style={{ display: "flex", fontSize: 100 }}>{reais(dados.ultimo.nominal)}</div>
      <div style={{ display: "flex", fontSize: 30 }}>Último registro: {mesPorExtenso(dados.ultimo.mes)}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#52514e" }}>Histórico, reajustes e poder de compra · Desempenho do Governo</div>
    </div>,
    { ...size, fonts: [{ name: "Inter", data: fonte, weight: 400, style: "normal" }] },
  );
}
