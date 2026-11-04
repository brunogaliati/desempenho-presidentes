import { URL_SITE } from "@/lib/seo";
export async function POST(request:Request){
  if(process.env.NEXT_PUBLIC_WEB_VITALS!=='true')return new Response(null,{status:404});
  const origem=request.headers.get('origin');
  if(!origem || ![URL_SITE,new URL(request.url).protocol+'//'+request.headers.get('host')].includes(origem))return new Response(null,{status:403});
  if(Number(request.headers.get('content-length'))>2000)return new Response(null,{status:413});
  try{
    const leitor=request.body?.getReader();if(!leitor)return new Response(null,{status:400});
    const partes:Uint8Array[]=[];let tamanho=0;while(true){const {done,value}=await leitor.read();if(done)break;tamanho+=value.length;if(tamanho>2000){await leitor.cancel();return new Response(null,{status:413});}partes.push(value);}
    const {nome,valor,avaliacao,caminho}=JSON.parse(Buffer.concat(partes).toString('utf8'));
    if(!['CLS','FCP','INP','LCP','TTFB'].includes(nome) || !Number.isFinite(valor) || valor<0 || valor>3600000 || !['good','needs-improvement','poor'].includes(avaliacao) || typeof caminho!=='string' || !/^\/(?!\/)[^?#\s\\]{0,299}$/.test(caminho))return new Response(null,{status:400});
    // Métricas agregáveis nos logs de hospedagem; sem cookies, IP, query ou identificador de visitante.
    console.info(JSON.stringify({evento:'web-vital',nome,valor,avaliacao,caminho}));
    return new Response(null,{status:204});
  }catch{return new Response(null,{status:400});}
}
