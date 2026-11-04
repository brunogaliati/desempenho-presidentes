import silhuetas from "../_dados/biomas-silhuetas.json";

export type TemaPainel = "economia" | "ambiente" | "dinheiro";
const nomes = { economia: "Economia", ambiente: "Meio ambiente", dinheiro: "Dinheiro público" };

/** As mesmas proporções da hero, sem apresentar números antes das fontes. */
export default function CarregandoPainel({ aba="economia", embutido=false }: { aba?:TemaPainel; embutido?:boolean }) {
  const conteudo = <section className="esqueleto-painel" data-skeleton={aba} aria-busy="true" aria-label={`Carregando ${nomes[aba]}`}>
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
