import { NextResponse } from "next/server";

import { sql } from "@/lib/db";

import { carregarDinheiro, carregarEmendas } from "../../_dados/dinheiro";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") ?? "painel";
  try {
    if (tipo === "painel") return NextResponse.json(await carregarDinheiro());
    const ano = Number(url.searchParams.get("ano"));
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return NextResponse.json({ erro: "Ano inválido" }, { status: 400 });
    if (tipo === "emendas") return NextResponse.json(await carregarEmendas(ano));
    if (tipo === "planos") {
      const uf = (url.searchParams.get("uf") ?? "").toUpperCase().slice(0, 2);
      const cnpj = (url.searchParams.get("cnpj") ?? "").replace(/\D/g, "").slice(0, 14);
      const parlamentar = (url.searchParams.get("parlamentar") ?? "").trim().slice(0, 120);
      const pagina = Math.max(0, Math.min(10000, Math.floor(Number(url.searchParams.get("pagina")) || 0)));
      const rows = await sql`select id_plano_acao::text as id, codigo_plano_acao as codigo,
        nome_beneficiario_plano_acao as beneficiario, uf_beneficiario_plano_acao as uf,
        nome_parlamentar_emenda_plano_acao as parlamentar, situacao_plano_acao as situacao,
        valor_custeio_plano_acao::float8 as custeio, valor_investimento_plano_acao::float8 as investimento
        from mart.transferegov_plano_acao_especial where ano_plano_acao = ${ano}
        and (${uf} = '' or uf_beneficiario_plano_acao = ${uf})
        and (${cnpj} = '' or cnpj_beneficiario_plano_acao = ${cnpj})
        and (${parlamentar} = '' or nome_parlamentar_emenda_plano_acao = ${parlamentar})
        order by coalesce(valor_custeio_plano_acao, 0) + coalesce(valor_investimento_plano_acao, 0) desc, id_plano_acao limit 51 offset ${pagina * 50}`;
      return NextResponse.json(rows);
    }
    if (tipo === "detalhe") {
      const id = url.searchParams.get("id") ?? "";
      if (!/^\d{1,18}$/.test(id)) return NextResponse.json({ erro: "Plano inválido" }, { status: 400 });
      const [planos, empenhos, finalidades, documentos, relatorios] = await Promise.all([
        sql`select codigo_plano_acao, situacao_plano_acao, descricao_programacao_orcamentaria_plano_acao, motivo_impedimento_plano_acao from mart.transferegov_plano_acao_especial where id_plano_acao = ${id}::bigint and ano_plano_acao = ${ano}`,
        sql`select numero_empenho, descricao_situacao_empenho, data_emissao_empenho, valor_empenho::float8 as valor from mart.transferegov_empenho_especial where id_plano_acao = ${id}::bigint order by data_emissao_empenho`,
        sql`select distinct f.area_politica_publica_tipo_pt, f.area_politica_publica_pt from mart.transferegov_finalidade_especial f where exists (select 1 from mart.transferegov_executor_especial e where e.id_executor = f.id_executor and e.id_plano_acao = ${id}::bigint)`,
        sql`select d.numero_documento_habil, d.descricao_situacao_dh, d.data_emissao_dh, d.valor_dh::float8 as valor from mart.transferegov_documento_habil_especial d where exists (select 1 from mart.transferegov_empenho_especial e where e.id_empenho=d.id_empenho and e.id_plano_acao=${id}::bigint) order by d.data_emissao_dh`,
        sql`select situacao_relatorio_gestao_novo as situacao, data_e_hora_relatorio_gestao_novo as data, valor_executado_relatorio_gestao_novo::float8 as executado, valor_pendente_relatorio_gestao_novo::float8 as pendente from mart.transferegov_relatorio_gestao_novo_especial where id_plano_acao=${id}::bigint order by data_e_hora_relatorio_gestao_novo desc`,
      ]);
      return NextResponse.json({ planos, empenhos, finalidades, documentos, relatorios });
    }
    return NextResponse.json({ erro: "Consulta inválida" }, { status: 400 });
  } catch (error) {
    console.error("Dinheiro público indisponível", error);
    return NextResponse.json({ erro: "Dados indisponíveis no momento" }, { status: 503 });
  }
}
