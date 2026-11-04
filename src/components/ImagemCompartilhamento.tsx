import "server-only";
import { ImageResponse } from "next/og";
import { fonteCompartilhamento } from "@/lib/fonteCompartilhamento";
import malha from "@/app/_painel/_dados/ufs.json";

export const tamanhoCompartilhamento = { width: 1200, height: 630 };

/** Mesma marca, paisagem e paleta do painel; o mapa usa a malha real do IBGE. */
export async function imagemCompartilhamento({ titulo, valor, referencia, descricao, fonte, uf }: {
  titulo: string; valor?: string; referencia?: string; descricao?: string; fonte?: string; uf?: string;
}) {
  const [regular, semibold] = await Promise.all([
    fonteCompartilhamento("Inter-Regular.ttf"), fonteCompartilhamento("Inter-SemiBold.ttf"),
  ]);
  return new ImageResponse(<div style={{ display: "flex", position: "relative", width: "100%", height: "100%", flexDirection: "column", background: "#f8fafd", color: "#263746", fontFamily: "Inter", overflow: "hidden", padding: "38px 48px" }}>
    <svg width="1200" height="215" viewBox="0 0 1200 215" style={{ position: "absolute", top: 0, left: 0 }}>
      <path d="M0 0H1200V78C1020 190 855 6 670 72S250 154 0 42Z" fill="#d3e3d8" />
      <path d="M745 0H1200V180C1060 208 882 151 745 0Z" fill="#c8d8e6" />
    </svg>
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 76, padding: "12px 22px", border: "1px solid #ffffff", borderRadius: 26, background: "rgba(255,255,255,0.72)" }}>
      <svg width="54" height="46" viewBox="0 0 64 54"><rect width="64" height="54" rx="13" fill="#15934d" /><path d="M6 27 32 6 58 27 32 48Z" fill="#f3cb38" /><circle cx="32" cy="27" r="13" fill="#285c84" /><defs><clipPath id="marca-disco"><circle cx="32" cy="27" r="13" /></clipPath></defs><path clipPath="url(#marca-disco)" d="M20 23Q33 21 44 32" fill="none" stroke="#fff" strokeWidth="4" /></svg>
      <div style={{ display: "flex", fontSize: 29, fontWeight: 600, letterSpacing: -0.7 }}>Desempenho do Governo</div>
      <div style={{ display: "flex", marginLeft: "auto", color: "#46586a", fontSize: 17 }}>Dados públicos. Critérios claros.</div>
    </div>
    <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", width: 750, gap: 20, zIndex: 1 }}>
        <div style={{ display: "flex", fontSize: valor ? (titulo.length > 68 ? 37 : 44) : titulo.length > 65 ? 48 : 60, fontWeight: 600, lineHeight: 1.12, letterSpacing: -1.6, whiteSpace: "pre-wrap" }}>{titulo}</div>
        {valor && <div style={{ display: "flex", fontSize: valor.length > 15 ? 67 : 92, fontWeight: 600, lineHeight: 1, letterSpacing: -2, color: "#285c84" }}>{valor}</div>}
        {(referencia || descricao) && <div style={{ display: "flex", maxWidth: 710, fontSize: 25, lineHeight: 1.45, color: "#46586a" }}>{referencia || descricao}</div>}
      </div>
      <div style={{ display: "flex", position: "absolute", right: -4, top: 54, width: 300, height: 330 }}>
        <svg width="300" height="330" viewBox={`0 0 ${malha.largura} ${malha.altura}`}>
          {malha.ufs.map(u => <path key={u.codigo} d={u.d} fill={uf === u.codigo ? "#285c84" : "#b6cfc2"} stroke="#f8fafd" strokeWidth="4" />)}
        </svg>
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #d9e3e8", paddingTop: 18, color: "#46586a" }}>
      {fonte && <div style={{ display: "flex", fontSize: 17, maxWidth: 1100 }}>{fonte}</div>}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 19 }}>
        <div style={{ display: "flex", fontWeight: 600 }}>desempenhodogoverno.com.br</div>
        <div style={{ display: "flex" }}>Brasil · Estados · Municípios</div>
      </div>
    </div>
  </div>, { ...tamanhoCompartilhamento, fonts: [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
  ], headers: { "X-Robots-Tag": "noindex" } });
}
