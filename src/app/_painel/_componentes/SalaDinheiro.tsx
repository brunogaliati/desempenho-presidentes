"use client";
import { Compartilhar } from "@/components/Compartilhar";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  arranjarTreemap,
  baseDoAno,
  COLUNAS_REGUA,
  conteudoDoBloco,
  deCem,
  ITENS,
  LIMIAR_DOBRA,
  LIMIAR_DOBRA_CELULAR,
  itemDe,
  NOME_FAMILIA,
  nomeDoItem,
  numero,
  ORDEM_FAMILIAS,
  reais,
  reguaDosEstados,
  sinal,
  variacaoReal,
  type BaseDeComparacao,
  type BlocoTreemap,
  type EnteDinheiro,
  type FamiliaId,
  type GrupoDeAnos,
  type PainelDinheiro,
  type PontoDinheiro,
} from "../_dados/dinheiroModelo";
import type { Governos } from "../_dados/tipos";
import { ROTULO } from "./Bloco";
import { governoEm } from "./governos";

/** O valor com o "R$" menor e separado do número. */
export function Moeda({ texto }: { texto: string }) {
  return (
    <>
      <span className="dn-rs">R$</span>
      {texto.replace(/^R\$\s/, "")}
    </>
  );
}

const rotuloDoAno = (painel: PainelDinheiro, ano: number) => (painel.parcial?.ano === ano ? `${ano} até ${painel.parcial.mes}` : String(ano));

function nomeDoEnte(painel: PainelDinheiro, sigla: string | null): EnteDinheiro {
  return painel.entes[sigla ?? "BR"];
}

interface PropsSala {
  painel: PainelDinheiro;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  ano: number;
  grupos: GrupoDeAnos[];
  escolherAno: (a: number) => void;
  selecionado: string | null;
  setSelecionado: (id: string | null) => void;
  zoom: FamiliaId | null;
  setZoom: (f: FamiliaId | null) => void;
  governos: Governos;
}

export function SalaDinheiro(props: PropsSala) {
  const { painel, sigla, ano, grupos, selecionado, setSelecionado, zoom, setZoom } = props;
  const ente = nomeDoEnte(painel, sigla);
  const ponto = ente.anos[String(ano)];
  const base = useMemo(() => baseDoAno(painel, ano, grupos), [painel, ano, grupos]);
  const mapa = useRef<HTMLDivElement>(null);
  // Item que não existe neste estado ou ano não fica aberto na barra.
  const aberto = selecionado && ponto && (ponto.v[selecionado] ?? 0) > 0 ? selecionado : null;

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelecionado(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, setSelecionado]);

  const destacar = (f: FamiliaId | null) => {
    if (!mapa.current) return;
    if (f) mapa.current.dataset.foco = f;
    else delete mapa.current.dataset.foco;
  };

  // Valor irrisório não merece aviso: o bloco sai da conta do mesmo jeito.
  const temFora = Boolean(ponto?.fora && ponto.fora / ponto.t >= 0.002);
  const legenda = (() => {
    if (!ponto) return null;
    if (zoom) {
      const v = ITENS.filter((i) => i.familia === zoom).reduce((s, i) => s + (ponto.v[i.id] ?? 0), 0);
      return (
        <>
          <button type="button" className="dn-voltar" onClick={() => setZoom(null)}>‹ Todo o orçamento</button>
          <h2>{NOME_FAMILIA[zoom]}</h2>
          <span>R$ {deCem(v, ponto.t)} de cada R$ 100 · {reais(v)}</span>
        </>
      );
    }
    return (
      <>
        <h2>De cada R$ 100</h2>
        <span>{sigla ? `do governo de ${ente.nome}` : "da União"}, {rotuloDoAno(painel, ano)}. {temFora ? "Sem as transferências." : "Sem a rolagem da dívida."}</span>
      </>
    );
  })();

  return (
    <section id="orcamento" className="dn-sala" data-aberta={aberto ? "" : undefined} aria-label="De cada R$ 100">
      <h1 className="titulo-painel dn-titulo">Dinheiro público</h1>
      <ColunaDinheiro {...props} ente={ente} ponto={ponto} base={base} aoAbrir={(id) => {
        setSelecionado(id);
        const f = itemDe(id)?.familia;
        if (ponto && (ponto.v[id] ?? 0) / ponto.t < 0.009 && f) setZoom(f);
      }} />
      <div className="dn-meio">
        <div className="dn-legenda-palco">{legenda}</div>
        <TreemapOrcamento
          ref_={mapa}
          ponto={ponto}
          sigla={sigla}
          zoom={zoom}
          selecionado={aberto}
          aberta={Boolean(aberto)}
          painel={painel}
          ente={ente}
          ano={ano}
          base={base}
          aoTocar={(b) => {
            if (b.dobra) {
              setZoom(b.familia);
              setSelecionado(null);
            } else setSelecionado(aberto === b.id ? null : b.id);
          }}
          semDado={`${ente.nome} ainda não publicou ${rotuloDoAno(painel, ano)}.`}
        />
        <TrilhoAnos painel={painel} grupos={grupos} ano={ano} ente={ente} escolherAno={props.escolherAno} />
      </div>
      <aside className="dn-barra vidro" aria-label={aberto ? "Detalhe do bloco" : "Famílias de gasto"}>
        {aberto && ponto ? (
          <DetalheItem key={aberto} {...props} id={aberto} ente={ente} ponto={ponto} base={base} aoFechar={() => setSelecionado(null)} />
        ) : (
          <Familias ponto={ponto} zoom={zoom} setZoom={setZoom} destacar={destacar} />
        )}
      </aside>
      <BalaoDinheiro />
    </section>
  );
}

/** Um balão só para a aba: lê `data-balao` de quem está sob o ponteiro, sem redesenhar o treemap. */
function BalaoDinheiro() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const some = () => el.classList.remove("dn-balao-ve");
    const mover = (ev: PointerEvent) => {
      const alvo = (ev.target as Element | null)?.closest?.("[data-balao]");
      const texto = alvo?.getAttribute("data-balao");
      if (!texto) return some();
      el.textContent = texto;
      el.classList.add("dn-balao-ve");
      const r = el.getBoundingClientRect();
      let x = ev.clientX + 14;
      let y = ev.clientY + 16;
      if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 12;
      if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 12;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    document.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerdown", some);
    window.addEventListener("scroll", some, { passive: true });
    window.addEventListener("blur", some);
    document.documentElement.addEventListener("pointerleave", some);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerdown", some);
      window.removeEventListener("scroll", some);
      window.removeEventListener("blur", some);
      document.documentElement.removeEventListener("pointerleave", some);
    };
  }, []);
  return <div ref={ref} className="dn-balao" aria-hidden />;
}

// --- Coluna da esquerda ---------------------------------------------------------

function Faisca({ painel, ente, ano }: { painel: PainelDinheiro; ente: EnteDinheiro; ano: number }) {
  const anos = painel.anos.filter((a) => a !== painel.parcial?.ano && ente.anos[String(a)]);
  if (anos.length < 2) return <div className="dn-faisca" />;
  const vs = anos.map((a) => ente.anos[String(a)].t * (painel.idx[String(a)] ?? 1));
  const max = Math.max(...vs);
  const min = Math.min(...vs);
  const X = (i: number) => 2 + (i * 76) / (anos.length - 1);
  const Y = (v: number) => 30 - ((v - min) / (max - min || 1)) * 26;
  const i = anos.indexOf(ano);
  return (
    <svg className="dn-faisca" viewBox="0 0 80 34" preserveAspectRatio="none" aria-hidden>
      <polyline points={vs.map((v, k) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--tinta-3)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {i >= 0 && <circle cx={X(i)} cy={Y(vs[i])} r="2.6" fill="var(--ouro)" />}
    </svg>
  );
}

function ColunaDinheiro({
  painel,
  sigla,
  setSigla,
  ano,
  governos,
  ente,
  ponto,
  base,
  aoAbrir,
}: PropsSala & { ente: EnteDinheiro; ponto: PontoDinheiro | undefined; base: BaseDeComparacao | null; aoAbrir: (id: string) => void }) {
  const opcoes = Object.entries(painel.entes)
    .filter(([k]) => k !== "BR")
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "pt"));
  const vt = variacaoReal(painel, ente, ano, base, "_total");
  // Nos estados, trocas de classificação contábil criam saltos que não são gasto novo.
  const linhas = ponto && !sigla
    ? ITENS.flatMap((i) => {
        const x = variacaoReal(painel, ente, ano, base, i.id);
        const s = (ponto.v[i.id] ?? 0) / ponto.t;
        return x === null || s < 0.01 ? [] : [{ id: i.id, familia: i.familia, x }];
      }).sort((a, b) => b.x - a.x)
    : [];
  const mudou = linhas.length > 4 ? [...linhas.slice(0, 2), ...linhas.slice(-2).reverse()] : linhas;
  const gov = sigla ? governoEm(governos, sigla, `${ano}-07-01`) : null;
  return (
    <div className="dn-coluna">
      <div className="mb-3 flex justify-end"><Compartilhar mensagem={"Orçamento de "+ente.nome+" · "+ano} contexto="" ancora="orcamento" compacto/></div>
      <label className={ROTULO} htmlFor="dn-ente" style={{ color: "var(--tinta-3)" }}>Quem gasta</label>
      <span className="dn-seletor-ente">
        <select id="dn-ente" value={sigla ?? "BR"} onChange={(e) => setSigla(e.target.value === "BR" ? null : e.target.value)}>
          <option value="BR">União</option>
          <optgroup label="Governos estaduais">
            {opcoes.map(([k, e]) => <option key={k} value={k}>{e.nome}</option>)}
          </optgroup>
        </select>
      </span>
      <div className="dn-quem">{sigla ? (gov ? `${gov.nome}${gov.partido ? ` · ${gov.partido}` : ""}` : "Governo estadual") : "Governo federal"}</div>
      <div className="dn-total">{ponto ? <strong><Moeda texto={reais(ponto.t)} /></strong> : <strong>—</strong>}</div>
      <div className="dn-periodo">{rotuloDoAno(painel, ano)} · valor liquidado</div>
      <div className="dn-apoio">
        <span className="dn-pilula">{vt !== null ? sinal(vt) : "—"}</span>
        <span>{vt !== null && base ? `contra ${base.texto}, sem a inflação` : "sem ano anterior para comparar"}</span>
      </div>
      <div className="dn-apoio dn-apoio-2">{ponto?.p ? `R$ ${numero(ponto.t / ponto.p)} por habitante` : "População indisponível"}</div>
      <Faisca painel={painel} ente={ente} ano={ano} />
      {ponto?.fora && ponto.fora / ponto.t >= 0.002 ? (
        <p className="dn-nota" data-balao="Em 2025, só Acre, Amazonas e São Paulo lançaram nesta linha o repasse legal a municípios. Fora da conta, os estados se comparam melhor.">
          Fora da conta: {reais(ponto.fora)} em transferências.
        </p>
      ) : null}
      <div className="dn-mudou">
        {!sigla && <div className={ROTULO} style={{ color: "var(--tinta-3)" }}>O que mais mudou{base ? ` desde ${base.ano}` : ""}</div>}
        {sigla ? (
          <p className="dn-nota">Nos estados, a mudança por linha fica só na tabela abaixo: trocas de classificação contábil criam saltos que não são gasto novo.</p>
        ) : mudou.length ? (
          <>
            <ul>
              {mudou.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => aoAbrir(r.id)}>
                    <span className={`dn-q dn-f-${r.familia}`} />
                    <span className="dn-nome">{nomeDoItem(r.id)}</span>
                    <span className="dn-valor">{sinal(r.x)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="dn-nota">Sem a inflação. Só linhas com mais de R$ 1 de cada R$ 100.</p>
          </>
        ) : (
          <p className="dn-nota">{base ? "Sem dado para comparar." : "A série começa aqui: não há governo anterior na base."}</p>
        )}
      </div>
    </div>
  );
}

// --- Treemap --------------------------------------------------------------------

function TreemapOrcamento({
  ref_,
  ponto,
  sigla,
  zoom,
  selecionado,
  aberta,
  painel,
  ente,
  ano,
  base,
  aoTocar,
  semDado,
}: {
  ref_: React.RefObject<HTMLDivElement | null>;
  ponto: PontoDinheiro | undefined;
  sigla: string | null;
  zoom: FamiliaId | null;
  selecionado: string | null;
  aberta: boolean;
  painel: PainelDinheiro;
  ente: EnteDinheiro;
  ano: number;
  base: BaseDeComparacao | null;
  aoTocar: (b: BlocoTreemap) => void;
  semDado: string;
}) {
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref_.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setArea((a) => (a && a.w === r.width && a.h === r.height ? a : { w: r.width, h: r.height }));
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [ref_, aberta]);

  // Calcula com a barra fechada: ao abrir, os blocos só estreitam em vez de mudar de lugar.
  const blocos = useMemo(() => {
    if (!area || !ponto) return [];
    const largo = window.innerWidth > 980;
    return arranjarTreemap(ponto, area, zoom, area.w + (aberta && largo ? 104 : 0), area.w < 520 ? LIMIAR_DOBRA_CELULAR : LIMIAR_DOBRA);
  }, [area, ponto, zoom, aberta]);

  return (
    <div ref={ref_} className="dn-mapa" role="group" aria-label="Orçamento dividido em blocos proporcionais">
      {!ponto && <p className="dn-sem-dado">{semDado}</p>}
      {ponto && blocos.map((b) => {
        const nome = b.dobra ? `Mais ${b.dobra} áreas` : nomeDoItem(b.id);
        const valor = `R$ ${deCem(b.v, ponto.t)}`;
        const c = conteudoDoBloco(b, nome, valor);
        const x = b.dobra || sigla ? null : variacaoReal(painel, ente, ano, base, b.id);
        const balao = [
          nome,
          `${valor} de cada R$ 100 · ${reais(b.v)}`,
          b.dobra ? "Toque para abrir" : ponto.p ? `R$ ${numero(b.v / ponto.p)} por habitante` : null,
          x !== null && base ? `${sinal(x)} contra ${base.texto}, sem a inflação` : null,
        ].filter(Boolean).join("\n");
        return (
          <button
            key={b.id}
            type="button"
            className={`dn-bloco dn-f-${b.familia}`}
            data-familia={b.familia}
            data-mini={b.w < 26 || b.h < 22 ? "" : undefined}
            data-estreito={c.tipo === "vertical" ? "" : undefined}
            data-compacto={c.tipo === "compacto" ? "" : undefined}
            data-balao={balao}
            aria-label={balao.replace(/\n/g, ". ")}
            aria-pressed={selecionado === b.id}
            style={{ left: b.x, top: b.y, width: b.w, height: b.h }}
            onClick={() => aoTocar(b)}
          >
            {c.tipo === "vertical" && <span className="dn-vert">{c.texto}</span>}
            {c.tipo === "compacto" && <span className="dn-nome" style={{ fontSize: c.tamNome }}>{nome}</span>}
            {c.tipo === "cheio" && (
              <>
                <span className="dn-nome" style={{ fontSize: c.tamNome }}>{nome}</span>
                {c.valor && <span className="dn-valor" style={{ fontSize: c.tamValor }}><Moeda texto={valor} /></span>}
                {c.absoluto && <span className="dn-absoluto">{reais(b.v)}</span>}
                {c.abrir && <span className="dn-abrir">Abrir ›</span>}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TrilhoAnos({ painel, grupos, ano, ente, escolherAno }: { painel: PainelDinheiro; grupos: GrupoDeAnos[]; ano: number; ente: EnteDinheiro; escolherAno: (a: number) => void }) {
  return (
    <div className="dn-trilho">
      {grupos.map((g) => (
        <div key={g.id} className="dn-gov" style={{ flex: g.anos.length }}>
          <span title={g.rotulo}>{g.rotulo}</span>
          <div>
            {g.anos.map((a) => (
              <button
                key={a}
                type="button"
                className="dn-ano"
                aria-pressed={a === ano}
                disabled={!ente.anos[String(a)]}
                title={rotuloDoAno(painel, a)}
                onClick={() => escolherAno(a)}
              >
                {a === painel.parcial?.ano ? `${a}*` : a}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Barra de vidro -------------------------------------------------------------

function Familias({ ponto, zoom, setZoom, destacar }: { ponto: PontoDinheiro | undefined; zoom: FamiliaId | null; setZoom: (f: FamiliaId | null) => void; destacar: (f: FamiliaId | null) => void }) {
  return (
    <div>
      <h3 className="dn-barra-titulo">De cada R$ 100</h3>
      {ponto ? (
        <ul className="dn-familias">
          {ORDEM_FAMILIAS.map((f) => {
            const v = ITENS.filter((i) => i.familia === f).reduce((s, i) => s + (ponto.v[i.id] ?? 0), 0);
            if (!(v > 0)) return null;
            return (
              <li key={f}>
                <button
                  type="button"
                  aria-pressed={zoom === f}
                  onPointerEnter={() => destacar(f)}
                  onPointerLeave={() => destacar(null)}
                  onClick={() => {
                    destacar(null);
                    setZoom(zoom === f ? null : f);
                  }}
                >
                  <span className={`dn-q dn-f-${f}`} />
                  <span className="dn-nome">{NOME_FAMILIA[f]}</span>
                  <span className="dn-valor"><Moeda texto={`R$ ${deCem(v, ponto.t)}`} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="dn-nota">Sem dado neste ano.</p>
      )}
      <p className="dn-nota">Toque em um bloco para ver a história dele e os 27 estados.</p>
    </div>
  );
}

function GraficoItem({ painel, ente, id, ano, grupos, escolherAno }: { painel: PainelDinheiro; ente: EnteDinheiro; id: string; ano: number; grupos: GrupoDeAnos[]; escolherAno: (a: number) => void }) {
  const anos = painel.anos.filter((a) => a !== painel.parcial?.ano && ente.anos[String(a)]);
  if (anos.length < 2) return <p className="dn-nota">Poucos anos para desenhar a linha.</p>;
  const vs = anos.map((a) => {
    const p = ente.anos[String(a)];
    return { a, v: (p.v[id] ?? 0) * (painel.idx[String(a)] ?? 1), nominal: p.v[id] ?? 0, t: p.t };
  });
  const W = 320;
  const H = 100;
  const E = 2;
  const D = W - 2;
  const T = 26;
  const B = H - 16;
  const max = Math.max(1, ...vs.map((x) => x.v)) * 1.08;
  const passo = (D - E) / (anos.length - 1);
  const X = (a: number) => E + (a - anos[0]) * passo;
  const Y = (v: number) => B - (v / max) * (B - T);
  const pts = vs.map((x) => `${X(x.a).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ");
  const ultimo = vs[vs.length - 1];
  const ativo = vs.find((x) => x.a === ano);
  return (
    <svg className="dn-grafico" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nomeDoItem(id)} por ano, descontada a inflação`}>
      {grupos.map((g, i) => {
        const de = Math.max(E, X(g.anos[0]) - (g.anos[0] > anos[0] ? passo / 2 : 0));
        const ate = Math.min(D, X(Math.min(g.anos[g.anos.length - 1], anos[anos.length - 1])) + passo / 2);
        if (ate <= de) return null;
        return (
          <g key={g.id}>
            {i % 2 === 1 && <rect x={de} y={0} width={ate - de} height={B} fill="var(--faixa-a)" />}
            {ate - de > 38 && <text x={(de + ate) / 2} y={11} textAnchor="middle" className="dn-texto-grafico">{g.rotulo.length > 12 ? g.rotulo.split(" ")[0] : g.rotulo}</text>}
          </g>
        );
      })}
      <line x1={E} x2={D} y1={B} y2={B} stroke="var(--eixo)" />
      <polygon points={`${E},${B} ${pts} ${X(ultimo.a)},${B}`} fill="var(--f-l)" opacity=".13" />
      <polyline points={pts} fill="none" stroke="var(--f-l)" strokeWidth="2" strokeLinejoin="round" />
      <text x={X(vs[0].a)} y={H - 3} className="dn-texto-grafico">{vs[0].a}</text>
      <text x={X(ultimo.a)} y={H - 3} textAnchor="end" className="dn-texto-grafico">{ultimo.a}</text>
      <text x={X(ultimo.a) - 2} y={Math.max(23, Y(ultimo.v) - 5)} textAnchor="end" className="dn-texto-grafico dn-texto-forte">{reais(ultimo.v)}</text>
      {ativo && <circle cx={X(ativo.a)} cy={Y(ativo.v)} r="4.5" fill="var(--ouro)" stroke="var(--superficie)" strokeWidth="1.5" />}
      {vs.map((x) => (
        <rect
          key={x.a}
          x={X(x.a) - passo / 2}
          y={0}
          width={passo}
          height={H}
          fill="transparent"
          className="dn-alvo-grafico"
          data-balao={`${x.a}: ${reais(x.v)} em R$ de ${painel.baseReal}\n${reais(x.nominal)} na época · R$ ${deCem(x.nominal, x.t)} de cada R$ 100\nToque para levar ${x.a} ao topo`}
          onClick={() => escolherAno(x.a)}
        />
      ))}
    </svg>
  );
}

function ReguaEstados({ painel, sigla, setSigla, id, ano }: { painel: PainelDinheiro; sigla: string | null; setSigla: (s: string | null) => void; id: string; ano: number }) {
  const regua = useMemo(() => reguaDosEstados(painel.entes, id, ano), [painel.entes, id, ano]);
  if (id === "transf") return <p className="dn-nota">A comparação não vale aqui: os estados não lançam esse repasse do mesmo jeito.</p>;
  if (!regua) {
    return <p className="dn-nota">{id === "defesa" || id === "exteriores" || id === "bancocentral" ? "Os estados não têm essa função." : "Poucos estados registram essa linha."}</p>;
  }
  return (
    <>
      <div className="dn-regua" style={{ height: regua.linhas * 18 }}>
        {regua.pontos.map((p) => (
          <button
            key={p.sigla}
            type="button"
            className="dn-chip"
            aria-pressed={sigla === p.sigla}
            aria-label={`${p.nome}: R$ ${numero(p.porHabitante)} por habitante`}
            data-balao={`${p.nome}: R$ ${numero(p.porHabitante)} por habitante\nR$ ${numero(p.deCadaCem, 2)} de cada R$ 100 do estado\nToque para ver o orçamento do estado`}
            style={{ left: `calc((100% - 29px) * ${p.coluna / (COLUNAS_REGUA - 1)})`, bottom: p.linha * 18 }}
            onClick={() => setSigla(sigla === p.sigla ? null : p.sigla)}
          >
            {p.sigla}
          </button>
        ))}
      </div>
      <div className="dn-regua-pontas">
        <span>R$ {numero(regua.min)}</span>
        <span>R$ {numero(regua.max)}</span>
      </div>
      <p className="dn-nota">Só o governo estadual; as prefeituras ficam de fora.</p>
    </>
  );
}

function DetalheItem({
  painel,
  sigla,
  setSigla,
  ano,
  grupos,
  escolherAno,
  id,
  ente,
  ponto,
  base,
  aoFechar,
}: PropsSala & { id: string; ente: EnteDinheiro; ponto: PontoDinheiro; base: BaseDeComparacao | null; aoFechar: () => void }) {
  const item = itemDe(id);
  if (!item) return null;
  const v = ponto.v[id] ?? 0;
  const x = sigla ? null : variacaoReal(painel, ente, ano, base, id);
  const uniao = sigla ? painel.entes.BR?.anos[String(ano)] : null;
  const abre = ente.abre?.[String(ano)]?.[id];
  return (
    <div id="orcamento-detalhe" className={`dn-detalhe dn-f-${item.familia}`}>
      <div className="dn-detalhe-topo">
        <div>
          <h3 className="dn-detalhe-nome">{nomeDoItem(id)}</h3>
          <div className="dn-detalhe-familia"><i className={`dn-q dn-f-${item.familia}`} />{NOME_FAMILIA[item.familia]}</div>
        </div>
        <Compartilhar mensagem={`${nomeDoItem(id)} · ${ente.nome} · ${ano}`} contexto="" ancora="orcamento-detalhe" compacto/>
        <button type="button" className="dn-fechar" aria-label="Fechar detalhe" onClick={aoFechar}>×</button>
      </div>
      <div className="dn-detalhe-numero">
        <strong><Moeda texto={`R$ ${deCem(v, ponto.t)}`} /></strong>
        <span>de cada R$ 100{uniao ? ` · na União: R$ ${deCem(uniao.v[id] ?? 0, uniao.t)}` : ""}</span>
      </div>
      <div className="dn-detalhe-apoio">
        <span>{reais(v)}</span>
        {ponto.p ? <span>R$ {numero(v / ponto.p)} por habitante</span> : null}
        {x !== null && base && (
          <>
            <span className="dn-pilula">{sinal(x)}</span>
            <span>contra {base.texto}</span>
          </>
        )}
      </div>
      {id === "transf" && <p className="dn-nota">Sobretudo a estados e municípios: FPM, FPE e royalties do petróleo são a maior parte.</p>}
      {id === "bancocentral" && <p className="dn-nota">O Tesouro cobre o resultado negativo apurado pelo Banco Central. No Anexo 01, esse valor aparece como juros e amortização.</p>}
      <div className="dn-secao">
        <div className="dn-secao-titulo">Ano a ano<span>sem a inflação, R$ de {painel.baseReal}</span></div>
        <GraficoItem painel={painel} ente={ente} id={id} ano={ano} grupos={grupos} escolherAno={escolherAno} />
        {ano === painel.parcial?.ano && <p className="dn-nota">*{ano} vai até {painel.parcial.mes}: fora da linha até o ano fechar.</p>}
      </div>
      <div className="dn-secao">
        <div className="dn-secao-titulo">Os 27 estados<span>R$ por habitante, {rotuloDoAno(painel, ano)}</span></div>
        <ReguaEstados painel={painel} sigla={sigla} setSigla={setSigla} id={id} ano={ano} />
      </div>
      {abre && abre.length > 0 ? (
        <div className="dn-secao">
          <div className="dn-secao-titulo">O que tem dentro</div>
          <ul className="dn-abre">
            {abre.slice(0, 3).map(([n, q]) => (
              <li key={n} data-balao={n}>
                <div><span className="dn-abre-nome">{n}</span><b>{reais(q)}</b></div>
                <div className="dn-traco"><i style={{ width: `${((100 * q) / abre[0][1]).toFixed(1)}%` }} /></div>
              </li>
            ))}
          </ul>
        </div>
      ) : id === "outros" ? (
        <div className="dn-secao">
          <p className="dn-nota">
            {sigla
              ? "Este anexo do Tesouro não abre esta linha."
              : "Este anexo do Tesouro não abre esta linha. Ela inclui precatórios, financiamentos e, desde 2025, as pensões militares."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
