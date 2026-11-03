"use client";

import { useState } from "react";
import { GraficoTempo } from "@/components/GraficoTempo";
import { comSinal, mesPorExtenso, reais } from "@/lib/formatar";
import { compararSalario, type MesSalario } from "@/lib/salarioMinimoModelo";
import { useLargura } from "@/lib/useLargura";

export function HistoricoSalario({ historico, referenciaReal }: { historico: MesSalario[]; referenciaReal: string }) {
  const [medida, setMedida] = useState<"real" | "nominal">("real");
  const [desde, setDesde] = useState(historico[0].mes);
  const [ate, setAte] = useState(referenciaReal);
  const { ref, largura } = useLargura<HTMLDivElement>();
  const comparacao = compararSalario(historico, desde, ate);
  const recorte = historico.filter((r) => r.mes >= desde && r.mes <= ate);
  const classe = "rounded-md border border-[var(--borda)] bg-[var(--superficie)] px-3 py-2 text-base";
  return (
    <div ref={ref}>
      <div className="my-5 flex flex-wrap items-end gap-4">
        <label className="grid gap-1 text-sm">Mostrar
          <select className={classe} value={medida} onChange={(e) => setMedida(e.target.value as "real" | "nominal")}>
            <option value="real">Poder de compra (IPCA)</option><option value="nominal">Valor da época</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">De
          <input className={classe} type="month" min={historico[0].mes} max={historico.at(-1)!.mes} value={desde} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">Até
          <input className={classe} type="month" min={historico[0].mes} max={historico.at(-1)!.mes} value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
      </div>
      {comparacao ? <>
        <p aria-live="polite" className="max-w-prose text-sm leading-relaxed">
          De {mesPorExtenso(desde)} a {mesPorExtenso(ate)}, o valor nominal mudou {comSinal(comparacao.nominal)}%.
          {comparacao.real !== null ? ` Descontada a inflação, a mudança foi de ${comSinal(comparacao.real)}%.` : " O poder de compra ainda não está disponível para uma das datas escolhidas."}
        </p>
        <GraficoTempo serie={{ id: "salario_minimo", nome: medida === "real" ? "Poder de compra do salário mínimo" : "Salário mínimo nominal", unidade: "R$", frequencia: "mensal", agregacao: null, datas: recorte.map((r) => r.mes), valores: recorte.map((r) => r[medida]) }} presidentes={[]} formatoValor={reais} largura={largura || 1000} altura={300} />
      </> : <p role="status">Escolha dois meses disponíveis, com o início anterior ou igual ao fim.</p>}
      <p className="text-sm leading-relaxed text-[var(--tinta-2)]">{medida === "real" ? `Valores corrigidos pelo IPCA, em reais de ${mesPorExtenso(referenciaReal)}. Meses sem IPCA ficam sem valor real.` : "Valores nominais: o número de reais de cada época, sem descontar a inflação."} Fonte: Banco Central (SGS 1619 e 433); cálculo do observatório.</p>
    </div>
  );
}
