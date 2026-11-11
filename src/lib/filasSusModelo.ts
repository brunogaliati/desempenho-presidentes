export const FONTE_FILAS_SUS = "https://dadosabertos.poa.br/dataset/gercon-gerenciamento-de-consultas";
export const SITUACOES_FILA:Record<string,string> = {
  SOLICITADA:"Solicitadas, aguardando agendamento",AGUARDA_REGULACAO:"Aguardam análise inicial da regulação",
  PENDENTE:"Devolvidas para complementar informações",AGUARDA_REAVALIACAO:"Aguardam reavaliação do regulador",
  AGUARDA_MATRICIAMENTO:"Aguardam teleconsultoria",EM_MATRICIAMENTO:"Em teleconsultoria",ENCAMINHADA_AO_NIR:"Encaminhadas ao núcleo de regulação do serviço",
  AUTORIZADA:"Autorizadas para agendamento",AUTORIZACAO_AUTOMATICA:"Autorizadas automaticamente para agendamento",
};
export interface DadosFilaSus {
  territorio:string; disponivel:boolean; referencia:string|null; anos:number[];
  situacoes:{situacao:string;solicitacoes:number}[]; municipiosNaoResolvidos:number;
  fonte:string; coletadoEm:string|null;
}
export function coortesDaFila(anos:number[]):string {
  const unicos=[...new Set(anos)].sort((a,b)=>a-b);
  if(!unicos.length)return "não informados";
  return unicos.length>1&&unicos.every((a,i)=>i===0||a===unicos[i-1]+1)?`${unicos[0]} a ${unicos.at(-1)}`:unicos.join(", ");
}
