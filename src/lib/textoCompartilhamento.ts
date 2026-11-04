import { Children, isValidElement, type ReactNode } from 'react';
export function textoCompartilhamento(no:ReactNode):string {
  return Children.toArray(no).map(n=>typeof n==='string'||typeof n==='number'?String(n):isValidElement<{children?:ReactNode}>(n)?textoCompartilhamento(n.props.children):'').join(' ').replace(/\s+/g,' ').trim();
}
