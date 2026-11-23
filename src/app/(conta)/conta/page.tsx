import type { Metadata } from "next";
import { redirect } from "next/navigation";
import fotografia from "@/app/_painel/_dados/fotografia.json";
import governos from "@/app/_painel/_dados/governos.json";
import { sessaoAtual } from "@/lib/contas";
import { listarSeguidos, type Seguido } from "@/lib/seguindo";
import { lerChaveSeguido, naComposicao } from "@/lib/seguindoChave";
import { type InfoPartido, PainelConta } from "../PainelConta";
import styles from "../conta.module.css";

export const metadata: Metadata = { title: "Minha conta | Desempenho do Governo" };

/**
 * A etiqueta de cada partido da composição atual, nas cores do painel (`--partido-*`). Sai daqui
 * para o navegador não baixar o `governos.json` inteiro só por isso.
 */
const PARTIDOS: Record<string, InfoPartido> = (() => {
  const partidos = governos.partidos as Record<string, { familia: string; curta: string }>;
  const siglas = new Set([...fotografia.deputados, ...fotografia.senadores].map(p => (!p.partido || p.partido === "S/Partido" ? "SEM" : p.partido)));
  return Object.fromEntries([...siglas].map(sigla => {
    if (sigla === "SEM") return [sigla, { cor: "var(--partido-sem)", tinta: "var(--partido-sem-texto)", rotulo: "s/ partido", vazado: true }];
    const familia = partidos[sigla]?.familia ?? "nd";
    return [sigla, { cor: `var(--partido-${familia})`, tinta: `var(--partido-${familia}-texto)`, rotulo: partidos[sigla]?.curta ?? sigla, vazado: familia === "nd" }];
  }));
})();

export default async function Conta({ searchParams }: { searchParams: Promise<{ seguir?: string }> }) {
  const { usuario, erro } = await sessaoAtual();
  if (!usuario && !erro) redirect("/login");
  if (!usuario) return (
    <section className={`vidro ${styles.cartao}`} data-lustro="fixo" aria-labelledby="titulo-conta">
      <p className={styles.sobretitulo}>Sua conta</p>
      <h1 id="titulo-conta">Minha conta</h1>
      <p className={styles.erro} role="alert">{erro}</p>
    </section>
  );

  let seguidos: Seguido[] | null = null;
  try {
    seguidos = await listarSeguidos(usuario.id);
  } catch (falha) {
    console.error("Lista de seguidos indisponível", falha);
  }
  const chave = lerChaveSeguido((await searchParams).seguir);
  // Contas criadas antes do campo de nome receberam "Leitor" do cadastro: não é o nome da pessoa.
  const nome = usuario.nome && usuario.nome !== "Leitor" ? usuario.nome : null;
  return <PainelConta usuario={{ nome, email: usuario.email }} seguidos={seguidos} partidos={PARTIDOS}
    sugestao={naComposicao(chave) ? chave : null} />;
}
