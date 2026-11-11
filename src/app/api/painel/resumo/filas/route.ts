import { NextResponse } from "next/server";
import { buscarMunicipioCodigo, UFS_MUNICIPAIS } from "@/lib/catalogoMunicipal";
import { carregarFilasSus } from "@/lib/dadosFilasSus";
export async function GET(request:Request) {
  const territorio=(new URL(request.url).searchParams.get('territorio')??'BR').toUpperCase();
  if(territorio!=='BR'&&!UFS_MUNICIPAIS.some(u=>u.sigla===territorio)&&!buscarMunicipioCodigo(territorio))return NextResponse.json({erro:'Território inválido'},{status:400});
  try{return NextResponse.json(await carregarFilasSus(territorio),{headers:{'Cache-Control':'public, max-age=600, stale-while-revalidate=3600'}});}
  catch(error){console.error('Filas SUS indisponíveis',error);return NextResponse.json({erro:'A consulta de filas não respondeu agora'},{status:503});}
}
