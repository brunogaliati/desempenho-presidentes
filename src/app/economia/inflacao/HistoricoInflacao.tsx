"use client";

import { useState } from "react";
import { GraficoTempo } from "@/components/GraficoTempo";
import { mesPorExtenso, numero } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";
import { acumuladoPeriodo, type MesInflacao } from "@/app/_painel/_dados/economiaModelo";

const MEDIDAS = { dozeMeses: "Acumulado em 12 meses", mensal: "Variação mensal", ano: "Acumulado no ano" };
const percentual = (v: number) => `${numero(v)}%`;

export function HistoricoInflacao({ historico }: { historico: MesInflacao[] }) {
  const ultimo = historico.at(-1)!;
  const inicioPadrao = `${Number(ultimo.mes.slice(0, 4)) - 10}-01`;
  const [desde, setDesde] = useState(historico.find((r) => r.mes >= inicioPadrao)?.mes ?? historico[0].mes);
  const [ate, setAte] = useState(ultimo.mes);
  const [medida, setMedida] = useState<keyof typeof MEDIDAS>("dozeMeses");
  const { ref, largura } = useLargura<HTMLDivElement>();
  const acumulado = acumuladoPeriodo({ datas: historico.map((r) => r.mes), valores: historico.map((r) => r.mensal) }, desde, ate);
  const recorte = historico.filter((r) => r.mes >= desde && r.mes <= ate);
  const classe = "rounded-md border border-[var(--borda)] bg-[var(--superficie)] px-3 py-2 text-base";
  return <div ref={ref}>
    <div className="my-5 flex flex-wrap items-end gap-4">
      <label className="grid gap-1 text-sm">Mostrar<select className={classe} value={medida} onChange={(e) => setMedida(e.target.value as keyof typeof MEDIDAS)}>
        {Object.entries(MEDIDAS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">De<input className={classe} type="month" min={historico[0].mes} max={ultimo.mes} value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
      <label className="grid gap-1 text-sm">Até<input className={classe} type="month" min={historico[0].mes} max={ultimo.mes} value={ate} onChange={(e) => setAte(e.target.value)} /></label>
    </div>
    {acumulado !== null ? <>
      <p aria-live="polite" className="max-w-prose text-sm leading-relaxed">De {mesPorExtenso(desde)} a {mesPorExtenso(ate)}, o IPCA acumulou <strong>{numero(acumulado)}%</strong>, considerando cada mês do intervalo uma única vez. Esse é o acumulado do intervalo escolhido, não a taxa de cada ponto do gráfico.</p>
      <div style={{ minHeight: 330 }}>
        <GraficoTempo serie={{ id: "ipca", nome: `IPCA: ${MEDIDAS[medida].toLowerCase()}`, unidade: "%", frequencia: "mensal", agregacao: null, datas: recorte.map((r) => r.mes), valores: recorte.map((r) => r[medida]) }} presidentes={[]} formatoValor={percentual} largura={largura || 1000} altura={300} />
      </div>
    </> : <p role="status" className="py-5">Escolha um intervalo válido e sem meses ausentes. O início deve ser anterior ou igual ao fim.</p>}
    <p className="text-sm leading-relaxed text-[var(--tinta-2)]">{medida === "dozeMeses" ? "Cada ponto acumula os 12 meses encerrados na referência. São necessários 12 meses completos de dados." : medida === "ano" ? "Cada ponto acumula de janeiro até a referência e reinicia a contagem a cada ano." : "Cada ponto mostra a variação de preços daquele mês. Valores negativos indicam deflação mensal."} Fonte: IBGE, via Banco Central (SGS 433). Meses sem cobertura aparecem sem valor.</p>
  </div>;
}
