"use client";

import { useState } from "react";
import { inteiro } from "../_dados/congressoModelo";
import { documentosSemMunicipioDasEmendas, type DocumentoSemMunicipio } from "../_dados/emendasParlamentarModelo";
import { formatar } from "./formatos";
import t from "./TerminalParlamentar.module.css";

export function SemMunicipioEmendasParlamentar({ documentos, busca, coletadoEm }: {
  documentos: DocumentoSemMunicipio[]; busca: string; coletadoEm: string;
}) {
  const [todos, setTodos] = useState(false);
  const linhas = documentosSemMunicipioDasEmendas(documentos, busca);
  const visiveis = todos ? linhas : linhas.slice(0, 10);
  return <>
    {linhas.length ? <>
      <div className={t.emendasRolagem} role="region" aria-label="Documentos de emendas sem município" tabIndex={0}>
        <table className={`${t.emendasTabela} ${t.emendasPlanosTabela} ${t.emendasDocumentosTabela}`}>
          <caption className="sr-only">Favorecido, emenda, localidade informada, fase e valor dos documentos sem município de aplicação</caption>
          <thead><tr>{["Favorecido", "Emenda", "Localidade informada", "Fase", "Valor"].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
          <tbody>{visiveis.map((r, i) => <tr key={`${r.documento}-${r.emenda}-${r.fase}-${i}`}>
            <th scope="row">{r.favorecido?.trim() || "Favorecido não informado"}<small>Documento {r.documento}</small>
              {r.linhasFonte > 1 && <small>{inteiro(r.linhasFonte)} linhas da fonte agrupadas; repetições preservadas</small>}</th>
            <td data-rotulo="Emenda">{r.emenda}</td>
            <td data-rotulo="Localidade informada">{r.localidade?.trim() || "Sem informação"}
              {r.ufInformada && /^[A-Z]{2}$/.test(r.ufInformada) && <small>UF de aplicação: {r.ufInformada}</small>}</td>
            <td data-rotulo="Fase">{r.fase === "Empenho" ? "Empenhado" : "Pago"}
              <small>{r.conciliado ? "Conferido com o resumo" : "Ainda não conciliado com o resumo"}</small></td>
            <td data-rotulo="Valor">{r.valor === null ? <span aria-label="Valor não informado">—</span> : formatar(r.valor, "reais2")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={t.rodape}><span role="status">{inteiro(visiveis.length)} de {inteiro(linhas.length)} {linhas.length === 1 ? "registro" : "registros"}</span>
        {linhas.length > 10 && <button type="button" className={t.linkPainel} aria-expanded={todos} onClick={() => setTodos(!todos)}>{todos ? "Mostrar menos" : "Ver todos os registros"}</button>}</div>
    </> : <p className={t.emendasContexto} role="status">{busca.trim() ? "Nenhum documento encontrado para esta busca." : "Não há documentos sem município identificados para este parlamentar e período. Saldos sem detalhamento ainda podem existir no resumo da CGU."}</p>}
    <p className={t.nota}>Favorecido é quem consta no documento, podendo ser um banco ou outro intermediário; seu endereço não define onde o recurso foi aplicado. Empenhado é valor reservado; pago é pagamento registrado. As duas fases não se somam.</p>
    <p className={t.nota}>Os registros detalham os totais de execução financeira. Documentos ainda não conciliados são mostrados para consulta e não devem ser somados ao saldo do painel. Saldos sem documentos correspondentes continuam sem favorecido identificado. Informações sob sigilo são mantidas como publicadas pela CGU.</p>
    <p className={t.nota}><a className={t.linkPainel} href="https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares-documentos" target="_blank" rel="noreferrer">Fonte: documentos de despesa · CGU</a>
      {" · "}coleta em {new Date(coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Valores sem correção pela inflação.</p>
  </>;
}
