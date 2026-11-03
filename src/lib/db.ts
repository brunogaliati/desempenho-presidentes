import { neon } from "@neondatabase/serverless";

/**
 * Client do Neon sobre HTTP.
 *
 * Driver HTTP em vez de pool TCP porque cada Server Component do Next.js roda
 * como função serverless de vida curta — abrir e fechar conexão TCP a cada
 * cold start custaria mais que a query. O driver HTTP é sem estado: uma
 * requisição por query.
 *
 * Na prática as páginas são geradas estaticamente com ISR, então isto é
 * chamado no build e nas revalidações, não a cada visita.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL não definida. Copie .env.example para .env.local e cole a " +
      "connection string do Neon (Dashboard → Connect → Pooled connection).",
  );
}

export const sql = neon(url);
