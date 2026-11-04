import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { carregarDados } from "@/lib/dados";
import { notFound } from "next/navigation";
export const alt = "Indicadores oficiais por mandato presidencial, com o mesmo critério de comparação";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export default async function Imagem({params}:{params:Promise<{pessoa:string}>}) {
  const {pessoa}=await params,dados=await carregarDados(),mandatos=dados.presidentes.filter(p=>p.pessoaId===pessoa);
  if(!mandatos.length)notFound();
  const periodo=mandatos.map(m=>m.inicio.slice(0,4)+"–"+m.fim.slice(0,4)+(m.emCurso?" (em curso)":"")).join(" · ");
  return imagemCompartilhamento({titulo:mandatos[0].nome,valor:mandatos.length+" mandato"+(mandatos.length>1?"s":""),referencia:periodo,fonte:"Fontes: Banco Central, IBGE e World Bank"});
}
