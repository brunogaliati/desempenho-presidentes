import "server-only";
import { unstable_cache } from "next/cache";
import { normalizarRGF, pontosDaDivida, quadrimestreAntes, type DadosFiscais, type LinhaRGF, type PeriodoFiscal, type PontoSerieFiscal } from "./resumoComplementos";

async function lerAnexo(codigo: number, p: PeriodoFiscal, anexo: "01" | "02"): Promise<LinhaRGF[]> {
  const q = new URLSearchParams({ an_exercicio: String(p.ano), in_periodicidade: "Q", nr_periodo: String(p.quadrimestre),
    co_tipo_demonstrativo: "RGF", co_poder: "E", id_ente: String(codigo), no_anexo: `RGF-Anexo ${anexo}` });
  const linhas: LinhaRGF[] = [];
  // A API é paginada. Não publicar uma resposta truncada como se estivesse completa.
  for (let pagina = 0; pagina < 20; pagina++) {
    q.set("offset", String(linhas.length));
    const r = await fetch(`https://apidatalake.tesouro.gov.br/ords/cdwhprd/siconfi/tt/rgf?${q}`, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    if (!r.ok) throw new Error(`Siconfi RGF: HTTP ${r.status}`);
    const d = await r.json();
    if (!Array.isArray(d.items) || typeof d.hasMore !== "boolean" || d.offset !== linhas.length || d.count !== d.items.length) throw new Error("Siconfi RGF: paginação inválida");
    linhas.push(...d.items);
    if (!d.hasMore) return linhas;
    if (!d.items.length) break;
  }
  throw new Error("Siconfi RGF: paginação incompleta");
}

async function lerPeriodo(codigo: number, p: PeriodoFiscal) {
  if (p.ano < 2015) return null; // A API do Siconfi começa em 2015.
  const respostas = await Promise.allSettled((["01", "02"] as const).map((anexo) => lerAnexo(codigo, p, anexo)));
  if (respostas.every((r) => r.status === "rejected")) throw new Error("Siconfi RGF indisponível");
  const linhas = respostas.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  return linhas.length ? normalizarRGF(linhas, codigo, p) : null;
}

async function lerFiscal(codigo: number, posse: string, fim: string): Promise<DadosFiscais> {
  const agora = new Date().toISOString();
  const limite = fim < agora.slice(0, 7) ? fim : agora.slice(0, 7);
  const [recebido, atual] = await Promise.all([
    lerPeriodo(codigo, quadrimestreAntes(posse)),
    (async () => {
      let p = quadrimestreAntes(limite);
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        const mes = `${p.ano}-${String(p.quadrimestre * 4).padStart(2, "0")}`;
        if (mes < posse) return null;
        const dado = await lerPeriodo(codigo, p);
        if (dado && (dado.divida !== null || dado.pessoal !== null)) return dado;
        p = quadrimestreAntes(mes);
      }
      return null;
    })(),
  ]);
  return { recebido, atual, consultadoEm: agora };
}

export const carregarFiscalResumo = unstable_cache(lerFiscal, ["resumo-rgf-v1"], { revalidate: 3600 * 6, tags:["painel-resumo"] });

/**
 * A série para o gráfico: um relatório por ano (o último quadrimestre publicado). O Anexo 02
 * traz a dívida dos quadrimestres anteriores do mesmo ano e o saldo do fim do ano anterior,
 * então um pedido por ano dá três pontos; a despesa com pessoal (12 meses) fica anual, mais
 * o último quadrimestre. São uns 25 pedidos por estado, guardados por um dia.
 */
async function lerSerieFiscal(codigo: number): Promise<PontoSerieFiscal[]> {
  const ultimo = quadrimestreAntes(new Date().toISOString().slice(0, 7));
  const anos = Array.from({ length: ultimo.ano - 2015 + 1 }, (_, i) => 2015 + i);
  const pontos = new Map<string, PontoSerieFiscal>();
  const ponto = (mes: string) => {
    const achado = pontos.get(mes);
    if (achado) return achado;
    const novo: PontoSerieFiscal = { mes, divida: null, pessoal: null };
    pontos.set(mes, novo);
    return novo;
  };
  const porAno = async (ano: number) => {
    // No ano corrente o relatório mais novo pode ainda não ter saído: tenta o quadrimestre anterior.
    for (let q = ano < ultimo.ano ? 3 : ultimo.quadrimestre; q >= 1; q--) {
      const p = { ano, quadrimestre: q };
      const [a1, a2] = await Promise.allSettled([lerAnexo(codigo, p, "01"), lerAnexo(codigo, p, "02")]);
      if (a1.status === "rejected" && a2.status === "rejected") throw a1.reason;
      const l1 = a1.status === "fulfilled" ? a1.value : [];
      const l2 = a2.status === "fulfilled" ? a2.value : [];
      if (!l1.length && !l2.length) continue;
      const pessoal = normalizarRGF(l1, codigo, p).pessoal;
      if (pessoal !== null) ponto(`${ano}-${String(q * 4).padStart(2, "0")}`).pessoal = pessoal;
      // O saldo do ano anterior só entra no primeiro ano; nos outros, vale o relatório do próprio ano.
      for (const [mes, v] of pontosDaDivida(l2, codigo, p)) if (ano === anos[0] || mes.startsWith(String(ano))) ponto(mes).divida = v;
      return;
    }
  };
  // Poucos de cada vez, para não martelar a API do Tesouro.
  for (let i = 0; i < anos.length; i += 4) await Promise.all(anos.slice(i, i + 4).map(porAno));
  return [...pontos.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export const carregarSerieFiscal = unstable_cache(lerSerieFiscal, ["resumo-rgf-serie-v1"], { revalidate: 3600 * 24 });
