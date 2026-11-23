export const SENHA_MINIMA = 8;
export const SENHA_MAXIMA = 128;
export const NOME_MAXIMO = 80;

/** Nome como a pessoa escreveu, sem caracteres invisíveis nem espaços repetidos. */
export function normalizarNome(valor: FormDataEntryValue | null) {
  if (typeof valor !== "string") return null;
  const nome = valor.normalize("NFC").replace(/\s+/g, " ").replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  if (!/\p{L}/u.test(nome) || Array.from(nome).length > NOME_MAXIMO) return null;
  return nome;
}

export function normalizarEmail(valor: FormDataEntryValue | null) {
  if (typeof valor !== "string") return null;
  const email = valor.trim().toLowerCase();
  if (email.length > 254) return null;
  const [local, dominio, extra] = email.split("@");
  if (local.length > 64 || !dominio || extra !== undefined) return null;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local)) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(dominio)) return null;
  return email;
}

export function senhaValida(senha: FormDataEntryValue | null): senha is string {
  return typeof senha === "string" && senha.length <= SENHA_MAXIMA && Array.from(senha).length >= SENHA_MINIMA;
}
