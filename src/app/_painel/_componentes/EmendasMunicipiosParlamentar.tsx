"use client";

import { useState } from "react";
import { type CasaCongresso, type PeriodoCota, NOME_UF, inteiro } from "../_dados/congressoModelo";
import { municipiosDasEmendas, type EmendasParlamentar, type OrdemEmendas } from "../_dados/emendasParlamentarModelo";
import { useJson } from "../_dados/useJson";
import { Bloco, Opcoes } from "./Bloco";
import { EsqueletoDetalhe } from "./GraficosCota";
import { formatar, titulo } from "./formatos";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";

type Visao = "aplicacao" | "prefeituras";
const LIMITE = 10;
const FONTE = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares";

export function EmendasMunicipiosParlamentar({ casa, id, periodo, uf, className }: {
  casa: CasaCongresso; id: number; periodo: PeriodoCota; uf: string; className: string;
}) {
  const { dados, erro, carregando } = useJson<EmendasParlamentar>(`/api/painel/congresso/emendas?${new URLSearchParams({ casa, id: String(id), ano: String(periodo) })}`);
  return <Bloco id="emendas-municipios" titulo="Emendas para os municípios" detalhe={NOME_UF[uf] ?? uf} lustroFixo className={className}>
    {carregando ? <EsqueletoDetalhe /> : erro ? <p className={estilos.aviso}>Não foi possível carregar as emendas. Recarregue a página para tentar novamente.</p>
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
  const linhas = municipiosDasEmendas(dados[visao], busca, ordem);
  const visiveis = todos ? linhas : linhas.slice(0, LIMITE);
  const periodo = dados.desde === dados.ate ? String(dados.desde) : `${dados.desde}–${dados.ate}`;
  const trocarVisao = (v: Visao) => { setVisao(v); setOrdem(v === "prefeituras" ? "pago" : "destinado"); setTodos(false); };
  const ordenar = (o: OrdemEmendas) => { setOrdem(o); setTodos(false); };
  const cabecalho = (campo: OrdemEmendas, rotulo: string) => <th scope="col" aria-sort={ordem === campo ? campo === "nome" ? "ascending" : "descending" : "none"}>
    <button type="button" className={estilos.ordenar} data-ativo={ordem === campo ? "" : undefined} onClick={() => ordenar(campo)}>
      {rotulo}<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d={campo === "nome" ? "M3 8 6 5l3 3" : "m3 4 3 3 3-3"} /></svg>
    </button>
  </th>;
  return <>
    <div className={t.emendasControles}>
      <Opcoes<Visao> ativa={visao} aoEscolher={trocarVisao} rotulo="Localidade das emendas" quebra
        opcoes={[{ id: "aplicacao", rotulo: "Local de aplicação" }, { id: "prefeituras", rotulo: "Prefeituras e fundos" }]} />
      <label className={t.emendasBusca}>Buscar município
        <input type="search" value={busca} onChange={e => { setBusca(e.target.value); setTodos(false); }} placeholder="Nome do município" />
      </label>
    </div>
    <p className={t.emendasContexto}>
      Emendas de {periodo} · {prefeituras ? "Valores recebidos pelas prefeituras e fundos municipais, pelo endereço do favorecido." : "Destinado é o valor empenhado. Pago inclui pagamentos de restos a pagar."}
    </p>
    {linhas.length ? <>
      <div className={t.emendasRolagem} role="region" aria-label="Valores de emendas por município" tabIndex={0}>
        <table className={t.emendasTabela} data-visao={visao}>
          <caption className="sr-only">{prefeituras ? "Recebimentos de prefeituras e fundos" : "Destinado e pago por local de aplicação"} · {NOME_UF[dados.uf]} · emendas de {periodo}, em reais nominais</caption>
          <thead><tr>{cabecalho("nome", "Município")}{!prefeituras && cabecalho("destinado", "Destinado")}{cabecalho("pago", "Pago")}</tr></thead>
          <tbody>{visiveis.map(m => <tr key={m.codigo}>
            <th scope="row">{titulo(m.nome)}</th>
            {!prefeituras && <td data-rotulo="Destinado">{m.destinado === null ? <span aria-label="Valor destinado não informado">—</span> : formatar(m.destinado, "reais2")}</td>}
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
      : "Localidades sem município definido não são distribuídas entre cidades. Valores acumulados pelo ano da emenda, mesmo quando o pagamento ocorreu depois."}
      {" "}Somente autoria individual identificada. Ausência de registro não significa R$ 0; — indica valor não informado.
    </p>
    <p className={t.nota}><a className={t.linkPainel} href={FONTE} target="_blank" rel="noreferrer">Fonte: Portal da Transparência · CGU</a>
      {" · "}coleta em {new Date(dados.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Valores sem correção pela inflação.</p>
  </>;
}
