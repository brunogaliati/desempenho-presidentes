import type { FocoMandato } from "@/app/_painel/_dados/tipos";
import type { LinhaResumo } from "@/app/_painel/_dados/resumoModelo";
import type { Sentido } from "@/lib/formatar";

export const FONTE_REDE_SAUDE = "https://dadosabertos.saude.gov.br/dataset/hospitais-e-leitos";
export interface RegistroRedeSaude {
  mes: string; hospitais_sus: number | null; leitos_sus: number | null; uti_sus: number | null;
  leitos_gestao_estadual: number | null; nao_mapeados: number; coletado_em: string;
}
export interface DadosRedeSaude { territorio: string; linhas: RegistroRedeSaude[] }
const n = (v: number) => v.toLocaleString("pt-BR");
/** Mais é melhor, na régua do placar. Sem importar `formatar`: o teste roda este arquivo direto no Node. */
const sentido = (v: number | null): Sentido => (v === null || v === 0 ? "neutro" : v > 0 ? "bom" : "ruim");

export function linhasRedeSaude(d: DadosRedeSaude, foco: Pick<FocoMandato, "posse" | "ate" | "fim">): LinhaResumo[] {
  const meses: string[] = [];
  const primeiro = d.linhas[0]?.mes, ultimo = d.linhas.at(-1)?.mes;
  if (primeiro && ultimo) {
    let ano = Number(primeiro.slice(0, 4)), mes = Number(primeiro.slice(5, 7));
    for (;;) {
      const chave = `${ano}-${String(mes).padStart(2, "0")}`;
      if (chave > ultimo) break;
      meses.push(chave);
      if (++mes > 12) { mes = 1; ano++; }
    }
  }
  const porMes = new Map(d.linhas.map((r) => [r.mes, r]));
  const indicadores = [
    ["hospitais_sus", "Hospitais com leitos SUS", "hospital geral e especializado · tipos 05 e 07"],
    ["leitos_sus", "Leitos SUS", "capacidade cadastrada · todos os tipos de unidade da fonte"],
    ["uti_sus", "Leitos de UTI SUS", "campo próprio do CNES · não somado aos leitos acima"],
  ] as const;
  return indicadores.map(([id, nome, detalhe]) => {
    const antes = d.linhas.findLast((r) => r.mes < foco.posse && r[id] !== null);
    const depois = d.linhas.findLast((r) => r.mes >= foco.posse && (foco.ate ? r.mes < foco.ate : r.mes <= foco.fim.slice(0, 7)) && r[id] !== null);
    const de = antes?.[id] ?? null, para = depois?.[id] ?? null;
    const mudanca = de !== null && para !== null ? para - de : null;
    return { id: `saude-${id}`, nome, detalhe,
      de: de === null ? null : n(de), para: para === null ? null : n(para),
      mudanca: mudanca === null ? null : `${mudanca > 0 ? "+" : ""}${n(mudanca)}`,
      // A cor diz só se a capacidade cadastrada subiu ou caiu, na régua do placar; não entra na conta do topo.
      sentido: sentido(mudanca), brasil: null, comparacao: null,
      periodo: depois ? `${depois.mes}${antes ? ` contra ${antes.mes}` : ""}` : "",
      falta: para === null ? "Sem referência válida neste mandato." : de === null ? "Sem referência válida antes da posse." : undefined,
      fonte: "Ministério da Saúde · DEMAS/CNES", urlFonte: FONTE_REDE_SAUDE,
      nota: "Estoque mensal de unidades ativas e leitos cadastrados para o SUS no território, sob diferentes gestores; não é ocupação, vaga disponível ou medida exclusiva deste governo. Meses não são somados. UTI e leitos são campos distintos da fonte, sem soma entre eles. A cor diz só se a capacidade cadastrada subiu ou caiu: mais leitos não comprovam melhor atendimento. Limites municipais são os do cadastro atual do IBGE.",
      grafico: { series: [{ rotulo: /^\d{7}$/.test(d.territorio) ? "Município" : d.territorio === "BR" ? "Brasil" : d.territorio, datas: meses, valores: meses.map((m) => porMes.get(m)?.[id] ?? null), principal: true }], casas: 0, sufixo: "", titulo: nome },
    };
  });
}
