import Link from "next/link";
import { UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { metadataPagina } from "@/lib/seo";
import { Trilha } from "@/app/economia/Trilha";
import styles from "@/app/economia/indicador.module.css";

export const metadata = metadataPagina("Resumo por município: indicadores e governo municipal", "Escolha um município para reunir população, emprego, programas sociais, hospitais, leitos SUS e contas fiscais, com fontes e períodos.", "/resumo/municipios", "/compartilhar?pagina=%2Fresumo");
export default function Municipios() {
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
    <header><Trilha itens={[{nome:"Resumo",href:"/resumo"},{nome:"Municípios"}]}/><h1>Resumo por município</h1>
      <p className="my-5 max-w-prose text-lg leading-relaxed">Escolha uma UF e uma cidade. O resumo reúne indicadores locais e dados do governo municipal, com a referência de cada fonte e comparação com o período anterior à posse.</p></header>
    <section className="vidro" data-lustro="fixo"><h2 className="text-xl font-semibold">Escolha uma unidade da federação</h2>
      <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{UFS_MUNICIPAIS.map((uf) => <li key={uf.codigo}><Link href={`/resumo/municipios/${uf.slug}`}>{uf.nome}</Link></li>)}</ul>
    </section>
  </main>;
}
