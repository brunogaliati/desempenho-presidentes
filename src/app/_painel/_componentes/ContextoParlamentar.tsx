import Link from "next/link";
import { MESES_POR_EXTENSO, NOME_UF, reaisInteiros } from "../_dados/congressoModelo";
import { historicoDaCota, nomeDaCasa, perfilOficialParlamentar, siglaParlamentar, type ParlamentarDaPagina } from "../_dados/paginaParlamentar";
import estilos from "./ContextoParlamentar.module.css";

/** Texto e tabela também saem no HTML inicial, antes das consultas do painel no navegador. */
export function ContextoParlamentar({ parlamentar }: { parlamentar: ParlamentarDaPagina }) {
  const { pessoa, casa } = parlamentar;
  const historico = historicoDaCota(parlamentar);
  return <section id="contexto-parlamentar" className={estilos.contexto} aria-labelledby="titulo-contexto-parlamentar">
    <h2 id="titulo-contexto-parlamentar">Gastos e atuação de {pessoa.nome}</h2>
    <p>{pessoa.nome} ({siglaParlamentar(pessoa)}) consta no cadastro {casa === "deputados" ? "da" : "do"} {nomeDaCasa(casa)} usado neste observatório. A UF registrada é {NOME_UF[pessoa.uf] ?? pessoa.uf}. O painel reúne cota parlamentar, fornecedores, votações e Emendas Pix, com o período e a fonte de cada medida.</p>
    <table>
      <caption>Cota parlamentar de {pessoa.nome}, em reais da época</caption>
      <thead><tr><th scope="col">Ano</th><th scope="col">Gasto registrado</th><th scope="col">Média da casa</th></tr></thead>
      <tbody>{historico.anos.map(a => <tr key={a.ano}>
        <th scope="row">{a.ano}{a.parcial && <small>Parcial{a.mes ? ` até ${MESES_POR_EXTENSO[a.mes - 1]}` : ""}</small>}</th>
        <td>{a.total === null ? "Sem registro" : reaisInteiros(a.total)}</td>
        <td>{a.media === null ? "Sem registro" : reaisInteiros(a.media)}</td>
      </tr>)}</tbody>
    </table>
    <p className={estilos.fonte}>Fonte: <a href={historico.fontes.dados}>{nomeDaCasa(casa)}, dados abertos da cota</a>. Coleta em <time dateTime={historico.coletadoEm}>{new Date(historico.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>. <a href={perfilOficialParlamentar(parlamentar)}>Consultar o perfil oficial de {pessoa.nome}</a>.</p>
    <h3>Como interpretar a cota parlamentar?</h3>
    <p>A cota cobre despesas da atividade parlamentar; não é salário nem o custo total do mandato. A média considera quem apresentou notas em cada ano. Sem registro não significa gasto zero. Notas podem entrar com atraso; o ano em curso é parcial e os valores podem ser revistos.</p>
    <h3>Mais gasto significa pior desempenho?</h3>
    <p>O total gasto, sozinho, não mede qualidade do mandato nem comprova irregularidade. O tempo no cargo e as despesas cobertas variam, e Câmara e Senado têm regras próprias. Votar conforme a orientação do governo também não é uma avaliação de qualidade.</p>
    <nav aria-label="Entenda os dados do parlamentar"><Link href="/congresso">Comparar parlamentares no Congresso</Link><Link href="/metodologia">Metodologia e limites</Link><Link href="/correcoes">Relatar um erro</Link></nav>
  </section>;
}
