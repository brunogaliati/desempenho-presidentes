"use client";
import Link from "next/link";
import { useJson } from "@/lib/useJson";
import { numero } from "@/lib/formatar";
import { coortesDaFila, SITUACOES_FILA, type DadosFilaSus } from "@/lib/filasSusModelo";
import { Bloco } from "./Bloco";

const CONSULTAS_POA="https://app.powerbi.com/view?r=eyJrIjoiMmQ1YTYxMGUtNzgzOC00ZWY3LWJhOTYtYTAwZjk5YjNmOGIyIiwidCI6IjA0NmFkMWJjLWE5NTYtNDA0OC05ODAzLTc4MTIyN2FhMDAzOSIsImMiOjh9";
const EXAMES_POA="https://app.powerbi.com/view?r=eyJrIjoiNzY4ZTJlNmQtOTc1ZC00ZjVlLWFmOGQtN2IwMDMwYmJmNzlmIiwidCI6IjA0NmFkMWJjLWE5NTYtNDA0OC05ODAzLTc4MTIyN2FhMDAzOSIsImMiOjh9";
/** Consultas mantidas pelos estados: um link, não uma série comparável entre governos. */
export const PORTAIS:Record<string,{nome:string;url:string}>={
  SP:{nome:"Acompanhamento de filas em São Paulo",url:"https://saudedigital.saude.sp.gov.br/servicos/poupatempo-da-saude/acompanhamento-de-filas"},
  RJ:{nome:"Regulação do SUS no Rio de Janeiro",url:"https://painel-regulacao-usuario-do-sus.saude.rj.gov.br/"},
  SC:{nome:"Lista de espera de Santa Catarina",url:"https://listadeespera.saude.sc.gov.br/"},
  DF:{nome:"Mapa Social da Saúde e regulação do DF",url:"https://paineis-ext.mpdft.mp.br/extensions/mapasauderegulamentacao/mapasauderegulamentacao.html"},
};
const dia=(s:string)=>s.split('-').reverse().join('/');
/** `semBloco`: só o miolo, para entrar como grupo dentro de outro bloco (o de Saúde do resumo). */
export function FilasSUS({territorio,posse,fim,uf,semBloco=false}:{territorio:string;posse:string;fim:string;uf?:string;semBloco?:boolean}) {
  const consulta=useJson<DadosFilaSus>(`/api/painel/resumo/filas?territorio=${territorio}`),d=consulta.dado;
  const portal=PORTAIS[uf??territorio];
  const foraDoMandato=Boolean(d?.referencia&&(d.referencia.slice(0,7)<posse||d.referencia.slice(0,7)>=fim));
  const visiveis=d?.situacoes.filter(s=>Object.hasOwn(SITUACOES_FILA,s.situacao))??[];
  const miolo=<>
    {consulta.erro?<p role="alert" className="leading-relaxed">A consulta de filas não respondeu agora. <button onClick={consulta.tentar} className="underline">Tentar de novo</button></p>:!d?<p role="status">Carregando os dados de filas…</p>:<>
      {!d.disponivel?<p className="max-w-prose text-sm leading-relaxed">Os agregados de filas já integrados cobrem o GERCON da rede regulada do RS. Não há um total comparável integrado para este território. Uma lacuna de cobertura não significa fila vazia. <Link href="/?uf=RS" className="underline">Ver a cobertura do RS</Link>.</p>
        :!d.referencia?<p role="status">Ainda não há uma extração publicada disponível nesta consulta.</p>
        :foraDoMandato?<p className="max-w-prose text-sm leading-relaxed">A fotografia disponível é de {dia(d.referencia)}, fora do mandato selecionado. Ela não foi usada para representar a fila deste governo. Não há uma fotografia histórica comparável neste recorte.</p>
        :<><p className="max-w-prose text-sm leading-relaxed"><strong>GERCON · rede regulada no Rio Grande do Sul.</strong> Situação em <time dateTime={d.referencia}>{dia(d.referencia)}</time> das solicitações feitas em {coortesDaFila(d.anos)}. O município é o da unidade solicitante. {territorio==='BR'?'Estes números cobrem essa base do RS; não são um total nacional.':territorio==='RS'?'A base publicada não representa todas as filas do SUS no estado.':'Os números se referem às unidades solicitantes deste município na base publicada.'}</p>
          {visiveis.length?<ul className="mt-4 divide-y divide-[var(--borda)]">{visiveis.map(s=><li key={s.situacao} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><span>{SITUACOES_FILA[s.situacao]}</span><strong className="tabular-nums">{numero(s.solicitacoes,0)} solicitações</strong></li>)}</ul>:<p className="mt-4 text-sm" role="status">A publicação consultada não traz solicitações nestas situações para este recorte. Não interpretamos isso como ausência de filas em outros sistemas ou períodos.</p>}
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-[var(--tinta-2)]">Solicitações não são pessoas únicas: uma pessoa pode ter vários pedidos. O ano do pedido não é o tamanho da fila naquele ano. Não há previsão de atendimento nem comparação entre mandatos a partir desta fotografia. {d.municipiosNaoResolvidos>0?`${d.municipiosNaoResolvidos} nomes de município sem correspondência inequívoca ficam apenas no agregado da base, sem serem atribuídos a uma cidade.`:''}</p>
          <p className="mt-3 text-sm">Fonte: <a href={d.fonte} className="underline">GERCON · Dados Abertos de Porto Alegre</a>{d.coletadoEm?` · coleta em ${dia(d.coletadoEm)}`:''}.</p>
        </>}
      {(territorio==='RS'||territorio==='4314902')&&<p className="mt-4 max-w-prose text-sm leading-relaxed">Painéis oficiais de Porto Alegre, com recorte só da capital: <a href={CONSULTAS_POA} className="underline">consultas</a> · <a href={EXAMES_POA} className="underline">exames</a> · <a href="https://prefeitura.poa.br/sms/transparencia" className="underline">metodologia</a>.</p>}
      {portal&&<p className="mt-4 text-sm leading-relaxed">Consulta mantida pelo poder público: <a href={portal.url} className="underline">{portal.nome}</a>. Uma consulta individual no portal não constitui uma série estatística comparável entre governos.</p>}
      <p className="mt-4 text-sm"><a href="https://www.gov.br/saude/pt-br/acesso-a-informacao/faq/tematicos-e-outros/como-verificar-lista-de-espera" className="underline">Como o Ministério da Saúde orienta a consulta das filas estaduais e municipais</a>.</p>
    </>}
  </>;
  return semBloco?miolo:<Bloco titulo="Filas do SUS" detalhe="cobertura identificada · solicitações, não pacientes únicos">{miolo}</Bloco>;
}
