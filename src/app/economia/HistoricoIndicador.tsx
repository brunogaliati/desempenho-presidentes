"use client";

import { useState } from "react";
import { GraficoTempo } from "@/components/GraficoTempo";
import { comSinal, numero, reais } from "@/lib/formatar";
import { useLargura } from "@/lib/useLargura";
import { compararPontosPublicos, rotuloPeriodoPublico, ultimaReferenciaPublica, type SeriePublica } from "@/app/prototipo/_dados/economiaModelo";

export function HistoricoIndicador({ series, principal, trimestral, moeda }: { series: SeriePublica[]; principal: string; trimestral: boolean; moeda: boolean }) {
  const [codigo, setCodigo] = useState(principal);
  const serie = series.find((s) => s.codigo === codigo)!;
  const ultima = ultimaReferenciaPublica(serie.pontos)!;
  const padrao = (s: SeriePublica) => s.pontos.find((p) => p.mes >= `${Number(ultimaReferenciaPublica(s.pontos)!.mes.slice(0,4)) - 10}-01`)!.mes;
  const [desde, setDesde] = useState(padrao(serie));
  const [ate, setAte] = useState(ultima.mes);
  const { ref, largura } = useLargura<HTMLDivElement>();
  const comparacao = compararPontosPublicos(serie.pontos, desde, ate, !moeda);
  const recorte = serie.pontos.filter((p) => p.mes >= desde && p.mes <= ate);
  const formato = (v: number) => moeda ? `${reais(v)}/litro` : `${numero(v,1)}%`;
  const classe = "rounded-md border border-[var(--borda)] px-3 py-2 text-base";
  const data = (mes: string) => rotuloPeriodoPublico(mes,trimestral);
  return <div ref={ref}>
    <div className="my-5 flex flex-wrap items-end gap-4">
      {series.length > 1 && <label className="grid gap-1 text-sm">Território<select className={classe} value={codigo} onChange={(e) => {
        const proxima = series.find((s) => s.codigo === e.target.value)!;
        setCodigo(proxima.codigo); setDesde(padrao(proxima)); setAte(ultimaReferenciaPublica(proxima.pontos)!.mes);
      }}>{series.map((s) => <option key={s.codigo} value={s.codigo}>{s.nome}</option>)}</select></label>}
      {([['De',desde,setDesde],['Até',ate,setAte]] as const).map(([nome,valor,mudar]) => <label className="grid gap-1 text-sm" key={nome}>{nome}
        {trimestral ? <select className={classe} value={valor} onChange={(e) => mudar(e.target.value)}>{serie.pontos.map((p) => <option key={p.mes} value={p.mes}>{data(p.mes)}</option>)}</select>
          : <input className={classe} type="month" min={serie.pontos[0].mes} max={ultima.mes} value={valor} onChange={(e) => mudar(e.target.value)} />}
      </label>)}
    </div>
    {comparacao !== null ? <>
      <p aria-live="polite" className="max-w-prose text-sm leading-relaxed"><strong>{serie.nome}</strong>: de {data(desde)} a {data(ate)}, a mudança foi de <strong>{comSinal(comparacao,moeda ? 2 : 1)}{moeda ? "%" : " pontos percentuais"}</strong>. {moeda ? "Comparação dos preços nominais nas duas datas, sem descontar a inflação." : "Diferença entre as taxas nas duas referências, sem atribuição de causa."}</p>
      <div style={{minHeight:330}}><GraficoTempo serie={{id:"indicador-publico",nome:`${moeda ? "Gasolina comum" : "Taxa de desocupação"} · ${serie.nome}`,unidade:moeda ? "R$/litro" : "%",frequencia:trimestral ? "trimestral" : "mensal",agregacao:null,datas:recorte.map((p) => p.mes),valores:recorte.map((p) => p.valor)}} presidentes={[]} formatoValor={formato} rotuloData={data} largura={largura || 1000} altura={300} /></div>
    </> : <p role="status" className="py-5">Escolha duas referências com dados, com o início anterior ou igual ao fim.</p>}
    <p className="text-sm leading-relaxed text-[var(--tinta-2)]">{trimestral ? "Trimestres civis encerrados. O Brasil e os estados usam o mesmo período e a mesma pesquisa." : moeda ? "Preço médio mensal de revenda da gasolina comum. Não é cotação de hoje nem o preço de um posto específico." : "Cada mês indica o trimestre móvel encerrado naquela referência; não é uma taxa isolada do mês."} As lacunas interrompem a linha.</p>
  </div>;
}
