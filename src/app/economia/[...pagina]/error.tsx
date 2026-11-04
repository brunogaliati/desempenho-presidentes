"use client";
import { ErroPagina } from "@/components/ErroPagina";
export default function ErroIndicador({reset}:{reset:()=>void}) {return <ErroPagina reset={reset} titulo="Não foi possível carregar os dados"/>;}
