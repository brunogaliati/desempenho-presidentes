import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
export const alt = "Desempenho do Governo: indicadores oficiais do Brasil, estados e municípios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export default function Imagem() {
  return imagemCompartilhamento({ titulo: "O Brasil em dados,\ngoverno a governo.", descricao: "Indicadores oficiais, séries históricas e comparações entre mandatos e territórios." });
}
