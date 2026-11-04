import { sitemapPublico } from "@/lib/sitemapPublico";
import { URL_SITE } from "@/lib/seo";
export const revalidate=3600;
export async function GET(){
  const paginas=await sitemapPublico();
  const entradas=Array.from({length:Math.ceil(paginas.length/4000)},(_,i)=>`<sitemap><loc>${URL_SITE}/sitemaps/${i}.xml</loc></sitemap>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entradas}</sitemapindex>`,{headers:{'Content-Type':'application/xml; charset=utf-8'}});
}
