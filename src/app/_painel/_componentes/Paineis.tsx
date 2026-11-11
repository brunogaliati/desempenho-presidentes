"use client";

import { comSinal, numero } from "@/lib/formatar";
import estilosDetalhes from "@/components/Detalhes.module.css";

import { DECISOES_EXEMPLO, TIPOS_EMENDA } from "../_dados/exemplos";
import type { AbaId, DadosPainel, ItemFeed, Leitura, Municipio, UF } from "../_dados/tipos";
import { formatar, pessoas, reaisCurto } from "./formatos";
import { Faisca } from "./GraficoLinha";
import { Selo } from "./Selo";
import { ABAS } from "./Topo";

/**
 * Os painéis ao lado do mapa.
 *
 * Esquerda: o país inteiro no tema da aba. Direita: as regiões e o que acabou
 * de acontecer, ou, com um estado escolhido, a ficha dele em todos os temas.
 * Dado observado, decisão e dinheiro ficam em blocos separados: uma mudança no
 * estado, a medida federal e o recurso transferido são afirmações diferentes,
 * e nenhuma prova a outra.
 */

export function Cartao({
  titulo,
  exemplo = false,
  acao,
  children,
}: {
  titulo?: string;
  exemplo?: boolean;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Bloco feito só de exemplos ganha borda tracejada inteira, além do selo:
  // um recorte de tela que pegue só o meio do bloco ainda carrega a marca.
  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--superficie)",
        borderColor: exemplo ? "var(--tinta-3)" : "var(--borda)",
        borderStyle: exemplo ? "dashed" : "solid",
      }}
    >
      {titulo && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {titulo}
            {exemplo && <Selo />}
          </h2>
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

function Barras({ linhas }: { linhas: { rotulo: string; valor: number; texto: string; destaque?: boolean }[] }) {
  const max = Math.max(...linhas.map((l) => l.valor), 1);
  return (
    <ul className="space-y-2">
      {linhas.map((l) => (
        <li key={l.rotulo}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span style={{ fontWeight: l.destaque ? 650 : 400 }}>{l.rotulo}</span>
            <span className="tabular font-semibold">{l.texto}</span>
          </div>
          <div className="mt-1 h-2 rounded-sm" style={{ background: "var(--grade)" }}>
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(l.valor / max) * 100}%`,
                background: l.destaque ? "var(--serie)" : "var(--mapa-1)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Variação contra o período que o governo recebeu, no idioma da medida. */
function variacao(leitura: Leitura, serie: (number | null)[] | undefined, periodo: number): string | null {
  const r = leitura.indiceRecebido;
  if (!serie || r === null || periodo <= r) return null;
  const a = serie[r];
  const b = serie[periodo];
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (leitura.formato === "pct1" || leitura.formato === "pct0") {
    return `${comSinal(b - a, 1)} pts desde ${leitura.periodos[r].extenso}`;
  }
  if (a === 0) return null;
  return `${comSinal(((b - a) / a) * 100, 0)}% em relação a ${leitura.periodos[r].extenso}`;
}

// ---------------------------------------------------------------------------
// Esquerda
// ---------------------------------------------------------------------------

export function PainelEsquerdo({
  dados,
  aba,
  leitura,
  periodo,
}: {
  dados: DadosPainel;
  aba: AbaId;
  leitura: Leitura;
  periodo: number;
}) {
  const v = leitura.brasil[periodo] ?? null;
  const delta = variacao(leitura, leitura.brasil, periodo);

  return (
    <div className="space-y-3">
      <Cartao titulo="Brasil" exemplo={leitura.exemplo}>
        <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
          {leitura.titulo} · {leitura.periodos[periodo]?.extenso}
        </p>
        <p className="manchete mt-1 text-4xl font-bold leading-none" data-brasil-valor>
          {formatar(v, leitura.formato)}
          {leitura.exemplo && <Selo />}
        </p>
        {delta && (
          <p className="tabular mt-1.5 text-xs" style={{ color: "var(--tinta-2)" }}>
            {delta}
          </p>
        )}
        <p className="mt-2 text-xs leading-snug" style={{ color: "var(--tinta-3)" }}>
          {leitura.descricao} Fonte: {leitura.fonte}.
        </p>
      </Cartao>

      {aba === "congresso" && <EsquerdaCongresso dados={dados} />}
      {aba === "dinheiro" && <EsquerdaDinheiro dados={dados} />}
    </div>
  );
}

function EsquerdaCongresso({ dados }: { dados: DadosPainel }) {
  const c = dados.congresso;
  const d = DECISOES_EXEMPLO;
  return (
    <>
      <Cartao titulo="Quem decide">
        <p className="manchete text-2xl font-bold">
          {c.deputados} <span className="text-base font-medium">deputados</span> · {c.senadores}{" "}
          <span className="text-base font-medium">senadores</span>
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--tinta-2)" }}>
          {c.partidosNaCamara} partidos na Câmara. {c.legislatura.numero}ª legislatura até 31/01/2027; a próxima
          começa em 01/02 com a Câmara inteira e {c.senadoRenovadas} das 81 cadeiras do Senado renovadas.
        </p>
      </Cartao>
      <Cartao titulo="Medidas provisórias desde 2023" exemplo>
        <p className="manchete text-2xl font-bold">
          {d.mps.editadas}
          <Selo /> <span className="text-sm font-medium">editadas</span>
        </p>
        <div className="mt-3">
          <Barras
            linhas={[
              { rotulo: "Viraram lei", valor: d.mps.convertidas, texto: String(d.mps.convertidas), destaque: true },
              { rotulo: "Perderam a validade", valor: d.mps.perderamValidade, texto: String(d.mps.perderamValidade) },
              { rotulo: "Ainda tramitando", valor: d.mps.emTramitacao, texto: String(d.mps.emTramitacao) },
            ]}
          />
        </div>
      </Cartao>
      <Cartao titulo="Leis, vetos e votações" exemplo>
        <ul className="tabular space-y-1 text-sm">
          <li>
            <strong>{numero(d.leisSancionadas, 0)}</strong> leis sancionadas
            <Selo />
          </li>
          <li>
            <strong>{d.vetosTotais}</strong> vetos totais e <strong>{d.vetosParciais}</strong> parciais
            <Selo />
          </li>
          <li>
            <strong>{numero(d.votacoesNominais.camara, 0)}</strong> votações nominais na Câmara,{" "}
            <strong>{d.votacoesNominais.senado}</strong> no Senado
            <Selo />
          </li>
        </ul>
      </Cartao>
    </>
  );
}

function EsquerdaDinheiro({ dados }: { dados: DadosPainel }) {
  const leitura = dados.leituras.dinheiro[0];
  const ultimo = leitura.periodos.length - 1;
  const total = (leitura.brasil[ultimo] ?? 0) * dados.ufs.reduce((s, u) => s + (u.populacao ?? 0), 0);
  return (
    <Cartao titulo="Emendas pagas desde 2023" exemplo>
      <p className="manchete text-3xl font-bold">
        {reaisCurto(total)}
        <Selo />
      </p>
      <div className="mt-3">
        <Barras
          linhas={TIPOS_EMENDA.map((t, i) => ({
            rotulo: t.rotulo,
            valor: total * t.parcela,
            texto: reaisCurto(total * t.parcela),
            destaque: i === 0,
          }))}
        />
      </div>
      <p className="mt-3 text-[11px] leading-snug" style={{ color: "var(--tinta-3)" }}>
        Valores pagos. Fontes previstas: Transferegov e Portal da Transparência.
      </p>
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Direita
// ---------------------------------------------------------------------------

export function PorRegiao({
  dados,
  leitura,
  periodo,
}: {
  dados: DadosPainel;
  leitura: Leitura;
  periodo: number;
}) {
  const linhas = dados.regioes.map((r) => ({
    ...r,
    v: leitura.regioes[r.codigo]?.[periodo] ?? null,
    delta: variacao(leitura, leitura.regioes[r.codigo], periodo),
  }));
  // Pelo módulo: na leitura de mudança os valores são quedas, e a barra
  // vazia escondia justamente o tamanho delas. O sinal está no número.
  const max = Math.max(...linhas.map((l) => Math.abs(l.v ?? 0)), 0.1);

  return (
    <Cartao titulo="Por região" exemplo={leitura.exemplo}>
      <ul className="space-y-3">
        {linhas.map((l) => (
          <li key={l.codigo}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span>{l.nome}</span>
              <span className="tabular font-semibold">{formatar(l.v, leitura.formato)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--grade)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${l.v === null ? 0 : (Math.abs(l.v) / max) * 100}%`,
                  background: "var(--serie)",
                  transition: "width 300ms ease-out",
                }}
              />
            </div>
            {l.delta && (
              <p className="tabular mt-0.5 text-[11px]" style={{ color: "var(--tinta-3)" }}>
                {l.delta}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

export function Feed({ itens, aba, titulo = "Últimas atualizações" }: { itens: ItemFeed[]; aba: AbaId; titulo?: string }) {
  if (itens.length === 0) return null;
  return (
    <Cartao titulo={titulo} exemplo>
      <ul className="space-y-3">
        {itens.map((item, k) => (
          <li
            key={k}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-xs"
            style={{ opacity: item.aba === aba ? 1 : 0.6 }}
          >
            <span className="tabular" style={{ color: "var(--tinta-3)" }}>
              {item.quando}
            </span>
            <span>
              <span className="mr-1 font-semibold uppercase tracking-wide" style={{ color: "var(--tinta-2)" }}>
                {item.origem}
              </span>
              {item.texto}
            </span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Ficha do estado
// ---------------------------------------------------------------------------

export function Ficha({
  dados,
  uf,
  aba,
  periodo,
  leitura,
  municipios,
  aoSelecionar,
  aoTrocarAba,
}: {
  dados: DadosPainel;
  uf: UF;
  aba: AbaId;
  periodo: number;
  leitura: Leitura;
  municipios: Municipio[] | null;
  aoSelecionar: (sigla: string | null) => void;
  aoTrocarAba: (a: AbaId) => void;
}) {
  const ordem = [...dados.ufs].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const i = ordem.findIndex((u) => u.sigla === uf.sigla);
  const anterior = ordem[(i - 1 + ordem.length) % ordem.length];
  const proximo = ordem[(i + 1) % ordem.length];

  const vUf = leitura.ufs[uf.codigo]?.[periodo] ?? null;
  const vBr = leitura.brasil[periodo] ?? null;
  const delta = variacao(leitura, leitura.ufs[uf.codigo], periodo);

  const secoes: Record<AbaId, React.ReactNode> = {
    resumo: null,
    economia: <FichaEconomia dados={dados} uf={uf} />,
    congresso: <FichaCongresso dados={dados} uf={uf} />,
    dinheiro: <FichaDinheiro dados={dados} uf={uf} />,
    ambiente: <FichaAmbiente dados={dados} uf={uf} municipios={municipios} />,
  };
  const abas = [aba, ...ABAS.map((a) => a.id).filter((a) => a !== aba)];

  return (
    <div className="space-y-3" data-ficha={uf.sigla}>
      <Cartao>
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold"
            style={{ background: "var(--faixa-ativa)", color: "var(--serie)" }}
          >
            {uf.sigla}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight">{uf.nome}</h2>
            <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
              {uf.regiao} · {pessoas(uf.populacao)} habitantes
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <BotaoIcone rotulo={`Estado anterior: ${anterior.nome}`} onClick={() => aoSelecionar(anterior.sigla)}>
              ‹
            </BotaoIcone>
            <BotaoIcone rotulo={`Próximo estado: ${proximo.nome}`} onClick={() => aoSelecionar(proximo.sigla)}>
              ›
            </BotaoIcone>
            <BotaoIcone rotulo="Voltar para o Brasil" onClick={() => aoSelecionar(null)}>
              ✕
            </BotaoIcone>
          </div>
        </div>

        <div className="mt-4 rounded-xl p-3" style={{ background: "var(--plano)" }}>
          <p className="text-xs" style={{ color: "var(--tinta-2)" }}>
            {leitura.titulo} · {leitura.periodos[periodo]?.extenso}
          </p>
          <p className="manchete mt-1 text-3xl font-bold leading-none">
            {formatar(vUf, leitura.formato)}
            {leitura.exemplo && <Selo />}
          </p>
          {/* A variação é do estado; numa linha só com o Brasil, lia-se como
              variação do país. */}
          {delta && (
            <p className="tabular mt-1.5 text-xs" style={{ color: "var(--tinta-2)" }}>
              {delta}
            </p>
          )}
          <p className="tabular mt-0.5 text-xs" style={{ color: "var(--tinta-2)" }}>
            Brasil: {formatar(vBr, leitura.formato)}
          </p>
        </div>
      </Cartao>

      {abas.map((a) => (
        <Cartao
          key={a}
          titulo={ABAS.find((x) => x.id === a)!.rotulo}
          acao={
            a !== aba ? (
              <button onClick={() => aoTrocarAba(a)} className="text-xs hover:underline" style={{ color: "var(--serie)" }}>
                ver no mapa →
              </button>
            ) : null
          }
        >
          {secoes[a]}
        </Cartao>
      ))}
    </div>
  );
}

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-7 w-7 items-center justify-center rounded-full border text-sm"
      style={{ borderColor: "var(--borda)" }}
    >
      {children}
    </button>
  );
}

function FichaEconomia({ dados, uf }: { dados: DadosPainel; uf: UF }) {
  const l = dados.leituras.economia[0];
  const s = l.ufs[uf.codigo] ?? [];
  const n = l.periodos.length - 1;
  if (n < 0) return <p className="text-sm">Sem dados de desocupação.</p>;
  const r = l.indiceRecebido !== null && l.indiceRecebido >= 0 ? l.indiceRecebido : null;
  const atual = s[n] ?? null;
  const antes = r !== null ? (s[r] ?? null) : null;
  const ordem = dados.ufs
    .map((u) => l.ufs[u.codigo]?.[n])
    .filter((v): v is number => v !== null && v !== undefined)
    .sort((a, b) => a - b);
  const posicao = atual !== null ? ordem.indexOf(atual) + 1 : 0;
  const total = ordem.length;
  // Conta a partir da ponta mais próxima: "2ª maior", não "26ª menor".
  const lugar =
    posicao === 0
      ? ""
      : posicao === 1
        ? "A menor taxa do país."
        : posicao === total
          ? "A maior taxa do país."
          : posicao <= total / 2
            ? `${posicao}ª menor taxa entre ${total} UFs.`
            : `${total - posicao + 1}ª maior taxa entre ${total} UFs.`;
  // Trimestre → último mês dele, para a faísca marcar a posse no lugar certo.
  const datas = l.periodos.map(
    (p) => `${p.codigo.slice(0, 4)}-${String(Number(p.codigo.slice(4)) * 3).padStart(2, "0")}`,
  );

  return (
    <div className="text-sm">
      <p>
        Desocupação <strong className="tabular">{formatar(atual, "pct1")}</strong> no {l.periodos[n].extenso}.
        <span className="tabular block text-xs" style={{ color: "var(--tinta-2)" }}>
          {r !== null && `Recebeu ${formatar(antes, "pct1")} no ${l.periodos[r].extenso}.`}
          {atual !== null && antes !== null ? ` ${comSinal(atual - antes, 1)} pts.` : ""} {lugar}
        </span>
      </p>
      <div className="mt-2">
        <Faisca datas={datas} valores={s} altura={32} />
      </div>
    </div>
  );
}

function FichaCongresso({ dados, uf }: { dados: DadosPainel; uf: UF }) {
  const l = dados.leituras.congresso[0];
  const ult = l.periodos.length - 1;
  return (
    <div className="text-sm">
      <p>
        <strong>{uf.deputados.length} deputados</strong> e <strong>{uf.senadores.length} senadores</strong>.
      </p>
      <ul className="mt-1.5 text-xs" style={{ color: "var(--tinta-2)" }}>
        {uf.senadores.map((s) => (
          <li key={s.nome}>
            Sen. {s.nome}
            {s.partido ? ` (${s.partido})` : ""}
          </li>
        ))}
      </ul>
      <details className={`${estilosDetalhes.compacto} mt-1.5 text-xs`}>
        <summary className="cursor-pointer" style={{ color: "var(--serie)" }}>
          Ver os {uf.deputados.length} deputados
        </summary>
        <ul className="mt-1.5 columns-2 gap-3" style={{ color: "var(--tinta-2)" }}>
          {uf.deputados.map((p) => (
            <li key={p.nome} className="break-inside-avoid py-0.5">
              {p.nome}
              {p.partido ? ` (${p.partido})` : ""}
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-2 text-xs" style={{ color: "var(--tinta-2)" }}>
        Votou com a orientação do governo em{" "}
        <strong className="tabular">{formatar(l.ufs[uf.codigo]?.[ult], "pct0")}</strong>
        <Selo /> no {l.periodos[ult].extenso}.
      </p>
    </div>
  );
}

function FichaDinheiro({ dados, uf }: { dados: DadosPainel; uf: UF }) {
  const l = dados.leituras.dinheiro[0];
  const ult = l.periodos.length - 1;
  const v = l.ufs[uf.codigo]?.[ult] ?? null;
  return (
    <p className="text-sm">
      <strong className="tabular">{formatar(v, "reais0")}</strong>
      <Selo /> por habitante em emendas pagas desde 2023
      {v !== null && uf.populacao ? (
        <span className="tabular block text-xs" style={{ color: "var(--tinta-2)" }}>
          {reaisCurto(v * uf.populacao)} no total
          <Selo /> · Brasil: {formatar(l.brasil[ult], "reais0")}
          <Selo /> por habitante
        </span>
      ) : null}
    </p>
  );
}

/** Focos nos últimos 12 meses contra o que o governo recebeu, e os municípios com mais focos no último ano do arquivo anual. */
function FichaAmbiente({ dados, uf, municipios }: { dados: DadosPainel; uf: UF; municipios: Municipio[] | null }) {
  const l = dados.leituras.ambiente.find((x) => x.id === "focos_12m");
  const s = l?.ufs[uf.codigo] ?? [];
  const p = s.findLastIndex((v) => v !== null);
  const r = l?.indiceRecebido ?? null;
  const n = dados.queimadas.anos.length - 1;
  const ano = dados.queimadas.anos[n];
  const top = municipios
    ? [...municipios].sort((a, b) => b.focos[n] - a.focos[n]).filter((m) => m.focos[n] > 0).slice(0, 5)
    : null;
  if (!l || p < 0) return null;
  return (
    <div className="text-sm">
      <p>
        <strong className="tabular">{formatar(s[p], "contagem")}</strong> focos nos {l.periodos[p].extenso}
        {r !== null && (
          <span className="tabular block text-xs" style={{ color: "var(--tinta-2)" }}>
            {formatar(s[r], "contagem")} em {dados.foco.anoRecebido}, antes da posse.
          </span>
        )}
      </p>
      {top && top.length > 0 && (
        <>
          <p className="mt-2 text-xs font-medium">Onde mais houve focos em {ano}</p>
          <ol className="tabular mt-1 space-y-0.5 text-xs" style={{ color: "var(--tinta-2)" }}>
            {top.map((m) => (
              <li key={m.codigo} className="flex justify-between gap-2">
                <span>{m.nome}</span>
                <span>{numero(m.focos[n], 0)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
