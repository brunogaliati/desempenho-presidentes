"use client";

import { useState } from "react";

/**
 * Botões de compartilhamento.
 *
 * Substitui `ShareButtons` e `MetricShareButtons`, que tinham a mesma lógica de
 * X/WhatsApp/Telegram duplicada em dois arquivos.
 *
 * O WhatsApp vem primeiro de propósito: é onde a discussão política brasileira
 * de fato acontece, e o link precisa chegar lá com o número já no texto, porque
 * boa parte das pessoas lê o print sem abrir o site.
 */

interface Props {
  /** Texto que vai junto do link. Deve conter o número, não só o convite. */
  mensagem: string;
  /** Âncora da seção, para o link cair no lugar certo. */
  ancora?: string;
  compacto?: boolean;
}

function url(ancora?: string) {
  if (typeof window === "undefined") return "";
  return ancora
    ? `${window.location.origin}${window.location.pathname}#${ancora}`
    : window.location.href;
}

export function Compartilhar({ mensagem, ancora, compacto = false }: Props) {
  const [copiado, setCopiado] = useState(false);

  const abrir = (destino: "whatsapp" | "x" | "telegram") => {
    const u = url(ancora);
    const texto = `${mensagem}\n\n${u}`;
    const links = {
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`,
      x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}`,
      telegram: `https://telegram.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(mensagem)}`,
    };
    window.open(links[destino], "_blank", "noopener,noreferrer");
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(`${mensagem}\n\n${url(ancora)}`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const classe = `rounded-md border px-2.5 ${compacto ? "py-1 text-xs" : "py-1.5 text-sm"} transition-colors hover:opacity-80`;
  const estilo = { borderColor: "var(--borda)", color: "var(--tinta-2)" };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compacto && (
        <span className="text-sm" style={{ color: "var(--tinta-3)" }}>
          Compartilhar:
        </span>
      )}
      <button onClick={() => abrir("whatsapp")} className={classe} style={estilo}>
        WhatsApp
      </button>
      <button onClick={() => abrir("x")} className={classe} style={estilo}>
        X
      </button>
      <button onClick={() => abrir("telegram")} className={classe} style={estilo}>
        Telegram
      </button>
      <button onClick={copiar} className={classe} style={estilo}>
        {copiado ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
