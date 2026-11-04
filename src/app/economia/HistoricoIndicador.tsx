"use client";
import { SeletorDados } from "@/components/SeletorDados";
import { SeletorPeriodo } from "@/components/SeletorPeriodo";
import styles from "@/app/economia/indicador.module.css";
import { opcaoCompartilhada } from "@/lib/compartilhamento";
import { useEstadoCompartilhavel } from "@/components/RecortesCompartilhaveis";


import { GraficoTempo } from "@/components/GraficoTempo";
import { comSinal, numero, reais } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";
import { compararPontosPublicos, rotuloPeriodoPublico, ultimaReferenciaPublica, type SeriePublica } from "@/app/_painel/_dados/economiaModelo";

export function HistoricoIndicador({ series, principal, trimestral, moeda }: { series: SeriePublica[]; principal: string; trimestral: boolean; moeda: boolean }) {
  const [codigo, setCodigo] = useEstadoCompartilhavel("territorio", principal, opcaoCompartilhada(series.map(s=>s.codigo)));
  const serie = series.find((s) => s.codigo === codigo)!;
  const ultima = ultimaReferenciaPublica(serie.pontos)!;
  const padrao = (s: SeriePublica) => s.pontos.find((p) => p.mes >= `${Number(ultimaReferenciaPublica(s.pontos)!.mes.slice(0,4)) - 10}-01`)!.mes;
  const [desde, setDesde] = useEstadoCompartilhavel("de", padrao(serie), v=>serie.pontos.some(p=>p.mes===v));
  const [ate, setAte] = useEstadoCompartilhavel("ate", ultima.mes, v=>serie.pontos.some(p=>p.mes===v));
  const { ref, largura } = useLargura<HTMLDivElement>();
  const comparacao = compararPontosPublicos(serie.pontos, desde, ate, !moeda);
  const recorte = serie.pontos.filter((p) => p.mes >= desde && p.mes <= ate);
  const formato = (v: number) => moeda ? `${reais(v)}/litro` : `${numero(v,1)}%`;
  const data = (mes: string) => rotuloPeriodoPublico(mes,trimestral);
  return <div ref={ref}>
    <div className={styles.filtros}>
      {series.length > 1 && <SeletorDados rotulo="Território" valor={codigo} opcoes={series.map(s=>({valor:s.codigo,rotulo:s.nome}))} aoEscolher={codigo=>{const proxima=series.find(s=>s.codigo===codigo)!;setCodigo(codigo);setDesde(padrao(proxima));setAte(ultimaReferenciaPublica(proxima.pontos)!.mes);}}/>}
      {([['De',desde,setDesde],['Até',ate,setAte]] as const).map(([rotulo,valor,mudar])=><SeletorPeriodo key={rotulo} rotulo={rotulo} valor={valor} referencias={serie.pontos.map(p=>p.mes)} precisao={trimestral?'trimestre':'mes'} aoEscolher={mudar}/>)}
    </div>
    {comparacao !== null ? <>
      <p aria-live="polite" className="max-w-prose text-sm leading-relaxed"><strong>{serie.nome}</strong>: de {data(desde)} a {data(ate)}, a mudança foi de <strong>{comSinal(comparacao,moeda ? 2 : 1)}{moeda ? "%" : " pontos percentuais"}</strong>. {moeda ? "Comparação dos preços nominais nas duas datas, sem descontar a inflação." : "Diferença entre as taxas nas duas referências, sem atribuição de causa."}</p>
      <div style={{minHeight:330}}><GraficoTempo serie={{id:"indicador-publico",nome:`${moeda ? "Gasolina comum" : "Taxa de desocupação"} · ${serie.nome}`,unidade:moeda ? "R$/litro" : "%",frequencia:trimestral ? "trimestral" : "mensal",agregacao:null,datas:recorte.map((p) => p.mes),valores:recorte.map((p) => p.valor)}} presidentes={[]} formatoValor={formato} rotuloData={data} largura={largura || 1000} altura={300} /></div>
    </> : <p role="status" className="py-5">Escolha duas referências com dados, com o início anterior ou igual ao fim.</p>}
    <p className="text-sm leading-relaxed text-[var(--tinta-2)]">{trimestral ? "Trimestres civis encerrados. O Brasil e os estados usam o mesmo período e a mesma pesquisa." : moeda ? "Preço médio mensal de revenda da gasolina comum. Não é cotação de hoje nem o preço de um posto específico." : "Cada mês indica o trimestre móvel encerrado naquela referência; não é uma taxa isolada do mês."} As lacunas interrompem a linha.</p>
  </div>;
}
