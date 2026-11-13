import type { PeriodoCota } from "./congressoModelo";

/** Aplicação do recurso e endereço do favorecido são geografias diferentes. */
export type MunicipioEmenda = { codigo: string; nome: string; destinado: number | null; pago: number | null };
export type PlanoEmenda = {
  emenda: string; fonte: string; instrumento: string; executor: string;
  objeto: string | null; situacao: string; codigoMunicipio: string | null; municipio: string | null; uf: string | null;
  metodoLocalizacao: string; previsto: number | null; totalInstrumento: number | null;
  beneficiario: string | null; empenhoPlano: number | null; documentos: string[]; conciliacao: string; fonteUrl: string;
};
export type EmendasParlamentar = {
  uf: string;
  desde: number;
  ate: number;
  coletadoEm: string;
  cobertura: {
    destinadoTotal: number | null;
    destinadoNoEstado: number | null;
    destinadoSemMunicipio: number | null;
    destinadoForaEstado: number | null;
    pagoSemMunicipio: number | null;
    emendasPendentes: number;
  };
  aplicacao: MunicipioEmenda[];
  prefeituras: MunicipioEmenda[];
  planos: PlanoEmenda[];
  coletadoEmPlanos: string;
};

export function planosDasEmendas(linhas: PlanoEmenda[], busca: string) {
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  const alvo = normalizar(busca);
  return linhas.filter(p => normalizar([p.municipio, p.objeto, p.beneficiario, p.emenda, p.situacao].filter(Boolean).join(" ")).includes(alvo))
    .sort((a, b) => Number(b.metodoLocalizacao === "municipio_citado_no_objeto") - Number(a.metodoLocalizacao === "municipio_citado_no_objeto")
      || (b.previsto ?? -Infinity) - (a.previsto ?? -Infinity) || a.emenda.localeCompare(b.emenda) || a.executor.localeCompare(b.executor));
}

/** O orçamento de um ano pode ter sido apresentado no anterior; o recorte é o ano da emenda. */
export function anosDasEmendas(periodo: PeriodoCota, hoje = new Date()) {
  const ano = hoje.getFullYear();
  const inicio = 2023 + 4 * Math.floor((ano - 2023) / 4);
  return typeof periodo === "number" ? { desde: periodo, ate: periodo } : { desde: inicio, ate: Math.min(inicio + 3, ano) };
}

export type OrdemEmendas = "nome" | "destinado" | "pago";
export function municipiosDasEmendas(linhas: MunicipioEmenda[], busca: string, ordem: OrdemEmendas) {
  const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").trim();
  const alvo = normalizar(busca);
  return linhas.filter(m => normalizar(m.nome).includes(alvo)).sort((a, b) => {
    if (ordem !== "nome") {
      if (a[ordem] === null && b[ordem] !== null) return 1;
      if (b[ordem] === null && a[ordem] !== null) return -1;
      if (a[ordem] !== b[ordem]) return (b[ordem] ?? 0) - (a[ordem] ?? 0);
    }
    return a.nome.localeCompare(b.nome, "pt-BR") || a.codigo.localeCompare(b.codigo);
  });
}
