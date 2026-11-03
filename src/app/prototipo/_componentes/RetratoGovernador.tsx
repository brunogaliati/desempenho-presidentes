import Image from "next/image";

import fotos from "../_dados/fotos-governadores.json";

/** A chave combina UF e nome para não confundir pessoas homônimas. */
export function RetratoGovernador({ uf, nome, tamanho = 24 }: { uf: string; nome: string; tamanho?: number }) {
  const src = (fotos as Record<string, string>)[`${uf}|${nome}`];
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border"
      style={{ width: tamanho, height: tamanho, borderColor: "var(--borda)", background: "var(--faixa-a)", color: "var(--tinta-2)", fontSize: tamanho * 0.34 }}
      data-retrato-governador={`${uf}|${nome}`}
    >
      {src ? (
        <Image src={src} alt={`Foto de ${nome}`} width={tamanho} height={tamanho} unoptimized className="h-full w-full object-cover" style={{ objectPosition: "50% 30%" }} />
      ) : <span aria-hidden>{iniciais}</span>}
    </span>
  );
}
