export const TEMAS_PAINEL = {
  economia: {
    caminho: "/",
    titulo: "Desempenho do Governo: indicadores do Brasil e dos estados",
    descricao: "Explore os indicadores econômicos, compare mandatos desde o Plano Real e consulte dados oficiais do Brasil e dos estados.",
  },
  ambiente: {
    caminho: "/meio-ambiente",
    titulo: "Meio ambiente: desmatamento, queimadas e fiscalização",
    descricao: "Explore dados do INPE e do Ibama sobre desmatamento, focos de calor e fiscalização ambiental no Brasil e nos estados.",
  },
  dinheiro: {
    caminho: "/dinheiro",
    titulo: "Dinheiro público: orçamento e transferências",
    descricao: "Explore o orçamento por função e as transferências especiais, com dados do Tesouro Nacional, Siconfi e Transferegov.",
  },
} as const;
export type TemaPainel = keyof typeof TEMAS_PAINEL;
export function temaDoCaminho(caminho: string): TemaPainel {
  return caminho === "/meio-ambiente" ? "ambiente" : caminho === "/dinheiro" ? "dinheiro" : "economia";
}
