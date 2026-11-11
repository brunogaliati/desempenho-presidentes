import Link from "next/link";
import { notFound } from "next/navigation";
import { MUNICIPIOS_INDICADORES, UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { caminhoResumoMunicipal, normalizarNomeMunicipal } from "@/lib/resumoMunicipalModelo";
import { metadataPagina } from "@/lib/seo";
import { Trilha } from "@/app/economia/Trilha";
import styles from "@/app/economia/indicador.module.css";

type Props = {params:Promise<{uf:string}>;searchParams:Promise<{q?:string;pagina?:string}>};
async function listar(props:Props) {
  const {uf:slug} = await props.params, q = await props.searchParams;
  const uf = UFS_MUNICIPAIS.find((u) => u.slug === slug);
  if (!uf || q.q && (typeof q.q !== "string" || q.q.length>80) || q.pagina && !/^[1-9]\d*$/.test(q.pagina)) notFound();
  const pagina = Number(q.pagina ?? 1), busca = q.q?.trim() ?? "";
  const cidades = MUNICIPIOS_INDICADORES.filter((m) => m.uf.codigo === uf.codigo && (!busca || normalizarNomeMunicipal(m.nome).includes(normalizarNomeMunicipal(busca)))).sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR"));
  const paginas = Math.max(1,Math.ceil(cidades.length/100));
  if (!Number.isSafeInteger(pagina) || pagina>paginas) notFound();
  return {uf,busca,pagina,paginas,total:cidades.length,cidades:cidades.slice((pagina-1)*100,pagina*100)};
}
export async function generateMetadata(props:Props) {
  const d = await listar(props);
  return {...metadataPagina(`Resumo dos municípios de ${d.uf.nome}`,`Escolha uma cidade de ${d.uf.nome} para consultar o resumo municipal com indicadores, hospitais e fontes oficiais.`,`/resumo/municipios/${d.uf.slug}`,"/compartilhar?pagina=%2Fresumo"),...(d.busca?{robots:{index:false,follow:true}}:{})};
}
export default async function MunicipiosUf(props:Props) {
  const d = await listar(props), caminho = `/resumo/municipios/${d.uf.slug}`;
  const url = (p:number) => `${caminho}?${new URLSearchParams({pagina:String(p),...(d.busca?{q:d.busca}:{})})}`;
  return <main className={`${styles.pagina} mx-auto max-w-6xl pb-20`}>
    <header><Trilha itens={[{nome:"Resumo",href:"/resumo"},{nome:"Municípios",href:"/resumo/municipios"},{nome:d.uf.nome}]}/><h1>Resumo dos municípios de {d.uf.nome}</h1>
      <p className="my-5 text-lg leading-relaxed">{d.total} localidades · página {d.pagina} de {d.paginas}.</p>
      <form method="get" className={styles.busca}><label>Buscar município<input type="search" name="q" defaultValue={d.busca} maxLength={80}/></label><button>Buscar município</button>{d.busca && <Link href={caminho}>Limpar busca</Link>}</form></header>
    <section className="vidro" data-lustro="fixo"><h2 className="text-xl font-semibold">Escolha um município</h2>
      {!d.cidades.length && <p className="mt-4" role="status">Nenhum município encontrado. Tente outra grafia ou limpe a busca.</p>}
      <ul className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{d.cidades.map((m) => <li key={m.codigo}><Link prefetch={false} href={caminhoResumoMunicipal(m)}>{m.nome}</Link></li>)}</ul>
      <nav aria-label="Paginação de municípios" className="mt-6 flex gap-5">{d.pagina>1 && <Link href={url(d.pagina-1)} rel="prev">Página anterior</Link>}{d.pagina<d.paginas && <Link href={url(d.pagina+1)} rel="next">Próxima página</Link>}</nav>
    </section>
  </main>;
}
