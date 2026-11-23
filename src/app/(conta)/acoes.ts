"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { autenticarConta, encerrarSessao, sessaoAtual } from "@/lib/contas";
import { normalizarEmail, normalizarNome, senhaValida, SENHA_MAXIMA, SENHA_MINIMA } from "@/lib/credenciais";
import { deixarDeSeguir, seguirParlamentar } from "@/lib/seguindo";
import { chaveSeguido, lerChaveSeguido, LIMITE_SEGUIDOS, naComposicao } from "@/lib/seguindoChave";

export async function acessar(modo: "entrar" | "cadastro", _estado: string | null, dados: FormData) {
  if (modo !== "entrar" && modo !== "cadastro") return "Opção de acesso inválida.";
  const cadastro = modo === "cadastro";
  const nome = cadastro ? normalizarNome(dados.get("nome")) : null;
  const email = normalizarEmail(dados.get("email"));
  const senha = dados.get("senha");
  if (cadastro && !nome) return "Informe seu nome.";
  if (!email) return "Informe um e-mail válido.";
  const senhaLonga = typeof senha === "string" && senha.length > SENHA_MAXIMA;
  if (cadastro && !senhaValida(senha)) {
    return senhaLonga ? `Use no máximo ${SENHA_MAXIMA} caracteres na senha.` : `Use pelo menos ${SENHA_MINIMA} caracteres na senha.`;
  }
  if (cadastro && dados.get("confirmacao") !== senha) return "As senhas não são iguais.";
  if (typeof senha !== "string" || !senha || senha.length > SENHA_MAXIMA) return "E-mail ou senha incorretos.";

  const { erro, verificar } = await autenticarConta(modo, email, senha, nome);
  if (erro) return erro;
  if (verificar) redirect("/login?verificar=1");
  // Veio do botão "Seguir" de um parlamentar: a página da conta oferece seguir quem ele escolheu.
  const seguir = lerChaveSeguido(dados.get("seguir"));
  redirect(naComposicao(seguir) ? `/conta?seguir=${chaveSeguido(seguir)}` : "/conta");
}

export async function sair() {
  const erro = await encerrarSessao();
  if (erro) return erro;
  redirect("/login");
}

/** Segue ou deixa de seguir um parlamentar da composição atual. */
export async function alternarSeguir(casa: string, id: number, seguir: boolean): Promise<{ erro: string | null }> {
  const chave = lerChaveSeguido(`${casa}:${id}`);
  if (!naComposicao(chave)) return { erro: "Parlamentar não encontrado na composição atual." };
  const { usuario, erro } = await sessaoAtual();
  if (!usuario) return { erro: erro ?? "Entre na sua conta para seguir parlamentares." };
  try {
    if (!seguir) await deixarDeSeguir(usuario.id, chave);
    else if (!(await seguirParlamentar(usuario.id, chave))) return { erro: `Você já segue ${LIMITE_SEGUIDOS} parlamentares, o máximo por conta.` };
  } catch (falha) {
    console.error("Seguir parlamentar indisponível", falha);
    return { erro: "Não deu para salvar agora. Tente de novo em instantes." };
  }
  revalidatePath("/conta");
  return { erro: null };
}
