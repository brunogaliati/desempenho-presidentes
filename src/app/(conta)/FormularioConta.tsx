"use client";

import { useActionState, useState } from "react";
import { acessar } from "./acoes";
import styles from "./conta.module.css";

export function FormularioConta({ cadastro, senhaMinima, senhaMaxima, nomeMaximo, seguir }: { cadastro: boolean; senhaMinima: number; senhaMaxima: number; nomeMaximo: number; seguir?: string }) {
  // Controlados para sobreviver ao reset do formulário quando a ação volta com erro.
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, acao, enviando] = useActionState(acessar.bind(null, cadastro ? "cadastro" : "entrar"), null);

  const tipoSenha = senhaVisivel ? "text" : "password";
  const senhaCurta = Array.from(senha).length < senhaMinima;
  // Avisa assim que a segunda senha desvia da primeira, sem esperar o fim da digitação.
  const diferentes = confirmacao !== "" && !senha.startsWith(confirmacao);
  const iguais = confirmacao !== "" && confirmacao === senha;

  return (
    <form className={styles.formulario} action={acao}>
      {seguir && <input type="hidden" name="seguir" value={seguir} />}
      {cadastro && (
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome</span>
          <input name="nome" type="text" autoComplete="name" autoCapitalize="words" maxLength={nomeMaximo} required
            value={nome} onChange={evento => setNome(evento.target.value)} />
        </label>
      )}
      <label className={styles.campo}>
        <span className={styles.rotulo}>E-mail</span>
        <input name="email" type="email" autoComplete="username" autoCapitalize="none" maxLength={254} required
          placeholder="voce@exemplo.com" value={email} onChange={evento => setEmail(evento.target.value)} />
      </label>
      <div className={styles.campo}>
        <label className={styles.rotulo} htmlFor="senha-conta">Senha</label>
        <div className={styles.senha}>
          <input id="senha-conta" name="senha" type={tipoSenha} autoComplete={cadastro ? "new-password" : "current-password"} required
            minLength={cadastro ? senhaMinima : undefined} maxLength={senhaMaxima}
            aria-describedby={cadastro ? "regra-senha" : undefined}
            value={senha} onChange={evento => setSenha(evento.target.value)} />
          <button type="button" className={styles.olho} aria-pressed={senhaVisivel}
            aria-controls={cadastro ? "senha-conta senha-confirmacao" : "senha-conta"}
            aria-label={senhaVisivel ? "Ocultar senha" : "Mostrar senha"} title={senhaVisivel ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setSenhaVisivel(visivel => !visivel)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" />
              {senhaVisivel && <path d="M4 4l16 16" />}
            </svg>
          </button>
        </div>
        {cadastro && (
          <span id="regra-senha" className={styles.regra} data-estado={senha && !senhaCurta ? "ok" : undefined}>
            {senha && !senhaCurta && <span aria-hidden>✓ </span>}Pelo menos {senhaMinima} caracteres.
          </span>
        )}
      </div>
      {cadastro && (
        <div className={styles.campo}>
          <label className={styles.rotulo} htmlFor="senha-confirmacao">Repita a senha</label>
          <input id="senha-confirmacao" name="confirmacao" type={tipoSenha} autoComplete="new-password" required maxLength={senhaMaxima}
            aria-invalid={diferentes || undefined} aria-describedby="confere-senha"
            value={confirmacao} onChange={evento => setConfirmacao(evento.target.value)} />
          <span id="confere-senha" className={styles.regra} data-estado={diferentes ? "erro" : iguais ? "ok" : undefined} aria-live="polite">
            {diferentes ? "As senhas não são iguais." : iguais ? <><span aria-hidden>✓ </span>As senhas são iguais.</> : null}
          </span>
        </div>
      )}
      {erro && <p className={styles.erro} role="alert">{erro}</p>}
      <button className={`botao-liquido ${styles.botao}`} disabled={enviando}>
        {cadastro ? (enviando ? "Criando conta…" : "Criar conta") : (enviando ? "Entrando…" : "Entrar")}
        {!enviando && <span aria-hidden>→</span>}
      </button>
    </form>
  );
}
