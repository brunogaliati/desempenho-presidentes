import type { HTMLAttributes } from 'react';
import { Compartilhar } from './Compartilhar';
import { idCompartilhavel } from '@/lib/compartilhamento';
import { textoCompartilhamento } from '@/lib/textoCompartilhamento';

export function TituloCompartilhavel({children,id,...props}:HTMLAttributes<HTMLHeadingElement>) {
  const titulo=textoCompartilhamento(children),ancora=id??idCompartilhavel(titulo);
  return <div className="titulo-compartilhavel"><h2 {...props} id={ancora}>{children}</h2><Compartilhar mensagem={titulo} ancora={ancora} compacto/></div>;
}
