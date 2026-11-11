export const TEMAS_PAINEL = {
  // Desde 11/11/2026 o site abre no Resumo; /resumo continua respondendo, com a canônica em "/".
  resumo: {
    caminho: "/",
    titulo: "Resumo do governo: o Brasil e cada estado num lugar só",
    descricao: "O que é de cada governo, federal ou estadual, numa tela: segurança, educação, orçamento, economia, meio ambiente e política, com o Brasil no mesmo período ao lado.",
  },
  congresso: {
    caminho: "/congresso",
    titulo: "Congresso Nacional: deputados federais e senadores",
    descricao: "Deputados federais e senadores por estado, partido e nome, com o crachá de cada um e quanto gastou da cota parlamentar, mês a mês, nas fontes oficiais.",
  },
  economia: {
    caminho: "/economia",
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
    titulo: "Orçamento público: gastos e transferências",
    descricao: "Explore o orçamento por função e as transferências especiais, com dados do Tesouro Nacional, Siconfi e Transferegov.",
  },
} as const;
export type TemaPainel = keyof typeof TEMAS_PAINEL;
export function temaDoCaminho(caminho: string): TemaPainel {
  // A página de cada parlamentar (/congresso/deputados/nome-id) fica dentro da aba Congresso.
  return caminho === "/" || caminho === "/resumo" ? "resumo" : caminho === "/congresso" || caminho.startsWith("/congresso/") ? "congresso" : caminho === "/meio-ambiente" ? "ambiente" : caminho === "/dinheiro" ? "dinheiro" : "economia";
}
