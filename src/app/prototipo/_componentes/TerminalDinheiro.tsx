"use client";

import { useEffect, useMemo, useState } from "react";

import {
  baseDoAno,
  deCem,
  ITENS,
  NOME_FAMILIA,
  nomeDoItem,
  numero,
  ORDEM_FAMILIAS,
  reais,
  SITUACAO_PLANO,
  sinal,
  variacaoReal,
  type EmendasDoAno,
  type GrupoDeAnos,
  type PainelDinheiro,
} from "../_dados/dinheiroModelo";
import { Bloco, Opcoes, ROTULO } from "./Bloco";

/** O que fica abaixo do treemap: painéis densos que seguem o ente e o ano escolhidos. */

const api = (params: Record<string, string>) => `/prototipo/api/dinheiro?${new URLSearchParams(params)}`;

function useDados<T>(url: string | null): { dados: T | null; erro: boolean } {
  const [estado, setEstado] = useState<{ url: string | null; dados: T | null; erro: boolean }>({ url: null, dados: null, erro: false });
  useEffect(() => {
    if (!url) return;
    const controle = new AbortController();
    fetch(url, { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<T>;
      })
      .then((dados) => setEstado({ url, dados, erro: false }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setEstado({ url, dados: null, erro: true });
      });
    return () => controle.abort();
  }, [url]);
  return estado.url === url ? estado : { dados: null, erro: false };
}

/** Texto que começa com `=`, `+`, `@` ou `-` vira fórmula na planilha: leva um apóstrofo na frente. */
function baixarCsv(nome: string, linhas: (string | number | null)[][]) {
  const texto = linhas
    .map((l) => l.map((v) => `"${(typeof v === "string" && /^[=+@\-\t\r]/.test(v) ? `'${v}` : String(v ?? "")).replaceAll('"', '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const BotaoCsv = ({ aoClicar }: { aoClicar: () => void }) => (
  <button type="button" className="dn-csv" onClick={aoClicar}>Baixar CSV</button>
);

interface Props {
  painel: PainelDinheiro;
  sigla: string | null;
  ano: number;
  grupos: GrupoDeAnos[];
  escolherAno: (a: number) => void;
}

export function TerminalDinheiro({ painel, sigla, ano, grupos, escolherAno }: Props) {
  return (
    <div className="dn-terminal">
      <AnoAno painel={painel} sigla={sigla} ano={ano} escolherAno={escolherAno} />
      <DeOndeVeio painel={painel} ano={ano} />
      <Emendas painel={painel} sigla={sigla} ano={ano} />
      <TodasAsLinhas painel={painel} sigla={sigla} ano={ano} grupos={grupos} />
      <Fontes painel={painel} />
    </div>
  );
}

function AnoAno({ painel, sigla, ano, escolherAno }: { painel: PainelDinheiro; sigla: string | null; ano: number; escolherAno: (a: number) => void }) {
  const ente = painel.entes[sigla ?? "BR"];
  return (
    <Bloco id="ano-a-ano" titulo="Ano a ano" detalhe={`${sigla ? ente.nome : "União"}, de cada R$ 100. Toque em um ano para levá-lo ao topo.`} className="dn-s7">
      <div className="dn-legenda">
        {ORDEM_FAMILIAS.map((f) => <span key={f}><i className={`dn-q dn-f-${f}`} />{NOME_FAMILIA[f]}</span>)}
      </div>
      <div className="dn-colunas">
        {painel.anos.map((a) => {
          const p = ente.anos[String(a)];
          const rotulo = a === painel.parcial?.ano ? `${a}*` : String(a);
          if (!p) {
            return (
              <div key={a} className="dn-col" data-vazia="">
                <div className="dn-pilha" data-balao={`${a}: ${ente.nome} sem dado`} />
                <span>{rotulo}</span>
              </div>
            );
          }
          return (
            <button key={a} type="button" className="dn-col" aria-pressed={a === ano} aria-label={`Levar ${a} ao topo`} onClick={() => escolherAno(a)}>
              <div className="dn-pilha">
                {ORDEM_FAMILIAS.map((f) => {
                  const v = ITENS.filter((i) => i.familia === f).reduce((s, i) => s + (p.v[i.id] ?? 0), 0);
                  if (!(v > 0)) return null;
                  const pc = (100 * v) / p.t;
                  return (
                    <div key={f} className={`dn-seg dn-f-${f}`} style={{ height: `${pc.toFixed(2)}%` }} data-balao={`${a} · ${NOME_FAMILIA[f]}\nR$ ${numero(pc, 2)} de cada R$ 100 · ${reais(v)}`}>
                      {pc >= 7 ? numero(pc) : ""}
                    </div>
                  );
                })}
              </div>
              <span>{rotulo}</span>
            </button>
          );
        })}
      </div>
    </Bloco>
  );
}

function DeOndeVeio({ painel, ano }: { painel: PainelDinheiro; ano: number }) {
  const r = painel.receita[String(ano)];
  const rotulo = painel.parcial?.ano === ano ? `${ano} até ${painel.parcial.mes}` : String(ano);
  return (
    <Bloco id="de-onde-veio" titulo="De onde veio" detalhe={`União, ${rotulo}, valor nominal`} className="dn-s5">
      {!r ? (
        <p className="dn-nota">Sem dado de receita neste ano.</p>
      ) : (
        <ReceitaDoAno r={r} />
      )}
    </Bloco>
  );
}

function ReceitaDoAno({ r }: { r: PainelDinheiro["receita"][string] }) {
  const partes: [string, number, string][] = [
    ["Contribuições", r.con, "dn-r1"],
    ["Impostos e taxas", r.imp, "dn-r2"],
    ["Outras receitas correntes", r.out, "dn-r3"],
    ["Empréstimos novos", r.emp, "dn-f-divida"],
    ["Outras de capital", r.cap, "dn-r4"],
  ];
  return (
    <>
      <div className="dn-faixa-receita">
        {partes.map(([n, v, c]) => {
          const p = (100 * v) / r.t;
          return p > 0 ? <div key={n} className={c} style={{ width: `${p.toFixed(2)}%` }} data-balao={`${n}\nR$ ${numero(p, 2)} de cada R$ 100 · ${reais(v)}`}>{p >= 8 ? numero(p) : ""}</div> : null;
        })}
      </div>
      <ul className="dn-linhas">
        {partes.map(([n, v, c]) => (
          <li key={n}>
            <i className={`dn-q ${c}`} />
            <span>{n}</span>
            <b>R$ {numero((100 * v) / r.t, 2)}</b>
            <span>{reais(v)}</span>
          </li>
        ))}
      </ul>
      <p className="dn-nota dn-nota-receita">
        Arrecadado de fato: {reais(r.t - r.emp - r.cap)}. O resto do total de {reais(r.t)} é dívida nova ({reais(r.emp)}) e outras receitas de capital ({reais(r.cap)}).
      </p>
    </>
  );
}

// --- Emendas Pix ----------------------------------------------------------------

type Filtro = { rotulo: string; cnpj?: string; parlamentar?: string };
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Emendas({ painel, sigla, ano }: { painel: PainelDinheiro; sigla: string | null; ano: number }) {
  const anoEmendas = Math.max(2020, ano);
  const { dados, erro } = useDados<EmendasDoAno>(api({ tipo: "emendas", ano: String(anoEmendas) }));
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState<"hab" | "tot">("hab");
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  useEffect(() => setFiltro(null), [anoEmendas, sigla]);

  const listas = useMemo(() => {
    if (!dados) return null;
    const alvo = semAcento(busca.trim());
    const casa = (s: string) => !alvo || semAcento(s).includes(alvo);
    const municipios = dados.municipios
      .filter((m) => (!sigla || m[1] === sigla) && casa(`${m[0]} ${m[1]}`))
      .map((m) => ({ nome: m[0], uf: m[1], v: m[2], hab: m[2] / m[4], cnpj: m[5] }))
      .sort((a, b) => (modo === "hab" ? b.hab - a.hab : b.v - a.v));
    const porNome = new Map<string, { nome: string; v: number; q: number }>();
    for (const p of dados.parlamentares) {
      if (sigla && p[1] !== sigla) continue;
      if (!casa(p[0])) continue;
      const a = porNome.get(p[0]) ?? { nome: p[0], v: 0, q: 0 };
      a.v += p[2];
      a.q += p[3];
      porNome.set(p[0], a);
    }
    return { municipios, parlamentares: [...porNome.values()].sort((a, b) => b.v - a.v) };
  }, [dados, busca, modo, sigla]);

  const cabecalho = dados ? (sigla ? (dados.porUf[sigla] ?? { v: 0, q: 0 }) : dados.total) : null;
  const uniao = painel.entes.BR.anos[String(ano)];
  const ms = listas?.municipios.slice(0, 10) ?? [];
  const ps = listas?.parlamentares.slice(0, 10) ?? [];
  const maxM = ms.length ? (modo === "hab" ? ms[0].hab : ms[0].v) : 1;
  const maxP = ps.length ? ps[0].v : 1;

  return (
    <Bloco
      id="emendas"
      titulo="Emendas Pix"
      detalhe={`transferências especiais, ${anoEmendas}${sigla ? `, ${painel.entes[sigla].nome}` : ""}. Valor dos planos de ação, não o que chegou à obra.`}
      className="dn-s12"
      lustroFixo
      acao={listas ? <BotaoCsv aoClicar={() => baixarCsv(`emendas-pix-${anoEmendas}.csv`, [["município", "UF", "valor dos planos (R$)", "R$ por habitante"], ...listas.municipios.map((m) => [m.nome, m.uf, m.v, Math.round(m.hab)])])} /> : undefined}
    >
      {erro && <p className="dn-nota">As emendas não responderam agora.</p>}
      {!erro && !dados && <div className="dn-esqueleto dn-esqueleto-emendas" aria-busy="true" />}
      {dados && cabecalho && listas && (
        <>
          {ano < 2020 && <p className="dn-nota">As emendas Pix começam em 2020: este painel mostra esse ano.</p>}
          <div className="dn-numeros">
            <div><span className={ROTULO}>Total</span><b>{reais(cabecalho.v)}</b></div>
            <div><span className={ROTULO}>Planos</span><b>{numero(cabecalho.q)}</b></div>
            {!sigla && uniao && ano >= 2020 && <div><span className={ROTULO}>De cada R$ 100</span><b>R$ {deCem(cabecalho.v, uniao.t)}</b></div>}
          </div>
          <div className="dn-barra-busca">
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar município ou parlamentar" aria-label="Buscar município ou parlamentar" />
            <Opcoes
              rotulo="Medida dos municípios"
              ativa={modo}
              aoEscolher={setModo}
              opcoes={[{ id: "hab", rotulo: "Por habitante" }, { id: "tot", rotulo: "Total" }]}
            />
          </div>
          <div className="dn-ranks">
            <div>
              <h4>Municípios</h4>
              <ol className="dn-rank">
                {ms.map((m) => (
                  <li key={m.cnpj}>
                    <button type="button" aria-pressed={filtro?.cnpj === m.cnpj} onClick={() => setFiltro(filtro?.cnpj === m.cnpj ? null : { rotulo: `${m.nome} (${m.uf})`, cnpj: m.cnpj })}>
                      <span className="dn-rank-linha"><span>{m.nome}<small>{m.uf}</small></span><b>{modo === "hab" ? `R$ ${numero(m.hab)}` : reais(m.v)}</b></span>
                      <span className="dn-traco"><i style={{ width: `${((100 * (modo === "hab" ? m.hab : m.v)) / maxM).toFixed(1)}%` }} /></span>
                    </button>
                  </li>
                ))}
                {!ms.length && <li className="dn-nota">Nada encontrado.</li>}
              </ol>
            </div>
            <div>
              <h4>Parlamentares</h4>
              <ol className="dn-rank">
                {ps.map((p) => (
                  <li key={p.nome}>
                    <button type="button" aria-pressed={filtro?.parlamentar === p.nome} onClick={() => setFiltro(filtro?.parlamentar === p.nome ? null : { rotulo: p.nome, parlamentar: p.nome })}>
                      <span className="dn-rank-linha"><span>{p.nome}</span><b>{reais(p.v)}</b></span>
                      <span className="dn-traco"><i style={{ width: `${((100 * p.v) / maxP).toFixed(1)}%` }} /></span>
                    </button>
                  </li>
                ))}
                {!ps.length && <li className="dn-nota">Nada encontrado.</li>}
              </ol>
            </div>
          </div>
          {filtro && <Planos key={`${filtro.cnpj ?? filtro.parlamentar}-${anoEmendas}`} filtro={filtro} ano={anoEmendas} sigla={sigla} aoFechar={() => setFiltro(null)} />}
          {!filtro && <p className="dn-nota">Toque em um município ou parlamentar para ver os planos.</p>}
        </>
      )}
    </Bloco>
  );
}

interface Plano {
  id: string;
  codigo: string | null;
  beneficiario: string | null;
  uf: string | null;
  parlamentar: string | null;
  situacao: string | null;
  custeio: number | null;
  investimento: number | null;
}

interface DetalhePlano {
  planos: { descricao_programacao_orcamentaria_plano_acao: string | null; motivo_impedimento_plano_acao: string | null }[];
  empenhos: { numero_empenho: string | null; descricao_situacao_empenho: string | null; valor: number | null }[];
  finalidades: { area_politica_publica_pt: string | null }[];
  documentos: { numero_documento_habil: string | null; descricao_situacao_dh: string | null; valor: number | null }[];
  relatorios: { situacao: string | null; data: string | null; executado: number | null; pendente: number | null }[];
}

const valorOuFalta = (v: number | null | undefined) => (v == null ? "não informado" : reais(v));

function Planos({ filtro, ano, sigla, aoFechar }: { filtro: Filtro; ano: number; sigla: string | null; aoFechar: () => void }) {
  const [pagina, setPagina] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const url = api({ tipo: "planos", ano: String(ano), uf: filtro.parlamentar && sigla ? sigla : "", cnpj: filtro.cnpj ?? "", parlamentar: filtro.parlamentar ?? "", pagina: String(pagina) });
  const { dados, erro } = useDados<Plano[]>(url);
  return (
    <section className="dn-planos" aria-label={`Planos de ${filtro.rotulo}`}>
      <div className="dn-planos-topo">
        <h4>Planos de {filtro.rotulo}</h4>
        <button type="button" className="dn-fechar" aria-label="Fechar planos" onClick={aoFechar}>×</button>
      </div>
      {erro && <p className="dn-nota">Os planos não responderam agora.</p>}
      {!erro && !dados && <p className="dn-nota">Carregando planos…</p>}
      {dados && dados.length === 0 && <p className="dn-nota">Nenhum plano encontrado.</p>}
      {dados && dados.length > 0 && (
        <>
          <ul>
            {dados.slice(0, 50).map((p) => (
              <li key={p.id} data-aberto={aberto === p.id ? "" : undefined}>
                <button type="button" aria-expanded={aberto === p.id} onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                  <span className="dn-plano-nome">{p.beneficiario ?? "Beneficiário não informado"}{p.uf ? <small>{p.uf}</small> : null}</span>
                  <span className="dn-plano-sub">{p.parlamentar ?? "Parlamentar não informado"} · {p.situacao ? (SITUACAO_PLANO[p.situacao] ?? p.situacao) : "Situação não informada"}</span>
                  <b>{reais((p.custeio ?? 0) + (p.investimento ?? 0))}</b>
                </button>
                {aberto === p.id && <DetalheDoPlano plano={p} ano={ano} />}
              </li>
            ))}
          </ul>
          {(pagina > 0 || dados.length > 50) && (
            <div className="dn-paginacao">
              <button type="button" disabled={pagina === 0} onClick={() => { setPagina(pagina - 1); setAberto(null); }}>Anterior</button>
              <span>Página {pagina + 1}</span>
              <button type="button" disabled={dados.length <= 50} onClick={() => { setPagina(pagina + 1); setAberto(null); }}>Próxima</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DetalheDoPlano({ plano, ano }: { plano: Plano; ano: number }) {
  const { dados, erro } = useDados<DetalhePlano>(api({ tipo: "detalhe", ano: String(ano), id: plano.id }));
  if (erro) return <p className="dn-nota">Detalhes indisponíveis.</p>;
  if (!dados) return <p className="dn-nota">Carregando detalhes…</p>;
  const info = dados.planos[0];
  const finalidades = dados.finalidades.map((f) => f.area_politica_publica_pt).filter(Boolean).join(", ");
  return (
    <div className="dn-plano-detalhe">
      <p>Custeio previsto: {valorOuFalta(plano.custeio)} · Investimento previsto: {valorOuFalta(plano.investimento)}</p>
      {info?.descricao_programacao_orcamentaria_plano_acao && <p>{info.descricao_programacao_orcamentaria_plano_acao}</p>}
      {info?.motivo_impedimento_plano_acao && <p>Motivo do impedimento: {info.motivo_impedimento_plano_acao}</p>}
      <p>Finalidades: {finalidades || "não informadas"}</p>
      <dl>
        <div><dt>Empenhos</dt><dd>{dados.empenhos.length ? dados.empenhos.map((e) => `${e.numero_empenho ?? "sem número"}: ${valorOuFalta(e.valor)} (${e.descricao_situacao_empenho ?? "situação não informada"})`).join("; ") : "não informados"}</dd></div>
        <div><dt>Documentos</dt><dd>{dados.documentos.length ? dados.documentos.map((d) => `${d.numero_documento_habil ?? "sem número"}: ${valorOuFalta(d.valor)} (${d.descricao_situacao_dh ?? "situação não informada"})`).join("; ") : "não informados"}</dd></div>
        {dados.relatorios.length > 0 && (
          <div>
            <dt>Relatórios</dt>
            <dd>
              {dados.relatorios.map((r) => `${r.data ? new Date(r.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"}: ${r.situacao ?? "situação não informada"}, executado ${valorOuFalta(r.executado)}, pendente ${valorOuFalta(r.pendente)}`).join("; ")}.
              {" "}Valores declarados não comprovam entrega.
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// --- Tabela e fontes ------------------------------------------------------------

function TodasAsLinhas({ painel, sigla, ano, grupos }: { painel: PainelDinheiro; sigla: string | null; ano: number; grupos: GrupoDeAnos[] }) {
  const ente = painel.entes[sigla ?? "BR"];
  const p = ente.anos[String(ano)];
  const base = baseDoAno(painel, ano, grupos);
  const rotulo = painel.parcial?.ano === ano ? `${ano} até ${painel.parcial.mes}` : String(ano);
  const linhas = p ? ITENS.map((i) => ({ ...i, v: p.v[i.id] ?? 0 })).filter((i) => i.v > 0).sort((a, b) => b.v - a.v) : [];
  const metade = Math.ceil(linhas.length / 2);
  const tabela = (lista: typeof linhas) => (
    <table>
      <thead><tr><th>Linha</th><th>De R$ 100</th><th>Total</th><th>Por hab.</th><th>Mudança</th></tr></thead>
      <tbody>
        {lista.map((i) => {
          const x = variacaoReal(painel, ente, ano, base, i.id);
          return (
            <tr key={i.id}>
              <td><i className={`dn-q dn-f-${i.familia}`} />{nomeDoItem(i.id)}</td>
              <td>{deCem(i.v, p!.t)}</td>
              <td>{reais(i.v)}</td>
              <td>{p!.p ? numero(i.v / p!.p) : "—"}</td>
              <td>{x !== null ? sinal(x) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <Bloco
      id="todas-as-linhas"
      titulo="Todas as linhas"
      detalhe={`${sigla ? ente.nome : "União"}, ${rotulo}${base ? `. Mudança contra ${base.texto}, sem a inflação` : ""}${sigla ? ". Saltos podem ser troca de classificação contábil, não gasto novo" : ""}${p?.fora ? `. Fora da conta: ${reais(p.fora)} em transferências` : ""}`}
      className="dn-s12"
      lustroFixo
      acao={p ? <BotaoCsv aoClicar={() => baixarCsv(`orcamento-${sigla ?? "uniao"}-${ano}.csv`, [["linha", "família", "de cada R$ 100", "valor liquidado (R$)", "R$ por habitante"], ...linhas.map((i) => [nomeDoItem(i.id), NOME_FAMILIA[i.familia], Number(((100 * i.v) / p.t).toFixed(2)), i.v, p.p ? Math.round(i.v / p.p) : null])])} /> : undefined}
    >
      {p ? <div className="dn-tabelas">{tabela(linhas.slice(0, metade))}{tabela(linhas.slice(metade))}</div> : <p className="dn-nota">Sem dado neste ano.</p>}
    </Bloco>
  );
}

function Fontes({ painel }: { painel: PainelDinheiro }) {
  const data = painel.coletadoEm ? painel.coletadoEm.split("-").reverse().join("/") : "data indisponível";
  return (
    <Bloco id="fontes-dinheiro" titulo="Fontes e limites" className="dn-s12">
      <p className="dn-fontes">
        Tesouro Nacional, Siconfi: RREO Anexo 02 para a despesa por função, em valor liquidado, sem operações intraorçamentárias e sem refinanciamento da dívida;
        RREO Anexo 01 para a receita. Inflação: IPCA, trazido para {painel.baseReal}. Emendas: Transferegov, ligadas ao município pelo CNPJ.
        População: estimativas do IBGE, com 2022 e 2023 interpolados.
        {" "}Coleta de {data}.
        {painel.parcial ? ` Em ${painel.parcial.ano}, as comparações usam jan–${painel.parcial.mes} dos dois anos.` : ""}
        {" "}<b>Limites:</b>{" "}
        {painel.abertura
          ? "“Outros encargos” é aberto com o orçamento por ação da CGU; precatórios entram por diferença, porque o arquivo não mostra o realizado deles. Desde 2025 as pensões militares estão nessa linha no Tesouro, e aqui voltam a Previdência, exceto no ano ainda aberto. Banco Central: ação da CGU; no ano aberto, a diferença entre juros e amortização do Anexo 01 e Serviço da Dívida do Anexo 02."
          : "“Outros encargos” não abre no Anexo 02. A cobertura do Banco Central é a diferença entre juros e amortização do Anexo 01 e Serviço da Dívida do Anexo 02. Desde 2025 as pensões militares (R$ 26 bi) estão em “Outros encargos”, não em Previdência."}
        {" "}Nos estados, trocas de classificação contábil criam saltos que não são gasto novo: em São Paulo, a linha de Previdência caiu enquanto as aposentadorias subiam. As transferências ficam fora da conta dos estados porque, em 2025, só Acre, Amazonas e São Paulo lançaram nelas o repasse a municípios.
      </p>
      <div className="dn-links-fonte">
        <a href="https://apidatalake.tesouro.gov.br/docs/siconfi/">Siconfi</a>
        <a href="https://docs.api.transferegov.gestao.gov.br/transferenciasespeciais/">Transferegov</a>
      </div>
    </Bloco>
  );
}
