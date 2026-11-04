import { imagemCompartilhamento } from "@/components/ImagemCompartilhamento";
import type { DadosPaginaEconomia } from "@/lib/dadosEconomiaPublica";
import { rotuloPeriodoPublico } from "@/app/_painel/_dados/economiaModelo";
import { numero, reais } from "@/lib/formatar";
import type { DadosIndicadorMunicipal } from "@/lib/dadosIndicadoresMunicipais";
import { INDICADORES_MUNICIPAIS,rotuloReferenciaMunicipal } from "@/lib/indicadoresMunicipais";

export async function imagemIndicador(d: DadosPaginaEconomia) {
  return imagemPublica(`${d.pagina.id === "gasolina" ? "Gasolina comum" : "Desemprego"} · ${d.territorio}${d.pagina.territorio?.uf ? ` (${d.pagina.territorio.uf.sigla}) · município` : d.pagina.territorio ? " (UF)" : ""}`,d.pagina.id === "gasolina" ? `${reais(d.ultimo.valor)}/litro` : `${numero(d.ultimo.valor,1)}%`,`${d.pagina.id === "desemprego" ? "Trimestre móvel encerrado em " : "Referência: "}${rotuloPeriodoPublico(d.ultimo.mes,d.trimestral)}`,d.fonte);
}

export async function imagemMunicipal(d:DadosIndicadorMunicipal) {
  const cfg=INDICADORES_MUNICIPAIS[d.id];
  return imagemPublica(`${cfg.nome} · ${d.municipio.nome} (${d.municipio.uf.sigla})`,numero(d.ultimo.valor,0),`Referência: ${rotuloReferenciaMunicipal(d.ultimo.referencia,cfg.anual)} · ${cfg.unidade}`,cfg.fonte);
}

async function imagemPublica(titulo:string,valor:string,referencia:string,fonteNome:string) {
  return imagemCompartilhamento({titulo,valor,referencia,fonte:fonteNome});
}
