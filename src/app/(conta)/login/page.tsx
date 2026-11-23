import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contaConfigurada, ERRO_CONTA, sessaoAtual } from "@/lib/contas";
import { NOME_MAXIMO, SENHA_MINIMA, SENHA_MAXIMA } from "@/lib/credenciais";
import fotografia from "@/app/_painel/_dados/fotografia.json";
import { chaveSeguido, lerChaveSeguido, naComposicao } from "@/lib/seguindoChave";
import { FormularioConta } from "../FormularioConta";
import styles from "../conta.module.css";

export const metadata: Metadata = { title: "Entrar | Desempenho do Governo" };

export default async function Login({ searchParams }: { searchParams: Promise<{ modo?: string; verificar?: string; seguir?: string }> }) {
  const params = await searchParams;
  // Do botão "Seguir" de um parlamentar: depois de entrar, a conta oferece seguir essa pessoa.
  const chave = lerChaveSeguido(params.seguir);
  const seguir = naComposicao(chave) ? chave : null;
  const quem = seguir ? fotografia[seguir.casa].find(p => p.id === seguir.id)?.nome : null;
  const { usuario } = await sessaoAtual();
  if (usuario) redirect(seguir ? `/conta?seguir=${chaveSeguido(seguir)}` : "/conta");
  const cadastro = params.modo === "cadastro";
  const comSeguir = (url: string) => (seguir ? `${url}${url.includes("?") ? "&" : "?"}seguir=${chaveSeguido(seguir)}` : url);
  if (!contaConfigurada()) return (
    <section className={`vidro ${styles.cartao}`} data-lustro="fixo" aria-labelledby="titulo-conta">
      <p className={styles.sobretitulo}>Sua conta</p>
      <h1 id="titulo-conta">Entrar</h1>
      <p className={styles.erro} role="alert">{ERRO_CONTA}</p>
    </section>
  );

  return (
    <section className={`vidro ${styles.cartao}`} data-lustro="fixo" aria-labelledby="titulo-conta">
      <nav className={`segmentos ${styles.modos}`} aria-label="Acesso à conta">
        <Link href={comSeguir("/login")} replace scroll={false} aria-current={cadastro ? undefined : "page"}>Entrar</Link>
        <Link href={comSeguir("/login?modo=cadastro")} replace scroll={false} aria-current={cadastro ? "page" : undefined}>Criar conta</Link>
      </nav>
      <p className={styles.sobretitulo}>Sua conta</p>
      <h1 id="titulo-conta">{cadastro ? "Crie sua conta" : "Entre na sua conta"}</h1>
      <p className={styles.ajuda}>{cadastro ? "Informe seu nome, seu e-mail e uma senha." : "Acesse sua conta com e-mail e senha."}</p>
      {quem && (
        <p className={styles.aviso} role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
            <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z" />
          </svg>
          {cadastro ? "Crie sua conta" : "Entre"} para seguir {quem} e ver como vota.
        </p>
      )}
      {params.verificar === "1" && (
        <p className={styles.aviso} role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
          </svg>
          Confira seu e-mail e confirme o cadastro antes de entrar.
        </p>
      )}
      <FormularioConta key={String(cadastro)} cadastro={cadastro} senhaMinima={SENHA_MINIMA} senhaMaxima={SENHA_MAXIMA} nomeMaximo={NOME_MAXIMO} seguir={seguir ? chaveSeguido(seguir) : undefined} />
      <p className={styles.nota}>
        Usamos o nome e o e-mail para identificar sua conta. <Link href="/sobre#privacidade">Privacidade</Link>
      </p>
    </section>
  );
}
