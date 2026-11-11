export interface VotoEstadual { id:number; nome:string; voto:string; fonte:string }
export interface VotacaoEstadual {
  id_fonte:string; data:string; titulo:string; ementa:string; resultado:string|null;
  sim:number|null; nao:number|null; abstencoes:number|null; executivo:boolean|null;
  fonte:string; proposicao:string|null; votos:VotoEstadual[];
}
export interface DadosVotacoesAssembleia {
  uf:string; total:number; pagina:number; paginas:number; inicio:string|null; fim:string|null; coletadoEm:string|null;
  cobertura:{estado:string;tipo:string;fonte_url:string;ressalva:string}[];
  votacoes:VotacaoEstadual[];
}
