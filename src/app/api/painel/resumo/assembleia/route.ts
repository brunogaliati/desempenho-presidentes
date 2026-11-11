import { NextResponse } from "next/server";
import { UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { carregarVotacoesAssembleia } from "@/lib/dadosVotacoesAssembleia";

export async function GET(request:Request) {
  const q=new URL(request.url).searchParams,uf=(q.get("uf")??"").toUpperCase();
  const posse=q.get("posse")??"",fim=q.get("fim")??"",busca=q.get("q")?.trim()??"",pagina=q.get("pagina")??"0",executivo=q.get("executivo")??"false";
  const mes=/^(19|20)\d{2}-(0[1-9]|1[0-2])$/;
  if(!UFS_MUNICIPAIS.some(u=>u.sigla===uf)||!mes.test(posse)||!mes.test(fim)||fim<=posse||busca.length>100||!/^\d{1,5}$/.test(pagina)||!['true','false'].includes(executivo))return NextResponse.json({erro:"Recorte inválido"},{status:400});
  try {
    return NextResponse.json(await carregarVotacoesAssembleia(uf,posse,fim,executivo==='true',busca,Number(pagina)),{headers:{"Cache-Control":"public, max-age=600, stale-while-revalidate=3600"}});
  } catch(error) {
    console.error("Votações estaduais indisponíveis",error);
    return NextResponse.json({erro:"As votações não responderam agora"},{status:503});
  }
}
