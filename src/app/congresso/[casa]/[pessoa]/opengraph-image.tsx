import { notFound } from "next/navigation";

import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import { reaisCompactos } from "@/app/_painel/_dados/congressoModelo";
import { CODIGO_UF, acharParlamentar, nomeDaCasa, resumoDaCota, siglaParlamentar } from "@/app/_painel/_dados/paginaParlamentar";

export const alt = "Cota parlamentar e perfil, com os dados oficiais da Câmara e do Senado";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Imagem({ params }: { params: Promise<{ casa: string; pessoa: string }> }) {
  const { casa, pessoa } = await params;
  const achado = acharParlamentar(casa, pessoa);
  if (!achado) notFound();
  const r = resumoDaCota(achado);
  return imagemCompartilhamento({
    titulo: `${achado.pessoa.nome} (${siglaParlamentar(achado.pessoa)})`,
    valor: r ? reaisCompactos(r.total) : undefined,
    referencia: r
      ? `de cota parlamentar em ${r.ano}${r.ate ? `, até ${r.ate}` : ""}${r.comparacao ? ` · ${r.comparacao.texto} dos ${achado.casa}` : ""}`
      : nomeDaCasa(achado.casa),
    fonte: achado.casa === "deputados" ? "Fonte: Câmara dos Deputados (CEAP)" : "Fonte: Senado Federal (CEAPS)",
    uf: CODIGO_UF[achado.pessoa.uf],
  });
}
