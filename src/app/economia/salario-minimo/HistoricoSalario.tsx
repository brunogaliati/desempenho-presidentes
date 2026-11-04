"use client";
import { SeletorDados } from "@/components/SeletorDados";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import styles from "@/app/economia/indicador.module.css";
import { opcaoCompartilhada } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";


import { GraficoTempo } from "@/components/GraficoTempo";
import { comSinal, mesPorExtenso, reais } from "@/lib/formatar";
import { compararSalario, type MesSalario } from "@/lib/salarioMinimoModelo";
import { useLargura } from "@/lib/useLargura";

export function HistoricoSalario({ historico, referenciaReal }: { historico: MesSalario[]; referenciaReal: string }) {
  const [medida, setMedida] = useEstadoCompartilhavel<"real" | "nominal">("medida", "real", opcaoCompartilhada(["real","nominal"]));
  const [desde, setDesde] = useEstadoCompartilhavel("de", historico[0].mes, v=>historico.some(r=>r.mes===v));
  const [ate, setAte] = useEstadoCompartilhavel("ate", referenciaReal, v=>historico.some(r=>r.mes===v));
  const { ref, largura } = useLargura<HTMLDivElement>();
  const comparacao = compararSalario(historico, desde, ate);
  const recorte = historico.filter((r) => r.mes >= desde && r.mes <= ate);
  return (
    <div ref={ref}>
        <div className={styles.filtros}>
        <SeletorDados rotulo="Mostrar" valor={medida} opcoes={[{valor:'real',rotulo:'Poder de compra (IPCA)'},{valor:'nominal',rotulo:'Valor da época'}]} aoEscolher={v=>setMedida(v as 'real'|'nominal')}/>
        <SeletorPeriodo rotulo="De" valor={desde} referencias={historico.map(r=>r.mes)} aoEscolher={setDesde}/>
        <SeletorPeriodo rotulo="Até" valor={ate} referencias={historico.map(r=>r.mes)} aoEscolher={setAte}/>
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
