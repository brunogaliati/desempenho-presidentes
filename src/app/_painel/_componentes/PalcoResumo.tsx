"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { caminhoParlamentar } from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import { montarPlenario } from "../_dados/plenarioModelo";
import type { LinhaResumo } from "../_dados/resumoModelo";
import type { DadosPainel, UF } from "../_dados/tipos";
import { corDaBancada, partidoDe } from "./bancada";
import { reguaDeCor } from "./formatos";
import { FotoParlamentar } from "./FotoParlamentar";
import { Mapa, type Moldura } from "./Mapa";
import { Plenario3D, type Assento } from "./Plenario3D";
import s from "./PalcoResumo.module.css";

/**
 * A primeira tela do Resumo: o governo num olhar.
 *
 * À esquerda, quem governa e o placar dele; no meio, o mapa, cada estado no
 * verde ou no vermelho do próprio saldo desde a posse; à direita, o placar item
 * a item e a Câmara, com a bancada do estado apontado acesa. As três peças se
 * respondem: apontar um estado acende a bancada; escolher abre o resumo dele.
 */

/** O saldo de um estado nas medidas que existem para os 27. */
export interface EstadoNoPalco {
  linhas: LinhaResumo[];
  bons: number;
  ruins: number;
  iguais: number;
}

// --- O passeio ---------------------------------------------------------------------
//
// Sem ninguém mexendo, a tela se mexe sozinha, sem trocar o assunto: no Brasil o mapa
// é do governo na tela, e o passeio não escolhe estado nenhum. Um brilho atravessa o
// país de tempos em tempos, e a câmera da Câmara vai e volta pelo plenário mostrando
// um deputado por vez. Num estado escolhido, a câmera passeia pela bancada dele. Para
// com o ponteiro no mapa ou na maquete, com o foco no palco, fora da tela e com menos
// movimento pedido.

/** Quanto dura cada parada da câmera. */
const PASSO_MS = 2800;
/** A primeira parada espera o mapa chegar e a maquete montar. */
const ESPERA_MS = 2600;
/** No Brasil, a câmera para em tantos pontos do plenário, da esquerda para a direita e de volta. */
const PARADAS = 12;

const deputados = fotografia.deputados;
type Deputado = (typeof deputados)[number];
/** Uma ordem fixa e misturada (servidor e navegador concordam), para não passear em ordem alfabética. */
const mistura = (id: number) => Math.imul(id, 2654435761) >>> 0;
const BANCADAS = (() => {
  const m = new Map<string, Deputado[]>();
  for (const p of deputados) m.set(p.uf, [...(m.get(p.uf) ?? []), p]);
  for (const lista of m.values()) lista.sort((a, b) => mistura(a.id) - mistura(b.id));
  return m;
})();

/** A cadeira da vez no Brasil: vai e volta pelo semicírculo, e cada volta pega outra fileira. */
function cadeiraDaVez(passo: number, total: number): number {
  const ciclo = 2 * (PARADAS - 1);
  const p = passo % ciclo;
  const j = p < PARADAS ? p : ciclo - p;
  const volta = Math.floor(passo / ciclo);
  return Math.min(total - 1, Math.floor(((j + 0.5) / PARADAS) * total) + (volta % 5) * 3);
}

const MOVIMENTO_REDUZIDO = "(prefers-reduced-motion: reduce)";
const assinarMovimento = (avisar: () => void) => {
  const m = window.matchMedia(MOVIMENTO_REDUZIDO);
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
};

/** Como o zoom da Economia: o estado com folga para os vizinhos. */
const MOLDURA: Moldura = { folga: 0.3, minimo: 220 };
const SOMBRA = "drop-shadow(0 8px 12px var(--atlas-sombra))";

/**
 * Verde ou vermelho pelo saldo (melhoraram menos pioraram), mais forte quanto
 * maior o saldo entre as medidas julgadas; saldo zero fica no cinza do meio.
 */
function corDoSaldo(e: EstadoNoPalco | undefined): string {
  const julgadas = e ? e.bons + e.ruins + e.iguais : 0;
  if (!e || !julgadas) return "var(--grade)";
  const saldo = e.bons - e.ruins;
  if (!saldo) return "var(--mapa-estavel)";
  const forca = Math.round(45 + 55 * (Math.abs(saldo) / julgadas));
  return `color-mix(in srgb, ${saldo > 0 ? "var(--mapa-melhor)" : "var(--mapa-pior)"} ${forca}%, var(--mapa-estavel))`;
}

export function PalcoResumo({
  dados,
  uf,
  setSigla,
  coluna,
  barra,
  porEstado,
  medidas,
}: {
  dados: DadosPainel;
  uf: UF | null;
  setSigla: (s: string | null) => void;
  /** Quem governa e o placar grande. */
  coluna: ReactNode;
  /** O placar item a item: a economia no Brasil, o que é do governo no estado. */
  barra: ReactNode;
  porEstado: Map<string, EstadoNoPalco>;
  /** Os nomes das medidas que pintam o mapa, para a legenda. */
  medidas: string[];
}) {
  const [apontada, setApontada] = useState<string | null>(null);

  // O passeio: um passo por vez, recomeçando quando o recorte (Brasil ou estado) muda.
  const palco = useRef<HTMLElement>(null);
  const chave = uf?.sigla ?? "BR";
  const [marcha, setMarcha] = useState({ chave, passo: -1 });
  const passo = marcha.chave === chave ? marcha.passo : -1;
  const [pausas, setPausas] = useState({ mapa: false, camara: false, foco: false });
  const pausar = (onde: keyof typeof pausas, sim: boolean) => setPausas((p) => (p[onde] === sim ? p : { ...p, [onde]: sim }));
  const pausado = pausas.mapa || pausas.camara || pausas.foco;
  const [visivel, setVisivel] = useState(false);
  const semMovimento = useSyncExternalStore(assinarMovimento, () => window.matchMedia(MOVIMENTO_REDUZIDO).matches, () => true);
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    let naTela = false;
    const atualizar = () => setVisivel(naTela && document.visibilityState === "visible");
    const observador = new IntersectionObserver(([e]) => {
      naTela = e.isIntersecting;
      atualizar();
    });
    observador.observe(el);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);
  const rodando = visivel && !pausado && !semMovimento;
  useEffect(() => {
    if (!rodando) return;
    const id = window.setTimeout(() => setMarcha({ chave, passo: passo + 1 }), passo < 0 ? ESPERA_MS : PASSO_MS);
    return () => window.clearTimeout(id);
  }, [rodando, passo, chave]);
  // Pausar congela a parada da vez; apontar um estado tira o passeio da frente.
  const passoDaCamara = semMovimento || apontada ? -1 : passo;
  // O mapa precisa de uma leitura para a geometria e as etiquetas; a cor e os números são do saldo.
  const leitura = dados.leituras.economia.find((l) => l.id === "desocupacao") ?? dados.leituras.economia[0];
  const regua = useMemo(() => reguaDeCor(Object.values(leitura.ufs).flat(), leitura.escala, leitura.rampa ?? "mapa"), [leitura]);
  const nomes = medidas.map((m) => m.toLocaleLowerCase("pt-BR"));
  const listaMedidas = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : (nomes[0] ?? "");

  const glifo = (u: UF, x: number, y: number, pequena: boolean) => {
    const e = porEstado.get(u.sigla);
    if (!e || !(e.bons + e.ruins + e.iguais)) return null;
    return (
      <text
        x={pequena ? x - 38 : x}
        y={y}
        textAnchor={pequena ? "start" : "middle"}
        dominantBaseline="central"
        fill="var(--tinta)"
        stroke="var(--plano)"
        strokeWidth={5}
        paintOrder="stroke"
        className="tabular"
        style={{ fontSize: pequena ? 16 : 18, fontWeight: 600 }}
        aria-hidden
      >
        {`↑${e.bons} ↓${e.ruins}`}
      </text>
    );
  };

  const balao = (u: UF) => {
    const e = porEstado.get(u.sigla);
    if (!e) return <p style={{ color: "var(--tinta-3)" }}>Sem dado.</p>;
    const julgadas = e.linhas.filter((l) => l.mudanca !== null);
    return (
      <>
        <p className="tabular mt-0.5">
          <b style={{ color: "var(--bom)" }}>{e.bons}</b> melhoraram · <b style={{ color: "var(--ruim)" }}>{e.ruins}</b> pioraram
          {e.iguais ? ` · ${e.iguais} iguais` : ""}
        </p>
        <ul className={s.balaoLista}>
          {julgadas.map((l) => (
            <li key={l.id}>
              <i style={{ background: l.sentido === "bom" ? "var(--placar-bom)" : l.sentido === "ruim" ? "var(--placar-ruim)" : "var(--grade)" }} />
              <span>{l.nome}</span>
              <b className="tabular">{l.mudanca}</b>
            </li>
          ))}
        </ul>
        <p style={{ color: "var(--tinta-3)" }}>{uf?.sigla === u.sigla ? "Clique para voltar ao Brasil" : "Clique para ver o resumo do estado"}</p>
      </>
    );
  };

  return (
    <section
      ref={palco}
      className={s.palco}
      aria-label="O governo num olhar"
      onFocus={() => pausar("foco", true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) pausar("foco", false);
      }}
    >
      <div className={s.coluna}>
        {coluna}
        <EstadosNoPeriodo dados={dados} uf={uf} porEstado={porEstado} setSigla={setSigla} />
      </div>

      <div className={s.mapa} onPointerEnter={() => pausar("mapa", true)} onPointerLeave={() => pausar("mapa", false)}>
        <div className={s.mapaDentro} aria-label={`Mapa: cada estado pelo saldo de ${listaMedidas} desde a posse`}>
          <Mapa
            atlas
            sombra={SOMBRA}
            ufs={dados.ufs}
            largura={dados.mapa.largura}
            altura={dados.mapa.altura}
            leitura={leitura}
            periodo={leitura.periodos.length - 1}
            regua={regua}
            selecionada={uf}
            aoSelecionar={setSigla}
            formasMunicipais={null}
            dadosMunicipais={null}
            camadaMunicipal={null}
            moldura={MOLDURA}
            vizinhosNoZoom
            chegada
            apagarOutros
            opacidadePreenchimento={0.94}
            espessuraContorno={0.7}
            corUf={(u) => corDoSaldo(porEstado.get(u.sigla))}
            glifo={glifo}
            balao={balao}
            aoApontar={setApontada}
            brilho={uf || semMovimento ? null : rodando ? "rodando" : "parado"}
          />
        </div>
        <div className={s.legenda}>
          <div className={s.escala} aria-hidden>
            <span>mais pioraram</span>
            <i style={{ background: "var(--mapa-pior)" }} />
            <i style={{ background: "color-mix(in srgb, var(--mapa-pior) 55%, var(--mapa-estavel))" }} />
            <i style={{ background: "var(--mapa-estavel)" }} />
            <i style={{ background: "color-mix(in srgb, var(--mapa-melhor) 55%, var(--mapa-estavel))" }} />
            <i style={{ background: "var(--mapa-melhor)" }} />
            <span>mais melhoraram</span>
          </div>
          <p>
            Cada estado pelas {medidas.length} medidas que existem para os 27: {listaMedidas}, desde a posse. Mostra como o estado
            andou, não o que o governador fez.
          </p>
        </div>
      </div>

      <aside className={`vidro ${s.barra}`} aria-label={uf ? `Placar e Câmara: ${uf.nome}` : "Placar e Câmara"}>
        <div className={s.barraPlacar}>{barra}</div>
        <CamaraNoPalco dados={dados} uf={uf} apontada={apontada} passo={passoDaCamara} aoPausar={(sim) => pausar("camara", sim)} />
      </aside>
    </section>
  );
}

/**
 * Embaixo do placar grande, o que o mapa mostra em palavras. No Brasil, quantos
 * estados ficaram de cada lado (os que pioraram, com nome, levam ao resumo
 * deles); num estado, as medidas que pintam o mapa dele.
 */
function EstadosNoPeriodo({ dados, uf, porEstado, setSigla }: { dados: DadosPainel; uf: UF | null; porEstado: Map<string, EstadoNoPalco>; setSigla: (s: string | null) => void }) {
  if (uf) {
    const e = porEstado.get(uf.sigla);
    const linhas = e?.linhas.filter((l) => l.mudanca !== null) ?? [];
    if (!e || !linhas.length) return null;
    return (
      <div className={s.noPeriodo}>
        <p className={s.noPeriodoTitulo}>{uf.nome} no período · o mapa</p>
        <p className={s.noPeriodoSaldo}>
          <b style={{ color: "var(--bom)" }}>{e.bons}</b> melhoraram · <b style={{ color: "var(--ruim)" }}>{e.ruins}</b> pioraram
        </p>
        <ul className={s.balaoLista}>
          {linhas.map((l) => (
            <li key={l.id}>
              <i style={{ background: l.sentido === "bom" ? "var(--placar-bom)" : l.sentido === "ruim" ? "var(--placar-ruim)" : "var(--grade)" }} />
              <span>{l.nome}</span>
              <b className="tabular">{l.mudanca}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const lados = { melhor: [] as UF[], empate: [] as UF[], pior: [] as UF[] };
  for (const u of dados.ufs) {
    const e = porEstado.get(u.sigla);
    if (!e || !(e.bons + e.ruins + e.iguais)) continue;
    lados[e.bons > e.ruins ? "melhor" : e.bons < e.ruins ? "pior" : "empate"].push(u);
  }
  if (!lados.melhor.length && !lados.pior.length && !lados.empate.length) return null;
  const linha = (cor: string, n: number, texto: string, ufs: UF[] | null) => (
    <li>
      <i style={{ background: cor }} />
      <span>
        <b className="tabular">{n}</b> {texto}
      </span>
      {ufs && ufs.length > 0 && ufs.length <= 6 && (
        <span className={s.siglas}>
          {ufs.map((u) => (
            <button key={u.sigla} type="button" onClick={() => setSigla(u.sigla)} title={`Ver o resumo ${u.deNome}`}>
              {u.sigla}
            </button>
          ))}
        </span>
      )}
    </li>
  );
  return (
    <div className={s.noPeriodo}>
      <p className={s.noPeriodoTitulo}>Os estados no período · o mapa</p>
      <ul className={s.lados}>
        {linha("var(--mapa-melhor)", lados.melhor.length, "com mais melhoras que pioras", lados.melhor)}
        {lados.empate.length > 0 && linha("var(--mapa-estavel)", lados.empate.length, lados.empate.length === 1 ? "empatado" : "empatados", lados.empate)}
        {linha("var(--mapa-pior)", lados.pior.length, "com mais pioras que melhoras", lados.pior)}
      </ul>
    </div>
  );
}

/**
 * A Câmara pequena, uma cadeira por deputado na cor do partido. O estado
 * apontado no mapa (ou o escolhido) acende a bancada dele; o resto apaga.
 */
function CamaraNoPalco({
  dados,
  uf,
  apontada,
  passo,
  aoPausar,
}: {
  dados: DadosPainel;
  uf: UF | null;
  apontada: string | null;
  /** A parada do passeio; -1 sem passeio. */
  passo: number;
  aoPausar: (sim: boolean) => void;
}) {
  const router = useRouter();
  // A maquete entra depois do mapa: a primeira pintura da página não espera por ela.
  const [montar, setMontar] = useState(false);
  useEffect(() => {
    const ocioso = window.requestIdleCallback?.(() => setMontar(true), { timeout: 1200 });
    const reserva = ocioso === undefined ? window.setTimeout(() => setMontar(true), 400) : undefined;
    return () => {
      if (ocioso !== undefined) window.cancelIdleCallback(ocioso);
      if (reserva !== undefined) window.clearTimeout(reserva);
    };
  }, []);
  const assentos = useMemo<Assento[]>(() => {
    const total = new Map<string, number>();
    for (const p of deputados) total.set(partidoDe(p), (total.get(partidoDe(p)) ?? 0) + 1);
    const ordem = [...total.keys()].sort((a, b) => total.get(b)! - total.get(a)! || a.localeCompare(b, "pt-BR"));
    return ordem.flatMap((sigla) =>
      deputados
        .filter((p) => partidoDe(p) === sigla)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((p) => ({ id: p.id, nome: p.nome, partido: sigla, cor: corDaBancada(dados.governos, p.partido) })),
    );
  }, [dados.governos]);
  // A câmera do passeio: gira para o lado da cadeira (as do lado direito de quem olha da galeria
  // pedem a câmera à direita) e sobe nas fileiras de trás, para ver por cima das da frente.
  const modelo = useMemo(() => montarPlenario(assentos.length), [assentos.length]);
  const posicao = useMemo(() => new Map(assentos.map((a, i) => [a.id, i])), [assentos]);
  // Num estado, a bancada dele; no Brasil, o plenário inteiro, sem acender ninguém.
  const bancadaUf = uf ? BANCADAS.get(uf.sigla) : undefined;
  const daVez =
    passo < 0 || !assentos.length
      ? null
      : uf
        ? bancadaUf?.length
          ? bancadaUf[passo % bancadaUf.length].id
          : null
        : assentos[cadeiraDaVez(passo, assentos.length)].id;
  const indiceDaVez = daVez === null ? undefined : posicao.get(daVez);
  const cadeira = indiceDaVez === undefined ? undefined : modelo.cadeiras[indiceDaVez];
  const fundo = cadeira ? cadeira.fileira / Math.max(1, modelo.fileiras.length - 1) : 0;
  const camera = useMemo(
    () => (cadeira ? { az: (Math.PI / 2 - cadeira.angulo) * 0.65, el: 0.5 + 0.38 * fundo } : null),
    [cadeira, fundo],
  );
  const alvo = apontada ?? uf?.sigla ?? null;
  const estado = alvo ? dados.ufs.find((u) => u.sigla === alvo) ?? null : null;
  const destaque = useMemo(() => (alvo ? new Set(deputados.filter((p) => p.uf === alvo).map((p) => p.id)) : null), [alvo]);
  const [sob, setSob] = useState<number | null>(null);
  const noCartao = sob ?? daVez;
  const pessoa = noCartao === null ? undefined : deputados.find((p) => p.id === noCartao);
  const linkCongresso = `/congresso${uf ? `?uf=${uf.sigla}` : ""}`;

  return (
    <div className={s.camara} onPointerEnter={() => aoPausar(true)} onPointerLeave={() => aoPausar(false)}>
      <div className={s.camaraTopo}>
        <p>
          <b>Câmara</b>{" "}
          {estado && destaque ? (
            <span className="tabular">
              · {estado.sigla}: {destaque.size} de {deputados.length}
            </span>
          ) : (
            <span className="tabular">· {deputados.length} deputados</span>
          )}
        </p>
        <Link href={linkCongresso} className={s.camaraLink}>
          Ver no Congresso →
        </Link>
      </div>
      <div className={s.camaraMaquete}>
        {montar ? (
          <Plenario3D
            compacta
            casa="deputados"
            assentos={assentos}
            destaque={destaque}
            realce={null}
            escolhido={null}
            fotos={false}
            cartaoId={noCartao}
            camera={camera}
            cartaoFixo={false}
            cartao={
              pessoa ? (
                <div className={s.cartaoCamara}>
                  <FotoParlamentar key={pessoa.id} casa="deputados" id={pessoa.id} nome={pessoa.nome} tamanho={34} prioridade />
                  <span className={s.cartaoTexto}>
                    <b>{pessoa.nome}</b>
                    <span>
                      {partidoDe(pessoa)} · {pessoa.uf}
                    </span>
                  </span>
                </div>
              ) : null
            }
            rotulo="Câmara dos Deputados, uma cadeira por deputado, na cor do partido. Clique numa cadeira para abrir a página do deputado."
            aoApontar={setSob}
            aoEscolher={(id) => {
              const p = id === null ? undefined : deputados.find((x) => x.id === id);
              if (p) router.push(caminhoParlamentar("deputados", p));
            }}
          />
        ) : (
          <div className={s.camaraEspera} aria-hidden />
        )}
      </div>
    </div>
  );
}

const FUNDO = { bom: "var(--placar-bom)", ruim: "var(--placar-ruim)", neutro: "var(--mapa-estavel)" } as const;
const TEXTO = { bom: "var(--placar-texto)", ruim: "var(--placar-texto)", neutro: "var(--tinta)" } as const;

/**
 * O placar do estado no mesmo molde do da Economia: um bloco chapado por
 * medida, verde ou vermelho pelo que mudou desde a posse. O detalhe de cada
 * um fica nas seções de baixo; aqui é o resumo de bater o olho.
 */
export function Ladrilhos({ grupos }: { grupos: { titulo: string; linhas: LinhaResumo[] | null }[] }) {
  return (
    <div className={s.ladrilhos}>
      {grupos.map((g) => {
        const linhas = g.linhas?.filter((l) => l.mudanca !== null) ?? null;
        return (
          <div key={g.titulo} className={s.ladrilhosGrupo}>
            <span className={s.ladrilhosTitulo}>{g.titulo}</span>
            <div className={s.ladrilhosGrade}>
              {linhas === null
                ? [0, 1].map((i) => <span key={i} className={s.ladrilhoOsso} aria-hidden />)
                : linhas.length
                  ? linhas.map((l) => (
                      <span
                        key={l.id}
                        className={s.ladrilho}
                        style={{ background: FUNDO[l.sentido], color: TEXTO[l.sentido] }}
                        title={`${l.nome}: ${l.mudanca} desde a posse (${l.periodo}).`}
                      >
                        <span className={s.ladrilhoNome}>{l.nome}</span>
                        <span className={s.ladrilhoValor}>
                          <b>{l.mudanca}</b>
                          {l.para && <small>{l.para}</small>}
                        </span>
                      </span>
                    ))
                  : <span className={s.ladrilhoVazio}>Sem dado antes e depois da posse.</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
