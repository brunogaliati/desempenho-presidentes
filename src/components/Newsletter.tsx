"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { inscrever, type Resultado } from "@/app/acoes";

/**
 * Captura de e-mail.
 *
 * Vem depois de toda a narrativa, não antes: o pedido só é razoável quando o
 * valor já foi entregue. A promessa é concreta ("aviso quando o IBGE divulgar")
 * em vez de "receba atualizações", porque a pessoa precisa saber exatamente o
 * que vai chegar na caixa dela.
 */

interface Props {
  origem?: string;
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
      style={{ background: "var(--serie)" }}
    >
      {pending ? "Cadastrando…" : "Quero receber"}
    </button>
  );
}

export function Newsletter({ origem = "rodape" }: Props) {
  const [estado, acao] = useActionState<Resultado | null, FormData>(
    inscrever,
    null,
  );

  return (
    <section
      className="rounded-lg border p-5 md:p-6"
      style={{ borderColor: "var(--borda)", background: "var(--superficie)" }}
      id="newsletter"
    >
      <h2 className="text-lg font-semibold">
        Aviso quando os números mudarem
      </h2>
      <p className="mt-1.5 max-w-prose text-[15px] leading-relaxed"
         style={{ color: "var(--tinta-2)" }}>
        O IBGE divulga a inflação todo mês e o desemprego a cada trimestre.
        Quando esses dados saem, eu recalculo tudo e te mando o que mudou, com
        o número novo e o que ele significa. Sem opinião, sem spam.
      </p>

      <form action={acao} className="mt-4 flex flex-wrap gap-2">
        <input type="hidden" name="origem" value={origem} />

        {/* Honeypot: invisível para gente, irresistível para robô. */}
        <input
          type="text"
          name="empresa"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-0 w-0 opacity-0"
        />

        <label htmlFor="email-newsletter" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="email-newsletter"
          type="email"
          name="email"
          required
          placeholder="seu@email.com"
          autoComplete="email"
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
          style={{
            borderColor: "var(--borda)",
            background: "var(--plano)",
            color: "var(--tinta)",
          }}
        />
        <Botao />
      </form>

      {estado && (
        <p
          role="status"
          className="mt-2 text-sm"
          style={{ color: estado.ok ? "var(--bom)" : "var(--ruim)" }}
        >
          {estado.ok ? "✓ " : "⚠ "}
          {estado.mensagem}
        </p>
      )}
    </section>
  );
}
