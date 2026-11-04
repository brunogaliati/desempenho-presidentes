import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { carregarSalarioMinimo } from "@/lib/salarioMinimo";
import { mesPorExtenso, reais } from "@/lib/formatar";
export const alt = "Salário mínimo nacional: valor e histórico do poder de compra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;
export default async function ImagemSalario() {
  const d = await carregarSalarioMinimo();
  return imagemCompartilhamento({titulo:"Salário mínimo nacional",valor:reais(d.ultimo.nominal),referencia:"Referência: "+mesPorExtenso(d.ultimo.mes),fonte:"Histórico, reajustes e poder de compra · Fontes identificadas na página"});
}
