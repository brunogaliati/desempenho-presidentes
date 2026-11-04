"use client";
import { ErroPagina } from "@/components/ErroPagina";
import { EstruturaEconomia } from "./economia/EstruturaEconomia";

export default function ErroPainel({ reset }: { reset: () => void }) {
  return <EstruturaEconomia><ErroPagina reset={reset}/></EstruturaEconomia>;
}
