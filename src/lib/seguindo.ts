import "server-only";

import type { CasaCongresso } from "@/app/_painel/_dados/congressoModelo";
import { sql } from "@/lib/db";
import { LIMITE_SEGUIDOS, naComposicao, type ChaveSeguido } from "@/lib/seguindoChave";

/**
 * Quem cada conta segue no Congresso, na tabela `conta.seguindo`
 * (`backend/sql/091_conta_seguindo.sql`). O id da conta é o do Neon Auth.
 */
export type Seguido = ChaveSeguido & { desde: string };

/** Na ordem em que a pessoa seguiu. Quem saiu da casa some da lista (sem dados novos para mostrar). */
export async function listarSeguidos(usuarioId: string): Promise<Seguido[]> {
  const linhas = await sql`select casa, parlamentar_id, to_char(criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as desde
    from conta.seguindo where usuario_id = ${usuarioId} order by criado_em, parlamentar_id`;
  return linhas
    .map(l => ({ casa: l.casa as CasaCongresso, id: Number(l.parlamentar_id), desde: String(l.desde) }))
    .filter(naComposicao);
}

/** Segue (sem erro se já seguia). `false` quando a conta chegou ao limite. */
export async function seguirParlamentar(usuarioId: string, { casa, id }: ChaveSeguido): Promise<boolean> {
  const [linha] = await sql`with novo as (
      insert into conta.seguindo (usuario_id, casa, parlamentar_id)
      select ${usuarioId}, ${casa}, ${id}
      where (select count(*) from conta.seguindo where usuario_id = ${usuarioId}) < ${LIMITE_SEGUIDOS}
      on conflict do nothing
      returning 1
    )
    select exists(select 1 from novo)
      or exists(select 1 from conta.seguindo where usuario_id = ${usuarioId} and casa = ${casa} and parlamentar_id = ${id}) as ok`;
  return Boolean(linha?.ok);
}

export async function deixarDeSeguir(usuarioId: string, { casa, id }: ChaveSeguido): Promise<void> {
  await sql`delete from conta.seguindo where usuario_id = ${usuarioId} and casa = ${casa} and parlamentar_id = ${id}`;
}
