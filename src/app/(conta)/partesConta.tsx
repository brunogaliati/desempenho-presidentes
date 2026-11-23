import { type CasaCongresso, VOTO_POR_LETRA } from "@/app/_painel/_dados/congressoModelo";
import type { Pessoa } from "./painelContaModelo";
import p from "./painel.module.css";

/** Peças comuns ao painel da conta (`PainelConta`) e à montagem da lista (`Montagem`). */

export type InfoPartido = { cor: string; tinta: string; rotulo: string; vazado: boolean };
export type Alternar = (pessoa: Pessoa, seguir: boolean) => void;

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const siglaDe = (x: Pessoa) => (!x.partido || x.partido === "S/Partido" ? "SEM" : x.partido);
export const casaCurta = (casa: CasaCongresso) => (casa === "deputados" ? "Câmara" : "Senado");

export function dataDoFeed(d: string) {
  const [ano, mes, dia] = d.slice(0, 10).split("-");
  return { dia, mes: MESES_CURTOS[Number(mes) - 1], ano };
}

/** PEC vota duas vezes no mesmo dia; o turno separa as duas linhas. */
export const turno = (descricao: string) => (/primeiro turno|1º turno/i.test(descricao) ? ", 1º turno" : /segundo turno|2º turno/i.test(descricao) ? ", 2º turno" : "");

export function Partido({ info }: { info: InfoPartido | undefined }) {
  if (!info) return null;
  return <span className={p.partido} data-vazado={info.vazado || undefined}
    style={info.vazado ? undefined : { background: info.cor, color: info.tinta }}>{info.rotulo}</span>;
}

/**
 * O voto como na página do parlamentar: ✓ Sim cheio em verde, ✗ Não cheio em vermelho, o resto
 * num selo de contorno. O símbolo e a palavra dizem o mesmo que a cor.
 */
export function Voto({ letra }: { letra: string }) {
  if (letra === "S" || letra === "N") return <span className={p.selo} data-sim={letra === "S" || undefined}>
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {letra === "S" ? <path d="m2.5 6.3 2.4 2.4 4.6-5" /> : <path d="m3 3 6 6M9 3 3 9" />}
    </svg>
    {letra === "S" ? "Sim" : "Não"}
  </span>;
  return <span className={p.seloNeutro} data-ausente={"-FJ".includes(letra) || undefined}>{VOTO_POR_LETRA[letra] ?? "Não votou"}</span>;
}
