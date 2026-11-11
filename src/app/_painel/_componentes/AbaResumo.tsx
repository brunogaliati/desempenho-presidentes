"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { Compartilhar } from "@/components/Compartilhar";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";
import { caminhoFoto, Retrato } from "@/components/Retrato";
import { numero, type Sentido } from "@/lib/formatar";
import { idCompartilhavel } from "@/lib/compartilhamento";
import { destinoPainel } from "@/lib/rotasPainel";
import { useLargura } from "@/lib/useLargura";
import { useJson } from "@/lib/useJson";
import { linhasRedeSaude } from "@/lib/redeSaudeModelo";

import {
  baseDoAno,
  gruposDeGovernadores,
  gruposDePresidentes,
  itemDe,
  nomeDoItem,
  reais,
  variacaoReal,
  type EnteDinheiro,
  type GrupoDeAnos,
  type PainelDinheiro,
} from "../_dados/dinheiroModelo";
import {
  cadeiras,
  contarLinhas,
  eleicaoGeralAntes,
  eleicoesNoMandato,
  linhasDasLeituras,
  linhasIdeb,
  linhasSeguranca,
  mesAno as mesAnoCurto,
  somarMeses,
  type CargoId,
  type Comparacao,
  type DadosResumo,
  type Eleicao,
  type GraficoResumo,
  type LinhaResumo,
} from "../_dados/resumoModelo";
import { linhasSaude, linhasFiscais, marcasGraficoResumo, type DadosFiscais } from "../_dados/resumoComplementos";
import type { DadosPainel, FocoMandato, Governos, MandatoVisual, TrechoGoverno, UF } from "../_dados/tipos";
import fotosGovernadores from "../_dados/fotos-governadores.json";
import fotografia from "../_dados/fotografia.json";
import { Bloco } from "./Bloco";
import { CartaoResumo, fichaDaLinha, fichaDoItem, type DadosCartao, type FichaCartao } from "./CartaoResumo";
import { formatar } from "./formatos";
import {
  comoEntrou,
  corDoPartido,
  governoEm,
  logoDoPartido,
  mesAno,
  nomePartido,
  rotuloPartido,
  semCorDePartido,
  tintaDoPartido,
  termosDoGoverno,
  type TermoGoverno,
} from "./governos";
import { Detalhe, PilulaVeredito, placarDaEconomia, type ItemPlacar } from "./Placar";
import { RetratoGovernador } from "./RetratoGovernador";
import { SeletorMunicipio } from "./SeletorMunicipio";
import { tituloVotacoes, VotacoesAssembleia } from "./VotacoesAssembleia";
import { FilasSUS, PORTAIS } from "./FilasSUS";
import { NavTerminal } from "./NavTerminal";
import s from "./AbaResumo.module.css";

/**
 * O resumo de um governo numa tela: o que é dele e o que só acontece no
 * território dele, separados. Num estado, segurança, educação da rede estadual e
 * o orçamento do estado são do governador; desemprego, crédito, desmatamento e
 * queimadas dependem mais de Brasília, do mercado e do clima, e ficam à parte.
 *
 * Toda linha usa a régua do placar (o último dado do mandato contra o que ele
 * recebeu) e, no estado, o Brasil no mesmo período ao lado: se o estado anda
 * junto com o país, a mudança dificilmente é só do estado.
 */

interface Props {
  dados: DadosPainel;
  /** O governo atual inteiro: a lista de mandatos não depende do escolhido. */
  atual: DadosPainel;
  sigla: string | null;
  setSigla: (s: string | null) => void;
  aoEscolherMandato: (id: string) => void;
}

/** As medidas do território que não são do governo do estado. */
const CONTEXTO_ESTADO: { id: string; aba: "economia" | "ambiente"; nome?: string }[] = [
  { id: "desocupacao", aba: "economia" },
  { id: "subutilizacao", aba: "economia", nome: "Subutilização" },
  { id: "inadimplencia", aba: "economia", nome: "Inadimplência" },
  { id: "desmatamento", aba: "ambiente" },
  { id: "focos_12m", aba: "ambiente", nome: "Queimadas" },
];
/** No Brasil, a economia já está no placar: o território é o meio ambiente. */
const CONTEXTO_BRASIL = CONTEXTO_ESTADO.filter((c) => c.aba === "ambiente");

const validarId = (v: unknown) => v === null || (typeof v === "string" && /^[\w.-]{1,80}$/.test(v));
/** Sigla de partido como o TSE e a Câmara escrevem: "PT", "PCdoB", "UNIÃO", "S/Partido". */
const validarSigla = (v: unknown) => typeof v === "string" && /^[\p{L}\p{N}/ .-]{0,24}$/u.test(v);

/** Os títulos dos blocos que o índice aponta: o id de um bloco sai do título (`idCompartilhavel`). */
const tituloOrcamento = (uf: UF | null) => (uf ? `Orçamento ${uf.deNome}` : "Orçamento da União");

// --- Dados ---------------------------------------------------------------------

// --- Partidos fora da tabela de governadores -----------------------------------

/**
 * O mapa só conhece os partidos que governaram estados. Na Assembleia e no
 * Congresso aparecem outros: os que mudaram de nome herdam a cor da família, e o
 * resto fica no cinza do "outros", que não disputa atenção com os grandes.
 */
const FAMILIA_EXTRA: Record<string, string> = {
  PV: "pv",
  PTN: "pode",
  PRD: "ptb",
  MOBILIZA: "pmn",
  "PC DO B": "pcdob",
};
const COR_EXTRA: Record<string, [string, string]> = {
  PSOL: ["light-dark(#d4553f, #e0705c)", "#ffffff"],
  REDE: ["light-dark(#3d8f6a, #58a882)", "#ffffff"],
};

function corPartido(g: Governos, sigla: string): string {
  if (g.partidos[sigla]) return corDoPartido(g, sigla);
  if (FAMILIA_EXTRA[sigla]) return `var(--partido-${FAMILIA_EXTRA[sigla]})`;
  return COR_EXTRA[sigla]?.[0] ?? "var(--partido-nd)";
}
function tintaPartido(g: Governos, sigla: string): string {
  if (g.partidos[sigla]) return tintaDoPartido(g, sigla);
  if (FAMILIA_EXTRA[sigla]) return `var(--partido-${FAMILIA_EXTRA[sigla]}-texto)`;
  return COR_EXTRA[sigla]?.[1] ?? "var(--partido-nd-texto)";
}

export function PilulaPartido({ g, sigla }: { g: Governos; sigla: string | null }) {
  const vazada = semCorDePartido(sigla);
  return (
    <span
      className="pilula"
      data-vazada={vazada || undefined}
      style={vazada ? undefined : { background: corDoPartido(g, sigla), color: tintaDoPartido(g, sigla) }}
      title={nomePartido(g, sigla)}
    >
      {rotuloPartido(g, sigla, true)}
    </span>
  );
}

/**
 * O partido de quem governa, no cabeçalho: a logo com o nome por extenso. A pílula
 * colorida, que repetiria a sigla da logo, fica só para quem não tem logo.
 */
export function PartidoComLogo({ g, sigla }: { g: Governos; sigla: string | null }) {
  if (!logoDoPartido(sigla)) return <PilulaPartido g={g} sigla={sigla} />;
  return (
    <span className={s.partidoComLogo}>
      <Logo sigla={sigla} className={s.logo} />
      <span>{nomePartido(g, sigla)}</span>
    </span>
  );
}

function Logo({ sigla, className }: { sigla: string | null; className: string }) {
  const src = logoDoPartido(sigla);
  return src ? <Image src={src} alt="" width={24} height={20} unoptimized className={className} /> : null;
}

// --- A aba ---------------------------------------------------------------------

export function AbaResumo({ dados, atual, sigla, setSigla, aoEscolherMandato }: Props) {
  const router = useRouter();
  const g = dados.governos;
  const foco = dados.foco;
  const uf = sigla ? dados.ufs.find((u) => u.sigla === sigla) ?? null : null;
  const resumo = useJson<DadosResumo>(`/api/painel/resumo?uf=${uf?.sigla ?? "BR"}&posse=${foco.posse}&v=2`);
  const dinheiro = useJson<PainelDinheiro>("/api/painel/dinheiro?tipo=painel");
  const [aberta, setAberta] = useEstadoCompartilhavel<string | null>("resumo.linha", null, validarId);
  const alternar = (id: string) => setAberta((a) => (a === id ? null : id));
  // O partido fixado vai no link, como o filtro de partido da aba Congresso: quem recebe vê o mesmo destaque.
  const [partidoFixo, setPartidoFixo] = useEstadoCompartilhavel<string>("resumo.partido", "", validarSigla);
  const [partidoSob, setPartidoSob] = useState<string | null>(null);
  const partido: EstadoPartido = {
    ativo: partidoSob ?? (partidoFixo || null),
    fixo: partidoFixo || null,
    passar: setPartidoSob,
    fixar: (p: string) => setPartidoFixo((x) => (x === p ? "" : p)),
    soltar: () => setPartidoFixo(""),
  };

  const mandatos = atual.economia.mandatos;
  const termos = useMemo(() => (uf ? termosDoGoverno(g, uf.sigla, mandatos) : []), [g, uf, mandatos]);
  const termo = termos.find((t) => t.id === foco.id) ?? null;
  const presidente = mandatos.find((m) => m.id === foco.id) ?? null;
  const ate = foco.ate ? `${foco.ate}-01` : "9999-12-31";
  const posseDia = `${foco.posse}-01`;
  const presidentesNoPeriodo = mandatos
    .filter((m) => m.inicio.slice(0, 10) < ate && m.fim.slice(0, 10) >= posseDia)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const r = resumo.dado;
  const seguranca = useMemo(() => (r ? linhasSeguranca(r, foco, Boolean(uf)) : []), [r, foco, uf]);
  const ideb = useMemo(() => (r ? linhasIdeb(r, foco, Boolean(uf)) : []), [r, foco, uf]);
  const saude = useMemo(() => (r ? linhasSaude(r, foco) : []), [r, foco]);
  const rede = useMemo(() => (r?.rede ? linhasRedeSaude(r.rede, foco) : []), [r, foco]);
  const contexto = useMemo(
    () => linhasDasLeituras(dados, uf ? CONTEXTO_ESTADO : CONTEXTO_BRASIL, uf?.codigo ?? null, (v, l) => formatar(v, l.formato), uf?.sigla),
    [dados, uf],
  );
  const placar = useMemo(() => (uf ? [] : placarDaEconomia(dados).grupos.filter((x) => x.itens.length)), [dados, uf]);

  // O placar do cabeçalho conta só o que é do governo: no estado, segurança e educação; no Brasil, a economia.
  const contas = uf
    ? contarLinhas([...seguranca, ...ideb])
    : contarLinhas(placar.flatMap((x) => x.itens).map((i) => ({ sentido: i.sentido, comparacao: null, mudanca: i.mudanca })));
  const julgadas = contas.bons + contas.ruins + contas.iguais;

  const periodo = `${foco.posse.slice(0, 4)}–${foco.fim.slice(0, 4)}`;
  const quem = uf ? (termo?.nomes.join(" e ") ?? `Governo ${uf.deNome}`) : (presidente?.nome ?? "Governo federal");
  const partidosDoGoverno = new Set<string>(
    uf ? (termo?.trechos ?? []).map((t) => t.partido).filter((p): p is string => Boolean(p)) : presidentesNoPeriodo.filter((m) => m.id === foco.id).map((m) => m.partido ?? "").filter(Boolean),
  );
  const frase = useMemo(() => {
    const onde = uf ? `${quem} ${uf.emNome}` : quem;
    if (!julgadas) return `${onde}, ${periodo}: o resumo do governo, com cada número na régua do placar.`;
    const doque = uf ? "do que é do governo do estado" : "da economia";
    const brasil = uf && contas.melhor + contas.igual + contas.pior
      ? ` Contra o Brasil no mesmo período: ${contas.melhor} melhor, ${contas.igual} igual, ${contas.pior} pior.`
      : "";
    return `${onde}, ${periodo}: das ${julgadas} medidas ${doque}, ${contas.bons} melhoraram e ${contas.ruins} pioraram desde a posse.${brasil}`;
  }, [uf, quem, periodo, julgadas, contas]);

  // O card para redes: os mesmos números da tela, no mesmo molde para todo governo.
  const principal = termo ? principalDoTermo(termo) : null;
  const partidoCartao = uf ? ([...(termo?.trechos ?? [])].reverse().find((t) => t.nome === principal)?.partido ?? null) : (presidente?.partido ?? null);
  const comparadasCartao = contas.melhor + contas.igual + contas.pior;
  const dadosCartao = useMemo<DadosCartao>(() => {
    const orc = dinheiro.dado ? orcamentoDoMandato(dinheiro.dado, uf, foco, dados, mandatos) : null;
    const fichaOrc: FichaCartao | null = orc && {
      rotulo: uf ? "Gasto do estado" : "Gasto da União",
      valor: reais(orc.total),
      antes: null,
      mudanca: orc.mudanca === null ? null : `${orc.mudanca >= 0 ? "+" : "−"}${numero(Math.abs(orc.mudanca), 0)}% real`,
      sentido: "neutro",
      nota: `em ${orc.ano}${orc.parcial ? ` até ${orc.parcial}` : ""}${orc.base ? ` · contra ${orc.base}` : ""}`,
    };
    const itens = uf
      ? [...seguranca, ...ideb].flatMap((l) => fichaDaLinha(l) ?? [])
      : placar.flatMap((x) => x.itens).slice(0, fichaOrc ? 9 : 10).map(fichaDoItem);
    return {
      esfera: uf ? `Governo ${uf.deNome}` : "Governo federal",
      periodo: `${foco.posse.slice(0, 4)}–${foco.fim.slice(0, 4)}${foco.emCurso ? " · em curso" : ""}`,
      nome: quem,
      partido: partidoCartao ? nomePartido(g, partidoCartao) : null,
      logo: logoDoPartido(partidoCartao),
      foto: uf ? (principal ? ((fotosGovernadores as Record<string, string>)[`${uf.sigla}|${principal}`] ?? null) : null) : presidente ? caminhoFoto(presidente.id) : null,
      bandeira: uf ? `/painel/bandeiras/${uf.sigla.toLowerCase()}.svg` : null,
      placarRotulo: uf ? "O que é do estado, desde a posse" : "A economia, desde a posse",
      bons: contas.bons,
      ruins: contas.ruins,
      iguais: contas.iguais,
      contraBrasil: uf && comparadasCartao ? `Contra o Brasil: ${contas.melhor} melhor · ${contas.igual} igual · ${contas.pior} pior` : null,
      fichas: fichaOrc ? [...itens, fichaOrc] : itens,
      fontes: uf ? "Sinesp/MJSP, Inep e Tesouro Nacional (Siconfi)" : "IBGE, Banco Central e Tesouro Nacional (Siconfi)",
      arquivo: `${uf?.sigla.toLowerCase() ?? "brasil"}-${foco.posse.slice(0, 4)}-${foco.fim.slice(0, 4)}`,
    };
  }, [dinheiro.dado, uf, foco, dados, mandatos, seguranca, ideb, placar, quem, partidoCartao, g, principal, presidente, contas, comparadasCartao]);
  // A dívida e o pessoal vêm do Tesouro na hora: só quando o diálogo abre.
  const fiscalDoCartao = useCallback(async (): Promise<FichaCartao[]> => {
    if (!uf) return [];
    const fim = foco.ate ?? somarMeses(foco.fim.slice(0, 7), 1);
    const r = await fetch(`/api/painel/resumo/fiscal?uf=${uf.sigla}&posse=${foco.posse}&fim=${fim}`);
    if (!r.ok) return [];
    return linhasFiscais((await r.json()) as DadosFiscais).flatMap((l) => fichaDaLinha(l) ?? []);
  }, [uf, foco]);
  const caminhoCartao = destinoPainel({ aba: "resumo", uf: uf?.sigla, mandato: foco.emCurso ? undefined : foco.id });

  // O índice da página, o mesmo da Economia: as seções na ordem em que aparecem.
  const secoes = useMemo(
    () => [
      { id: "resumo-do-governo", rotulo: "Do governo" },
      { id: idCompartilhavel(tituloOrcamento(uf)), rotulo: "Orçamento" },
      { id: "resumo-territorio", rotulo: uf ? "No período" : "Responsabilidade dividida" },
      { id: "resumo-saude", rotulo: "Saúde" },
      { id: "resumo-politica", rotulo: "Política" },
      ...(uf ? [{ id: idCompartilhavel(tituloVotacoes(uf.sigla)), rotulo: "Votações" }] : []),
    ],
    [uf],
  );

  const verAba = (aba: "economia" | "ambiente" | "dinheiro") => {
    window.scrollTo({ top: 0, behavior: "instant" });
    router.push(destinoPainel({ aba, uf: uf?.sigla, mandato: foco.id }), { scroll: false });
  };
  const verCongresso = (destino: string) => {
    window.scrollTo({ top: 0, behavior: "instant" });
    router.push(destino, { scroll: false });
  };
  const verPresidente = (id: string) => {
    setSigla(null);
    aoEscolherMandato(id);
  };

  return (
    <div className={s.raiz}>
      <NavTerminal secoes={secoes} rotulo="Seções do resumo" />
      <h1 className="sr-only">Resumo do governo{uf ? ` ${uf.deNome}` : " federal"}, {periodo}</h1>

      <Cabeca
        dados={dados}
        uf={uf}
        setSigla={setSigla}
        termo={termo}
        termos={termos}
        presidente={presidente}
        mandatos={mandatos}
        presidentesNoPeriodo={presidentesNoPeriodo}
        foco={foco}
        contas={contas}
        julgadas={julgadas}
        frase={frase}
        aoEscolherMandato={aoEscolherMandato}
        verPresidente={verPresidente}
        cartao={<CartaoResumo dados={dadosCartao} caminho={caminhoCartao} frase={frase} extras={uf ? fiscalDoCartao : undefined} />}
      />

      <div className={s.comoLer}>
        <span><b>Como ler:</b> cada número é o último do mandato contra o último antes da posse.</span>
        <span><i className={s.quadradinho} style={{ background: "var(--placar-bom, var(--bom))" }} />melhorou</span>
        <span><i className={s.quadradinho} style={{ background: "var(--placar-ruim, var(--ruim))" }} />piorou</span>
        {uf && <span>Ao lado, o Brasil no mesmo período.</span>}
        <span>Mudança durante um governo não prova que ele a causou.</span>
      </div>

      {resumo.erro && !r && (
        <div className={`vidro ${s.aviso}`} role="alert">
          O resumo não respondeu agora.
          <button type="button" onClick={resumo.tentar}>Tentar de novo</button>
        </div>
      )}

      <section className={s.secao} aria-labelledby="resumo-do-governo">
        <div className={s.secaoTitulo}>
          <h2 id="resumo-do-governo">{uf ? "O que é do governo do estado" : "O que é do governo federal"}</h2>
          <span>{uf ? "Polícias, rede estadual de ensino e o orçamento do estado." : "Política econômica e o orçamento da União."}</span>
        </div>
        <div className={s.grade}>
          {uf ? (
            <>
              <BlocoLinhas titulo="Segurança" detalhe="polícias estaduais · Sinesp" linhas={r ? seguranca : null} aberta={aberta} alternar={alternar} foco={foco} />
              {/* Educação e as contas do estado têm poucas linhas: empilhadas, ocupam a altura da segurança em vez de deixar um vão ao lado dela. */}
              <div className={s.pilha}>
                <BlocoLinhas titulo="Educação" detalhe={`rede estadual · Ideb, Inep`} linhas={r ? ideb : null} aberta={aberta} alternar={alternar} foco={foco} />
                <BlocoFiscalResumo uf={uf} foco={foco} aberta={aberta} alternar={alternar} />
              </div>
            </>
          ) : (
            <BlocoEconomia grupos={placar} aberta={aberta} alternar={alternar} aoVerHistorico={() => verAba("economia")} />
          )}
          <BlocoDinheiro
            painel={dinheiro.dado}
            erro={dinheiro.erro}
            tentar={dinheiro.tentar}
            uf={uf}
            foco={foco}
            dados={dados}
            mandatos={mandatos}
            verAba={() => verAba("dinheiro")}
            aoEscolherMandato={aoEscolherMandato}
          />
        </div>
      </section>

      <section className={s.secao} aria-labelledby="resumo-territorio">
        <div className={s.secaoTitulo}>
          <h2 id="resumo-territorio">{uf ? `${uf.nome} no período` : "Responsabilidade dividida"}</h2>
          <span>
            {uf
              ? "Acontece no estado, mas depende mais de Brasília, do mercado e do clima do que do governador."
              : "Estados e municípios respondem por parte disto: as polícias são estaduais e a escola pública é de estados e prefeituras."}
          </span>
        </div>
        {/* No Brasil, segurança e educação primeiro: são o que a frase de cima explica. */}
        {!uf && (
          <div className={s.grade}>
            <BlocoLinhas titulo="Segurança no país" detalhe="soma das polícias estaduais · Sinesp" linhas={r ? seguranca : null} aberta={aberta} alternar={alternar} foco={foco} />
            <BlocoLinhas titulo="Educação no país" detalhe="rede pública · Ideb, Inep" linhas={r ? ideb : null} aberta={aberta} alternar={alternar} foco={foco} />
          </div>
        )}
        <Mosaico linhas={contexto} aberta={aberta} alternar={alternar} foco={foco} comBrasil={Boolean(uf)} verAba={verAba} />
        <BlocoSaude uf={uf} rede={r ? (r.rede ? rede : []) : null} maisMedicos={r ? saude : null} aberta={aberta} alternar={alternar} foco={foco} />
      </section>

      <section className={s.secao} aria-labelledby="resumo-politica">
        <div className={s.secaoTitulo}>
          <h2 id="resumo-politica">Política</h2>
          <span>
            Quem foi eleito, pelo resultado do TSE. Clique ou toque num partido para ver os números dele em todas as barras.
            {partidosDoGoverno.size > 0 && (
              <span className={s.chaveDourada}>
                <i aria-hidden />
                {partidosDoGoverno.size > 1 ? "partidos do governo no mandato" : uf ? "partido do governador" : "partido do presidente"}
              </span>
            )}
          </span>
        </div>
        {r ? (
          <Politica
            r={r}
            g={g}
            uf={uf}
            foco={foco}
            dados={dados}
            partido={partido}
            partidosDoGoverno={partidosDoGoverno}
            setSigla={setSigla}
            verCongresso={verCongresso}
          />
        ) : (
          <div className={`vidro ${s.carregando}`}>{resumo.erro ? "Sem dados de eleição agora." : "Carregando as eleições…"}</div>
        )}
      </section>

      {uf && <VotacoesAssembleia key={`${uf.sigla}:${foco.posse}`} uf={uf.sigla} posse={foco.posse} fim={foco.ate ?? somarMeses(foco.fim.slice(0,7),1)}/>}

      <div className={s.faltam}>
        <div>
          <b>Ainda não temos</b>
          <br />
          O que este resumo ainda não mostra, para não parecer que não existe.
        </div>
        {uf ? (
          <>
            {uf.sigla === "RS" ? (
              <div><b>Resultados do SUS</b><br />Leitos, vagas e solicitações na regulação não medem a qualidade do atendimento. A fila do GERCON é uma fotografia, sem comparação entre mandatos.</div>
            ) : (
              <div><b>Filas do SUS</b><br />Não há um total de filas {uf.deNome} que dê para comparar entre governos. O único que integramos é o do Rio Grande do Sul (GERCON). Leitos e vagas não medem a qualidade do atendimento.</div>
            )}
            <div><b>Cobertura legislativa</b><br />O bloco de votações identifica as fontes integradas e as lacunas de cada Assembleia. Autoria desconhecida não é tratada como oposição.</div>
          </>
        ) : (
          <>
            <div><b>Filas do SUS</b><br />Não há um total nacional de filas. O único que integramos é o do Rio Grande do Sul (GERCON), no resumo do estado. Leitos e vagas não medem a qualidade do atendimento.</div>
            <div><b>Votações</b><br />A base do governo no Congresso, votação a votação.</div>
          </>
        )}
      </div>
    </div>
  );
}

function BlocoFiscalResumo({ uf, foco, aberta, alternar }: { uf: UF; foco: FocoMandato; aberta: string | null; alternar: (id: string) => void }) {
  const fim = foco.ate ?? somarMeses(foco.fim.slice(0, 7), 1);
  const fiscal = useJson<DadosFiscais>(`/api/painel/resumo/fiscal?uf=${uf.sigla}&posse=${foco.posse}&fim=${fim}`);
  if (fiscal.erro) return (
    <Bloco titulo="Dívida e pessoal" detalhe="RGF · Tesouro Nacional">
      <div className={s.aviso} role="alert">O Tesouro não respondeu agora. <button type="button" onClick={fiscal.tentar}>Tentar de novo</button></div>
    </Bloco>
  );
  return <BlocoLinhas titulo="Dívida e pessoal" detalhe="RGF · % da receita ajustada · fora da contagem do topo" linhas={fiscal.dado ? linhasFiscais(fiscal.dado) : null} aberta={aberta} alternar={alternar} foco={foco} />;
}

/**
 * A saúde num bloco só: a rede SUS no território (CNES, de todos os gestores), o
 * Mais Médicos (programa federal) e, só onde há um total publicado (o GERCON, no
 * RS), a fila da regulação. Nada disto é só do governo escolhido: tem a cor da
 * régua, mas fica fora da contagem do topo.
 */
function BlocoSaude({
  uf,
  rede,
  maisMedicos,
  aberta,
  alternar,
  foco,
}: {
  uf: UF | null;
  rede: LinhaResumo[] | null;
  maisMedicos: LinhaResumo[] | null;
  aberta: string | null;
  alternar: (id: string) => void;
  foco: FocoMandato;
}) {
  const portal = uf ? PORTAIS[uf.sigla] : undefined;
  const lista = (linhas: LinhaResumo[] | null, vazio: string) =>
    !linhas ? (
      <p className={s.tileQuando}>Carregando…</p>
    ) : linhas.length ? (
      <ul className={s.linhas}>
        {linhas.map((l) => (
          <Linha key={l.id} l={l} aberta={aberta === l.id} alternar={() => alternar(l.id)} foco={foco} />
        ))}
      </ul>
    ) : (
      <p className={s.tileQuando}>{vazio}</p>
    );
  return (
    <Bloco id="resumo-saude" titulo="Saúde" detalhe="SUS · Ministério da Saúde · fora da contagem do topo">
      <div className={s.colunas}>
        <div>
          <div className={s.grupo}>Rede SUS {uf ? uf.emNome : "no país"} · todos os gestores</div>
          {lista(rede, "A consulta à rede hospitalar não respondeu agora.")}
        </div>
        <div>
          <div className={s.grupo}>Mais Médicos · programa federal</div>
          {lista(maisMedicos, "Sem dado do programa agora.")}
          {portal && (
            <p className={s.notaSaude}>
              Filas: o estado mantém uma consulta oficial, <a href={portal.url}>{portal.nome}</a>. Ela serve para acompanhar um pedido; não dá um total comparável entre governos.
            </p>
          )}
        </div>
      </div>
      {uf?.sigla === "RS" && (
        <div className={s.filasSaude}>
          <div className={s.grupo}>Filas na regulação · GERCON</div>
          <FilasSUS territorio="RS" posse={foco.posse} fim={foco.ate ?? somarMeses(foco.fim.slice(0, 7), 1)} semBloco />
        </div>
      )}
    </Bloco>
  );
}

// --- Cabeçalho -------------------------------------------------------------------

function Cabeca({
  dados,
  uf,
  setSigla,
  termo,
  termos,
  presidente,
  mandatos,
  presidentesNoPeriodo,
  foco,
  contas,
  julgadas,
  frase,
  aoEscolherMandato,
  verPresidente,
  cartao,
}: {
  dados: DadosPainel;
  uf: UF | null;
  setSigla: (s: string | null) => void;
  termo: TermoGoverno | null;
  termos: TermoGoverno[];
  presidente: MandatoVisual | null;
  mandatos: MandatoVisual[];
  presidentesNoPeriodo: MandatoVisual[];
  foco: FocoMandato;
  contas: ReturnType<typeof contarLinhas>;
  julgadas: number;
  frase: string;
  aoEscolherMandato: (id: string) => void;
  verPresidente: (id: string) => void;
  cartao: ReactNode;
}) {
  const g = dados.governos;
  const pessoas = termo ? [...new Map(termo.trechos.map((t) => [t.nome, t])).values()] : [];
  const previsto = uf && foco.emCurso ? g.previstos?.[uf.sigla] : undefined;
  const comparadas = contas.melhor + contas.igual + contas.pior;
  // O trilho rola até o governo na tela, sem mexer na rolagem da página. Sem barra de
  // rolagem: as bordas esmaecem e as setas aparecem só do lado em que há mais governos.
  const trilho = useRef<HTMLElement>(null);
  const [bordas, setBordas] = useState({ esq: false, dir: false });
  const medirBordas = useCallback(() => {
    const n = trilho.current;
    if (!n) return;
    const esq = n.scrollLeft > 4;
    const dir = n.scrollLeft + n.clientWidth < n.scrollWidth - 4;
    setBordas((b) => (b.esq === esq && b.dir === dir ? b : { esq, dir }));
  }, []);
  useEffect(() => {
    const nav = trilho.current;
    const atual = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (nav && atual) nav.scrollLeft = atual.offsetLeft - nav.clientWidth / 2 + atual.offsetWidth / 2;
    medirBordas();
    window.addEventListener("resize", medirBordas);
    return () => window.removeEventListener("resize", medirBordas);
  }, [foco.id, uf, medirBordas]);
  const rolar = (lado: 1 | -1) => trilho.current?.scrollBy({ left: lado * trilho.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <header className={`vidro ${s.cabeca}`}>
      <div className={s.topoCabeca}>
        <div className={s.esferas} role="group" aria-label="Esfera de governo">
          <button type="button" className={s.esfera} aria-pressed={!uf} onClick={() => setSigla(null)}>
            Brasil
          </button>
          <SeletorUf ufs={dados.ufs} uf={uf} aoEscolher={setSigla} />
          <SeletorMunicipio uf={uf?.sigla ?? null} municipio={null} />
        </div>
      </div>

      <div className={s.quem}>
        <div className={s.identidade}>
          <div className={s.retratos}>
            {uf ? (
              pessoas.length ? (
                pessoas.map((t) => (
                  <span key={t.nome} className={s.retratoGrande}>
                    <RetratoGovernador uf={uf.sigla} nome={t.nome} tamanho={pessoas.length > 1 ? 64 : 84} />
                  </span>
                ))
              ) : (
                <Image src={`/painel/bandeiras/${uf.sigla.toLowerCase()}.svg`} alt="" width={84} height={60} unoptimized />
              )
            ) : (
              presidente && (
                <span className={s.retratoGrande}>
                  <Retrato presidente={presidente} tamanho="gg" prioridade />
                </span>
              )
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className={s.sobretitulo}>
              {uf ? `Governo ${uf.deNome}` : "Governo federal"} · {foco.posse.slice(0, 4)}–{foco.fim.slice(0, 4)}
              {foco.emCurso ? " · em curso" : ""}
            </div>
            <h2 className={s.titulo}>{uf ? (termo?.nomes.join(" e ") ?? uf.nome) : (presidente?.nome ?? "Presidência")}</h2>
            {uf
              ? termo?.trechos.map((t, i) => <LinhaTrecho key={`${t.nome}-${t.inicio}-${i}`} g={g} t={t} varios={termo.trechos.length > 1} />)
              : presidente && (
                  <div className={s.linhaPartido}>
                    <PartidoComLogo g={g} sigla={presidente.partido} />
                    <span>
                      {presidente.mandato}º mandato · {mesAno(presidente.inicio)} a {presidente.emCurso ? "hoje" : mesAno(presidente.fim)}
                    </span>
                  </div>
                )}
            {previsto && (
              <p className={s.nota}>
                Eleito em 2026: <b>{previsto.nome}</b>
                {previsto.partido ? ` (${rotuloPartido(g, previsto.partido)})` : ""}, posse em {previsto.posse.split("-").reverse().join("/")}.
              </p>
            )}
            {uf && presidentesNoPeriodo.length > 0 && (
              <p className={s.nota}>
                Em Brasília no período:{" "}
                {presidentesNoPeriodo.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && (i === presidentesNoPeriodo.length - 1 ? " e " : ", ")}
                    <button
                      type="button"
                      onClick={() => verPresidente(m.id)}
                      className="font-semibold hover:underline"
                      style={{ color: "var(--tinta)" }}
                      title={`Ver o resumo do governo federal: ${m.nomeCurto}`}
                    >
                      {m.nomeCurto}
                    </button>{" "}
                    ({m.partido ?? "s/ partido"})
                  </span>
                ))}
                .
              </p>
            )}
          </div>
        </div>

        <div className={s.placar} aria-label="Placar do resumo">
          <span className={s.placarRotulo}>
            {uf ? "O que é do estado, desde a posse" : "A economia, desde a posse"}
          </span>
          {julgadas ? (
            <>
              <div className={s.placarNumeros}>
                <span style={{ color: "var(--bom)" }}>
                  {contas.bons}
                  <small>melhoraram</small>
                </span>
                <span style={{ color: "var(--ruim)" }}>
                  {contas.ruins}
                  <small>pioraram</small>
                </span>
                {contas.iguais > 0 && (
                  <span style={{ color: "var(--tinta-3)" }}>
                    {contas.iguais}
                    <small>iguais</small>
                  </span>
                )}
              </div>
              <div className={s.placarBarra} aria-hidden>
                {contas.bons > 0 && <i style={{ flex: contas.bons, background: "var(--bom)" }} />}
                {contas.iguais > 0 && <i style={{ flex: contas.iguais, background: "var(--grade)" }} />}
                {contas.ruins > 0 && <i style={{ flex: contas.ruins, background: "var(--ruim)" }} />}
              </div>
              {uf && comparadas > 0 && (
                <span className={s.contraBrasil}>
                  Contra o Brasil: <b style={{ color: "var(--bom)" }}>{contas.melhor} melhor</b> · {contas.igual} igual ·{" "}
                  <b style={{ color: "var(--ruim)" }}>{contas.pior} pior</b>
                </span>
              )}
            </>
          ) : (
            <span className={s.contraBrasil}>Ainda sem medida com dado antes e depois da posse.</span>
          )}
          <div className={s.compartilhar}>
            <Compartilhar mensagem={frase} />
            {cartao}
          </div>
        </div>
      </div>

      <div className={s.trilhoCaixa} data-esq={bordas.esq || undefined} data-dir={bordas.dir || undefined}>
      <button type="button" className={s.setaTrilho} data-lado="esq" onClick={() => rolar(-1)} aria-label="Governos anteriores" hidden={!bordas.esq}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
      </button>
      <nav ref={trilho} className={s.trilho} aria-label={uf ? `Governos ${uf.deNome}` : "Presidentes"} onScroll={medirBordas}>
        {uf
          ? termos.map((t) => {
              const quem = principalDoTermo(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  className={s.termo}
                  aria-current={t.id === foco.id}
                  onClick={() => aoEscolherMandato(t.id)}
                  title={`${t.ano}–${t.ano + 3}: ${t.nomes.join(", ")}`}
                >
                  <RetratoGovernador uf={uf.sigla} nome={quem} tamanho={32} />
                  {t.ano}–{t.ano + 3} · {quem.split(" ")[0]}
                  {t.nomes.length > 1 ? ` +${t.nomes.length - 1}` : ""}
                </button>
              );
            })
          : [...mandatos]
              .sort((a, b) => a.inicio.localeCompare(b.inicio))
              .map((m) => (
                <button key={m.id} type="button" className={s.termo} aria-current={m.id === foco.id} onClick={() => aoEscolherMandato(m.id)}>
                  <Retrato presidente={m} tamanho="p" />
                  {m.nomeCurto}
                  {m.mandato > 1 ? ` ${m.mandato}` : ""} · {m.inicio.slice(0, 4)}
                </button>
              ))}
      </nav>
      <button type="button" className={s.setaTrilho} data-lado="dir" onClick={() => rolar(1)} aria-label="Governos seguintes" hidden={!bordas.dir}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
      </button>
      </div>
    </header>
  );
}

/**
 * O estado do resumo: a mesma lista de vidro do seletor de mandato do topo, com a
 * bandeira de cada UF e os estados agrupados por região, em duas colunas.
 */
export function SeletorUf({ ufs, uf, aoEscolher, ativo = Boolean(uf) }: { ufs: UF[]; uf: UF | null; aoEscolher: (s: string) => void; /** Num município, a UF aparece sem estar marcada. */ ativo?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const listaId = useId();
  const regioes = useMemo(() => {
    const grupos = new Map<string, { nome: string; codigo: string; ufs: UF[] }>();
    for (const u of ufs) {
      const g = grupos.get(u.regiaoCodigo) ?? { nome: u.regiao, codigo: u.regiaoCodigo, ufs: [] };
      g.ufs.push(u);
      grupos.set(u.regiaoCodigo, g);
    }
    return [...grupos.values()]
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map((g) => ({ ...g, ufs: g.ufs.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) }));
  }, [ufs]);

  useEffect(() => {
    if (!aberto) return;
    (raiz.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? raiz.current?.querySelector<HTMLElement>('[role="option"]'))?.focus();
    const fora = (e: globalThis.PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && aberto) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(false);
      gatilho.current?.focus();
    } else if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      if (!aberto && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      e.preventDefault();
      if (!aberto) {
        setAberto(true);
        return;
      }
      const opcoes = [...(raiz.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
      const i = opcoes.findIndex((o) => o === document.activeElement);
      const passo = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      const n = e.key === "Home" ? 0 : e.key === "End" ? opcoes.length - 1 : (i + passo + opcoes.length) % opcoes.length;
      opcoes[n]?.focus();
    }
  };

  return (
    <div
      ref={raiz}
      className={s.seletorUf}
      onKeyDown={teclado}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
      }}
    >
      <button
        ref={gatilho}
        type="button"
        className={s.esfera}
        aria-pressed={ativo}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-label={uf ? `Estado: ${uf.nome}. Trocar de estado` : "Escolher um estado"}
        onClick={() => setAberto(!aberto)}
      >
        {uf && <Image className={s.bandeira} src={`/painel/bandeiras/${uf.sigla.toLowerCase()}.svg`} alt="" width={18} height={13} unoptimized />}
        {uf ? (
          <>
            <span className={s.nomeUf}>{uf.nome}</span>
            <span className={s.siglaUf}>{uf.sigla}</span>
          </>
        ) : (
          "Estados"
        )}
        <svg className={s.setaMenu} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        // O vidro desenha o fundo numa camada que rolaria junto com o conteúdo: a caixa de
        // vidro fica parada e só a lista de dentro rola.
        <div className={`mandato-opcoes vidro ${s.listaUf}`}>
        <div id={listaId} role="listbox" aria-label="Estados" className={s.listaUfRolagem}>
          {regioes.map((r) => (
            <div key={r.codigo} role="group" aria-label={r.nome} className={s.grupoUf}>
              <div className={s.regiao} aria-hidden>
                {r.nome}
              </div>
              {r.ufs.map((u) => (
                <button
                  key={u.sigla}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={u.sigla === uf?.sigla}
                  className={`mandato-opcao ${s.opcaoUf}`}
                  onClick={() => {
                    aoEscolher(u.sigla);
                    setAberto(false);
                    gatilho.current?.focus();
                  }}
                >
                  <Image className={s.bandeira} src={`/painel/bandeiras/${u.sigla.toLowerCase()}.svg`} alt="" width={18} height={13} unoptimized />
                  <span>{u.nome}</span>
                  <small>{u.sigla}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  );
}

/** Quem ficou mais tempo no cargo no mandato: o rosto e o nome do trilho. */
function principalDoTermo(t: TermoGoverno): string {
  const dias = new Map<string, number>();
  for (const x of t.trechos) {
    const a = x.inicio > t.inicio ? x.inicio : t.inicio;
    const b = x.fim === null || x.fim > t.fim ? t.fim : x.fim;
    dias.set(x.nome, (dias.get(x.nome) ?? 0) + Math.max(0, Date.parse(b) - Date.parse(a)));
  }
  return [...dias.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? t.nomes[0];
}

function LinhaTrecho({ g, t, varios }: { g: Governos; t: TrechoGoverno; varios: boolean }) {
  return (
    <div className={s.linhaPartido}>
      {varios && <b style={{ color: "var(--tinta)" }}>{t.nome.split(" ")[0]}</b>}
      <PartidoComLogo g={g} sigla={t.partido} />
      <span>
        {mesAno(t.inicio)} a {t.fim ? mesAno(t.fim) : "hoje"} · {comoEntrou(t)}
        {t.eleitoPor && t.eleitoPor !== t.partido ? ` pelo ${rotuloPartido(g, t.eleitoPor)}` : ""}
      </span>
    </div>
  );
}

// --- Linhas ----------------------------------------------------------------------

const TEXTO_COMPARACAO: Record<Comparacao, string> = { melhor: "melhor que o Brasil", igual: "igual ao Brasil", pior: "pior que o Brasil" };
const COR_COMPARACAO: Record<Comparacao, string> = { melhor: "var(--bom)", igual: "var(--tinta-3)", pior: "var(--ruim)" };

function TagBrasil({ c }: { c: Comparacao | null }) {
  if (!c) return null;
  return (
    <span className={s.tag} style={{ color: COR_COMPARACAO[c] }}>
      {TEXTO_COMPARACAO[c]}
    </span>
  );
}

export function BlocoLinhas({
  titulo,
  detalhe,
  linhas,
  aberta,
  alternar,
  foco,
}: {
  titulo: string;
  detalhe: string;
  linhas: LinhaResumo[] | null;
  aberta: string | null;
  alternar: (id: string) => void;
  foco: FocoMandato;
}) {
  return (
    <Bloco titulo={titulo} detalhe={detalhe}>
      {linhas ? (
        <ul className={s.linhas}>
          {linhas.map((l) => (
            <Linha key={l.id} l={l} aberta={aberta === l.id} alternar={() => alternar(l.id)} foco={foco} />
          ))}
        </ul>
      ) : (
        <p className={s.tileQuando}>Carregando…</p>
      )}
    </Bloco>
  );
}

function Linha({ l, aberta, alternar, foco }: { l: LinhaResumo; aberta: boolean; alternar: () => void; foco: FocoMandato }) {
  return (
    <li>
      <button type="button" className={s.linha} aria-expanded={aberta} onClick={alternar}>
        <span className={s.linhaNome}>
          <b>{l.nome}</b>
          <small>{l.detalhe}</small>
        </span>
        <span className={s.linhaValores}>
          {l.de && <>{l.de} → </>}
          <b>{l.para ?? "—"}</b>
        </span>
        {l.mudanca ? <PilulaVeredito texto={l.mudanca} sentido={l.sentido} className={s.pilula} /> : <span className={s.semComparar}>sem régua</span>}
        <span className={s.linhaBrasil}>
          {l.falta ?? l.brasil}
          <TagBrasil c={l.comparacao} />
        </span>
        <i className={s.seta} aria-hidden />
      </button>
      {aberta && <DetalheLinha l={l} foco={foco} />}
    </li>
  );
}

function DetalheLinha({ l, foco, verAba }: { l: LinhaResumo; foco: FocoMandato; verAba?: (aba: "economia" | "ambiente" | "dinheiro") => void }) {
  return (
    <div className={s.detalhe}>
      {l.periodo && <p>{l.periodo}{l.brasil ? `; no mesmo período, ${l.brasil.replace(/^Brasil /, "o Brasil teve ")}.` : "."}</p>}
      {l.nota && <p>{l.nota}</p>}
      {l.grafico && <Grafico g={l.grafico} foco={foco} sentido={l.sentido} />}
      <div className={s.rodapeDetalhe}>
        <span>Fonte: {l.urlFonte ? <a href={l.urlFonte}>{l.fonte}</a> : l.fonte}</span>
        {l.aba && verAba && (
          <a
            href={destinoPainel({ aba: l.aba })}
            onClick={(e) => {
              e.preventDefault();
              verAba(l.aba!);
            }}
          >
            Ver na aba {l.aba === "ambiente" ? "Meio ambiente" : l.aba === "dinheiro" ? "Orçamento" : "Economia"} →
          </a>
        )}
      </div>
    </div>
  );
}

// --- Contexto em mosaico ----------------------------------------------------------

export function Mosaico({
  linhas,
  aberta,
  alternar,
  foco,
  comBrasil,
  verAba,
}: {
  linhas: LinhaResumo[];
  aberta: string | null;
  alternar: (id: string) => void;
  foco: FocoMandato;
  comBrasil: boolean;
  verAba: (aba: "economia" | "ambiente" | "dinheiro") => void;
}) {
  const escolhida = linhas.find((l) => l.id === aberta) ?? null;
  return (
    <>
      <div className={s.mosaico}>
        {linhas.map((l) => (
          <button key={l.id} type="button" className={`vidro ${s.tile}`} aria-expanded={aberta === l.id} onClick={() => alternar(l.id)}>
            <span className={s.tileNome}>{l.nome}</span>
            <span className={s.tileValor}>
              <strong>{l.para ?? "—"}</strong>
              {l.mudanca && <PilulaVeredito texto={l.mudanca} sentido={l.sentido} className="text-[12.5px]" />}
            </span>
            <span className={s.tileQuando}>
              {l.detalhe}
              {l.de ? ` · recebeu ${l.de}` : ""}
            </span>
            {(comBrasil || l.falta) && (
              <span className={s.tileBrasil}>
                {l.falta ?? l.brasil ?? "Sem o Brasil para comparar"}
                <TagBrasil c={l.comparacao} />
              </span>
            )}
          </button>
        ))}
      </div>
      {escolhida && (
        <div className={`vidro ${s.detalheMosaico}`}>
          <div className={s.secaoTitulo} style={{ padding: 0 }}>
            <h3 className="text-[15px] font-semibold">{escolhida.nome}</h3>
            <span>{escolhida.detalhe}</span>
          </div>
          <DetalheLinha l={escolhida} foco={foco} verAba={verAba} />
        </div>
      )}
    </>
  );
}

// --- Economia federal --------------------------------------------------------------

function BlocoEconomia({
  grupos,
  aberta,
  alternar,
  aoVerHistorico,
}: {
  grupos: { titulo: string; itens: ItemPlacar[] }[];
  aberta: string | null;
  alternar: (id: string) => void;
  aoVerHistorico: () => void;
}) {
  return (
    <Bloco titulo="Economia" detalhe="o placar da aba Economia" className={s.largo}>
      <div className={s.colunas}>
      {grupos.map((grupo) => (
        <div key={grupo.titulo}>
          <div className={s.grupo}>{grupo.titulo}</div>
          <ul className={s.linhas}>
            {grupo.itens.map((x) => {
              const id = `eco-${x.id}`;
              const estaAberta = aberta === id;
              return (
                <li key={id}>
                  <button type="button" className={s.linha} aria-expanded={estaAberta} onClick={() => alternar(id)}>
                    <span className={s.linhaNome}>
                      <b>{x.rotulo}</b>
                    </span>
                    <span className={s.linhaValores}>
                      <b>{x.agora}</b>
                    </span>
                    <PilulaVeredito texto={x.mudanca} sentido={x.sentido} className={s.pilula} />
                    <i className={s.seta} aria-hidden />
                  </button>
                  {estaAberta && <Detalhe x={x} aoVerHistorico={aoVerHistorico} />}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      </div>
      {!grupos.length && <p className={s.tileQuando}>Sem placar para este mandato.</p>}
    </Bloco>
  );
}

// --- Gráfico ------------------------------------------------------------------------

const mesNum = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;

const COR_FAIXA: Record<Sentido, string> = { bom: "var(--bom)", ruim: "var(--ruim)", neutro: "var(--ouro)" };

/**
 * A linha da medida com o mandato numa faixa da cor do veredito e a posse em
 * ouro. No estado, o Brasil vai tracejado na mesma escala. Passar o dedo ou o
 * mouse mostra o ponto mais próximo.
 */
function Grafico({ g, foco, sentido }: { g: GraficoResumo; foco: FocoMandato; sentido: Sentido }) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [sob, setSob] = useState<number | null>(null);
  const datas = g.series[0]?.datas ?? [];
  const validos = (i: number) => g.series.some((x) => x.valores[i] !== null && x.valores[i] !== undefined);
  let ini = 0;
  while (ini < datas.length && !validos(ini)) ini++;
  let fim = datas.length - 1;
  while (fim > ini && !validos(fim)) fim--;
  const todos = g.series.flatMap((x) => x.valores.slice(ini, fim + 1).filter((v): v is number => v !== null && v !== undefined));
  const altura = 150;
  const M = { topo: 10, dir: 58, base: 22, esq: 40 };
  const fmt = (v: number) => `${numero(v, g.casas)}${g.sufixo}`;

  if (!todos.length || fim <= ini) {
    return (
      <div ref={ref} className={s.grafico}>
        <p className={s.tileQuando}>Sem série para desenhar.</p>
      </div>
    );
  }
  let lo = Math.min(...todos);
  let hi = Math.max(...todos);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const folga = (hi - lo) * 0.08;
  const ticks = marcasGraficoResumo(lo >= 0 ? Math.max(0, lo - folga) : lo - folga, hi + folga);
  const yMin = ticks[0];
  const yMax = ticks.at(-1)!;
  const t0 = mesNum(datas[ini]);
  const t1 = mesNum(datas[fim]);
  const w = Math.max(0, largura - M.esq - M.dir);
  const h = altura - M.topo - M.base;
  const x = (d: string) => M.esq + ((mesNum(d) - t0) / Math.max(1, t1 - t0)) * w;
  const y = (v: number) => M.topo + (1 - (v - yMin) / (yMax - yMin || 1)) * h;
  const xPosse = mesNum(foco.posse) >= t0 && mesNum(foco.posse) <= t1 ? x(foco.posse) : mesNum(foco.posse) < t0 ? M.esq : null;
  const fimMandato = foco.ate ? Math.min(mesNum(foco.ate) - 1, t1) : t1;
  const xFim = M.esq + ((fimMandato - t0) / Math.max(1, t1 - t0)) * w;
  const rotuloData = (d: string) => (g.pontos ? d.slice(0, 4) : mesAnoCurto(d));
  const anos = [...new Set(datas.slice(ini, fim + 1).map((d) => d.slice(0, 4)))];
  const passoAno = Math.max(1, Math.ceil(anos.length / Math.max(2, Math.floor(w / 56))));

  const caminho = (valores: (number | null)[]) => {
    let p = "";
    let novo = true;
    for (let i = ini; i <= fim; i++) {
      const v = valores[i];
      if (v === null || v === undefined) {
        if (!g.pontos) novo = true;
        continue;
      }
      p += `${novo ? "M" : "L"}${x(datas[i]).toFixed(1)},${y(v).toFixed(1)}`;
      novo = false;
    }
    return p;
  };
  const mover = (e: PointerEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caixa.left;
    let melhor = -1;
    let dist = Infinity;
    for (let i = ini; i <= fim; i++) {
      if (!validos(i)) continue;
      const d = Math.abs(x(datas[i]) - px);
      if (d < dist) {
        dist = d;
        melhor = i;
      }
    }
    setSob(melhor >= 0 ? melhor : null);
  };

  return (
    <div ref={ref} className={s.grafico}>
      <div className={s.tituloGrafico}>{g.titulo}</div>
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label={`${g.series[0].rotulo}: ${g.titulo}`} onPointerMove={mover} onPointerLeave={() => setSob(null)}>
          {xPosse !== null && xFim > xPosse && (
            <rect x={xPosse} y={M.topo} width={xFim - xPosse} height={h} fill={COR_FAIXA[sentido]} opacity={0.09} />
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} stroke="var(--grade)" strokeWidth={1} opacity={0.6} />
              <text x={M.esq - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--tinta-3)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {anos.map((a, i) =>
            i % passoAno === 0 ? (
              <text key={a} x={x(`${a}-${g.pontos ? "11" : "01"}`) < M.esq ? M.esq : x(`${a}-${g.pontos ? "11" : "01"}`)} y={altura - 6} fontSize={10} fill="var(--tinta-3)" textAnchor="middle">
                {a}
              </text>
            ) : null,
          )}
          {xPosse !== null && (
            <g>
              <line x1={xPosse} x2={xPosse} y1={M.topo - 4} y2={M.topo + h} stroke="var(--ouro-forte, var(--ouro))" strokeWidth={1.5} strokeDasharray="3 3" />
              <text x={xPosse + 4} y={M.topo + 6} fontSize={10} fill="var(--tinta-2)">
                posse
              </text>
            </g>
          )}
          {g.series
            .slice()
            .reverse()
            .map((serie) => (
              <g key={serie.rotulo}>
                <path
                  d={caminho(serie.valores)}
                  fill="none"
                  stroke={serie.principal ? "var(--tinta)" : "var(--tinta-3)"}
                  strokeWidth={serie.principal ? 2 : 1.4}
                  strokeDasharray={serie.principal ? undefined : "4 3"}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={g.pontos && !serie.principal ? 0.8 : 1}
                />
                {g.pontos &&
                  serie.valores.map((v, i) =>
                    v === null || v === undefined || i < ini || i > fim ? null : (
                      <circle key={i} cx={x(datas[i])} cy={y(v)} r={serie.principal ? 3.2 : 2.4} fill={serie.principal ? "var(--tinta)" : "var(--superficie)"} stroke={serie.principal ? "none" : "var(--tinta-3)"} />
                    ),
                  )}
              </g>
            ))}
          {g.series.map((serie, k) => {
            let i = fim;
            while (i >= ini && (serie.valores[i] === null || serie.valores[i] === undefined)) i--;
            if (i < ini) return null;
            const v = serie.valores[i]!;
            const outro = g.series[1 - k]?.valores[i];
            // Rótulos que se encostariam: o de cima sobe, o de baixo desce; empate, o principal sobe.
            const empurra = outro !== null && outro !== undefined && Math.abs(y(outro) - y(v)) < 12 ? (v > outro || (v === outro && serie.principal) ? -6 : 6) : 0;
            return (
              <text key={serie.rotulo} x={x(datas[i]) + 6} y={y(v) + 3.5 + empurra} fontSize={10.5} fontWeight={serie.principal ? 650 : 500} fill={serie.principal ? "var(--tinta)" : "var(--tinta-3)"}>
                {serie.rotulo} {fmt(v)}
              </text>
            );
          })}
          {sob !== null && (
            <g pointerEvents="none">
              <line x1={x(datas[sob])} x2={x(datas[sob])} y1={M.topo} y2={M.topo + h} stroke="var(--tinta-3)" strokeWidth={1} />
              {g.series.map((serie) => {
                const v = serie.valores[sob];
                return v === null || v === undefined ? null : (
                  <circle key={serie.rotulo} cx={x(datas[sob])} cy={y(v)} r={3.5} fill="var(--superficie)" stroke={serie.principal ? "var(--tinta)" : "var(--tinta-3)"} strokeWidth={1.5} />
                );
              })}
            </g>
          )}
        </svg>
      )}
      {sob !== null && largura > 0 && (
        <div className={s.balao} style={{ left: Math.min(Math.max(x(datas[sob]), 70), largura - 70), top: -6 }}>
          <b>{rotuloData(datas[sob])}</b>
          {g.series.map((serie) => {
            const v = serie.valores[sob];
            return (
              <span key={serie.rotulo}>
                {" · "}
                {serie.rotulo} {v === null || v === undefined ? "sem dado" : fmt(v)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Dinheiro ------------------------------------------------------------------------

function BlocoDinheiro({
  painel,
  erro,
  tentar,
  uf,
  foco,
  dados,
  mandatos,
  verAba,
  aoEscolherMandato,
}: {
  painel: PainelDinheiro | null;
  erro: boolean;
  tentar: () => void;
  uf: UF | null;
  foco: FocoMandato;
  dados: DadosPainel;
  mandatos: MandatoVisual[];
  verAba: () => void;
  aoEscolherMandato: (id: string) => void;
}) {
  const [item, setItem] = useEstadoCompartilhavel<string | null>("resumo.orcamento", null, validarId);
  const titulo = tituloOrcamento(uf);
  // Os anos de cada governo e o nome que o gráfico ano a ano escreve embaixo deles.
  const { grupos, nomes } = useMemo(() => {
    if (!painel) return { grupos: [] as GrupoDeAnos[], nomes: {} as Record<string, string> };
    if (uf) {
      const termos = termosDoGoverno(dados.governos, uf.sigla, mandatos);
      return { grupos: gruposDeGovernadores(painel.anos, termos), nomes: Object.fromEntries(termos.map((t) => [t.id, principalDoTermo(t)])) };
    }
    const lista = gruposDePresidentes(painel.anos, mandatos);
    return { grupos: lista, nomes: Object.fromEntries(lista.map((g) => [g.id, g.rotulo])) };
  }, [painel, uf, dados.governos, mandatos]);

  if (!painel) {
    return (
      <Bloco titulo={titulo} detalhe="Tesouro Nacional · Siconfi">
        {erro ? (
          <p className={s.tileQuando}>
            O orçamento não respondeu agora.{" "}
            <button type="button" onClick={tentar} className="font-semibold" style={{ color: "var(--serie)" }}>
              Tentar de novo
            </button>
          </p>
        ) : (
          <p className={s.tileQuando}>Carregando…</p>
        )}
      </Bloco>
    );
  }

  const ente: EnteDinheiro | undefined = painel.entes[uf?.sigla ?? "BR"];
  const grupo = grupos.find((x) => x.id === foco.id);
  const anosComDado = (grupo?.anos ?? []).filter((a) => ente?.anos[String(a)]);
  const fechados = anosComDado.filter((a) => a !== painel.parcial?.ano);
  const ano = fechados.at(-1) ?? anosComDado.at(-1);

  if (!ente || ano === undefined) {
    return (
      <Bloco titulo={titulo} detalhe="Tesouro Nacional · Siconfi">
        <p className={s.tileQuando}>
          A base de despesas por função começa em {painel.anos[0]}: não há ano deste mandato nela.
        </p>
      </Bloco>
    );
  }

  const base = baseDoAno(painel, ano, grupos);
  const ponto = ente.anos[String(ano)];
  const idx = painel.idx[String(ano)] ?? 1;
  const total = ponto.t * idx;
  const porHabitante = ponto.p ? total / ponto.p : null;
  const mudancaTotal = variacaoReal(painel, ente, ano, base, "_total");
  const itens = Object.entries(ponto.v)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const principais = itens.slice(0, 7);
  const resto = itens.slice(7).reduce((soma, [, v]) => soma + v, 0);
  const parcial = painel.parcial?.ano === ano;
  const escolhido = item && (item === "_total" || ponto.v[item] !== undefined) ? item : null;
  const familia = (id: string) => itemDe(id)?.familia ?? "opaco";

  return (
    <Bloco
      titulo={titulo}
      className={s.largo}
      detalhe={`Tesouro Nacional · Siconfi · em R$ de ${painel.baseReal}`}
      acao={
        <a
          href={destinoPainel({ aba: "dinheiro", uf: uf?.sigla })}
          onClick={(e) => {
            e.preventDefault();
            verAba();
          }}
          className="text-[11.5px] font-medium hover:underline"
          style={{ color: "var(--serie)" }}
        >
          Aba Orçamento →
        </a>
      }
    >
      <div className={s.numerosOrc}>
        <strong>{reais(total)}</strong>
        <span>
          gastos em {ano}
          {parcial ? ` até ${painel.parcial?.mes}` : ""}
          {porHabitante ? ` · ${reais(porHabitante)} por habitante` : ""}
        </span>
      </div>
      <p className={s.tileQuando} style={{ marginTop: 4 }}>
        {mudancaTotal === null
          ? "Sem o ano antes da posse na base para comparar."
          : `${mudancaTotal >= 0 ? "+" : "−"}${numero(Math.abs(mudancaTotal), 0)}% acima da inflação contra ${base?.texto}, o ano que o governo recebeu. Gastar mais não é melhor nem pior: o painel não pinta esta conta.`}
        {ponto.fora ? ` Fora do total: ${reais(ponto.fora * idx)} repassados a municípios, que só alguns estados lançam como despesa.` : ""}
      </p>

      <div className={s.barraOrc} data-escolhido={escolhido && escolhido !== "_total" ? "" : undefined} role="group" aria-label={`Para onde foi o dinheiro em ${ano}`}>
        {principais.map(([id, v]) => (
          <button
            key={id}
            type="button"
            className={`${s.segOrc} dn-f-${familia(id)}`}
            style={{ flex: v }}
            aria-pressed={escolhido === id}
            onClick={() => setItem(escolhido === id ? null : id)}
            title={`${nomeDoItem(id)}: ${reais(v * idx)} (${numero((100 * v) / ponto.t, 1)}%)`}
          >
            {v / ponto.t > 0.07 && (
              <>
                <strong>{numero((100 * v) / ponto.t, 0)}%</strong>
                <small>{nomeDoItem(id)}</small>
              </>
            )}
          </button>
        ))}
        {resto > 0 && <span className={`${s.segOrc} dn-r3`} style={{ flex: resto, cursor: "default" }} title={`Outros: ${reais(resto * idx)}`} />}
      </div>

      <div className={s.listaOrc}>
        {principais.map(([id, v]) => {
          const m = uf ? null : variacaoReal(painel, ente, ano, base, id);
          return (
            <button key={id} type="button" className={`${s.itemOrc} dn-f-${familia(id)}`} aria-pressed={escolhido === id} onClick={() => setItem(escolhido === id ? null : id)}>
              <i className={s.quadradinho} />
              {nomeDoItem(id)}
              <em>
                {reais(v * idx)}
                {m !== null ? ` · ${m >= 0 ? "+" : "−"}${numero(Math.abs(m), 0)}%` : ""}
              </em>
            </button>
          );
        })}
      </div>
      {uf && <p className={s.observacao}>Num estado, a variação de cada área fica de fora: a forma de classificar a despesa mudou entre os anos e criaria saltos que não são gasto. O total se compara.</p>}

      <HistoricoOrcamento
        painel={painel}
        ente={ente}
        grupos={grupos}
        nomes={nomes}
        focoId={foco.id}
        item={escolhido && escolhido !== "_total" ? escolhido : null}
        ano={ano}
        base={base}
        estado={Boolean(uf)}
        limparItem={() => setItem(null)}
        aoEscolherMandato={aoEscolherMandato}
      />
    </Bloco>
  );
}

/** Os números do topo do orçamento, para o card: a mesma conta do `BlocoDinheiro`. */
function orcamentoDoMandato(painel: PainelDinheiro, uf: UF | null, foco: FocoMandato, dados: DadosPainel, mandatos: MandatoVisual[]) {
  const grupos = uf ? gruposDeGovernadores(painel.anos, termosDoGoverno(dados.governos, uf.sigla, mandatos)) : gruposDePresidentes(painel.anos, mandatos);
  const ente = painel.entes[uf?.sigla ?? "BR"];
  const anosComDado = (grupos.find((x) => x.id === foco.id)?.anos ?? []).filter((a) => ente?.anos[String(a)]);
  const ano = anosComDado.filter((a) => a !== painel.parcial?.ano).at(-1) ?? anosComDado.at(-1);
  if (!ente || ano === undefined) return null;
  const base = baseDoAno(painel, ano, grupos);
  return {
    ano,
    total: ente.anos[String(ano)].t * (painel.idx[String(ano)] ?? 1),
    parcial: painel.parcial?.ano === ano ? painel.parcial.mes : null,
    mudanca: variacaoReal(painel, ente, ano, base, "_total"),
    base: base?.texto ?? null,
  };
}

/**
 * O gasto ano a ano, descontada a inflação. Cada barra diz o valor; embaixo, a chave
 * de cada governo (clicar leva ao resumo dele); o tracejado é o nível do ano que o
 * governo recebeu. Uma área escolhida aparece dentro do total, não sozinha: num
 * estado, ela pode crescer só porque outra encolheu (a despesa trocou de rubrica), e
 * isso só se vê com o total do lado. Gastar mais não é melhor nem pior: sem verde e vermelho.
 */
function HistoricoOrcamento({
  painel,
  ente,
  grupos,
  nomes,
  focoId,
  item,
  ano,
  base,
  estado,
  limparItem,
  aoEscolherMandato,
}: {
  painel: PainelDinheiro;
  ente: EnteDinheiro;
  grupos: GrupoDeAnos[];
  nomes: Record<string, string>;
  focoId: string;
  item: string | null;
  ano: number;
  base: ReturnType<typeof baseDoAno>;
  estado: boolean;
  limparItem: () => void;
  aoEscolherMandato: (id: string) => void;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [sob, setSob] = useState<number | null>(null);
  const anos = painel.anos.filter((a) => a !== painel.parcial?.ano && ente.anos[String(a)] && painel.idx[String(a)]);
  const valor = (a: number, id: string | null): number | null => {
    const p = ente.anos[String(a)];
    const k = painel.idx[String(a)];
    if (!p || !k) return null;
    return (id ? (p.v[id] ?? 0) : p.t) * k;
  };
  const doMandato = new Set(grupos.find((g) => g.id === focoId)?.anos ?? []);
  const grupoDoAno = (a: number) => grupos.find((g) => g.anos.includes(a));
  const iAno = anos.indexOf(ano);
  const iBase = base ? anos.indexOf(base.ano) : -1;

  const altura = 236;
  const M = { topo: 20, dir: 6, base: 52, esq: 44 };
  const w = Math.max(0, largura - M.esq - M.dir);
  const h = altura - M.topo - M.base;
  const maior = Math.max(...anos.map((a) => valor(a, null) ?? 0), 1);
  const yMax = maior * 1.08;
  const ticks = marcasGraficoResumo(0, maior, 4).filter((t) => t <= yMax);
  const banda = anos.length ? w / anos.length : 0;
  const barra = Math.min(banda * 0.66, 48);
  const xEsq = (i: number) => M.esq + banda * i + (banda - barra) / 2;
  const y = (v: number) => M.topo + h - (v / yMax) * h;
  const curto = (v: number) => reais(v).replace("R$ ", "");
  const eixo = (v: number) => (v === 0 ? "0" : v >= 1e12 ? `${numero(v / 1e12, v % 1e12 ? 1 : 0)} tri` : `${numero(v / 1e9, 0)} bi`);
  const medida = (a: number) => valor(a, item);
  const vBase = base && iBase >= 0 ? medida(base.ano) : null;
  const mandato = anos.map((a, i) => (doMandato.has(a) ? i : -1)).filter((i) => i >= 0);
  const cor = item ? `dn-f-${itemDe(item)?.familia ?? "opaco"}` : "";

  // O ano em detalhe: o que está sob o dedo ou o mouse; parado, o último do governo.
  const iDet = sob ?? iAno;
  const aDet = anos[iDet];
  const tDet = aDet === undefined ? null : valor(aDet, null);
  const tAntes = iDet > 0 ? valor(anos[iDet - 1], null) : null;
  const quemDet = aDet === undefined ? undefined : grupoDoAno(aDet);
  const popDet = aDet === undefined ? null : ente.anos[String(aDet)]?.p;
  const iDet2 = item && aDet !== undefined ? valor(aDet, item) : null;

  // Num estado, uma área que sobe enquanto outra desce no mesmo tanto é sinal de despesa
  // que trocou de rubrica. Os números vão por escrito; a leitura fica como possibilidade.
  const alerta = (() => {
    if (!estado || !item || !base || ano === painel.parcial?.ano) return null;
    const di = (valor(ano, item) ?? 0) - (valor(base.ano, item) ?? 0);
    const dT = (valor(ano, null) ?? 0) - (valor(base.ano, null) ?? 0);
    const total = valor(ano, null) ?? 1;
    if (Math.abs(di) < total * 0.02) return null;
    const ids = new Set([...Object.keys(ente.anos[String(ano)]?.v ?? {}), ...Object.keys(ente.anos[String(base.ano)]?.v ?? {})]);
    const opostos = [...ids]
      .filter((id) => id !== item)
      .map((id) => [id, (valor(ano, id) ?? 0) - (valor(base.ano, id) ?? 0)] as const)
      .filter(([, d]) => Math.sign(d) === -Math.sign(di) && Math.abs(d) >= Math.abs(di) * 0.4)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 2);
    if (!opostos.length) return null;
    const mov = (d: number) => `${d >= 0 ? "subiu" : "caiu"} ${reais(Math.abs(d))}`;
    return `De ${base.ano} a ${ano}, ${nomeDoItem(item)} ${mov(di)}. No mesmo período, ${opostos.map(([id, d]) => `${nomeDoItem(id)} ${mov(d)}`).join(" e ")}; o total ${mov(dT)}. Parte da mudança pode ser despesa que trocou de área, não gasto novo.`;
  })();

  // Um salto do total que mora quase todo numa linha sem área ("Outros encargos", "Sem
  // classificação") é contábil: em SP, 2018 tem R$ 65 bi a mais ali, que somem em 2019.
  // A barra ganha um asterisco e a nota diz onde está o salto, sem adivinhar a causa.
  const saltos = anos.slice(1).flatMap((a, j) => {
    const antes = valor(anos[j], null) ?? 0;
    const dT = (valor(a, null) ?? 0) - antes;
    if (!antes || Math.abs(dT) < antes * 0.12) return [];
    const linha = ["outros", "naoclass"]
      .map((id) => [id, (valor(a, id) ?? 0) - (valor(anos[j], id) ?? 0)] as const)
      .find(([, d]) => Math.sign(d) === Math.sign(dT) && Math.abs(d) >= Math.abs(dT) * 0.6);
    return linha ? [{ a, de: anos[j], id: linha[0], d: linha[1] }] : [];
  });
  const comSalto = new Set(saltos.map((x) => x.a));

  // O nome embaixo de cada governo: inteiro se couber, senão o primeiro e o último nome, senão o primeiro.
  const rotuloQueCabe = (nome: string, espaco: number) => {
    const partes = nome.split(" ");
    const opcoes = [nome, partes.length > 2 ? `${partes[0]} ${partes.at(-1)}` : nome, partes[0]];
    return opcoes.find((o) => o.length * 6.2 <= espaco) ?? "";
  };
  const escolherGoverno = (id: string) => {
    if (id !== focoId) aoEscolherMandato(id);
  };

  return (
    <div className={`${s.hist} ${cor}`}>
      <div className={s.rotuloBarra}>
        <span>
          <b>{item ? `${nomeDoItem(item)} dentro do total` : "Gasto total"}</b>, por ano, descontada a inflação
          {item && (
            <button type="button" className={s.verTotal} onClick={limparItem}>
              ver só o total
            </button>
          )}
        </span>
        <span className={s.legendaHist}>
          <span><i className={s.amostraMandato} data-item={item ? "" : undefined} />anos deste governo</span>
          {vBase !== null && <span><i className={s.amostraBase} />nível de {base?.ano}, o que recebeu</span>}
        </span>
      </div>
      <div ref={ref} className={s.histGrafico}>
        {largura > 0 && anos.length > 0 && (
          <svg
            width={largura}
            height={altura}
            role="img"
            aria-label={`${item ? nomeDoItem(item) : "Gasto total"} por ano, de ${anos[0]} a ${anos.at(-1)}, descontada a inflação`}
            onPointerLeave={() => setSob(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.esq} x2={M.esq + w} y1={y(t)} y2={y(t)} stroke="var(--grade)" strokeWidth={1} opacity={t === 0 ? 1 : 0.55} />
                <text x={M.esq - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--tinta-3)">
                  {eixo(t)}
                </text>
              </g>
            ))}
            {sob !== null && <rect x={M.esq + banda * sob} y={M.topo - 16} width={banda} height={h + 16 + 22} rx={8} fill="var(--faixa-a)" />}
            {anos.map((a, i) => {
              const t = valor(a, null) ?? 0;
              const v = item ? (valor(a, item) ?? 0) : t;
              const noMandato = doMandato.has(a);
              return (
                <g key={a}>
                  {item && <rect x={xEsq(i)} y={y(t)} width={barra} height={Math.max(0, y(0) - y(t))} rx={3} fill="var(--grade)" opacity={0.6} />}
                  <rect
                    x={xEsq(i)}
                    y={y(v)}
                    width={barra}
                    height={Math.max(1, y(0) - y(v))}
                    rx={3}
                    style={{ fill: item ? "var(--f)" : noMandato ? "var(--serie)" : "color-mix(in srgb, var(--serie) 22%, var(--grade))" }}
                    opacity={item && !noMandato ? 0.45 : 1}
                  />
                  <text x={xEsq(i) + barra / 2} y={M.topo + h + 14} textAnchor="middle" fontSize={10.5} fontWeight={i === iBase || i === iAno ? 650 : 400} fill={i === iBase || i === iAno ? "var(--tinta)" : "var(--tinta-3)"}>
                    {banda >= 34 ? a : `’${String(a).slice(2)}`}
                  </text>
                </g>
              );
            })}
            {vBase !== null && mandato.length > 0 && (
              <line
                x1={xEsq(Math.min(iBase, mandato[0]))}
                x2={xEsq(mandato.at(-1)!) + barra}
                y1={y(vBase)}
                y2={y(vBase)}
                stroke="var(--tinta-2)"
                strokeWidth={1.3}
                strokeDasharray="4 3"
              />
            )}
            {/* Os valores por cima do tracejado, com um contorno da cor do fundo para não serem riscados. */}
            {anos.map((a, i) => {
              const v = valor(a, item) ?? 0;
              const noMandato = doMandato.has(a);
              if (!(banda >= 46 || i === iBase || i === iAno || i === sob || (!item && comSalto.has(a)))) return null;
              return (
                <text
                  key={`v-${a}`}
                  x={xEsq(i) + barra / 2}
                  y={y(v) - 5}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={noMandato ? 650 : 500}
                  fill={noMandato ? "var(--tinta)" : "var(--tinta-2)"}
                  stroke="var(--superficie)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {curto(v)}
                  {!item && comSalto.has(a) ? "*" : ""}
                </text>
              );
            })}
            {grupos.map((g) => {
              const idx = g.anos.map((a) => anos.indexOf(a)).filter((i) => i >= 0);
              if (!idx.length) return null;
              const x0 = M.esq + banda * idx[0] + 3;
              const x1 = M.esq + banda * (idx.at(-1)! + 1) - 3;
              const atual = g.id === focoId;
              const yb = altura - 20;
              const nome = nomes[g.id] ?? g.rotulo;
              return (
                <g
                  key={g.id}
                  className={atual ? undefined : s.chaveGoverno}
                  role={atual ? undefined : "button"}
                  tabIndex={atual ? undefined : 0}
                  aria-label={atual ? undefined : `Ver o resumo de ${nome}`}
                  onClick={() => escolherGoverno(g.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      escolherGoverno(g.id);
                    }
                  }}
                >
                  <title>{nome}</title>
                  <rect x={x0} y={yb - 8} width={Math.max(0, x1 - x0)} height={26} fill="transparent" />
                  <path d={`M${x0},${yb - 5}V${yb}H${x1}V${yb - 5}`} fill="none" stroke={atual ? "var(--ouro-forte, var(--ouro))" : "var(--tinta-3)"} strokeWidth={atual ? 2 : 1} opacity={atual ? 1 : 0.7} />
                  <text x={(x0 + x1) / 2} y={yb + 14} textAnchor="middle" fontSize={11} fontWeight={atual ? 650 : 500} fill={atual ? "var(--tinta)" : "var(--tinta-2)"}>
                    {rotuloQueCabe(nome, x1 - x0)}
                  </text>
                </g>
              );
            })}
            {anos.map((a, i) => (
              <rect
                key={`alvo-${a}`}
                x={M.esq + banda * i}
                y={M.topo - 16}
                width={banda}
                height={h + 16 + 22}
                fill="transparent"
                onPointerEnter={() => setSob(i)}
                onClick={() => setSob(i)}
              />
            ))}
          </svg>
        )}
      </div>
      {aDet !== undefined && tDet !== null && (
        <p className={s.detalheAno} aria-live="polite">
          <b>{aDet}</b>
          {quemDet ? ` · ${nomes[quemDet.id] ?? quemDet.rotulo}` : ""} · total {reais(tDet)}
          {tAntes ? ` (${tDet >= tAntes ? "+" : "−"}${numero(Math.abs(100 * (tDet / tAntes - 1)), 0)}% sobre ${anos[iDet - 1]})` : ""}
          {popDet ? ` · ${reais(tDet / popDet)} por habitante` : ""}
          {item && iDet2 !== null ? ` · ${nomeDoItem(item)} ${reais(iDet2)}, ${numero((100 * iDet2) / tDet, 0)}% do total` : ""}
          {sob === null ? <span className={s.dica}> · passe o mouse ou toque numa barra para ver o ano</span> : null}
        </p>
      )}
      {alerta && <p className={s.alertaOrc}>{alerta}</p>}
      {saltos.length > 0 && (
        <p className={s.observacao}>
          * Onde está o salto:{" "}
          {saltos.map((x) => `${x.a}, ${x.d >= 0 ? "+" : "−"}${reais(Math.abs(x.d))} em ${nomeDoItem(x.id)} sobre ${x.de}`).join("; ")}. É uma linha
          contábil, sem área de serviço.
        </p>
      )}
      {painel.parcial && ente.anos[String(painel.parcial.ano)] && (
        <p className={s.observacao}>
          {painel.parcial.ano} ainda está aberto (dados até {painel.parcial.mes}) e fica fora do gráfico.
        </p>
      )}
    </div>
  );
}

// --- Política --------------------------------------------------------------------------

export interface EstadoPartido {
  ativo: string | null;
  /** O partido fixado com um clique; `ativo` também segue o ponteiro. Opcional: o resumo municipal não fixa. */
  fixo?: string | null;
  passar: (p: string | null) => void;
  fixar: (p: string) => void;
  soltar?: () => void;
}

/** De onde sai cada número da leitura do partido: a mesma eleição de uma barra, com o rótulo por extenso. */
type FonteLeitura = { e: Eleicao | null; rotulo: string; hoje?: "deputados" | "senadores" };

/** A eleição geral cujos eleitos estão no cargo na data: quem se elege em outubro toma posse em fevereiro. */
function eleicaoEmExercicio(data: string) {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  let e = ano - ((((ano - 2022) % 4) + 4) % 4);
  if (ano === e || (ano === e + 1 && mes < 2)) e -= 4;
  return e;
}

/** Quantos estão no cargo hoje, pelo cadastro da Câmara e do Senado que a aba Congresso usa. */
const noCargo = (casa: "deputados" | "senadores", partido: string, uf: string | null) =>
  fotografia[casa].filter((p) => p.partido === partido && (!uf || p.uf === uf)).length;

/** A aba Congresso já filtrada: estado, partido e, se ali o partido só tiver senadores, a casa. */
function linkCongresso(uf: string | null, partido: string | null, casa?: "senadores") {
  const q = new URLSearchParams();
  if (uf) q.set("uf", uf);
  if (casa) q.set("r.congresso.casa", casa);
  if (partido) q.set("r.congresso.partido", partido);
  return `/congresso${q.size ? `?${q}` : ""}`;
}

/** Um link de verdade (abre em outra aba com Ctrl ou o botão do meio), que navega sem recarregar no clique simples. */
function LinkCongresso({ destino, verCongresso, className, children }: { destino: string; verCongresso: (d: string) => void; className?: string; children: ReactNode }) {
  return (
    <a
      href={destino}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        verCongresso(destino);
      }}
    >
      {children}
    </a>
  );
}

function Politica({
  r,
  g,
  uf,
  foco,
  dados,
  partido,
  partidosDoGoverno,
  setSigla,
  verCongresso,
}: {
  r: DadosResumo;
  g: Governos;
  uf: UF | null;
  foco: FocoMandato;
  dados: DadosPainel;
  partido: EstadoPartido;
  partidosDoGoverno: Set<string>;
  setSigla: (s: string | null) => void;
  verCongresso: (destino: string) => void;
}) {
  const achar = (ano: number, cargo: CargoId) => r.eleicoes.find((e) => e.ano === ano && e.cargo === cargo) ?? null;
  const geral = eleicaoGeralAntes(foco.posse);
  const gerais = eleicoesNoMandato(foco, false);
  const municipais = eleicoesNoMandato(foco, true);
  const municipal = municipais.at(-1) ?? (() => {
    let a = Number(foco.posse.slice(0, 4));
    while ((a - 1996) % 4 !== 0) a--;
    return a;
  })();
  const senado = r.senado;
  const suplementares = r.senadoSuplementares.length ? `; suplementares de ${r.senadoSuplementares.map((d) => d.split("-").reverse().join("/")).join(", ")}` : "";
  const casaLocal = uf ? "estadual" : "federal";
  const nomeCasa = uf ? (uf.sigla === "DF" ? "Câmara Legislativa" : "Assembleia Legislativa") : "Câmara dos Deputados";

  const barras = [
    { e: achar(geral, casaLocal), ano: geral, rotulo: `Eleita em ${geral}, a que o governo encontrou`, cargo: casaLocal as CargoId },
    ...gerais.map((a) => ({ e: achar(a, casaLocal), ano: a, rotulo: `Eleita em ${a}, toma posse em ${a + 1}`, cargo: casaLocal as CargoId })),
  ];

  // Governadores na posse do presidente, um por estado.
  const diaPosse = `${foco.posse}-15`;
  const governadores = uf
    ? []
    : [...dados.ufs]
        .sort((a, b) => a.sigla.localeCompare(b.sigla))
        .map((u) => ({ u, t: governoEm(g, u.sigla, diaPosse) }))
        .filter((x): x is { u: UF; t: TrechoGoverno } => x.t !== null);
  const eleicaoGovernadores: Eleicao | null = governadores.length
    ? (() => {
        const cont = new Map<string, number>();
        for (const { t } of governadores) cont.set(t.partido ?? "ND", (cont.get(t.partido ?? "ND") ?? 0) + 1);
        const partidos = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        return { ano: geral, cargo: "estadual", partidos, total: governadores.length };
      })()
    : null;

  // A leitura do partido fixado repete os números das barras numa frase. "Hoje no cargo" só entra
  // quando a barra é a da legislatura em exercício: comparar com 2018 não diria nada.
  const emExercicio = eleicaoEmExercicio(fotografia.coletadoEm);
  const hojeSe = (ano: number, casa: "deputados" | "senadores") => (ano === geral && geral === emExercicio ? casa : undefined);
  const senadores = `senadores eleitos em ${geral - 4} e ${geral}`;
  const prefeitos: FonteLeitura = { e: achar(municipal, "prefeito"), rotulo: `prefeitos eleitos em ${municipal}` };
  const fontesLeitura: FonteLeitura[] = uf
    ? [
        ...barras.map((b) => ({ e: b.e, rotulo: `deputados ${uf.sigla === "DF" ? "distritais" : "estaduais"} eleitos em ${b.ano}` })),
        { e: achar(geral, "federal"), rotulo: `deputados federais eleitos em ${geral}`, hoje: hojeSe(geral, "deputados") },
        { e: senado, rotulo: senadores, hoje: hojeSe(geral, "senadores") },
        prefeitos,
      ]
    : [
        ...barras.map((b) => ({ e: b.e, rotulo: `deputados federais eleitos em ${b.ano}`, hoje: hojeSe(b.ano, "deputados") })),
        { e: senado, rotulo: senadores, hoje: hojeSe(geral, "senadores") },
        ...(eleicaoGovernadores ? [{ e: eleicaoGovernadores, rotulo: "governadores na posse do presidente" }] : []),
        prefeitos,
      ];
  const notaNoCargo = (
    <p className={s.observacao}>
      Eleitos, segundo o TSE. Quem está no cargo hoje pode ser outra pessoa (troca de partido, suplente que assumiu):{" "}
      <LinkCongresso destino={linkCongresso(uf?.sigla ?? null, null)} verCongresso={verCongresso}>
        veja no Congresso
      </LinkCongresso>
      .
    </p>
  );

  return (
    <>
      <div className={s.grade}>
        <Bloco titulo={nomeCasa} detalhe={uf ? `${cadeiras("estadual", uf.sigla) ?? ""} cadeiras · TSE` : "513 cadeiras · TSE"}>
          {barras.map((b) => (
            <BarraEleicao key={b.rotulo} e={b.e} rotulo={b.rotulo} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={cadeiras(b.cargo, uf?.sigla ?? null)} />
          ))}
          <Legenda listas={barras.map((b) => b.e)} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} />
          {!uf && notaNoCargo}
        </Bloco>

        {uf ? (
          <Bloco titulo="Em Brasília" detalhe={`a bancada ${uf.deNome} · TSE`}>
            <BarraEleicao e={achar(geral, "federal")} rotulo={`Deputados federais, eleitos em ${geral}`} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={cadeiras("federal", uf.sigla)} />
            <BarraEleicao e={senado} rotulo={`Senadores, eleitos em ${geral - 4} e ${geral}${suplementares}`} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={3} baixa />
            <Legenda listas={[achar(geral, "federal"), senado]} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} />
            <p className={s.observacao}>
              <span className={s.federal}>FEDERAL</span> A bancada vota em Brasília, não na Assembleia; está aqui porque representa o estado.
            </p>
            {notaNoCargo}
          </Bloco>
        ) : (
          <Bloco titulo="Senado" detalhe="81 cadeiras · TSE">
            <BarraEleicao e={senado} rotulo={`Eleitos em ${geral - 4} e ${geral}${suplementares}`} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={81} />
            <Legenda listas={[senado]} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} />
          </Bloco>
        )}

        {!uf && eleicaoGovernadores && (
          <Bloco titulo="Governadores" detalhe={`na posse, ${mesAno(diaPosse)}`}>
            <BarraEleicao e={eleicaoGovernadores} rotulo="Partido do governador em cada estado" g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} esperado={27} unidade="estados" />
            <div className={s.governadores}>
              {governadores.map(({ u, t }) => {
                const k = t.partido ?? "ND";
                return (
                  <button
                    key={u.sigla}
                    type="button"
                    className={s.governador}
                    data-apagado={partido.ativo && partido.ativo !== k ? "" : undefined}
                    onClick={() => setSigla(u.sigla)}
                    onPointerEnter={() => partido.passar(k)}
                    onPointerLeave={() => partido.passar(null)}
                    title={`${t.nome} (${rotuloPartido(g, t.partido)}), ${u.nome}. Ver o resumo do estado.`}
                  >
                    <RetratoGovernador uf={u.sigla} nome={t.nome} tamanho={34} />
                    <b>{u.sigla}</b>
                    <PilulaPartido g={g} sigla={t.partido} />
                  </button>
                );
              })}
            </div>
          </Bloco>
        )}

        <Bloco titulo="Prefeituras" detalhe={uf ? `${uf.nome} · TSE` : "o país · TSE"}>
          {(() => {
            const e = achar(municipal, "prefeito");
            return (
              <>
                <BarraEleicao
                  e={e}
                  rotulo={`Prefeitos eleitos em ${municipal}${municipais.length ? ", durante o mandato" : ", antes da posse"}`}
                  g={g}
                  partido={partido}
                  partidosDoGoverno={partidosDoGoverno}
                  esperado={null}
                />
                <Legenda listas={[e]} g={g} partido={partido} partidosDoGoverno={partidosDoGoverno} />
                {e && (
                  <p className={s.observacao}>
                    {numero(e.total, 0)} prefeitos na eleição regular; municípios com eleição suplementar ou resultado pendente não entram.
                  </p>
                )}
              </>
            );
          })()}
        </Bloco>
      </div>
      {partido.fixo && (
        <LeituraDoPartido
          sigla={partido.fixo}
          fontes={fontesLeitura}
          g={g}
          uf={uf}
          rotuloGoverno={partidosDoGoverno.has(partido.fixo) ? (partidosDoGoverno.size > 1 ? "partido do governo no mandato" : uf ? "partido do governador" : "partido do presidente") : null}
          aoSoltar={() => partido.soltar?.()}
          verCongresso={verCongresso}
        />
      )}
    </>
  );
}

/**
 * Os números do partido fixado: o clique deixa de só acender as barras e passa a dizer quanto o partido
 * tem em cada uma, quantos estão no cargo hoje e onde ver essas pessoas (a aba Congresso, já filtrada).
 * Fica depois da grade e gruda no pé da tela só enquanto a seção está à vista (sticky, não fixed): nasce
 * embaixo de tudo, então o clique não empurra as barras, e no fim da seção para de cobrir o último bloco.
 */
function LeituraDoPartido({
  sigla,
  fontes,
  g,
  uf,
  rotuloGoverno,
  aoSoltar,
  verCongresso,
}: {
  sigla: string;
  fontes: FonteLeitura[];
  g: Governos;
  uf: UF | null;
  rotuloGoverno: string | null;
  aoSoltar: () => void;
  verCongresso: (destino: string) => void;
}) {
  const familia = g.partidos[sigla]?.familia;
  const curto = rotuloCurto(g, sigla);
  const nome = g.partidos[sigla]?.nome;
  const doUf = uf?.sigla ?? null;
  const itens = fontes.flatMap((f) => {
    if (!f.e) return [];
    const n = f.e.partidos.find(([x]) => x === sigla)?.[1] ?? 0;
    // Sem ninguém com esta sigla, mas com a sigla anterior ou seguinte (DEM e União, PR e PL): diz quantos,
    // para a barra apagada não parecer que o partido tinha zero.
    const parente = !n && familia ? f.e.partidos.find(([x]) => x !== sigla && g.partidos[x]?.familia === familia) : undefined;
    return [{ rotulo: f.rotulo, n, total: f.e.total, parente, hoje: f.hoje ? noCargo(f.hoje, sigla, doUf) : null }];
  });
  const dep = noCargo("deputados", sigla, doUf);
  const sen = noCargo("senadores", sigla, doUf);
  const logo = logoDoPartido(sigla);

  return (
    <aside className={`vidro ${s.leituraPartido}`} aria-label={`Números do ${curto}`}>
      <header className={s.leituraTopo}>
        <span className={s.leituraNome}>
          {logo ? <Image src={logo} alt="" width={22} height={18} unoptimized className={s.logoPequeno} /> : <i className={s.pontoPartido} style={{ background: corPartido(g, sigla) }} />}
          <b>{curto}</b>
          {nome && nome !== curto && <span>{nome}</span>}
          {rotuloGoverno && (
            <span className={s.chaveDourada}>
              <i aria-hidden />
              {rotuloGoverno}
            </span>
          )}
        </span>
        <button type="button" className={s.leituraFechar} onClick={aoSoltar} aria-label="Soltar o destaque do partido">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <ul className={s.leituraItens} role="status">
        {itens.map((i) => (
          <li key={i.rotulo}>
            <b>{i.n ? `${numero(i.n, 0)} de ${numero(i.total, 0)}` : `nenhum dos ${numero(i.total, 0)}`}</b> {i.rotulo}
            {i.parente && (
              <span className={s.leituraNota}>
                {" "}
                (com a sigla {rotuloCurto(g, i.parente[0])}, da mesma família: {numero(i.parente[1], 0)})
              </span>
            )}
            {i.hoje !== null && <span className={s.leituraHoje}> · hoje, {i.hoje ? `${numero(i.hoje, 0)} no cargo` : "nenhum no cargo"}</span>}
          </li>
        ))}
      </ul>
      {dep + sen > 0 ? (
        <LinkCongresso destino={linkCongresso(doUf, sigla, !dep ? "senadores" : undefined)} verCongresso={verCongresso} className={s.leituraLink}>
          {dep + sen === 1 ? `Ver no Congresso quem está no cargo hoje →` : `Ver no Congresso os ${dep + sen} que estão no cargo hoje →`}
        </LinkCongresso>
      ) : (
        <p className={s.leituraNota}>
          Nenhum deputado federal ou senador do {curto}
          {uf ? ` ${uf.deNome}` : ""} no cargo hoje.
        </p>
      )}
    </aside>
  );
}

export function BarraEleicao({
  e,
  rotulo,
  g,
  partido,
  partidosDoGoverno,
  esperado,
  baixa = false,
  unidade = "eleitos",
}: {
  e: Eleicao | null;
  rotulo: string;
  g: Governos;
  partido: EstadoPartido;
  partidosDoGoverno: Set<string>;
  esperado: number | null;
  baixa?: boolean;
  unidade?: string;
}) {
  if (!e) {
    return (
      <>
        <div className={s.rotuloBarra}>
          <span>{rotulo}</span>
        </div>
        <p className={s.observacao}>O TSE não tem esta eleição na base do site.</p>
      </>
    );
  }
  return (
    <>
      <div className={s.rotuloBarra}>
        <span>{rotulo}</span>
        <span>
          {numero(e.total, 0)}
          {esperado && e.total < esperado ? ` de ${esperado}` : ""} {unidade}
        </span>
      </div>
      <div className={s.barraPartidos} data-baixa={baixa || undefined} role="group" aria-label={rotulo}>
        {e.partidos.map(([sigla, n]) => {
          const larga = n / e.total >= (baixa ? 0.3 : 0.07);
          return (
            <button
              key={sigla}
              type="button"
              className={s.segPartido}
              style={{ flex: n, background: corPartido(g, sigla), color: tintaPartido(g, sigla) }}
              data-destaque={partidosDoGoverno.has(sigla) || undefined}
              data-apagado={partido.ativo && partido.ativo !== sigla ? "" : undefined}
              aria-pressed={partido.ativo === sigla}
              onPointerEnter={() => partido.passar(sigla)}
              onPointerLeave={() => partido.passar(null)}
              onFocus={() => partido.passar(sigla)}
              onBlur={() => partido.passar(null)}
              onClick={() => partido.fixar(sigla)}
              title={`${g.partidos[sigla]?.nome ?? sigla}: ${n} (${numero((100 * n) / e.total, 0)}%)`}
            >
              {larga ? `${rotuloCurto(g, sigla)} ${n}` : ""}
            </button>
          );
        })}
      </div>
      {esperado && e.total < esperado && (
        <p className={s.observacao}>O arquivo do TSE traz {e.total} dos {esperado} eleitos desta eleição.</p>
      )}
    </>
  );
}

const rotuloCurto = (g: Governos, sigla: string) => (g.partidos[sigla] ? rotuloPartido(g, sigla, true) : sigla);

/** Os partidos das barras do bloco, somados, com a logo quando há. Clicar fixa o destaque. */
export function Legenda({ listas, g, partido, partidosDoGoverno }: { listas: (Eleicao | null)[]; g: Governos; partido: EstadoPartido; partidosDoGoverno: Set<string> }) {
  const soma = new Map<string, number>();
  for (const e of listas) if (e) for (const [p, n] of e.partidos) soma.set(p, (soma.get(p) ?? 0) + n);
  const ordem = [...soma.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!ordem.length) return null;
  const visiveis = ordem.slice(0, 10);
  const outros = ordem.length - visiveis.length;
  return (
    <div className={s.legenda}>
      {visiveis.map(([sigla]) => (
        <button
          key={sigla}
          type="button"
          data-apagado={partido.ativo && partido.ativo !== sigla ? "" : undefined}
          aria-pressed={partido.ativo === sigla}
          onPointerEnter={() => partido.passar(sigla)}
          onPointerLeave={() => partido.passar(null)}
          onClick={() => partido.fixar(sigla)}
          title={g.partidos[sigla]?.nome ?? sigla}
        >
          {logoDoPartido(sigla) ? (
            <Image src={logoDoPartido(sigla)!} alt="" width={20} height={16} unoptimized className={s.logoPequeno} />
          ) : (
            <i className={s.pontoPartido} style={{ background: corPartido(g, sigla) }} />
          )}
          <span style={partidosDoGoverno.has(sigla) ? { fontWeight: 650, color: "var(--tinta)" } : undefined}>{rotuloCurto(g, sigla)}</span>
        </button>
      ))}
      {outros > 0 && <span style={{ color: "var(--tinta-3)" }}>+{outros} partidos</span>}
    </div>
  );
}
