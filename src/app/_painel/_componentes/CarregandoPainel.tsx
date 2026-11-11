import silhuetas from "../_dados/biomas-silhuetas.json";
import { CongressoCarregando } from "./CongressoCarregando";

export type TemaPainel = "resumo" | "economia" | "ambiente" | "dinheiro" | "congresso";
const nomes = { resumo: "Resumo do governo", economia: "Economia", ambiente: "Meio ambiente", dinheiro: "Orçamento público", congresso: "Congresso" };

/** O resumo não tem mapa: um cabeçalho de vidro e duas colunas de linhas. */
function ResumoCarregando() {
  const vidro = { borderRadius: "1.6rem", padding: "1.1rem", display: "flex", flexDirection: "column" as const, gap: "0.75rem" };
  return <section className="esqueleto-painel" data-skeleton="resumo" aria-busy="true" aria-label="Carregando o resumo do governo" style={{ maxWidth: "72rem", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem", padding: "0.25rem" }}>
    <p role="status" className="sr-only">Carregando o resumo do governo com os dados oficiais…</p>
    <div className="vidro" data-lustro="fixo" aria-hidden="true" style={vidro}><div className="esqueleto-linha esqueleto-titulo"/><div className="esqueleto-linha"/><div className="esqueleto-linha esqueleto-curta"/></div>
    <div aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))", gap: "0.9rem" }}>
      {[0, 1].map((i) => <div key={i} className="vidro" data-lustro="fixo" style={vidro}><div className="esqueleto-linha esqueleto-titulo"/>{Array.from({ length: 5 }, (_, k) => <div key={k} className="esqueleto-linha"/>)}</div>)}
    </div>
  </section>;
}

/** As mesmas proporções da hero, sem apresentar números antes das fontes. */
export default function CarregandoPainel({ aba="economia", embutido=false }: { aba?:TemaPainel; embutido?:boolean }) {
  const conteudo = aba === "congresso" ? <CongressoCarregando /> : aba === "resumo" ? <ResumoCarregando /> : <section className="esqueleto-painel" data-skeleton={aba} aria-busy="true" aria-label={`Carregando ${nomes[aba]}`}>
    <p role="status" className="sr-only">Carregando {nomes[aba]} com os dados oficiais…</p>
    <div className="esqueleto-sala" aria-hidden="true">
      {aba==='dinheiro'&&<div className="esqueleto-linha esqueleto-titulo-dinheiro"/>}
      <div className="esqueleto-resumo">
        <div className="esqueleto-linha esqueleto-titulo"/>
        <div className="esqueleto-linha"/>
        <div className="esqueleto-linha esqueleto-numero"/>
        <div className="esqueleto-linha"/>
        <div className="esqueleto-linha esqueleto-curta"/>
        <div className="esqueleto-lista">{Array.from({length:aba==='ambiente'?5:4},(_,i)=><div key={i} className="esqueleto-linha"/>)}</div>
      </div>
      {aba==='dinheiro'?<div className="esqueleto-treemap">{[32,18,12,10,8,7,6,7].map((peso,i)=><div key={i} style={{flexGrow:peso,flexBasis:`${peso>20?45:peso>10?25:15}%`}}/>)}</div>:<div className="esqueleto-mapa"><svg viewBox={silhuetas.viewBox}><path d={silhuetas.brasil} fillRule="evenodd"/></svg></div>}
      <div className="esqueleto-barra vidro" data-lustro="fixo">
        {aba==='ambiente'&&<div className="esqueleto-biomas">{Array.from({length:7},(_,i)=><i key={i}/>)}</div>}
        <div className="esqueleto-linha esqueleto-titulo"/>
        <div className="esqueleto-lista">{Array.from({length:aba==='dinheiro'?6:9},(_,i)=><div key={i} className="esqueleto-linha"/>)}</div>
      </div>
    </div>
  </section>;
  if(embutido)return conteudo;
  return <div className="painel-governo min-h-dvh px-3" data-aba={aba} data-visual="governo-v1" data-carregando-completo="true">
    <div aria-hidden="true" className="fundo-painel"/>
    <div className="painel-cabecalho" aria-hidden="true"><div className="cabecalho-painel esqueleto-cabecalho"><div className="esqueleto-linha esqueleto-titulo"/><div className="esqueleto-linha"/><div className="esqueleto-linha esqueleto-temas"/><div className="esqueleto-linha esqueleto-mandato"/></div></div>
    <main>{conteudo}</main>
  </div>;
}
