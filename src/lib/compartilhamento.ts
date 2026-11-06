export type FiltrosCompartilhados = Record<string, string | number | boolean | null | undefined>;

export function idCompartilhavel(titulo: string) {
  return `bloco-${titulo.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,85)}`;
}

export function codificarFiltro(valor: unknown): string | null {
  if (valor === undefined) return null;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}

/** Ano e período efetivos são parte do recorte mesmo se o estado interno usa null como padrão. */
export function registroDoFiltro<T>(valor:T,inicial:T,primeiro:T,paraLink?:(valor:T)=>unknown):string|null {
  const salvo=codificarFiltro(paraLink?paraLink(valor):valor);
  if(paraLink)return salvo;
  return salvo===codificarFiltro(inicial)&&salvo===codificarFiltro(primeiro)?null:salvo;
}

export function decodificarFiltro<T>(valor: string, validar: (valor: unknown) => boolean): T | undefined {
  if (valor.length > 2048) return undefined;
  try { const convertido: unknown = JSON.parse(valor); if (validar(convertido)) return convertido as T; } catch { /* Identificadores de texto não precisam de JSON. */ }
  return validar(valor) ? valor as T : undefined;
}

/** Somente identificadores/filtros entram no link; valores e rótulos vêm das fontes. */
export function linkCompartilhado(atual: string, registros: Iterable<[string,string|null]>, filtros: FiltrosCompartilhados = {}, ancora?: string) {
  const origem = new URL(atual), link = new URL(origem.pathname,origem.origin);
  for (const [chave,valor] of origem.searchParams) {
    if (['uf','mandato','pagina','q'].includes(chave) || /^r\.[a-z0-9_.-]{1,140}$/.test(chave)) link.searchParams.append(chave,valor);
  }
  for (const [chave,valor] of registros) {
    if (!/^r\.[a-z0-9_.-]{1,140}$/.test(chave)) continue;
    if (valor === null) link.searchParams.delete(chave); else link.searchParams.set(chave,valor);
  }
  for (const [chave,valor] of Object.entries(filtros)) {
    if (!['uf','mandato','pagina','q'].includes(chave) && !/^r\.[a-z0-9_.-]{1,140}$/.test(chave)) continue;
    if (valor === undefined || (valor === null && !chave.startsWith('r.'))) link.searchParams.delete(chave); else link.searchParams.set(chave,String(valor));
  }
  const destino = ancora ?? origem.hash.slice(1);
  if (/^[a-zA-Z0-9_.-]{1,100}$/.test(destino)) {link.hash=destino;link.searchParams.set('painel',destino);}
  return link.toString();
}

export const opcaoCompartilhada = (opcoes: readonly unknown[]) => (v: unknown) => opcoes.includes(v);
export const identificadorCompartilhado = (v: unknown) => v === null || (typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(v));
export const inteiroCompartilhado = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10000;
export const textoCompartilhado = (v: unknown) => typeof v === 'string' && v.length <= 200;
