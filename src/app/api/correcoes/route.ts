import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { URL_SITE } from "@/lib/seo";
export async function POST(request:Request){
  const erro=(mensagem:string,status=400)=>Response.json({erro:mensagem},{status});
  const origem=request.headers.get('origin');
  const origemLocal=new URL(request.url).protocol+'//'+request.headers.get('host');
  if(!origem || ![URL_SITE,origemLocal].includes(origem))return erro('Origem do envio inválida.',403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return erro('Formato de envio inválido.',415);
  const leitor=request.body?.getReader();if(!leitor)return erro('Relato vazio.');
  let texto='',bytes=0;const decoder=new TextDecoder();
  while(true){const {done,value}=await leitor.read();if(done)break;bytes+=value.byteLength;if(bytes>14000){await leitor.cancel();return erro('O relato excede o tamanho permitido.',413);}texto+=decoder.decode(value,{stream:true});}texto+=decoder.decode();
  let corpo;try{corpo=JSON.parse(texto);}catch{return erro('Formato de envio inválido.');}
  if(!corpo || typeof corpo!=='object' || corpo.empresa)return erro('Envio inválido.');
  const {caminho,descricao}=corpo;
  if(typeof caminho!=='string' || !/^\/(?!\/)[^?#\s\\]{0,299}$/.test(caminho))return erro('Informe um caminho deste site começando com /.');
  if(typeof descricao!=='string' || descricao.trim().length<20 || descricao.length>3000)return erro('Descreva o problema com 20 a 3.000 caracteres.');
  try{
    const protocolo=randomUUID();
    // Limite global de proteção ao formulário anônimo, sem coletar IP ou cookies.
    const recebidos=await sql`insert into observatorio.correcao_site(id,caminho,descricao)
      select ${protocolo}::uuid,${caminho},${descricao.trim()}
      where (select count(*) from observatorio.correcao_site where criado_em>now()-interval '1 minute')<30 returning id`;
    if(!recebidos.length)return erro('Há muitos envios agora. Aguarde um minuto e tente novamente.',429);
    return Response.json({protocolo},{status:201});
  }catch{return erro('Não foi possível registrar o relato. Tente novamente.',503);}
}
