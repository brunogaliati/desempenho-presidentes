import { sitemapPublico } from "@/lib/sitemapPublico";
export const revalidate=3600;
const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^(0|[1-9]\d*)\.xml$/.test(id))return new Response(null,{status:404});
  const paginas=(await sitemapPublico()).slice(Number(id.slice(0,-4))*4000,(Number(id.slice(0,-4))+1)*4000);
  if(!paginas.length)return new Response(null,{status:404});
  const entradas=paginas.map(p=>`<url><loc>${xml(p.url)}</loc>${p.lastModified?`<lastmod>${xml(String(p.lastModified))}</lastmod>`:''}</url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entradas}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
