"use client";

import { useState } from "react";
import { type CasaCongresso, type PeriodoCota, NOME_UF, inteiro } from "../_dados/congressoModelo";
import { municipiosDasEmendas, municipiosPrevistosDosPlanos, planosDasEmendas, type EmendasParlamentar, type OrdemEmendas } from "../_dados/emendasParlamentarModelo";
import { useJson } from "../_dados/useJson";
import { Bloco, Opcoes } from "./Bloco";
import { EsqueletoDetalhe } from "./GraficosCota";
import { MapaEmendasEstado } from "./MapaEmendasEstado";
import { PlanosEmendasParlamentar } from "./PlanosEmendasParlamentar";
import { formatar, titulo } from "./formatos";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";

type Visao = "aplicacao" | "prefeituras" | "planos";
const LIMITE = 10;
const FONTE = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares";

export function EmendasMunicipiosParlamentar({ casa, id, periodo, uf, className }: {
  casa: CasaCongresso; id: number; periodo: PeriodoCota; uf: string; className: string;
}) {
  const { dados, erro, carregando } = useJson<EmendasParlamentar>(`/api/painel/congresso/emendas?${new URLSearchParams({ casa, id: String(id), ano: String(periodo) })}`);
  return <Bloco id="emendas-municipios" titulo="Emendas para os municípios" detalhe={NOME_UF[uf] ?? uf} lustroFixo className={className} corpo={t.emendasMiolo}>
    {carregando ? <div aria-busy="true"><EsqueletoDetalhe /></div> : erro ? <p className={estilos.aviso}>Não foi possível carregar as emendas. Recarregue a página para tentar novamente.</p>
      : dados ? <TabelaEmendas key={`${casa}-${id}-${periodo}`} dados={dados} /> : null}
  </Bloco>;
}

/** Exportada para conferir a mesma tabela com dados reais e casos de ausência nos testes. */
export function TabelaEmendas({ dados }: { dados: EmendasParlamentar }) {
  const [visao, setVisao] = useState<Visao>("aplicacao");
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<OrdemEmendas>("destinado");
  const [todos, setTodos] = useState(false);
  const prefeituras = visao === "prefeituras";
  const planos = visao === "planos";
  const cobertura = dados.cobertura;
  const dinheiro = (v: number | null) => v === null ? "valor não informado" : formatar(v, "reais2");
  const linhas = municipiosDasEmendas(dados[prefeituras ? "prefeituras" : "aplicacao"], busca, ordem);
  const visiveis = todos ? linhas : linhas.slice(0, LIMITE);
  const periodo = dados.desde === dados.ate ? String(dados.desde) : `${dados.desde}–${dados.ate}`;
  const trocarVisao = (v: Visao) => { setVisao(v); setOrdem(v === "prefeituras" ? "pago" : "destinado"); setTodos(false); };
  const ordenar = (o: OrdemEmendas) => { setOrdem(o); setTodos(false); };
  const cabecalho = (campo: OrdemEmendas, rotulo: string) => <th scope="col" aria-sort={ordem === campo ? campo === "nome" ? "ascending" : "descending" : "none"}>
    <button type="button" className={estilos.ordenar} data-ativo={ordem === campo ? "" : undefined} onClick={() => ordenar(campo)}>
      {rotulo}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d={campo === "nome" ? "M3 8 6 5l3 3" : "m3 4 3 3 3-3"} /></svg>
    </button>
  </th>;
  const [foco, setFoco] = useState<string | null>(null);
  const mapa = planos ? municipiosPrevistosDosPlanos(planosDasEmendas(dados.planos, busca), dados.uf) : dados[prefeituras ? "prefeituras" : "aplicacao"];
  return <div className={t.emendasCorpo} data-visao={visao}>
    <div className={t.emendasIntro}>
    <div className={t.emendasControles}>
      <Opcoes<Visao> ativa={visao} aoEscolher={trocarVisao} rotulo="Localidade das emendas" quebra
        opcoes={[{ id: "aplicacao", rotulo: "Execução financeira" }, { id: "planos", rotulo: "Planos e projetos" }, { id: "prefeituras", rotulo: "Prefeituras e fundos" }]} />
      <label className={t.emendasBusca}><span className="sr-only">{planos ? "Buscar município ou projeto" : "Buscar município"}</span>
        <input type="search" value={busca} onChange={e => { setBusca(e.target.value); setTodos(false); }} placeholder={planos ? "Buscar município ou projeto" : "Buscar município"} />
      </label>
    </div>
    <p className={t.emendasContexto}>
      Emendas de {periodo} · {planos ? "Destinação prevista nos planos. Aprovação e empenho vinculado não comprovam realização da obra ou serviço."
        : prefeituras ? "Valores recebidos pelas prefeituras e fundos municipais, pelo endereço do favorecido." : "Execução financeira registrada: empenhado e pago, incluindo restos a pagar. Pagamento comprova repasse, não entrega da obra ou serviço."}
    </p>
    {!prefeituras && !planos && <p className={t.emendasCobertura}>
      {cobertura.destinadoTotal === null ? "O total destinado não está informado integralmente para este período." : <>Dos {dinheiro(cobertura.destinadoTotal)} destinados, {dinheiro(cobertura.destinadoNoEstado)} têm município identificado em {NOME_UF[dados.uf] ?? dados.uf}.</>}
      {cobertura.destinadoSemMunicipio === null ? <> <strong>A cobertura municipal está incompleta: há valores não informados.</strong></>
        : cobertura.destinadoSemMunicipio !== 0 ? <> <strong>{dinheiro(cobertura.destinadoSemMunicipio)} ainda sem município definido.</strong></> : null}
      {cobertura.destinadoForaEstado !== null && cobertura.destinadoForaEstado !== 0 && <> Outros {dinheiro(cobertura.destinadoForaEstado)} têm município em outra UF.</>}
      {cobertura.pagoSemMunicipio !== null && cobertura.pagoSemMunicipio !== 0 && <> Nos pagamentos, {dinheiro(cobertura.pagoSemMunicipio)} ainda sem município definido.</>}
    </p>}
    </div>
    <div className={t.emendasLista}>
    {planos ? <PlanosEmendasParlamentar planos={dados.planos} busca={busca} coletadoEm={dados.coletadoEmPlanos} foco={foco} aoFocar={codigo => setFoco(codigo && mapa.some(m => m.codigo === codigo) ? codigo : null)} /> : <>
    {linhas.length ? <>
      <div className={t.emendasRolagem} role="region" aria-label="Valores de emendas por município" tabIndex={0}>
        <table className={t.emendasTabela} data-visao={visao}>
          <caption className="sr-only">{prefeituras ? "Recebimentos de prefeituras e fundos" : "Empenhado e pago por local de aplicação"} · {NOME_UF[dados.uf]} · emendas de {periodo}, em reais nominais</caption>
          <thead><tr>{cabecalho("nome", "Município")}{!prefeituras && cabecalho("destinado", "Empenhado")}{cabecalho("pago", "Pago")}</tr></thead>
          <tbody onMouseLeave={() => setFoco(null)}>{visiveis.map(m => <tr key={m.codigo} data-foco={foco === m.codigo ? "" : undefined}
            onMouseEnter={() => setFoco(m.codigo)} onFocus={() => setFoco(m.codigo)}>
            <th scope="row">{titulo(m.nome)}</th>
            {!prefeituras && <td data-rotulo="Empenhado">{m.destinado === null ? <span aria-label="Valor destinado não informado">—</span> : formatar(m.destinado, "reais2")}</td>}
            <td data-rotulo="Pago">{m.pago === null ? <span aria-label="Valor pago não informado">—</span> : formatar(m.pago, "reais2")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={t.rodape}>
        <span role="status">{inteiro(visiveis.length)} de {inteiro(linhas.length)} {linhas.length === 1 ? "município" : "municípios"}</span>
        {linhas.length > LIMITE && <button type="button" className={t.linkPainel} aria-expanded={todos} onClick={() => setTodos(!todos)}>{todos ? "Mostrar menos" : `Ver todos os ${inteiro(linhas.length)} municípios`}</button>}
      </div>
    </> : <p className={estilos.aviso} role="status">{busca.trim() ? "Nenhum município encontrado para esta busca." : prefeituras
      ? "Não há recebimentos de prefeituras e fundos municipais identificados para este parlamentar e período."
      : "Não há municípios de aplicação identificados para este parlamentar e período. Consulte também Prefeituras e fundos."}</p>}
    <p className={t.nota}>{prefeituras
      ? "A fonte não informa o valor destinado nesta visão. O endereço de quem recebeu não comprova o local de aplicação. Estes pagamentos não se somam aos da outra visão."
      : "A tabela mostra apenas os valores com município identificado. Localidades estaduais, nacionais ou múltiplas não são rateadas. Valores acumulados pelo ano da emenda, mesmo quando o pagamento ocorreu depois."}
      {" "}Somente autoria individual identificada. Ausência de registro não significa R$ 0; — indica valor não informado.
    </p>
    {!prefeituras && <details className={t.nota}>
      <summary className={t.linkPainel}>Como identificamos os municípios</summary>
      <p>Usamos o município de aplicação publicado nos documentos de empenho e pagamento da CGU, sem inferir o destino pelo endereço de fornecedores.
        O detalhamento substitui o resumo somente quando os valores fecham em centavos, por emenda e fase da despesa.</p>
      <p>{cobertura.emendasPendentes > 0
        ? `${inteiro(cobertura.emendasPendentes)} ${cobertura.emendasPendentes === 1 ? "emenda ainda usa" : "emendas ainda usam"} o resumo em pelo menos uma fase: os documentos estão ausentes, incompletos ou divergem do total. A localização pode estar incompleta.`
        : "Todas as emendas com valores foram conferidas com os documentos nas duas fases disponíveis."}
        {" "}Planos e convênios não são contados como empenho. Consulte Planos e projetos para os destinos previstos ainda sem execução municipal comprovada. Ausência de um pagamento municipal não comprova que nada foi pago.</p>
      <a className={t.linkPainel} href="https://portaldatransparencia.gov.br/dicionario-de-dados/emendas-parlamentares-por-documento" target="_blank" rel="noreferrer">Dicionário dos documentos de despesa</a>
    </details>}
    <p className={t.nota}><a className={t.linkPainel} href={FONTE} target="_blank" rel="noreferrer">Fonte: Portal da Transparência · CGU</a>
      {" · "}coleta em {new Date(dados.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Valores sem correção pela inflação.</p>
    </>}
    </div>
    <MapaEmendasEstado uf={dados.uf} linhas={mapa} medida={planos ? "previsto" : prefeituras || ordem === "pago" ? "pago" : "destinado"} foco={foco} aoFocar={setFoco} />
  </div>;
}
