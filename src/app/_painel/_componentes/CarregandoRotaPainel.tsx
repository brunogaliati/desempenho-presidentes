"use client";
import { usePathname } from "next/navigation";
import { temaDoCaminho } from "@/lib/temasPainel";
import CarregandoPainel from "./CarregandoPainel";
export default function CarregandoRotaPainel() {
  return <CarregandoPainel aba={temaDoCaminho(usePathname())}/>;
}
