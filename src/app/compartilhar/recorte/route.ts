import { cartaoDoPedido, pedidoDaImagem } from "@/app/_painel/_componentes/capaRecorte";
import { carregarPainel } from "@/app/_painel/_dados/carregar";
import { imagemRecorte } from "@/components/ImagemRecorte";
import { imagemEmCache } from "@/lib/imagemEmCache";

const naoHa = () => new Response(null, { status: 404, headers: { "X-Robots-Tag": "noindex" } });

/** O cartão de um recorte do painel. Só aceita ids que existem nos dados: nenhum texto vem do endereço. */
export function GET(request: Request) {
  return imagemEmCache(request, async () => {
    const q = new URL(request.url).searchParams;
    const dia = q.get("d");
    if (dia !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return naoHa();
    const pedido = pedidoDaImagem(q);
    if (!pedido) return naoHa();
    const { painel } = await carregarPainel();
    const cartao = cartaoDoPedido(pedido, painel);
    return cartao ? imagemRecorte(cartao) : naoHa();
  });
}
