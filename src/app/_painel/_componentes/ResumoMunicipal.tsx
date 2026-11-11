"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Compartilhar } from "@/components/Compartilhar";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";
import { useJson } from "@/lib/useJson";

import { linhasFiscais, type DadosFiscais } from "../_dados/resumoComplementos";
import { somarMeses, type LinhaResumo } from "../_dados/resumoModelo";
import { focoDaGestao, gestaoEmCurso, gestaoValida, type DadosResumoMunicipal, type GestaoMunicipal } from "../_dados/resumoMunicipalModelo";
import type { DadosPainel, FocoMandato, Governos, UF } from "../_dados/tipos";
import { BarraEleicao, BlocoLinhas, Legenda, Mosaico, PartidoComLogo, PilulaPartido, SeletorUf, type EstadoPartido } from "./AbaResumo";
import { Bloco } from "./Bloco";
import { mesAno, rotuloPartido, termosDoGoverno } from "./governos";
import { SeletorMunicipio } from "./SeletorMunicipio";
import { FilasSUS } from "./FilasSUS";
import s from "./AbaResumo.module.css";
import m from "./ResumoMunicipal.module.css";

/**
 * O resumo de uma prefeitura, no mesmo molde do resumo do governo federal e dos
 * estados: quem governa, o que é da prefeitura, o que só acontece na cidade e a
 * política. O cabeçalho do painel e o seletor de esferas continuam os mesmos;
 * a página estática do município (/resumo/municipios/…) segue sendo a de busca.
 *
 * A base ainda não tem uma medida que seja só da prefeitura e tenha direção
 * (como o Ideb da rede municipal): por isso não há placar de melhorou/piorou.
 */

interface Props {
  /** O painel do governo atual: estados, partidos, governadores e presidentes. */
  dados: DadosPainel;
  codigo: string;
  /** O ano da posse; `null` para a gestão em curso. */
  gestao: number | null;
  setSigla: (s: string | null) => void;
}

const validarId = (v: unknown) => v === null || (typeof v === "string" && /^[\w.-]{1,80}$/.test(v));
const data = (d: string) => d.split("-").reverse().join("/");

/** Os limites de dívida e pessoal são outros para municípios: 120% (Senado) e 54% (LRF, art. 20). */
function fiscaisDoMunicipio(d: DadosFiscais): LinhaResumo[] {
  const limite = { divida: 120, pessoal: 54 } as const;
  return linhasFiscais(d).map((l) => {
    const id = l.id === "fiscal-divida" ? "divida" : "pessoal";
    if (!l.grafico) return l;
    return {
      ...l,
      grafico: {
        ...l.grafico,
        series: l.grafico.series.map((x) => (x.principal ? { ...x, rotulo: "Município" } : { ...x, valores: x.valores.map(() => limite[id]) })),
        titulo: id === "divida"
          ? `% da receita corrente líquida no fim de cada quadrimestre · limite de ${limite.divida}% (Senado)`
          : `% da receita corrente líquida em 12 meses, no fim de cada ano e no último relatório · limite de ${limite.pessoal}% (LRF)`,
      },
    };
  });
}

/** Sai do município para o estado (ou o Brasil), sem perder o resto do endereço. */
function sairDoMunicipio(setSigla: (s: string | null) => void, sigla: string | null, mandato?: string) {
  const url = new URL(location.href);
  for (const p of ["municipio", "gestao", "r.resumo.linha"]) url.searchParams.delete(p);
  if (mandato) url.searchParams.set("mandato", mandato);
  window.scrollTo({ top: 0, behavior: "instant" });
  window.history.pushState(null, "", url);
  setSigla(sigla);
}

function trocarGestao(ano: number) {
  const url = new URL(location.href);
  if (ano === gestaoEmCurso()) url.searchParams.delete("gestao");
  else url.searchParams.set("gestao", String(ano));
  url.searchParams.delete("r.resumo.linha");
  window.history.replaceState(null, "", url);
}

export function ResumoMunicipal({ dados, codigo, gestao, setSigla }: Props) {
  const ano = gestao !== null && gestaoValida(gestao) ? gestao : gestaoEmCurso();
  const foco = useMemo(() => focoDaGestao(ano), [ano]);
  const resumo = useJson<DadosResumoMunicipal>(`/api/painel/resumo/municipio?codigo=${codigo}&ano=${ano}`);
  const [aberta, setAberta] = useEstadoCompartilhavel<string | null>("resumo.linha", null, validarId);
  const alternar = (id: string) => setAberta((a) => (a === id ? null : id));
  const [partidoFixo, setPartidoFixo] = useState<string | null>(null);
  const [partidoSob, setPartidoSob] = useState<string | null>(null);
  const partido: EstadoPartido = { ativo: partidoSob ?? partidoFixo, passar: setPartidoSob, fixar: (p) => setPartidoFixo((x) => (x === p ? null : p)) };

  const g = dados.governos;
  const r = resumo.dado;
  const uf = dados.ufs.find((u) => u.codigo === codigo.slice(0, 2)) ?? null;
  const nome = r?.municipio.nome ?? null;
  const periodo = `${ano}–${ano + 3}`;
  const atual = r?.gestoes.find((x) => x.ano === ano) ?? null;
  const prefeito = r?.semPrefeitura ? null : (atual?.prefeito ?? null);
  const partidosDoGoverno = new Set(prefeito?.partido ? [prefeito.partido] : []);
  const frase = nome
    ? prefeito
      ? `${prefeito.nome} (${rotuloPartido(g, prefeito.partido, true)}), prefeitura de ${nome} (${uf?.sigla}), ${periodo}: contas, Câmara, população, emprego e saúde, com as fontes.`
      : `${nome} (${uf?.sigla}), ${periodo}: contas, população, emprego e saúde, com as fontes.`
    : "O resumo da prefeitura, com as fontes.";

  return (
    <div className={s.raiz}>
      <h1 className="sr-only">
        Resumo da prefeitura{nome ? ` de ${nome} (${uf?.sigla})` : ""}, {periodo}
      </h1>

      <Cabeca dados={dados} uf={uf} codigo={codigo} r={r} ano={ano} foco={foco} atual={atual} frase={frase} setSigla={setSigla} />

      <div className={s.comoLer}>
        <span><b>Como ler:</b> cada número é o último da gestão contra o último antes da posse.</span>
        <span><i className={s.quadradinho} style={{ background: "var(--placar-bom, var(--bom))" }} />melhorou</span>
        <span><i className={s.quadradinho} style={{ background: "var(--placar-ruim, var(--ruim))" }} />piorou</span>
        <span>População, emprego, CadÚnico e BPC ficam sem cor: subir ou cair não é, por si, melhor ou pior.</span>
        <span>Mudança durante uma gestão não prova que ela a causou.</span>
      </div>

      {resumo.erro && !r && (
        <div className={`vidro ${s.aviso}`} role="alert">
          O resumo do município não respondeu agora.
          <button type="button" onClick={resumo.tentar}>Tentar de novo</button>
        </div>
      )}

      <section className={s.secao} aria-labelledby="municipio-governo">
        <div className={s.secaoTitulo}>
          <h2 id="municipio-governo">A prefeitura e a Câmara</h2>
          <span>As contas do Executivo municipal e os vereadores eleitos junto com o prefeito.</span>
        </div>
        <div className={s.grade}>
          {codigo.startsWith("53") || codigo === "2605459" ? (
            <Bloco titulo="Contas públicas" detalhe="território sem prefeitura autônoma">
              <p className={s.observacao}>Este território não tem RGF municipal próprio. <Link href={`/?uf=${codigo.startsWith("53") ? "DF" : "PE"}`}>Consultar as contas do governo {codigo.startsWith("53") ? "distrital" : "de Pernambuco"}</Link>.</p>
            </Bloco>
          ) : <BlocoFiscal codigo={codigo} foco={foco} aberta={aberta} alternar={alternar} />}
          <Bloco titulo="Câmara Municipal" detalhe={r?.camara ? `eleita em ${r.camara.ano} · TSE` : "TSE"}>
            {r ? (
              r.semPrefeitura ? (
                <p className={s.observacao}>{r.semPrefeitura}</p>
              ) : (
                <>
                  <BarraEleicao e={r.camara} rotulo={`Vereadores eleitos em ${ano - 1}, com o prefeito`} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={null} />
                  <Legenda listas={[r.camara]} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} />
                  {r.camara && prefeito?.partido && (
                    <p className={s.observacao}>
                      O partido do prefeito vai em destaque. A bancada eleita não mostra trocas de partido nem a base do governo na Câmara.
                    </p>
                  )}
                </>
              )
            ) : (
              <p className={s.tileQuando}>{resumo.erro ? "Sem dados de eleição agora." : "Carregando…"}</p>
            )}
          </Bloco>
        </div>
      </section>

      <section className={s.secao} aria-labelledby="municipio-territorio">
        <div className={s.secaoTitulo}>
          <h2 id="municipio-territorio">{nome ? `${nome} no período` : "A cidade no período"}</h2>
          <span>Acontece na cidade, mas depende também da economia do país, do estado e de programas federais.</span>
        </div>
        {r ? (
          r.indicadores.length ? (
            <Mosaico linhas={r.indicadores} aberta={aberta} alternar={alternar} foco={foco} comBrasil={false} verAba={() => {}} />
          ) : (
            <p className={s.observacao}>A base ainda não tem indicadores publicáveis para este município.</p>
          )
        ) : (
          !resumo.erro && <div className={`vidro ${s.carregando}`}>Carregando os indicadores…</div>
        )}
        {r && uf?.sigla !== "SP" && (
          <p className={s.observacao}>CadÚnico e BPC ainda não têm cobertura municipal integrada nesta UF; a série já disponível é a paulista, da Fundação Seade.</p>
        )}
        <BlocoLinhas titulo="Hospitais e leitos SUS" detalhe="rede no território · CNES · gestores diversos" linhas={r ? (r.rede ?? []) : null} aberta={aberta} alternar={alternar} foco={foco} />
        {r && !r.rede && <p className={s.observacao}>A consulta à rede hospitalar não respondeu agora.</p>}
        {/* Como no resumo do governo: a fila integrada é o GERCON, só do RS. */}
        {uf?.sigla === "RS" && <FilasSUS territorio={codigo} uf={uf.sigla} posse={foco.posse} fim={foco.ate ?? somarMeses(foco.fim.slice(0, 7), 1)} />}
      </section>

      <section className={s.secao} aria-labelledby="municipio-gestoes">
        <div className={s.secaoTitulo}>
          <h2 id="municipio-gestoes">{nome ? `Prefeitos eleitos em ${nome}` : "Prefeitos eleitos"}</h2>
          <span>Pelo resultado do TSE. Escolha uma gestão para ver os números dela.</span>
        </div>
        <div className={s.grade}>
          <Bloco titulo="Gestões" detalhe="desde 2013 · TSE">
            {r ? <ListaGestoes g={g} gestoes={r.gestoes} ano={ano} semPrefeitura={r.semPrefeitura} /> : <p className={s.tileQuando}>Carregando…</p>}
          </Bloco>
          <div className={s.faltam}>
            <div>
              <b>Ainda não temos</b>
              <br />
              O que este resumo ainda não mostra, para não parecer que não existe.
            </div>
            <div><b>Educação municipal</b><br />O Ideb da rede municipal, que é da prefeitura, ainda não está na base.</div>
            <div><b>Orçamento da prefeitura</b><br />O gasto por área (saúde, educação, transporte) e as transferências recebidas.</div>
            <div><b>Câmara Municipal</b><br />Como os vereadores votaram os projetos do prefeito.</div>
          </div>
        </div>
      </section>

      {r && (
        <nav aria-label="Páginas do município" className={m.rodape}>
          <Link href={r.caminho}>Página de {r.municipio.nome}, com as fontes</Link>
          {r.paginasIndicadores.map((p) => (
            <Link key={p.caminho} href={p.caminho} prefetch={false}>
              {p.nome} em {r.municipio.nome}
            </Link>
          ))}
          <Link href={`/correcoes?pagina=${encodeURIComponent(r.caminho)}`}>Relatar erro nos dados</Link>
        </nav>
      )}
    </div>
  );
}

function BlocoFiscal({ codigo, foco, aberta, alternar }: { codigo: string; foco: FocoMandato; aberta: string | null; alternar: (id: string) => void }) {
  const fim = foco.ate ?? somarMeses(foco.fim.slice(0, 7), 1);
  const fiscal = useJson<DadosFiscais>(`/api/painel/resumo/municipio/fiscal?codigo=${codigo}&posse=${foco.posse}&fim=${fim}`);
  const linhas = useMemo(() => (fiscal.dado ? fiscaisDoMunicipio(fiscal.dado) : null), [fiscal.dado]);
  if (fiscal.erro) {
    return (
      <Bloco titulo="Dívida e pessoal" detalhe="RGF · Tesouro Nacional">
        <div className={s.aviso} role="alert">
          O Tesouro não respondeu agora. Os dados do município não foram trocados pelos do estado.{" "}
          <button type="button" onClick={fiscal.tentar}>Tentar de novo</button>
        </div>
      </Bloco>
    );
  }
  return (
    <div>
      <BlocoLinhas titulo="Dívida e pessoal" detalhe="RGF · % da receita ajustada · Executivo municipal" linhas={linhas} aberta={aberta} alternar={alternar} foco={foco} />
      {linhas?.every((l) => l.para === null) && (
        <p className={s.observacao}>Municípios com menos de 50 mil habitantes podem publicar o RGF por semestre; esta consulta lê os quadrimestrais.</p>
      )}
    </div>
  );
}

function Cabeca({
  dados,
  uf,
  codigo,
  r,
  ano,
  foco,
  atual,
  frase,
  setSigla,
}: {
  dados: DadosPainel;
  uf: UF | null;
  codigo: string;
  r: DadosResumoMunicipal | null;
  ano: number;
  foco: FocoMandato;
  atual: GestaoMunicipal | null;
  frase: string;
  setSigla: (s: string | null) => void;
}) {
  const g = dados.governos;
  const mandatos = dados.economia.mandatos;
  const nome = r?.municipio.nome ?? null;
  const prefeito = r?.semPrefeitura ? null : (atual?.prefeito ?? null);
  const vice = r?.semPrefeitura ? null : (atual?.vice ?? null);
  const inicio = `${ano}-01-01`, fim = `${ano + 4}-01-01`;
  // Quem governava acima da prefeitura durante a gestão: o estado e Brasília.
  const termos = uf ? termosDoGoverno(g, uf.sigla, mandatos).filter((t) => t.inicio < fim && t.fim > inicio) : [];
  const presidentes = mandatos.filter((x) => x.inicio.slice(0, 10) < fim && x.fim.slice(0, 10) >= inicio).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const lista = (itens: React.ReactNode[]) => itens.flatMap((x, i) => [i > 0 ? (i === itens.length - 1 ? " e " : ", ") : null, x]);
  // Como no resumo do governo: o trilho abre centrado na gestão da tela, sem mexer na rolagem da página.
  const trilho = useRef<HTMLElement>(null);
  const temTrilho = Boolean(r && !r.semPrefeitura);
  useEffect(() => {
    const nav = trilho.current;
    const marcada = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (nav && marcada) nav.scrollLeft = marcada.offsetLeft - nav.clientWidth / 2 + marcada.offsetWidth / 2;
  }, [ano, temTrilho]);

  return (
    <header className={`vidro ${s.cabeca}`}>
      <div className={s.topoCabeca}>
        <div className={s.esferas} role="group" aria-label="Esfera de governo">
          <button type="button" className={s.esfera} aria-pressed={false} onClick={() => sairDoMunicipio(setSigla, null)}>
            Brasil
          </button>
          <SeletorUf ufs={dados.ufs} uf={uf} ativo={false} aoEscolher={(sigla) => sairDoMunicipio(setSigla, sigla)} />
          <SeletorMunicipio uf={uf?.sigla ?? null} municipio={{ codigo, nome: nome ?? "Município" }} />
        </div>
      </div>

      <div className={s.quem}>
        <div className={s.identidade}>
          <div className={s.retratos}>
            {prefeito ? (
              <span className={s.retratoGrande}>
                <RetratoPrefeito nome={prefeito.nome} foto={prefeito.foto} tamanho={84} />
              </span>
            ) : (
              uf && <Image className={m.bandeiraGrande} src={`/painel/bandeiras/${uf.sigla.toLowerCase()}.svg`} alt="" width={84} height={60} unoptimized />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={s.sobretitulo}>
              Prefeitura{nome ? ` de ${nome}` : ""}
              {uf ? ` (${uf.sigla})` : ""} · {ano}–{ano + 3}
              {foco.emCurso ? " · em curso" : ""}
            </div>
            <h2 className={s.titulo}>{prefeito?.nome ?? nome ?? "Carregando…"}</h2>
            {prefeito && (
              <div className={s.linhaPartido}>
                <PartidoComLogo g={g} sigla={prefeito.partido} />
                <span>
                  eleito em {data(prefeito.data)}
                  {prefeito.suplementar ? ", em eleição suplementar" : ""}
                  {vice ? ` · vice: ${vice.nome}${vice.partido && vice.partido !== prefeito.partido ? ` (${rotuloPartido(g, vice.partido, true)})` : ""}` : ""}
                </span>
              </div>
            )}
            {r?.semPrefeitura && <p className={s.nota}>{r.semPrefeitura}</p>}
            {r && !r.semPrefeitura && !prefeito && (
              <p className={s.nota}>{r.erroEleicao ? "A consulta à eleição não respondeu agora." : "Não encontramos um resultado eleitoral inequívoco para esta gestão."}</p>
            )}
            {prefeito && <p className={s.nota}>O resultado do TSE não confirma exercício atual, afastamentos ou sucessões.</p>}
            {uf && (termos.length > 0 || presidentes.length > 0) && (
              <p className={s.nota}>
                No período:{" "}
                {termos.length > 0 && (
                  <>
                    governo {uf.deNome} com{" "}
                    {lista(
                      termos.map((t) => (
                        <button key={t.id} type="button" className={m.links} onClick={() => sairDoMunicipio(setSigla, uf.sigla, t.id)} title={`Ver o resumo do governo ${uf.deNome}, ${t.ano}–${t.ano + 3}`}>
                          {t.nomes.map((n) => n.split(" ")[0]).join(" e ")}
                        </button>
                      )),
                    )}
                    {presidentes.length > 0 ? "; " : ""}
                  </>
                )}
                {presidentes.length > 0 && (
                  <>
                    em Brasília,{" "}
                    {lista(
                      presidentes.map((x) => (
                        <button key={x.id} type="button" className={m.links} onClick={() => sairDoMunicipio(setSigla, null, x.id)} title={`Ver o resumo do governo federal: ${x.nomeCurto}`}>
                          {x.nomeCurto}
                        </button>
                      )),
                    )}
                  </>
                )}
                .
              </p>
            )}
          </div>
        </div>

        <div className={s.placar} aria-label="A cidade em números">
          <span className={s.placarRotulo}>{nome ? `${nome} hoje` : "A cidade hoje"}</span>
          {r?.retrato.length ? (
            <div className={m.retratoNumeros}>
              {r.retrato.map((x) => (
                <span key={x.rotulo} title={`Último dado: ${x.quando}`}>
                  <b>{x.valor}</b>
                  <small>{x.rotulo}</small>
                </span>
              ))}
            </div>
          ) : (
            <span className={s.contraBrasil}>{r ? "Sem indicadores publicáveis para este município." : "Carregando…"}</span>
          )}
          <span className={s.contraBrasil}>O último dado de cada fonte, não um placar da gestão.</span>
          <div className={s.compartilhar}>
            <Compartilhar mensagem={frase} />
          </div>
        </div>
      </div>

      {r && !r.semPrefeitura && (
        <div className={s.trilhoCaixa}>
          <nav ref={trilho} className={s.trilho} aria-label={nome ? `Gestões de ${nome}` : "Gestões municipais"}>
            {r.gestoes.map((x) => (
              <button key={x.ano} type="button" className={s.termo} style={x.prefeito ? undefined : { paddingLeft: 12 }} aria-current={x.ano === ano} onClick={() => trocarGestao(x.ano)} title={x.prefeito ? `${x.ano}–${x.ano + 3}: ${x.prefeito.nome}` : `${x.ano}–${x.ano + 3}`}>
                {x.prefeito && <RetratoPrefeito nome={x.prefeito.nome} foto={x.prefeito.foto} tamanho={32} />}
                {x.ano}–{x.ano + 3}
                {x.prefeito ? ` · ${x.prefeito.nome.split(" ")[0]}` : ""}
              </button>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/** A foto de candidatura do TSE em círculo; sem foto, as iniciais, como nos governadores. */
function RetratoPrefeito({ nome, foto, tamanho }: { nome: string; foto: string | null; tamanho: number }) {
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .filter((p) => !/^(da|das|de|do|dos|e)$/i.test(p))
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border"
      style={{ width: tamanho, height: tamanho, borderColor: "var(--borda)", background: "var(--faixa-a)", color: "var(--tinta-2)", fontSize: tamanho * 0.34 }}
    >
      {foto ? (
        <Image src={foto} alt={`Foto de ${nome}`} width={tamanho} height={tamanho} unoptimized className="h-full w-full object-cover" style={{ objectPosition: "50% 25%" }} />
      ) : (
        <span aria-hidden>{iniciais}</span>
      )}
    </span>
  );
}

function ListaGestoes({ g, gestoes, ano, semPrefeitura }: { g: Governos; gestoes: GestaoMunicipal[]; ano: number; semPrefeitura: string | null }) {
  if (semPrefeitura) return <p className={s.observacao}>{semPrefeitura}</p>;
  return (
    <ul className={m.gestoes}>
      {[...gestoes].reverse().map((x) => (
        <li key={x.ano}>
          <button type="button" className={m.gestao} aria-current={x.ano === ano} onClick={() => trocarGestao(x.ano)}>
            <span className={m.gestaoAno}>
              {x.ano}–{x.ano + 3}
            </span>
            <span className={m.gestaoNome}>
              {x.prefeito ? <b>{x.prefeito.nome}</b> : "Sem resultado inequívoco no TSE"}
              {x.prefeito && (
                <small>
                  eleito em {mesAno(x.prefeito.data)}
                  {x.prefeito.suplementar ? " (suplementar)" : ""}
                  {x.vice ? ` · vice: ${x.vice.nome}` : ""}
                </small>
              )}
            </span>
            {x.prefeito && <PilulaPartido g={g} sigla={x.prefeito.partido} />}
          </button>
        </li>
      ))}
    </ul>
  );
}
