import Link from "next/link";
import { MESES_POR_EXTENSO, NOME_UF, reaisInteiros } from "../_dados/congressoModelo";
import { historicoDaCota, nomeDaCasa, perfilOficialParlamentar, siglaParlamentar, type ParlamentarDaPagina } from "../_dados/paginaParlamentar";
import estilos from "./ContextoParlamentar.module.css";

/** Texto e tabela também saem no HTML inicial, antes das consultas do painel no navegador. */
export function ContextoParlamentar({ parlamentar }: { parlamentar: ParlamentarDaPagina }) {
  const { pessoa, casa } = parlamentar;
  const historico = historicoDaCota(parlamentar);
  // A tabela começa no primeiro ano com nota: o arquivo vai de 2008 em diante para todo mundo, e
  // os anos antes do mandato viravam uma fila de "Sem registro". Do primeiro ano em diante, um
  // ano sem nota fica (é informação: a pessoa estava fora do cargo ou não usou a cota).
  const primeiro = historico.anos.findIndex(a => a.total !== null);
  const anos = primeiro < 0 ? [] : historico.anos.slice(primeiro);
  // No mesmo tom das Fontes logo acima: rodapé de texto miúdo, sem painel, em três colunas.
  return <section id="contexto-parlamentar" className={estilos.contexto} aria-labelledby="titulo-contexto-parlamentar">
    <h2 id="titulo-contexto-parlamentar">Gastos e atuação de {pessoa.nome}</h2>
    <div className={estilos.texto}>
    <p>{pessoa.nome} ({siglaParlamentar(pessoa)}) consta no cadastro {casa === "deputados" ? "da" : "do"} {nomeDaCasa(casa)} usado neste observatório. A UF registrada é {NOME_UF[pessoa.uf] ?? pessoa.uf}. O painel reúne cota parlamentar, fornecedores, votações e Emendas Pix, com o período e a fonte de cada medida.</p>
    <p>Fonte: <a href={historico.fontes.dados}>{nomeDaCasa(casa)}, dados abertos da cota</a>. Coleta em <time dateTime={historico.coletadoEm}>{new Date(historico.coletadoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time>. <a href={perfilOficialParlamentar(parlamentar)}>Consultar o perfil oficial de {pessoa.nome}</a>.</p>
    <nav aria-label="Entenda os dados do parlamentar"><Link href="/congresso">Comparar parlamentares no Congresso</Link><Link href="/metodologia">Metodologia e limites</Link><Link href="/correcoes">Relatar um erro</Link></nav>
    </div>
    {anos.length > 0 ? <table>
      <caption>Cota parlamentar de {pessoa.nome}, em reais da época</caption>
      <thead><tr><th scope="col">Ano</th><th scope="col">Gasto registrado</th><th scope="col">Média da casa</th></tr></thead>
      <tbody>{anos.map(a => <tr key={a.ano}>
        <th scope="row">{a.ano}{a.parcial && <small>até {a.mes ? MESES_POR_EXTENSO[a.mes - 1] : "agora"}</small>}</th>
        <td data-vazio={a.total === null ? "" : undefined}>{a.total === null ? "Sem registro" : reaisInteiros(a.total)}</td>
        <td data-vazio={a.media === null ? "" : undefined}>{a.media === null ? "Sem registro" : reaisInteiros(a.media)}</td>
      </tr>)}</tbody>
    </table> : <p className={estilos.tabela}>Não há notas da cota parlamentar de {pessoa.nome} nos arquivos {casa === "deputados" ? "da" : "do"} {nomeDaCasa(casa)}. Sem registro não significa gasto zero.</p>}
    <div className={estilos.perguntas}>
    <h3>Como interpretar a cota parlamentar?</h3>
    <p>A cota cobre despesas da atividade parlamentar; não é salário nem o custo total do mandato. A média considera quem apresentou notas em cada ano. Sem registro não significa gasto zero. Notas podem entrar com atraso; o ano em curso é parcial e os valores podem ser revistos.</p>
    <h3>Mais gasto significa pior desempenho?</h3>
    <p>O total gasto, sozinho, não mede qualidade do mandato nem comprova irregularidade. O tempo no cargo e as despesas cobertas variam, e Câmara e Senado têm regras próprias. Votar conforme a orientação do governo também não é uma avaliação de qualidade.</p>
    </div>
  </section>;
}
