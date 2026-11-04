import Link from "next/link";
import LayoutEconomia from "./economia/layout";
import styles from "./economia/indicador.module.css";

export default function NaoEncontrada() {
  return <LayoutEconomia><main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><header><h1>Esta página não foi encontrada</h1><p className="my-5 max-w-prose text-lg leading-relaxed">O endereço pode ter mudado ou o recorte ainda não tem dados suficientes para publicação.</p></header><section className="vidro" data-lustro="fixo"><h2>Encontre os dados que procura</h2><nav aria-label="Continuar explorando" className="mt-5 flex flex-wrap gap-6"><Link href="/">Painel do Brasil</Link><Link href="/economia">Indicadores de economia</Link><Link href="/economia/municipios">Buscar municípios</Link></nav></section></main></LayoutEconomia>;
}
