"use client";
import { Children, isValidElement, type DetailsHTMLAttributes } from 'react';
import { useEstadoCompartilhavel } from './RecortesCompartilhaveis';
import { Compartilhar } from './Compartilhar';
import { idCompartilhavel, opcaoCompartilhada } from '@/lib/compartilhamento';
import { textoCompartilhamento } from '@/lib/textoCompartilhamento';

export function DetalhesCompartilhaveis({children,id,...props}:DetailsHTMLAttributes<HTMLDetailsElement>) {
  const resumo=Children.toArray(children).find(n=>isValidElement(n)&&n.type==='summary');
  const titulo=textoCompartilhamento(resumo),ancora=id??idCompartilhavel(titulo);
  const [aberto,setAberto]=useEstadoCompartilhavel(`detalhe.${ancora}`,false,opcaoCompartilhada([true,false]));
  return <details {...props} id={ancora} open={aberto} onToggle={e=>setAberto(e.currentTarget.open)}>{children}<div className="mt-4"><Compartilhar mensagem={titulo} ancora={ancora} compacto/></div></details>;
}
