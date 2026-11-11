"use client";

import { useEffect, useRef } from "react";
import { posicoesHemiciclo } from "../_dados/hemicicloModelo";
import estilos from "./AbaCongresso.module.css";

/** A mesma reserva de espaço do Congresso; anima só enquanto a espera está visível. */
export function CongressoCarregando() {
  const raiz = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let visivel = false;
    const atualizar = () => { el.dataset.animando = String(visivel && !document.hidden); };
    const observador = new IntersectionObserver(([entrada]) => { visivel = entrada.isIntersecting; atualizar(); });
    observador.observe(el);
    document.addEventListener("visibilitychange", atualizar);
    return () => { observador.disconnect(); document.removeEventListener("visibilitychange", atualizar); };
  }, []);
  // Mesmo desenho da página pronta: frase do recorte ao lado da maquete, seletor de vista sobre ela,
  // legenda com cabeçalho; no bloco, resultado, o seletor de medida e o cabeçalho das colunas da lista.
  return <section ref={raiz} className={`${estilos.sala} ${estilos.esqueleto}`} data-skeleton="congresso" aria-busy="true" aria-label="Carregando Congresso">
    <p role="status" className="sr-only">Carregando Congresso com os dados oficiais…</p>
    <div className={estilos.cabecalho} aria-hidden="true">
      <div className={estilos.tituloCasa}><div className={`${estilos.osso} ${estilos.ossoTitulo}`} /><div className={`${estilos.osso} ${estilos.ossoCasas}`} /></div>
      <div className={estilos.acoes}><span className={`${estilos.osso} ${estilos.ossoAcao}`} /></div>
    </div>
    <div className={estilos.composicao} aria-hidden="true">
      <div className={estilos.recorte}><div className={estilos.total}><span className={`${estilos.osso} ${estilos.ossoNumero}`} /><span className={`${estilos.osso} ${estilos.ossoPilula}`} /></div></div>
      <div className={estilos.figura}>
        <div className={estilos.palcoEsqueleto}>
          <svg className={estilos.esqueletoAssentos} viewBox="0 0 1000 540">{posicoesHemiciclo(160).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.raio} />)}</svg>
          <span className={`${estilos.osso} ${estilos.ossoVistas}`} />
        </div>
        <div className={estilos.leitura}><span className={`${estilos.osso} ${estilos.ossoLinhaCentro}`} style={{ width: "min(52%, 520px)" }} /></div>
        <div className={estilos.referencia}><span className={`${estilos.osso} ${estilos.ossoLinhaCentro}`} style={{ width: "min(70%, 480px)" }} /></div>
      </div>
      <div className={estilos.lateral}>
        <div className={estilos.legendaCabecalho}><span className={`${estilos.osso} ${estilos.ossoCabecalhoLegenda}`} /></div>
        <div className={estilos.legenda}>{Array.from({ length: 21 }, (_, i) => <div key={i} className={estilos.esqueletoPartido}><span className={estilos.osso} /><span className={estilos.osso} /><span className={estilos.osso} /></div>)}</div>
      </div>
    </div>
    <div className={`${estilos.parlamentares} vidro rounded-[1.6rem] p-4`} aria-hidden="true">
      <div className={estilos.esqueletoTopoLista}>
        <div className={estilos.esqueletoTitulos}><span className={`${estilos.osso} ${estilos.ossoTitulo}`} /><span className={`${estilos.osso} ${estilos.ossoDetalhe}`} /></div>
        <div className={estilos.esqueletoBusca}><span className={`${estilos.osso} ${estilos.ossoBusca}`} /><span className={`${estilos.osso} ${estilos.ossoAcao}`} /></div>
      </div>
      <div className={estilos.esqueletoResultado}><span className={estilos.osso} /><span className={estilos.osso} /></div>
      <div className={estilos.esqueletoDiretorio}>
        <div>
          <span className={`${estilos.osso} ${estilos.ossoMedida}`} />
          <div className={estilos.esqueletoCabeca}><span className={estilos.osso} /><span className={estilos.osso} /></div>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className={estilos.esqueletoLinha}><span className={estilos.osso} /><div><span className={estilos.osso} /><span className={estilos.osso} /></div><div className={estilos.esqueletoValor}><span className={estilos.osso} /><span className={estilos.osso} /></div></div>)}
        </div>
        <div className={estilos.esqueletoPainel}><span className={estilos.osso} style={{ width: "35%" }} /><span className={estilos.osso} style={{ width: "45%", height: 48 }} /><span className={estilos.osso} style={{ width: "80%" }} /><span className={estilos.osso} style={{ height: 180, marginTop: 16 }} /></div>
      </div>
    </div>
  </section>;
}
