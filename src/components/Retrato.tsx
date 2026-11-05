import Image from "next/image";

import type { Presidente } from "@/types/dados";

/**
 * Foto do presidente, redonda.
 *
 * O rosto é o canal de identidade do site. Nove cores categóricas não
 * passariam na checagem de daltonismo, e pintar cada mandato com a cor do
 * partido seria carga política disfarçada de design. A foto identifica na hora,
 * é neutra, e funciona para quem não vai parar para ler o rótulo.
 *
 * O nome sempre acompanha a imagem em algum lugar próximo — foto sozinha não é
 * acessível.
 */

const TAMANHOS = {
  pp: 24,
  p: 32,
  m: 44,
  g: 64,
  gg: 96,
} as const;

/**
 * As fotos são servidas de `public/presidentes/`, não do Wikimedia.
 *
 * Hotlinkar dava HTTP 429 já em desenvolvimento — o Wikimedia limita quem
 * busca várias imagens de uma vez — e em pico eleitoral resultaria em bloqueio,
 * além de ser abusivo com um serviço mantido por doação. Arquivo local também
 * remove uma dependência externa de uma página que precisa aguentar tráfego.
 *
 * O banco guarda a URL original do Wikimedia como registro de procedência; aqui
 * fica só a decisão de exibição. Datas, autores e licenças estão em
 * `public/presidentes/fontes.json`, com atribuição na página de metodologia.
 */
/**
 * Foto por MANDATO, não por pessoa.
 *
 * Cada mandato usa uma imagem da época. Para FHC 1, um registro de 1997;
 * para Dilma 2015, um registro da Agência Brasil em maio daquele ano. Os
 * demais usam os respectivos retratos oficiais, sem trocar as feições por IA.
 */
const ARQUIVO_LOCAL: Record<string, string> = {
  fhc_1: "fhc-1997",
  fhc_2: "fhc",
  lula_1: "lula-2003",
  lula_2: "lula-2007",
  lula_3: "lula",
  dilma_1: "dilma",
  dilma_2: "dilma-2015",
  temer: "temer",
  bolsonaro: "bolsonaro",
};

export function caminhoFoto(id: string): string | null {
  const arquivo = ARQUIVO_LOCAL[id];
  return arquivo ? `/presidentes/${arquivo}.jpg` : null;
}

interface Props {
  presidente: Pick<Presidente, "id" | "nome" | "nomeCurto">;
  tamanho?: keyof typeof TAMANHOS;
  /**
   * Número do mandato, marcado sobre o retrato.
   *
   * Passe quando a mesma pessoa aparecer mais de uma vez na mesma tela.
   */
  numeroMandato?: number | null;
  /** Recua a foto quando o mandato não está em foco. */
  apagado?: boolean;
  /**
   * Anel da cor do fundo em volta do retrato.
   *
   * Para réguas onde dois rostos podem encostar: sem o anel, dois círculos
   * vizinhos viram uma mancha só.
   */
  anel?: boolean;
  /**
   * Carrega junto com a página em vez de esperar o scroll.
   *
   * Só para os retratos acima da dobra — os do gráfico de abertura. O padrão
   * do Next é `loading="lazy"`, o que atrasava justamente a primeira coisa que
   * o leitor vê.
   */
  prioridade?: boolean;
  className?: string;
}

export function Retrato({
  presidente,
  tamanho = "m",
  numeroMandato = null,
  apagado = false,
  anel = false,
  prioridade = false,
  className = "",
}: Props) {
  const px = TAMANHOS[tamanho];
  const src = caminhoFoto(presidente.id);
  // Abaixo de 24px o número não caberia legível, e poluiria mais que ajudaria.
  const mostrarNumero = numeroMandato !== null && px >= 24;

  const estilo = {
    width: px,
    height: px,
    borderColor: "var(--borda)",
    // Recua sem sumir. Cinza total a 45% apagava o rosto: a foto da Dilma, que
    // tem fundo claro, virava um círculo vazio. O secundário aqui precisa
    // continuar reconhecível, porque reconhecer quem é *é* a função da peça.
    filter: apagado ? "grayscale(0.9) contrast(1.05)" : "none",
    opacity: apagado ? 0.82 : 1,
    transition: "filter 400ms, opacity 400ms",
  };

  if (!src) {
    // Iniciais como reserva, para o layout não pular se uma foto sumir.
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-full border font-medium ${className}`}
        style={{
          ...estilo,
          background: "var(--faixa-a)",
          color: "var(--tinta-3)",
          fontSize: px * 0.38,
        }}
      >
        {presidente.nomeCurto.slice(0, 2)}
      </span>
    );
  }

  // O selo fica fora do círculo recortado, então o wrapper não pode ter
  // `overflow-hidden`: quem recorta é o span interno.
  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{
        width: px,
        height: px,
        // O anel vai no invólucro, não na foto: aplicado junto com o `opacity`
        // do recuo ele desbotaria também e deixaria de separar dois vizinhos.
        borderRadius: 9999,
        boxShadow: anel ? "0 0 0 2px var(--superficie)" : undefined,
      }}
    >
      <span
        className="block h-full w-full overflow-hidden rounded-full border"
        style={estilo}
      >
        <Image
          src={src}
          alt={`Foto de ${presidente.nome}`}
          width={px * 2}
          height={px * 2}
          // `object-top` porque o enquadramento oficial deixa o rosto na parte
          // de cima; centralizar cortaria a testa.
          className="h-full w-full object-cover object-top"
          priority={prioridade}
        />
      </span>

      {mostrarNumero && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full font-semibold leading-none"
          style={{
            width: Math.max(px * 0.36, 13),
            height: Math.max(px * 0.36, 13),
            fontSize: Math.max(px * 0.22, 9),
            background: apagado ? "var(--eixo)" : "var(--serie)",
            color: "#fff",
            // Anel da cor do fundo para o selo não encostar na foto.
            boxShadow: "0 0 0 2px var(--superficie)",
            transition: "background 400ms",
          }}
        >
          {numeroMandato}
        </span>
      )}
    </span>
  );
}
