"use client";
import { usePathname } from "next/navigation";
import { temaDoCaminho } from "@/lib/temasPainel";
import CarregandoPainel from "./CarregandoPainel";
import { rotaParlamentar } from "../_dados/congressoModelo";
export default function CarregandoRotaPainel({ embutido=false }: { embutido?:boolean }) {
  const caminho=usePathname();
  return <CarregandoPainel aba={temaDoCaminho(caminho)} perfilParlamentar={!!rotaParlamentar(caminho)} embutido={embutido}/>;
}
