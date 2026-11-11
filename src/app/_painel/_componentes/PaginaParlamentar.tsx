"use client";

import Link from "next/link";

import { Compartilhar } from "@/components/Compartilhar";

import { type CasaCongresso, NOME_UF } from "../_dados/congressoModelo";
import fotografia from "../_dados/fotografia.json";
import type { DadosPainel } from "../_dados/tipos";
import { useCotaDoAno } from "../_dados/useCota";
import type { Parlamentar } from "./DiretorioCongresso";
import { TerminalParlamentar, linkCongresso } from "./TerminalParlamentar";
import estilos from "./Parlamentares.module.css";
import t from "./TerminalParlamentar.module.css";

/**
 * A página de um deputado ou senador: a trilha até a bancada e o terminal da pessoa
 * (`TerminalParlamentar`), com o plenário, as votações, a cota, as emendas e a posição
 * entre os colegas do estado e do partido.
 */
export function PaginaParlamentar({ casa, id, dados, corDe }: {
  casa: CasaCongresso;
  id: number;
  dados: DadosPainel;
  corDe: (partido: string | null) => string;
}) {
  const pessoa: Parlamentar | undefined = fotografia[casa].find(p => p.id === id);
  const { indice, cota, periodo, anos, setPeriodo, erro } = useCotaDoAno(casa);
  if (!pessoa) return <div className={estilos.pagina}>
    <p className={estilos.aviso}>Este parlamentar não está na composição atual do Congresso. <Link href={linkCongresso(casa)} className="underline underline-offset-4">Ver quem está</Link>.</p>
  </div>;

  const uf = dados.ufs.find(u => u.sigla === pessoa.uf);
  const deEstado = uf?.deNome ?? `de ${NOME_UF[pessoa.uf] ?? pessoa.uf}`;
  const rotuloCasa = casa === "deputados" ? "Deputados" : "Senadores";
  const maquete = linkCongresso(casa, [["r.congresso.pessoa", String(pessoa.id)]]);

  return <div className={t.pagina}>
    <nav aria-label="Você está em" className={estilos.trilhaPagina}>
      <ol>
        <li><Link href="/congresso">Congresso</Link></li>
        <li><Link href={linkCongresso(casa, [["uf", pessoa.uf]])}>{rotuloCasa} {deEstado}</Link></li>
        <li aria-current="page">{pessoa.nome}</li>
      </ol>
    </nav>
    <TerminalParlamentar casa={casa} pessoa={pessoa} governos={dados.governos} ufs={dados.ufs} cor={corDe(pessoa.partido)}
      indice={indice} cota={cota} erroCota={erro} periodo={periodo} anos={anos} aoEscolherPeriodo={setPeriodo}
      acoes={<>
        <Link href={maquete}>Ver na maquete</Link>
        <Compartilhar mensagem={`${pessoa.nome}: votações, cota parlamentar e perfil`} compacto />
      </>} />
  </div>;
}
