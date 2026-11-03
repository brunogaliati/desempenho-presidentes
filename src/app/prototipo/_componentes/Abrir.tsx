"use client";

/** O mesmo movimento para a barra que abre, o mapa que recua e o que se expande. */
export const MOVIMENTO = "duration-500 ease-[cubic-bezier(.22,1,.36,1)]";

/**
 * Abre e fecha na altura com transição: a grade vai de 0fr a 1fr. Dentro de
 * botão vai como `span`, que é o que o HTML deixa pôr ali.
 */
export function Abrir({
  aberto,
  children,
  como: Tag = "div",
}: {
  aberto: boolean;
  children: React.ReactNode;
  como?: "div" | "span";
}) {
  return (
    <Tag
      className={`grid transition-[grid-template-rows,opacity] ${MOVIMENTO}`}
      style={{
        gridTemplateRows: aberto ? "1fr" : "0fr",
        opacity: aberto ? 1 : 0,
      }}
      inert={!aberto}
    >
      <Tag className="block min-h-0 overflow-hidden">{children}</Tag>
    </Tag>
  );
}
