"use client";
import { SeletorDados } from "@/components/SeletorDados";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import styles from "@/app/economia/indicador.module.css";
import { opcaoCompartilhada } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";


import { GraficoTempo } from "@/components/GraficoTempo";
import { mesPorExtenso, numero } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";
import { acumuladoPeriodo, type MesInflacao } from "@/app/_painel/_dados/economiaModelo";

const MEDIDAS = { dozeMeses: "Acumulado em 12 meses", mensal: "Variação mensal", ano: "Acumulado no ano" };
const percentual = (v: number) => `${numero(v)}%`;

export function HistoricoInflacao({ historico }: { historico: MesInflacao[] }) {
  const ultimo = historico.at(-1)!;
  const inicioPadrao = `${Number(ultimo.mes.slice(0, 4)) - 10}-01`;
  const [desde, setDesde] = useEstadoCompartilhavel("de", historico.find((r) => r.mes >= inicioPadrao)?.mes ?? historico[0].mes, v=>historico.some(r=>r.mes===v));
  const [ate, setAte] = useEstadoCompartilhavel("ate", ultimo.mes, v=>historico.some(r=>r.mes===v));
  const [medida, setMedida] = useEstadoCompartilhavel<keyof typeof MEDIDAS>("medida", "dozeMeses", opcaoCompartilhada(Object.keys(MEDIDAS)));
  const { ref, largura } = useLargura<HTMLDivElement>();
  const acumulado = acumuladoPeriodo({ datas: historico.map((r) => r.mes), valores: historico.map((r) => r.mensal) }, desde, ate);
  const recorte = historico.filter((r) => r.mes >= desde && r.mes <= ate);
  return <div ref={ref}>
    <div className={styles.filtros}>
      <SeletorDados rotulo="Mostrar" valor={medida} opcoes={Object.entries(MEDIDAS).map(([valor,rotulo])=>({valor,rotulo}))} aoEscolher={v=>setMedida(v as keyof typeof MEDIDAS)}/>
      <SeletorPeriodo rotulo="De" valor={desde} referencias={historico.map(r=>r.mes)} aoEscolher={setDesde}/>
      <SeletorPeriodo rotulo="Até" valor={ate} referencias={historico.map(r=>r.mes)} aoEscolher={setAte}/>
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
