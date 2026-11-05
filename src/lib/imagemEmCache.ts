import { getCloudflareContext } from "@opennextjs/cloudflare";

const UM_DIA = 60 * 60 * 24;

/**
 * Gerar um cartão leva de 2 a 4 s por pedido (medido em produção em 04/11/2026) e a resposta
 * de um Worker não passa pelo cache do CDN: cada pedido gerava de novo, e o robô do aplicativo
 * que monta a prévia do link é quem espera. A chave é a URL inteira, com o `?v=` de `seo.ts`.
 * Fora do Worker não existe `caches.default`, e a imagem só é gerada.
 */
export async function imagemEmCache(request: Request, gerar: () => Response | Promise<Response>): Promise<Response> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache) return gerar();
  const chave = new Request(request.url);
  const guardada = await cache.match(chave);
  if (guardada) return guardada;
  const resposta = await gerar();
  if (!resposta.ok) return resposta;
  // O gerador manda guardar por um ano, sem revalidar: quem pega o primeiro pedido ouve o mesmo que os outros.
  const pronta = new Response(resposta.body, resposta);
  pronta.headers.set("Cache-Control", `public, max-age=${UM_DIA}`);
  getCloudflareContext().ctx.waitUntil(cache.put(chave, pronta.clone()));
  return pronta;
}
