"use client";
import { Children, isValidElement, type DetailsHTMLAttributes } from 'react';
import { useEstadoCompartilhavel } from './RecortesCompartilhaveis';
import { Compartilhar } from './Compartilhar';
import { idCompartilhavel, opcaoCompartilhada } from '@/lib/compartilhamento';
import { textoCompartilhamento } from '@/lib/textoCompartilhamento';
import estilos from './Detalhes.module.css';

type Props=DetailsHTMLAttributes<HTMLDetailsElement>&{
  /** "acao" revela uma lista ou tabela longa; o padrão é a linha de pergunta. */
  variante?:'pergunta'|'acao';
};

export function DetalhesCompartilhaveis({children,id,className='',variante='pergunta',...props}:Props) {
  const resumo=Children.toArray(children).find(n=>isValidElement(n)&&n.type==='summary');
  const titulo=textoCompartilhamento(resumo),ancora=id??idCompartilhavel(titulo);
  const [aberto,setAberto]=useEstadoCompartilhavel<boolean|undefined>(`detalhe.${ancora}`,undefined,opcaoCompartilhada([true,false]));
  // Fechado é o padrão: `undefined` tira o parâmetro da URL em vez de deixar `=false` nela.
  return <details {...props} className={`${variante==='acao'?estilos.acao:estilos.detalhes} ${className}`} id={ancora} open={aberto===true} onToggle={e=>setAberto(e.currentTarget.open?true:undefined)}>{children}<div className={estilos.compartilhar}><Compartilhar mensagem={titulo} ancora={ancora} compacto/></div></details>;
}
