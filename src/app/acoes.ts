"use server";

import { sql } from "@/lib/db";

/**
 * Cadastro na newsletter.
 *
 * Grava na tabela `assinante` do mesmo Neon que serve os dados — a lista é o
 * motor de receita do projeto (tráfego eleitoral → lista → patrocínio), e
 * mantê-la junto permite segmentar por quando a pessoa entrou sem depender de
 * um serviço externo nesta fase.
 *
 * Substitui a versão que escrevia numa aba do Google Sheets.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface Resultado {
  ok: boolean;
  mensagem: string;
}

export async function inscrever(
  _anterior: Resultado | null,
  form: FormData,
): Promise<Resultado> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const origem = String(form.get("origem") ?? "").slice(0, 80) || null;

  // Honeypot: campo escondido que só um robô preenche. Responde como sucesso
  // para não ensinar o robô a contornar a checagem.
  if (String(form.get("empresa") ?? "")) {
    return { ok: true, mensagem: "Pronto! Você vai receber as atualizações." };
  }

  if (!EMAIL.test(email) || email.length > 254) {
    return { ok: false, mensagem: "Esse e-mail não parece válido." };
  }

  try {
    // `do nothing` em vez de erro: reenviar o mesmo e-mail é engano comum, e
    // avisar "já cadastrado" só expõe quem está na lista.
    await sql`
      insert into assinante (email, origem)
      values (${email}, ${origem})
      on conflict (email) do nothing
    `;
    return { ok: true, mensagem: "Pronto! Você vai receber as atualizações." };
  } catch (erro) {
    console.error("falha ao inscrever:", erro);
    return {
      ok: false,
      mensagem: "Não consegui cadastrar agora. Tente de novo em instantes.",
    };
  }
}
