import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { buscarMunicipioCaminho } from "@/lib/catalogoMunicipal";
import { carregarResumoMunicipal } from "@/lib/dadosResumoMunicipal";
import { caminhoResumoMunicipal } from "@/lib/resumoMunicipalModelo";
import { INDICADORES_MUNICIPAIS, rotaMunicipal, rotuloReferenciaMunicipal, type MunicipioIndicadores } from "@/lib/indicadoresMunicipais";
import { linhasRedeSaude } from "@/lib/redeSaudeModelo";
import { metadataPagina, jsonLd, URL_SITE } from "@/lib/seo";
import { numero, comSinal } from "@/lib/formatar";
import { Trilha } from "@/app/economia/Trilha";
import { FraseDaPagina } from "@/components/FraseDaPagina";
import { carregarFiscalResumo } from "@/app/_painel/_dados/resumoFiscal";
import { linhasFiscais } from "@/app/_painel/_dados/resumoComplementos";
import type { LinhaResumo } from "@/app/_painel/_dados/resumoModelo";
import styles from "@/app/economia/indicador.module.css";
import { FilasSUS } from "@/app/_painel/_componentes/FilasSUS";

export const revalidate = 3600;
type Props = {params:Promise<{uf:string;municipio:string}>;searchParams:Promise<{ano?:string}>};
async function recorte(props:Props) {
  const p=await props.params,q=await props.searchParams,m=buscarMunicipioCaminho(p.uf,p.municipio);
  const distrital=m?.uf.sigla==='DF',primeiro=distrital?2015:2013;
  const anoAtual=new Date().getUTCFullYear(),padrao=anoAtual-(anoAtual-(distrital?2023:2025))%4;
  const ano=q.ano===undefined?padrao:Number(q.ano);
  if(!m || q.ano && !/^\d{4}$/.test(q.ano) || !Number.isInteger(ano) || ano<primeiro || ano>anoAtual || (ano-primeiro)%4!==0)notFound();
  const esfera=distrital?'distrital':m.codigo==='2605459'?'do distrito estadual':'municipal';
  return {m,ano,padrao,primeiro,esfera};
}
export async function generateMetadata(props:Props) {
  const {m,ano,padrao,esfera}=await recorte(props),path=caminhoResumoMunicipal(m);
  return {...metadataPagina(`Resumo de ${m.nome} (${m.uf.sigla}): administração ${esfera}, ${ano}–${ano+3}`,`População, emprego formal, programas sociais, hospitais e leitos SUS e contas públicas de ${m.nome}, com referências e fontes oficiais.`,path),...(ano!==padrao?{robots:{index:false,follow:true}}:{})};
}
function Medidas({linhas}:{linhas:LinhaResumo[]}) {
  return <ul className="mt-4 divide-y divide-[var(--borda)]">{linhas.map((l)=><li key={l.id} className="py-4">
    <div className="flex flex-wrap items-baseline justify-between gap-3"><div><h3 className="font-semibold">{l.nome}</h3><p className="mt-1 text-sm text-[var(--tinta-2)]">{l.detalhe}</p></div><p className="text-lg tabular-nums">{l.de!==null && <>{l.de} → </>}<strong>{l.para??"Indisponível"}</strong>{l.mudanca!==null && <span className="ml-3 text-sm text-[var(--tinta-2)]">{l.mudanca}</span>}</p></div>
    <p className="mt-2 text-sm text-[var(--tinta-2)]">{l.periodo}{l.falta?`${l.periodo?" · ":""}${l.falta}`:""}</p>
    <details className="mt-3"><summary className="cursor-pointer text-sm">Fonte e limites da medida</summary><div className="mt-2 max-w-prose space-y-2 text-sm leading-relaxed"><p>{l.nota}</p><p>Fonte: {l.urlFonte?<a href={l.urlFonte}>{l.fonte}</a>:l.fonte}.</p></div></details>
  </li>)}</ul>;
}
async function ContasMunicipais({m,ano}:{m:MunicipioIndicadores;ano:number}) {
  const titulo=m.uf.sigla==='DF'?"Contas do governo distrital":"Contas do governo municipal";
  if(m.codigo==='2605459')return <section className="vidro" data-lustro="fixo" id="contas"><h2 className="text-xl font-semibold">Contas do distrito estadual</h2><p className="mt-4 max-w-prose leading-relaxed">Fernando de Noronha não é um município autônomo com RGF municipal próprio. <Link href="/resumo?uf=PE">Consultar as contas do governo de Pernambuco</Link>.</p></section>;
  try {
    const d=await carregarFiscalResumo(m.uf.sigla==='DF'?53:Number(m.codigo),`${ano}-01`,`${ano+4}-01`);
    return <section className="vidro" data-lustro="fixo" id="contas"><h2 className="text-xl font-semibold">{titulo}</h2><p className="mt-3 max-w-prose leading-relaxed">Dívida e despesa com pessoal do Executivo, em relação à receita corrente líquida ajustada. Fonte: Tesouro Nacional, RGF.</p><Medidas linhas={linhasFiscais(d)}/></section>;
  } catch {
    return <section className="vidro" data-lustro="fixo" id="contas"><h2 className="text-xl font-semibold">{titulo}</h2><p className="mt-4 leading-relaxed" role="status">O Tesouro não respondeu agora. <a href="https://siconfi.tesouro.gov.br/siconfi/index.jsf">Consultar o Siconfi</a>.</p></section>;
  }
}
async function Conteudo({m,ano}:{m:MunicipioIndicadores;ano:number}) {
  const d=await carregarResumoMunicipal(m,ano);
  const onde=`${m.nome} (${m.uf.sigla})`;
  return <>
    <section className="vidro" data-lustro="fixo" id="prefeitura"><h2 className="text-xl font-semibold">Administração e eleição</h2>
      {m.uf.sigla==="DF"?<p className="mt-4 leading-relaxed">Brasília é uma unidade equivalente a município no cadastro do IBGE. O Distrito Federal não possui prefeito: o governo é distrital.</p>
        :m.codigo==="2605459"?<p className="mt-4 leading-relaxed">Fernando de Noronha é um distrito estadual e não elege prefeito.</p>
        :d.prefeito?<><p className="mt-4 text-lg"><strong>{d.prefeito.nome_urna||d.prefeito.nome}</strong> · {d.prefeito.partido_sigla}</p><p className="mt-2 leading-relaxed">Prefeito eleito em {d.prefeito.data_eleicao.split("-").reverse().join("/")}, segundo o TSE. O resultado eleitoral não confirma exercício atual, afastamentos ou sucessões.</p></>
        :<p className="mt-4 leading-relaxed">{d.erroEleicao?"A consulta à eleição não respondeu agora.":"Não encontramos um resultado eleitoral municipal inequívoco para este período."}</p>}
      <p className="mt-3 text-sm text-[var(--tinta-2)]">Fonte: <a href="https://dadosabertos.tse.jus.br/">Dados Abertos do TSE</a>. Nome e UF conferidos com o cadastro municipal; códigos TSE e IBGE não são tratados como equivalentes.</p>
    </section>
    <section className="vidro" data-lustro="fixo" id="indicadores"><h2 className="text-xl font-semibold">{onde} no período</h2><p className="mt-3 max-w-prose leading-relaxed">Último dado dentro de {ano}–{ano+3} contra o último anterior a janeiro de {ano}. População e emprego dependem também da economia nacional. CadÚnico e BPC são programas de âmbito federal; os dados locais não medem desempenho exclusivo da prefeitura.</p>
      <ul className="mt-5 divide-y divide-[var(--borda)]">{d.indicadores.map(({id,dados,base,atual})=>{
        const cfg=INDICADORES_MUNICIPAIS[id],delta=atual?.valor!==null&&atual?.valor!==undefined&&base?.valor!==null&&base?.valor!==undefined?atual.valor-base.valor:null;
        return <li key={id} className="py-4"><div className="flex flex-wrap items-baseline justify-between gap-3"><h3 className="font-semibold"><Link href={rotaMunicipal(id,m)}>{cfg.nome}</Link></h3><p className="text-lg tabular-nums">{base && <>{numero(base.valor,0)} → </>}<strong>{atual?numero(atual.valor,0):"Indisponível"}</strong>{atual && <span className="ml-2 text-sm">{cfg.unidade}</span>}</p></div>
          <p className="mt-2 text-sm text-[var(--tinta-2)]">{atual?`${rotuloReferenciaMunicipal(atual.referencia,cfg.anual)}${base?` contra ${rotuloReferenciaMunicipal(base.referencia,cfg.anual)}`:" · sem base anterior à posse"}`:"Sem referência válida dentro deste mandato."}{delta!==null?` · diferença de ${comSinal(delta,0)} ${cfg.unidade}`:""}</p>
          {id==="emprego-formal"&&atual&&<p className="mt-2 text-sm">No último mês: {numero(atual.extras[0],0)} admissões, {numero(atual.extras[1],0)} desligamentos e saldo de {comSinal(atual.extras[2]!,0)} vínculos.</p>}
          <p className="mt-2 text-sm text-[var(--tinta-2)]">Fonte: <a href={cfg.url}>{cfg.fonte}</a>{dados?` · coleta ${dados.atualizado.slice(0,10)}`:" · consulta sem dados disponíveis"}.</p></li>;
      })}</ul>
      {m.uf.sigla!=="SP"&&<p className="mt-4 max-w-prose text-sm leading-relaxed">CadÚnico e BPC ainda não têm cobertura municipal integrada nesta UF. A série municipal já disponível desses programas é a paulista, publicada pela Fundação Seade.</p>}
    </section>
    <section className="vidro" data-lustro="fixo" id="saude"><h2 className="text-xl font-semibold">Hospitais e leitos SUS no município</h2><p className="mt-3 max-w-prose leading-relaxed">Rede no território, com diferentes gestores. O cadastro não informa ocupação ou vaga disponível, nem atribui toda a oferta à prefeitura.</p>
      {d.rede?<Medidas linhas={linhasRedeSaude(d.rede,{posse:`${ano}-01`,ate:`${ano+4}-01`,fim:`${ano+3}-12-31`})}/>:<p className="mt-4" role="status">A consulta à rede hospitalar não respondeu agora.</p>}
    </section>
  </>;
}
export default async function Municipio(props:Props) {
  const {m,ano,padrao,primeiro,esfera}=await recorte(props),path=caminhoResumoMunicipal(m);
  const schema={"@context":"https://schema.org","@type":"WebPage",name:`Resumo de ${m.nome} (${m.uf.sigla})`,url:URL_SITE+path,inLanguage:"pt-BR",about:{"@type":"City",name:m.nome,identifier:m.codigo}};
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}><FraseDaPagina texto={`Resumo de ${m.nome} (${m.uf.sigla}), ${ano}–${ano+3}: indicadores locais, hospitais e contas públicas, com fontes oficiais.`}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLd(schema)}}/>
    <header><Trilha itens={[{nome:"Resumo",href:"/resumo"},{nome:"Municípios",href:"/resumo/municipios"},{nome:m.uf.nome,href:`/resumo/municipios/${m.uf.slug}`},{nome:m.nome}]}/><h1>Resumo de {m.nome} <span className="text-[var(--tinta-2)]">({m.uf.sigla})</span></h1><p className="my-5 max-w-prose text-lg leading-relaxed">Administração {esfera} · período {ano}–{ano+3}. Indicadores e fontes na mesma página, com os limites de cada medida. Mudança durante o período não comprova que o governo a causou.</p>
      <form method="get" className={styles.busca}><label>Período da administração<select className="min-h-11 rounded-lg border border-[var(--borda)] bg-[var(--superficie)] px-3 text-base" name="ano" defaultValue={ano}>{Array.from({length:(padrao-primeiro)/4+1},(_,i)=>primeiro+i*4).reverse().map(a=><option key={a} value={a}>{a}–{a+3}</option>)}</select></label><button>Ver período</button></form>
      <nav aria-label="Nesta página" className={styles.navegacaoMunicipal}><a href="#prefeitura">Administração e eleição</a><a href="#indicadores">Indicadores</a><a href="#saude">Hospitais e leitos SUS</a><a href="#contas">Contas públicas</a></nav>
    </header>
    <Suspense fallback={<p role="status" className="py-6">Carregando os dados de {m.nome}…</p>}><Conteudo m={m} ano={ano}/></Suspense>
    <FilasSUS territorio={m.codigo} uf={m.uf.sigla} posse={`${ano}-01`} fim={`${ano+4}-01`}/>
    <Suspense fallback={<p role="status" className="py-6">Consultando as contas municipais no Tesouro…</p>}><ContasMunicipais m={m} ano={ano}/></Suspense>
    <nav aria-label="Outros recortes" className="flex flex-wrap gap-5 py-5"><Link href={`/resumo?uf=${m.uf.sigla}`}>Resumo do estado</Link><Link href={`/resumo/municipios/${m.uf.slug}`}>Trocar de município</Link><Link href={`/correcoes?pagina=${encodeURIComponent(path)}`}>Relatar erro nos dados</Link></nav>
  </main>;
}
