import { Fragment } from "react";
import Link from "next/link";
import styles from "./indicador.module.css";

/** Migalhas das páginas de dados. O último item é a página atual, sem link. */
export function Trilha({ itens }: { itens: { nome: string; href?: string }[] }) {
  return (
    <nav aria-label="Navegação estrutural" className={styles.trilha}>
      {itens.map((item, i) => (
        <Fragment key={item.nome}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {item.href ? <Link href={item.href}>{item.nome}</Link> : <span aria-current="page">{item.nome}</span>}
        </Fragment>
      ))}
    </nav>
  );
}
