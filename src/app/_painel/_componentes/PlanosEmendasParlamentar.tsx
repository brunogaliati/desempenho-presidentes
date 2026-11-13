"use client";

import { useState } from "react";
import { planosDasEmendas, type PlanoEmenda } from "../_dados/emendasParlamentarModelo";
import { inteiro } from "../_dados/congressoModelo";
import { formatar, titulo } from "./formatos";
import t from "./TerminalParlamentar.module.css";

const LOCALIZACAO: Record<string, string> = {
  municipio_citado_no_objeto: "Município citado no objeto",
  beneficiario_municipal: "Beneficiário municipal",
  endereco_do_beneficiario: "Endereço do beneficiário; aplicação não confirmada",
  objeto_com_varios_municipios: "Objeto abrange vários municípios",
  sem_municipio: "Aplicação municipal não identificada",
};

export function PlanosEmendasParlamentar({ planos, busca, coletadoEm }: { planos: PlanoEmenda[]; busca: string; coletadoEm: string }) {
  const [todos, setTodos] = useState(false);
  const linhas = planosDasEmendas(planos, busca);
  const visiveis = todos ? linhas : linhas.slice(0, 10);
  return <>
    {linhas.length ? <>
      <div className={t.emendasRolagem} role="region" aria-label="Planos previstos e evidências" tabIndex={0}>
        <table className={`${t.emendasTabela} ${t.emendasPlanosTabela}`}>
          <caption className="sr-only">Planos e projetos previstos, com origem da localização e vínculo financeiro</caption>
          <thead><tr><th scope="col">Município e projeto</th><th scope="col">Valor previsto</th><th scope="col">Evidência disponível</th></tr></thead>
          <tbody>{visiveis.map(p => <tr key={`${p.emenda}-${p.fonte}-${p.instrumento}-${p.executor}`}>
            <th scope="row" data-rotulo="Município e projeto">
              <strong>{p.municipio ? `${titulo(p.municipio)}${p.uf ? ` (${p.uf})` : ""}` : "Município não identificado"}</strong>
              <small>{LOCALIZACAO[p.metodoLocalizacao] ?? "Localização não confirmada"}</small>
              <details><summary className={t.linkPainel}>Ver projeto e fonte</summary>
                <p>{p.objeto ?? "Objeto não informado na fonte."}</p>
                <p>{p.beneficiario ?? "Beneficiário não informado"} · emenda {p.emenda} · instrumento {p.instrumento}</p>
                <a className={t.linkPainel} href={p.fonteUrl} target="_blank" rel="noreferrer">{p.fonte === "transferegov_executor" ? "Consultar Transferegov" : "Consultar fonte CGU"}</a>
              </details>
            </th>
            <td data-rotulo="Valor previsto">{p.previsto !== null ? <>{formatar(p.previsto, "reais2")}<small>Previsto para este executor/plano</small></>
              : <>{p.totalInstrumento === null ? "Não informado" : formatar(p.totalInstrumento, "reais2")}<small>Total do instrumento; parcela da emenda não informada</small></>}</td>
            <td data-rotulo="Evidência disponível">
              <strong>{p.situacao}</strong>
              <small>{p.empenhoPlano !== null ? p.conciliacao === "empenho_do_plano_conciliado" ? "Empenho do plano conciliado com a CGU" : "Vínculo financeiro parcial; há pendências"
                : "Sem empenho conciliado nesta coleta"}</small>
              {p.empenhoPlano !== null && <details><summary className={t.linkPainel}>Ver vínculo financeiro</summary>
                <p>{formatar(p.empenhoPlano, "reais2")} em empenhos vinculados ao plano inteiro. Esse valor pode aparecer em vários executores e não deve ser somado entre linhas.</p>
                <p>{p.documentos.join(", ")}</p>
              </details>}
              <small>Realização da obra ou serviço não verificada</small>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={t.rodape}><span role="status">{inteiro(visiveis.length)} de {inteiro(linhas.length)} {linhas.length === 1 ? "registro de planejamento" : "registros de planejamento"}</span>
        {linhas.length > 10 && <button type="button" className={t.linkPainel} aria-expanded={todos} onClick={() => setTodos(!todos)}>{todos ? "Mostrar menos" : "Ver todos os planos e projetos"}</button>}</div>
    </> : <p className={t.emendasContexto} role="status">{busca.trim() ? "Nenhum plano encontrado para esta busca." : "Não há planos vinculados a este parlamentar e período nas fontes coletadas. Isso não comprova ausência de destinação."}</p>}
    <p className={t.nota}>Valores previstos não se somam aos empenhados ou pagos. Um plano aprovado ou um repasse financeiro não comprova a realização da obra ou serviço.
      O município pode vir do objeto, do cadastro municipal ou do endereço do beneficiário, conforme indicado em cada registro.</p>
    <details className={t.nota}><summary className={t.linkPainel}>Cobertura e pendências das fontes</summary>
      <p>Coletamos planos, executores e empenhos das transferências especiais no Transferegov, além das parcerias (incluindo Saúde) e convênios vinculados às emendas no pacote CGU. Os vínculos usam o código da emenda e do documento, sem parear apenas pelo nome.</p>
      <p>Projetos da Conab/PAA, subrepasses de fundos estaduais, contratos de universidades e despesas de órgãos federais ainda podem exigir documentos adicionais de execução. Sem vínculo verificável com um município, permanecem como pendência. Dados protegidos por sigilo não são inferidos.</p>
    </details>
    <p className={t.nota}>Fontes: CGU e Transferegov · coleta em {new Date(coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Valores nominais.</p>
  </>;
}
