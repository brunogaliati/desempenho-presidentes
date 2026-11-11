import type { DadosPainel } from "../_dados/tipos";
import { corDoPartido } from "./governos";

/** A sigla de um parlamentar, com quem está sem partido no cadastro. */
export const partidoDe = (p: { partido: string | null }) => p.partido ?? "Sem informação";

/** Partidos que não governaram estados e por isso não têm cor no mapa: a maquete precisa de uma. */
const coresComplementares: Record<string, string> = { PV: "var(--partido-pv)", PSOL: "var(--congresso-psol)", REDE: "var(--congresso-rede)", AVANTE: "var(--congresso-avante)", PRD: "var(--congresso-prd)", "MISSÃO": "var(--congresso-missao)" };

/** A cor de uma bancada na maquete e nas listas do Congresso (e na Câmara do Resumo). */
export const corDaBancada = (governos: DadosPainel["governos"], sigla: string | null) =>
  coresComplementares[sigla ?? ""] ?? corDoPartido(governos, sigla === "S/Partido" ? "SEM" : sigla);
