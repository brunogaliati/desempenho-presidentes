import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { carregarInflacao } from "@/lib/inflacao";
import { mesPorExtenso, numero } from "@/lib/formatar";
export const alt = "IPCA: inflação acumulada em 12 meses e referência dos dados";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;
export default async function ImagemInflacao() {
  const d = await carregarInflacao();
  return imagemCompartilhamento({titulo:"Inflação (IPCA) em 12 meses",valor:d.ultimo.dozeMeses===null?"Indisponível":numero(d.ultimo.dozeMeses)+"%",referencia:"Referência: "+mesPorExtenso(d.ultimo.mes),fonte:"Fonte: IBGE, via Banco Central"});
}
