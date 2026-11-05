import "server-only";
import type { CSSProperties } from "react";

import type { Cartao, CartaoIndicador, CartaoPlacar } from "@/app/_painel/_componentes/capaRecorte";
import malha from "@/app/_painel/_dados/ufs.json";
import { respostaDaCapa, TINTA, TINTA_2 } from "@/components/ImagemCompartilhamento";
import { caminhoFoto } from "@/components/Retrato";
import { fotoCompartilhamento } from "@/lib/fonteCompartilhamento";
import { contaDoPlacar } from "@/lib/fraseCompartilhamento";
import type { Sentido } from "@/lib/formatar";

/**
 * O cartão de um recorte: o número do indicador ou o placar do mandato.
 *
 * As cores são as do placar: o bloco chapado, verde melhorou, vermelho piorou e cinza
 * sem veredito, com a mesma régua para todo governo. Em miniatura a imagem chega a
 * 400 px de largura, então o que importa é grande. O rosto identifica o governo: é neutro,
 * como no resto do site, e vale igual para todos.
 */

const FUNDO: Record<Sentido, string> = { bom: "#2e795b", ruim: "#a3473a", neutro: "#b3bec8" };
const TEXTO: Record<Sentido, string> = { bom: "#ffffff", ruim: "#ffffff", neutro: TINTA };
/** A linha do gráfico: sem veredito, o azul da marca; o cinza do bloco sumiria no fundo. */
const LINHA: Record<Sentido, string> = { bom: FUNDO.bom, ruim: FUNDO.ruim, neutro: "#285c84" };

const flex = (extra: CSSProperties): CSSProperties => ({ display: "flex", ...extra });
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

async function fotoDe(id: string | undefined): Promise<string | null> {
  const caminho = id ? caminhoFoto(id) : null;
  return caminho ? fotoCompartilhamento(caminho) : null;
}

function Foto({ src, tamanho }: { src: string; tamanho: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- A imagem é desenhada pelo gerador, não pelo navegador.
  return <img src={src} width={tamanho} height={tamanho} alt="" style={{ width: tamanho, height: tamanho, borderRadius: tamanho, objectFit: "cover", border: "3px solid #ffffff" }} />;
}

const LARGURA_LINHA = 444;
const ALTURA_LINHA = 208;

/** Uma série, sem legenda: o título diz qual é. A faixa é o mandato; o tracejado, o que ele recebeu. */
function Linha({ c }: { c: CartaoIndicador }) {
  const { valores, posse, referencia, inicio, fim } = c.linha;
  const pontos = valores.flatMap((v, i) => (v === null ? [] : [{ i, v }]));
  if (pontos.length < 2) return null;
  const todos = [...pontos.map((p) => p.v), ...(referencia === null ? [] : [referencia])];
  const menor = Math.min(...todos), maior = Math.max(...todos);
  const folga = (maior - menor || 1) * 0.1;
  const borda = 12;
  const x = (i: number) => borda + (i / Math.max(1, valores.length - 1)) * (LARGURA_LINHA - 2 * borda);
  const y = (v: number) => ALTURA_LINHA - borda - ((v - menor + folga) / (maior - menor + 2 * folga)) * (ALTURA_LINHA - 2 * borda);
  const caminho = (lista: typeof pontos) => lista.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const ultimo = pontos[pontos.length - 1];
  const antes = posse < 0 ? [] : pontos.filter((p) => p.i <= posse);
  const depois = posse < 0 ? pontos : pontos.filter((p) => p.i >= posse);
  const cor = LINHA[c.sentido];
  const naPosse = x(Math.max(posse, 0)) + 6;
  const cabePosse = posse >= 0 && naPosse > inicio.length * 10 + 14 && naPosse + 62 < LARGURA_LINHA - fim.length * 10;
  return (
    <div style={flex({ flexDirection: "column", width: LARGURA_LINHA, gap: 6 })}>
      <svg width={LARGURA_LINHA} height={ALTURA_LINHA} viewBox={`0 0 ${LARGURA_LINHA} ${ALTURA_LINHA}`}>
        {posse >= 0 && <rect x={x(posse)} y={0} width={LARGURA_LINHA - x(posse)} height={ALTURA_LINHA} rx={10} fill="#e4ebf1" />}
        {referencia !== null && <line x1={borda} x2={LARGURA_LINHA - borda} y1={y(referencia)} y2={y(referencia)} stroke="#8795a3" strokeWidth={2} strokeDasharray="7 7" />}
        {antes.length > 1 && <path d={caminho(antes)} fill="none" stroke="#8795a3" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />}
        {depois.length > 1 && <path d={caminho(depois)} fill="none" stroke={cor} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />}
        <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r={10} fill={cor} stroke="#f8fafd" strokeWidth={3} />
      </svg>
      <div style={flex({ position: "relative", height: 24, fontSize: 18, color: TINTA_2 })}>
        <div style={flex({})}>{inicio}</div>
        {cabePosse && <div style={flex({ position: "absolute", left: naPosse, fontWeight: 600 })}>posse</div>}
        <div style={flex({ marginLeft: "auto" })}>{fim}</div>
      </div>
    </div>
  );
}

function MapaDaUf({ codigo }: { codigo: string }) {
  return (
    <svg width="92" height="92" viewBox={`0 0 ${malha.largura} ${malha.altura}`}>
      {malha.ufs.map((u) => <path key={u.codigo} d={u.d} fill={codigo === u.codigo ? "#285c84" : "#c7d3dc"} stroke="#f8fafd" strokeWidth="4" />)}
    </svg>
  );
}

function Indicador({ c, foto }: { c: CartaoIndicador; foto: string | null }) {
  // Largura aproximada de cada dígito, nos tamanhos cheios: o par de números nunca quebra de linha.
  const k = Math.min(1, 610 / ((c.de ? c.de.length * 29 + 78 : 0) + c.para.length * 51 + 40));
  return (
    <div style={flex({ flex: 1, alignItems: "center", gap: 36 })}>
      <div style={flex({ flexDirection: "column", width: 624, gap: 14 })}>
        <div style={flex({ fontSize: c.nome.length > 34 ? 34 : c.nome.length > 22 ? 40 : 48, fontWeight: 600, letterSpacing: -1.2, lineHeight: 1.12 })}>{c.nome}</div>
        <div style={flex({ alignItems: "center", gap: 16 })}>
          {c.de && <div style={flex({ fontSize: 56 * k, letterSpacing: -1.4 * k, color: TINTA_2, whiteSpace: "nowrap" })}>{c.de}</div>}
          {c.de && <div style={flex({ fontSize: 46 * k, color: TINTA_2 })}>→</div>}
          <div style={flex({ padding: "4px 20px 8px", borderRadius: 16, background: FUNDO[c.sentido], color: TEXTO[c.sentido], fontSize: 86 * k, fontWeight: 600, letterSpacing: -2.4 * k, lineHeight: 1.08, whiteSpace: "nowrap" })}>{c.para}</div>
        </div>
        <div style={flex({ fontSize: 25, color: TINTA_2 })}>{c.legenda}</div>
        {(c.veredito || c.destaque) && (
          <div style={flex({ flexDirection: "column", gap: 4, fontSize: 25, lineHeight: 1.25 })}>
            {c.veredito && <div style={flex({ fontWeight: 600 })}>{c.veredito}</div>}
            {c.destaque && <div style={flex({})}>{c.destaque}</div>}
          </div>
        )}
      </div>
      <div style={flex({ flexDirection: "column", width: LARGURA_LINHA, gap: 12 })}>
        <div style={flex({ alignItems: "center", gap: 14, height: 92 })}>
          {c.uf ? <MapaDaUf codigo={c.uf.codigo} /> : foto && <Foto src={foto} tamanho={84} />}
          <div style={flex({ flexDirection: "column" })}>
            {c.uf && <div style={flex({ fontSize: 26, fontWeight: 600 })}>{c.uf.nome}</div>}
            {c.governo && <div style={flex({ fontSize: c.uf ? 21 : 26, fontWeight: c.uf ? 400 : 600, color: c.uf ? TINTA_2 : TINTA })}>{`Governo ${c.governo.nome}`}</div>}
            {c.governo && <div style={flex({ fontSize: 21, color: TINTA_2 })}>{c.governo.anos}</div>}
          </div>
        </div>
        <Linha c={c} />
      </div>
    </div>
  );
}

const LARGURA_BLOCO = 172;

function Placar({ c, foto }: { c: CartaoPlacar; foto: string | null }) {
  return (
    <div style={flex({ flex: 1, flexDirection: "column", justifyContent: "center", gap: 18 })}>
      <div style={flex({ alignItems: "center", gap: 18 })}>
        {foto && <Foto src={foto} tamanho={84} />}
        <div style={flex({ flexDirection: "column", gap: 2 })}>
          <div style={flex({ fontSize: 38, fontWeight: 600, letterSpacing: -1 })}>{`${c.tema} no governo ${c.governo.nome}`}</div>
          <div style={flex({ fontSize: 22, color: TINTA_2 })}>{`${c.governo.anos} · cada indicador hoje contra a posse`}</div>
        </div>
        <div style={flex({ flexDirection: "column", alignItems: "flex-end", marginLeft: "auto", fontSize: 25, fontWeight: 600, lineHeight: 1.3 })}>
          <div style={flex({ color: c.bons ? FUNDO.bom : TINTA_2 })}>{maiuscula(contaDoPlacar(c.bons, "melhorou", "melhoraram"))}</div>
          <div style={flex({ color: c.ruins ? FUNDO.ruim : TINTA_2 })}>{maiuscula(contaDoPlacar(c.ruins, "piorou", "pioraram"))}</div>
          {c.iguais > 0 && <div style={flex({ color: TINTA_2 })}>{contaDoPlacar(c.iguais, "ficou igual", "ficaram iguais")}</div>}
        </div>
      </div>
      <div style={flex({ flexWrap: "wrap", rowGap: 12, columnGap: 22 })}>
        {c.grupos.map((g) => (
          <div key={g.titulo} style={flex({ flexDirection: "column", gap: 5 })}>
            <div style={flex({ fontSize: 17, fontWeight: 600, color: TINTA_2 })}>{g.titulo}</div>
            <div style={flex({ gap: 5 })}>
              {g.itens.map((x) => (
                <div key={x.rotulo} style={flex({ flexDirection: "column", justifyContent: "center", width: LARGURA_BLOCO, height: 78, padding: "0 10px", borderRadius: 10, background: FUNDO[x.sentido], color: TEXTO[x.sentido] })}>
                  <div style={flex({ fontSize: 16 })}>{x.rotulo}</div>
                  <div style={flex({ fontSize: 28, fontWeight: 600, letterSpacing: -0.6 })}>{x.mudanca}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function imagemRecorte(c: Cartao) {
  const foto = await fotoDe(c.tipo === "indicador" && c.uf ? undefined : c.governo?.id);
  return c.tipo === "placar"
    ? respostaDaCapa(<Placar c={c} foto={foto} />, "Fontes oficiais de cada indicador no site")
    : respostaDaCapa(<Indicador c={c} foto={foto} />, `Fonte: ${c.fonte}`);
}
