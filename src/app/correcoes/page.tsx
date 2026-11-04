import Link from "next/link";
import LayoutEconomia from "../economia/layout";
import styles from "../economia/indicador.module.css";
import { metadataPagina } from "@/lib/seo";
import { FormularioCorrecao } from "./FormularioCorrecao";
export const metadata=metadataPagina('Relatar um erro · Desempenho do Governo','Registre problemas em dados, fontes ou textos publicados pelo projeto, sem informar dados pessoais.','/correcoes');
export default async function Correcoes({searchParams}:{searchParams:Promise<{pagina?:string|string[]}>}){
  const p=[(await searchParams).pagina].flat()[0]??'/';const pagina=/^\/(?!\/)[^?#\s\\]{0,299}$/.test(p)?p:'/';
  return <LayoutEconomia><main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><header><Link href="/sobre">Sobre o projeto</Link><h1>Relatar um erro</h1><p className="my-5 text-lg leading-relaxed">Encontrou um número, uma fonte ou uma explicação que precisa de revisão? Registre o problema para análise.</p></header><section className="vidro" data-lustro="fixo"><h2>Descreva o problema</h2><p className="mt-4 max-w-prose leading-relaxed">Não pedimos nome, e-mail ou documento. O formulário serve para relatar erros do site; não consulta benefícios, cadastros pessoais ou solicitações a órgãos públicos.</p><FormularioCorrecao pagina={pagina}/></section><section className="vidro" data-lustro="fixo"><h2>O que acontece com o relato?</h2><p className="mt-4 max-w-prose leading-relaxed">O relato fica registrado no banco do projeto para análise. Não há prazo de resposta ou canal individual de acompanhamento definido. A confirmação de recebimento não garante que o dado esteja incorreto. Consulte a <Link href="/sobre">política de correções</Link>.</p></section></main></LayoutEconomia>;
}
