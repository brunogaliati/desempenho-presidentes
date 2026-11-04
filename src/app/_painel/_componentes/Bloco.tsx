"use client";
import { Compartilhar } from "@/components/Compartilhar";
import { idCompartilhavel } from "@/lib/compartilhamento";

/**
 * As peças comuns dos painéis do terminal da economia: o painel de vidro, o
 * seletor de opções e o rótulo em caixa alta. Ficam aqui para os quadros de
 * emprego, crédito e orçamento usarem exatamente o mesmo padrão do resto.
 */

export const ROTULO = "mono text-[10px] font-medium uppercase tracking-[0.14em]";

/**
 * Um painel de vidro. O cabeçalho é uma linha só: o nome do painel e, quando
 * ajuda, um detalhe curto em cinza (fonte, período). Nada de sobretítulo nem
 * frase de abertura: o painel se explica pelo que mostra.
 */
export function Bloco({
  id,
  titulo,
  detalhe,
  acao,
  className = "",
  corpo = "",
  lustroFixo = false,
  mensagemCompartilhamento,
  contextoCompartilhamento,
  children,
}: {
  id?: string;
  titulo: string;
  detalhe?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
  /** Classes do miolo, abaixo do cabeçalho. */
  corpo?: string;
  /** Sem o reflexo que segue o ponteiro: num painel grande e denso, redesenhá-lo a cada movimento pesa. */
  lustroFixo?: boolean;
  mensagemCompartilhamento?: string;
  contextoCompartilhamento?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id ?? idCompartilhavel(titulo)}
      aria-label={titulo}
      data-lustro={lustroFixo ? "fixo" : undefined}
      className={`vidro min-w-0 rounded-[1.6rem] p-4 ${className}`}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <h3 className="text-[15px] font-semibold leading-snug">{titulo}</h3>
        {detalhe && (
          <span className="text-[11px]" style={{ color: "var(--tinta-3)" }}>
            {detalhe}
          </span>
        )}
        <div className="ml-auto flex max-w-full shrink-0 items-center gap-2 self-center">{acao}<Compartilhar mensagem={mensagemCompartilhamento??titulo} contexto={contextoCompartilhamento} ancora={id ?? idCompartilhavel(titulo)} compacto/></div>
      </header>
      <div className={`mt-3 ${corpo}`}>{children}</div>
    </section>
  );
}

/** Um botão por opção, lado a lado, com a escolhida preenchida. */
export function Opcoes<T extends string>({
  opcoes,
  ativa,
  aoEscolher,
  rotulo,
  quebra = false,
}: {
  opcoes: { id: T; rotulo: string }[];
  ativa: T;
  aoEscolher: (id: T) => void;
  rotulo: string;
  /** Muitas opções: quebram em mais de uma linha quando não cabem. */
  quebra?: boolean;
}) {
  return (
    <div className="seletor" data-quebra={quebra ? "" : undefined} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={o.id === ativa} onClick={() => aoEscolher(o.id)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
