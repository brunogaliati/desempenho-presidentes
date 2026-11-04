import { NextResponse } from "next/server";

import { sql } from "@/lib/db";

import queimadas from "@/app/_painel/_dados/queimadas.json";
import type { Municipio } from "@/app/_painel/_dados/tipos";

/**
 * Municípios de uma UF: nome e população do Neon, focos do INPE.
 *
 * O contorno vem de um arquivo estático (`public/painel/municipios/`); aqui
 * só os números, para o painel não carregar 5.570 municípios na abertura.
 */

export async function GET(_: Request, { params }: { params: Promise<{ uf: string }> }) {

  const { uf } = await params;
  if (!/^[0-9]{2}$/.test(uf)) return new NextResponse(null, { status: 400 });

  const linhas = (await sql`
    select m.codigo_ibge, m.nome, p.populacao
      from mart.municipio m
      left join observatorio.populacao_estimada p
        on p.nivel = 'N6'
       and p.codigo_ibge = m.codigo_ibge
       and p.ano = (select max(ano) from observatorio.populacao_estimada where nivel = 'N6')
     where m.codigo_uf = ${uf}
     order by m.nome
  `) as Record<string, unknown>[];

  const focos = queimadas.municipioAnual as Record<string, number[]>;
  const zeros = queimadas.anos.map(() => 0);

  const municipios: Municipio[] = linhas.map((r) => ({
    codigo: String(r.codigo_ibge),
    nome: String(r.nome),
    populacao: r.populacao === null ? null : Number(r.populacao),
    // Município sem foco no arquivo do INPE teve zero focos detectados pelo
    // satélite de referência; a ausência aqui é contagem, não falta de dado.
    focos: focos[String(r.codigo_ibge)] ?? zeros,
  }));

  return NextResponse.json({ municipios });
}
