"use client";
import { createContext, useContext } from "react";
export const ContextoPerfil = createContext<{pessoaId:string;nome:string}|null>(null);
export const usePerfilPainel=()=>useContext(ContextoPerfil);
