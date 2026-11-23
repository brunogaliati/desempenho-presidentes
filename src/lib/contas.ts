import "server-only";

import { parseSetCookie, stringifyCookie } from "cookie";
import { cookies, headers } from "next/headers";

const COOKIE_NEON = "__Secure-neon-auth.session_token";
const producao = process.env.NODE_ENV === "production";
const COOKIE_SITE = producao ? "__Host-desempenho-neon" : "desempenho-neon";
export const ERRO_CONTA = "O acesso à conta está indisponível. Tente novamente em instantes.";

function urlNeon() {
  const base = process.env.NEON_AUTH_BASE_URL?.trim();
  if (!base) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return `${url.href.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
}

export function contaConfigurada() {
  return Boolean(urlNeon());
}

async function chamarNeon(
  caminho: "get-session?disableRefresh=true" | "sign-in/email" | "sign-up/email" | "sign-out",
  opcoes: { token?: string; origem?: string; dados?: object },
) {
  const base = urlNeon();
  if (!base) throw new Error("NEON_AUTH_BASE_URL ausente ou inválida");
  const cabecalhos = new Headers({ Accept: "application/json" });
  if (opcoes.token) cabecalhos.set("Cookie", stringifyCookie({ [COOKIE_NEON]: opcoes.token }));
  if (opcoes.origem) cabecalhos.set("Origin", opcoes.origem);
  if (opcoes.dados) cabecalhos.set("Content-Type", "application/json");
  return fetch(new URL(caminho, base), {
    method: opcoes.dados ? "POST" : "GET",
    headers: cabecalhos,
    body: opcoes.dados ? JSON.stringify(opcoes.dados) : undefined,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
}

async function tokenAtual() {
  return (await cookies()).get(COOKIE_SITE)?.value;
}

async function gravarCookie(token: string, validade: { maxAge?: number; expires?: Date }) {
  (await cookies()).set(COOKIE_SITE, token, {
    httpOnly: true,
    secure: producao,
    sameSite: "lax",
    path: "/",
    ...validade,
  });
}

export async function sessaoAtual() {
  const token = await tokenAtual();
  if (!token || !contaConfigurada()) return { usuario: null, erro: null };
  try {
    const resposta = await chamarNeon("get-session?disableRefresh=true", { token });
    if (resposta.status === 401) return { usuario: null, erro: null };
    if (!resposta.ok) return { usuario: null, erro: ERRO_CONTA };
    const dados = await resposta.json();
    const usuario = dados?.user;
    if (!dados?.session || typeof usuario?.id !== "string" || typeof usuario?.email !== "string") {
      return { usuario: null, erro: null };
    }
    const nome = typeof usuario.name === "string" && usuario.name.trim() ? usuario.name.trim() : null;
    return { usuario: { id: usuario.id, email: usuario.email, nome }, erro: null };
  } catch {
    return { usuario: null, erro: ERRO_CONTA };
  }
}

export async function autenticarConta(modo: "entrar" | "cadastro", email: string, senha: string, nome?: string | null) {
  try {
    // As Server Actions do Next conferem o Origin com o host antes de chamar esta função.
    const origem = (await headers()).get("origin");
    if (!origem) return { erro: ERRO_CONTA };
    const cadastro = modo === "cadastro";
    const dados = cadastro ? { email, password: senha, name: nome || "Leitor", callbackURL: new URL("/login", origem).href }
      : { email, password: senha };
    const resposta = await chamarNeon(cadastro ? "sign-up/email" : "sign-in/email", { origem, dados });

    if (resposta.status === 429) return { erro: "Muitas tentativas. Aguarde um pouco e tente novamente." };
    if (resposta.status >= 500) return { erro: ERRO_CONTA };
    if (!resposta.ok) {
      const falha = await resposta.json().catch(() => null);
      if (falha?.code === "INVALID_ORIGIN") return { erro: ERRO_CONTA };
      if (falha?.code === "EMAIL_NOT_VERIFIED") return { erro: "Confirme seu e-mail antes de entrar." };
      return { erro: cadastro ? "Não foi possível criar a conta. Se você já tem uma conta, tente entrar." : "E-mail ou senha incorretos." };
    }

    const sessao = resposta.headers.getSetCookie().map(cabecalho => parseSetCookie(cabecalho))
      .find(cookie => cookie.name === COOKIE_NEON && cookie.value);
    if (sessao?.value) {
      await gravarCookie(sessao.value, { maxAge: sessao.maxAge, expires: sessao.expires });
      return { erro: null, verificar: false };
    }

    const registro = await resposta.json();
    if (cadastro && registro?.token === null && registro?.user) return { erro: null, verificar: true };
    return { erro: ERRO_CONTA };
  } catch {
    return { erro: ERRO_CONTA };
  }
}

export async function encerrarSessao() {
  const erro = "Não foi possível sair da conta. Tente novamente em instantes.";
  try {
    const token = await tokenAtual();
    if (token) {
      const origem = (await headers()).get("origin");
      if (!origem) return erro;
      const resposta = await chamarNeon("sign-out", { token, origem, dados: {} });
      if (!resposta.ok && resposta.status !== 401) return erro;
    }
    await gravarCookie("", { maxAge: 0 });
    return null;
  } catch {
    return erro;
  }
}
