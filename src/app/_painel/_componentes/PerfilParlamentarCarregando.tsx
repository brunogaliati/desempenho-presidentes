import type { CSSProperties } from "react";
import { EsqueletoDetalhe } from "./GraficosCota";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";

/** Reserva a mesma identidade, fita e grade do perfil, sem a maquete do plenário. */
export function PerfilParlamentarCarregando() {
  const osso = (largura: string, altura = 12) => <span className={estilos.osso} style={{ width: largura, maxWidth: "100%", height: altura }} />;
  return <section className={t.pagina} data-skeleton="parlamentar" aria-busy="true" aria-label="Carregando perfil parlamentar">
    <p className="sr-only" role="status">Carregando perfil parlamentar com os dados oficiais…</p>
    <div aria-hidden="true" style={{ paddingBlock: 8 }}>{osso("240px", 16)}</div>
    <div className={`vidro ${t.cabeca}`} data-lustro="fixo" aria-hidden="true">
      <div className={t.identidade}>
        <div className={estilos.osso} style={{ width: 84, height: 112 }} />
        <div className={t.quem}>{osso("180px", 10)}{osso("280px", 32)}{osso("160px", 18)}{osso("70%", 14)}{osso("220px", 24)}</div>
        <div className={t.periodo}>{osso("140px", 10)}{osso("300px", 36)}</div>
      </div>
      <div className={t.fita}>{[2, 3, 1].map((n, i) => <div className={t.grupo} key={i}>
        {osso("130px", 10)}
        <div className={t.celulas} style={{ "--n": n } as CSSProperties}>{Array.from({ length: n }, (_, j) => <div key={j} className={t.celula}>
          {osso("80%", 12)}<div style={{ marginBlock: 8 }}>{osso("80%", 28)}</div>{osso("90%", 12)}
        </div>)}</div>
      </div>)}</div>
    </div>
    <div className={t.grade} aria-hidden="true">
      {[t.aMes, t.aAno, t.aCat, t.aFor, t.aPle, t.aVot, t.aUf, t.aPar, t.aMun, t.aFon, t.aEme].map((area, i) => <div key={i} className={`vidro rounded-[1.6rem] p-4 ${t.painel} ${area}`} data-lustro="fixo">
        {osso("160px", 18)}<div className="mt-3"><EsqueletoDetalhe /></div>
      </div>)}
    </div>
  </section>;
}
