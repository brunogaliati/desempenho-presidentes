// node --env-file=.env.local scripts/verificar-indicadores-municipais.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
import { idsMunicipais,rotaMunicipal } from '../src/lib/indicadoresMunicipais.ts';
const root=process.env.SEO_PREVIEW_URL??'http://localhost:3000',sql=neon(process.env.DATABASE_URL);
async function fetch(url,init){
 const r=await globalThis.fetch(url,{signal:AbortSignal.timeout(60000),...init});
 if(r.status>=500){const b=await r.clone().text();console.error(JSON.stringify({path:new URL(url).pathname,status:r.status,server:r.headers.get('server'),ray:r.headers.get('cf-ray'),titulo:b.match(/<title[^>]*>(.*?)<\/title>/is)?.[1],erro:b.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>/gi,' ').replace(/\s+/g,' ').split('Cloudflare Ray ID')[0].slice(0,600)}));}
 return r;
}

const municipios=JSON.parse(await readFile(new URL('../src/lib/municipiosIndicadores.json',import.meta.url),'utf8'));
const cobertura=await sql`select indicador,codigo_ibge codigo,to_char(referencia,'YYYY-MM') referencia from mart.historico_publicavel_municipal`;
const refs=new Map(cobertura.map(r=>[`${r.indicador}:${r.codigo}`,r.referencia]));
const paths=new Set();
for(const m of municipios)for(const id of m.indicadores){assert(refs.has(`${id}:${m.codigo}`),`cobertura ${id}/${m.codigo}`);paths.add(rotaMunicipal(id,m));}
assert.equal(paths.size,cobertura.filter(r=>municipios.some(m=>m.codigo===r.codigo && m.indicadores.includes(r.indicador))).length);
async function carregarSitemap(path){const r=await fetch(root+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200,path+' status');assert(r.headers.get('content-type')?.includes('xml'),path+' tipo');return r.text();}
const indice=await carregarSitemap('/sitemap.xml');
const xml=indice.includes('<sitemapindex')?(await Promise.all([...indice.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>carregarSitemap(new URL(m[1]).pathname)))).join(''):indice;
const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
assert.equal(new Set(urls).size,urls.length);for(const path of paths)assert(urls.some(url=>url.endsWith(path)),path+' sitemap');
assert(!xml.includes('prototipo'));assert(!xml.includes('/imagens/'));
async function lote(items,fn){for(let i=0;i<items.length;i+=4)await Promise.all(items.slice(i,i+4).map(fn));}
if(process.env.SEO_APENAS_ARQUITETURA!=='true'){
const diretorios=urls.filter(u=>new URL(u).pathname.startsWith('/economia/municipios'));
const descobertas=new Set();
await lote(diretorios,async u=>{
 const url=new URL(u),path=url.pathname+url.search,res=await fetch(root+path);assert.equal(res.status,200,path);const html=await res.text();
 assert(html.includes(`rel="canonical" href="${u}"`),path+' canonical');
 for(const m of html.matchAll(/href="(\/economia\/(?:populacao|emprego-formal|cadunico|bpc)\/[^"?#]+)"/g)){assert(paths.has(m[1]),m[1]);descobertas.add(m[1]);}
});
assert.equal(descobertas.size,paths.size,'todos os indicadores precisam de link comum em um diretório');
console.log(`PASSOU: cobertura das ${paths.size} páginas; ${diretorios.length} diretórios paginados; todas as URLs descobertas por links; ${urls.length} URLs únicas no sitemap.`);
const amostras=new Map();
for(const uf of new Set(municipios.map(m=>m.uf.codigo)))for(const id of ['populacao','emprego-formal']){
 const m=municipios.find(m=>m.uf.codigo===uf && m.indicadores.includes(id));if(m)amostras.set(`${id}:${m.codigo}`,{id,m});
}
for(const id of ['cadunico','bpc'])for(const m of [municipios.find(m=>m.indicadores.includes(id)),municipios.findLast(m=>m.indicadores.includes(id))])amostras.set(`${id}:${m.codigo}`,{id,m});
const nova=municipios.find(m=>m.codigo==='5101837');if(nova)amostras.set(`populacao:${nova.codigo}`,{id:'populacao',m:nova});
const numero=v=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:0}).format(v);
await lote([...amostras.values()],async({id,m})=>{
 const ref=refs.get(`${id}:${m.codigo}`),path=rotaMunicipal(id,m),res=await fetch(root+path);assert.equal(res.status,200,path);const html=await res.text();
 assert.equal([...html.matchAll(/<h1[ >]/g)].length,1);assert(html.includes(`rel="canonical" href="https://desempenhodogoverno.com.br${path}"`));
 const graph=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(m=>JSON.parse(m[1])['@graph']??[]),d=graph.find(s=>s['@type']==='Dataset');
 assert.equal(d.spatialCoverage.identifier,m.codigo);assert.equal(d.spatialCoverage.containedInPlace.identifier,m.uf.codigo);assert.equal(d.spatialCoverage['@type'],'City');assert(d.temporalCoverage.endsWith(`${ref}-01`));assert.equal(graph.find(s=>s['@type']==='BreadcrumbList').itemListElement.length,4);
 let row;
 if(id==='populacao')row=(await sql`select populacao::float8 valor from mart.populacao_estimada where nivel='N6' and codigo_ibge=${m.codigo} and ano=${Number(ref.slice(0,4))}`)[0];
 else if(id==='emprego-formal')row=(await sql`select estoque::float8 valor from mart.caged_emprego_mensal where nivel='municipio' and ajuste='com_ajustes' and codigo=${m.codigo.slice(0,6)} and uf_sigla=${m.uf.sigla} and mes=${ref+'-01'}::date`)[0];
 else row=(await sql`select valores[array_position(variaveis,${id==='bpc'?'Bem_BPC':'Fam_Cad'})]::float8 valor from mart.transferencia_renda where nivel='municipio' and recurso=${id==='bpc'?'bpc':'cad_pbf'} and codigo=${m.codigo} and mes=${ref+'-01'}::date`)[0];
 assert(row);assert(d.description.includes(numero(row.valor)),path+' valor fonte');
 const img=await fetch(root+`/economia/imagens/${id}/${m.uf.slug}/${m.slug}`);assert.equal(img.status,200,path+' imagem');assert(img.headers.get('content-type').includes('image/png'));assert.equal(img.headers.get('x-robots-tag'),'noindex');assert((await img.arrayBuffer()).byteLength>1000);
});
console.log(`PASSOU: ${amostras.size} páginas e imagens, valores conferidos na fonte, todas as UFs, geração sob demanda e município com histórico curto.`);
for(const path of ['/economia/populacao/uf-inexistente/cidade','/economia/cadunico/parana/curitiba','/economia/bpc/parana/curitiba','/economia/emprego-formal/maranhao/bacurituba','/economia/municipios/sao-paulo?pagina=9999','/economia/imagens/bpc/parana/curitiba'])assert.equal((await fetch(root+path)).status,404,path);
const busca=await(await fetch(root+'/economia/municipios/sao-paulo?q=campinas')).text();assert(busca.includes('noindex, follow'));assert(busca.includes('rel="canonical" href="https://desempenhodogoverno.com.br/economia/municipios/sao-paulo"'));
for(const path of ['/economia/salario-minimo','/economia/inflacao','/economia/gasolina/sao-paulo/campinas','/economia/desemprego/bahia'])assert.equal((await fetch(root+path)).status,200,path);
console.log('PASSOU: seis limites/404, busca não indexável e quatro rotas existentes preservadas.');
}


// Arquitetura pública: todos os panoramas, pais canônicos e datas reais.
const hubs=urls.map(u=>new URL(u).pathname).filter(p=>/^\/economia\/(populacao|emprego-formal|cadunico|bpc)(?:\/[^/]+)?$/.test(p));
assert.equal(hubs.length,60);
await lote(hubs,async path=>{
 const r=await fetch(root+path);assert.equal(r.status,200,path);const html=await r.text();
 assert.equal([...html.matchAll(/<h1[ >]/g)].length,1,path);assert(html.includes(`rel="canonical" href="https://desempenhodogoverno.com.br${path}"`),path);
 assert(!/href="\/prototipo(?:[?"/])/.test(html),path+' navegação pública');
 assert(html.includes('CollectionPage'));assert(html.includes('dateModified'));assert(html.includes('/metodologia'));assert(html.includes('/correcoes'));
});
const datas=new Map([...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>\s*<\/url>/g)].map(m=>[new URL(m[1].replaceAll('&amp;','&')).pathname,m[2]]));
for(const path of ['/economia/populacao/sao-paulo/campinas','/economia/emprego-formal/sao-paulo/campinas','/economia/cadunico/sao-paulo/campinas','/economia/bpc/sao-paulo/campinas','/economia/gasolina/sao-paulo/campinas','/economia/inflacao','/economia/salario-minimo']){
 const html=await(await fetch(root+path)).text();const graph=[...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].flatMap(m=>JSON.parse(m[1])['@graph']??[]),d=graph.find(s=>s['@type']==='Dataset');
 assert(d.dateModified);assert.equal(d.dateModified,datas.get(path),path+' sitemap/schema');assert(html.includes('Revisão do conteúdo'));assert(html.includes('/correcoes'));
}
for(const path of ['/','/economia','/metodologia','/sobre','/correcoes','/meio-ambiente','/dinheiro']){
 const r=await fetch(root+path);assert.equal(r.status,200,path);const html=await r.text();assert(html.includes(`rel="canonical" href="https://desempenhodogoverno.com.br${path==='/'?'':path}"`) || html.includes(`rel="canonical" href="https://desempenhodogoverno.com.br${path}"`),path+' canonical');assert(!html.includes('noindex'));assert(!/href="\/prototipo(?:[?"/])/.test(html));
}
for(const [corpo,origem,status] of [[{caminho:'//outro.site',descricao:'Descrição do teste suficientemente longa.'},root,400],[{caminho:'/',descricao:'curta'},root,400],[{caminho:'/',descricao:'Descrição do teste suficientemente longa.'},'https://outro.site',403]]){
 const r=await fetch(root+'/api/correcoes',{method:'POST',headers:{'Content-Type':'application/json',Origin:origem},body:JSON.stringify(corpo)});assert.equal(r.status,status);
}
assert.equal((await fetch(root+'/sitemaps/999.xml')).status,404);
assert.equal((await fetch(root+'/sitemaps/01.xml')).status,404);
console.log(`PASSOU: ${hubs.length} panoramas, navegação pública sem protótipo, sete páginas institucionais/temas, datas de revisão no sitemap/schema e validação do formulário.`);

if(process.env.REVALIDATE_TOKEN){
 const assinatura=async()=>(await sql`select md5(string_agg(chave||':'||assinatura||':'||modificado_em::text,',' order by chave)) valor from observatorio.revisao_publicacao`)[0].valor;
 const antes=await assinatura();
 const r=await fetch(root+'/api/revalidate',{method:'POST',headers:{'x-revalidate-token':process.env.REVALIDATE_TOKEN}});assert.equal(r.status,200);
 // Rota dinâmica força a leitura das assinaturas após a invalidação da tag.
 assert.equal((await fetch(root+'/sitemaps/999.xml')).status,404);
 assert.equal(await assinatura(),antes,'reconsulta sem mudança não pode renovar a data editorial');
 console.log('PASSOU: webhook de revalidação funciona e dados idênticos preservam todas as assinaturas e datas de revisão.');
}
