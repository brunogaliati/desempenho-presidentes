// Audita a cobertura de todos os URLs por modelo e verifica HTML/capas dos casos representativos.
// AUDITORIA_URL=https://... node scripts/verificar-identidade-publica.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const raiz=process.env.AUDITORIA_URL??'http://localhost:3000';
const pasta=new URL('../.wrangler/auditoria-identidade/',import.meta.url);await mkdir(pasta,{recursive:true});
const simples=new Set(['/','/explorar','/metodologia','/sobre','/correcoes','/meio-ambiente','/dinheiro']);
function modelo(caminho){
 if(simples.has(caminho))return 'pagina:'+caminho;
 if(/^\/presidente\/[^/]+$/.test(caminho))return 'presidente';
 if(/^\/economia\/municipios(?:\/[^/]+)?$/.test(caminho))return 'diretorio';
 const p=caminho.split('/').filter(Boolean),id=p[1];
 if(['salario-minimo','inflacao'].includes(id)&&p.length===2)return id;
 if(['populacao','emprego-formal','cadunico','bpc'].includes(id)&&p.length>=2&&p.length<=4)return (p.length===4?'municipal:':'panorama:')+id;
 if(['gasolina','desemprego'].includes(id)&&p.length>=2&&p.length<=4)return id+':'+(p[2]==='estados'?'comparacao':p.length);
 throw new Error('Modelo público sem cobertura: '+caminho);
}
async function obter(caminho,opcoes){const r=await fetch(raiz+caminho,{signal:AbortSignal.timeout(60000),...opcoes});assert.equal(r.status,200,caminho+' status');return r;}
const indice=await(await obter('/sitemap.xml')).text(),partes=[...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
const xml=(await Promise.all(partes.map(async p=>(await obter(p)).text()))).join('');
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>{const u=new URL(m[1].replaceAll('&amp;','&'));return u.pathname+u.search;});
const grupos=new Map();for(const url of urls){const tipo=modelo(new URL(url,raiz).pathname);const g=grupos.get(tipo)??[];g.push(url);grupos.set(tipo,g);}
const amostras=new Set();for(const [tipo,g]of grupos){for(const p of tipo==='presidente'?g:[g[0],g.at(-1),g.reduce((a,b)=>a.length>=b.length?a:b)])amostras.add(p);}
const imagens=new Map();
function meta(html,chave){const t=[...html.matchAll(/<meta\b[^>]*>/g)].map(m=>m[0]).find(t=>t.includes(`property="${chave}"`)||t.includes(`name="${chave}"`));return t?.match(/content="([^"]+)"/)?.[1].replaceAll('&amp;','&');}
async function verificar(p){const html=await(await obter(p)).text();assert(html.includes('data-visual="governo-v1"'),p+' visual aprovado');assert.equal([...html.matchAll(/<h1[ >]/g)].length,1,p+' h1');assert(!/(?:href|src)="\/prototipo(?:[/?"])/.test(html),p+' dependência de protótipo');assert(!html.replaceAll('\\"','"').includes('"exemplo":true'),p+' dados de demonstração');assert(!html.includes('data:image/svg+xml'),p+' favicon antigo');assert(html.includes('/icone.svg')&&html.includes('/apple-touch-icon.png'),p+' ícones');
 const og=meta(html,'og:image'),twitter=meta(html,'twitter:image');assert(og&&twitter,p+' capas Open Graph/Twitter');assert.equal(meta(html,'og:image:width'),'1200',p+' largura declarada');assert.equal(meta(html,'og:image:height'),'630',p+' altura declarada');
 for(const valor of [og,twitter]){const u=new URL(valor);assert.equal(u.origin,'https://desempenhodogoverno.com.br');const pathname=new URL(p,raiz).pathname;if(!/^\/(?:presidente\/|economia\/(?:inflacao|salario-minimo)$)/.test(pathname)&&pathname!=='/')assert(u.pathname.startsWith('/compartilhar')||u.pathname.startsWith('/economia/imagens/'),p+' capa contextual');imagens.set(u.pathname+u.search,p);}
}
async function lote(itens,fn){for(let i=0;i<itens.length;i+=3)await Promise.all(itens.slice(i,i+3).map(fn));}
await lote([...amostras],verificar);
console.log(`PASSOU: ${urls.length} URLs mapeadas em ${grupos.size} modelos; ${amostras.size} páginas representativas com visual aprovado, H1, ícones e capas contextuais.`);
let maiorImagem=0;
await lote([...imagens],async([p,pagina])=>{const r=await obter(p);assert(r.headers.get('content-type')?.includes('image/png'),p);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a',p);assert.equal(b.readUInt32BE(16),1200,p);assert.equal(b.readUInt32BE(20),630,p);assert(b.length>3000,p);maiorImagem=Math.max(maiorImagem,b.length);const nome=modelo(new URL(pagina,raiz).pathname).replaceAll(/[^a-z0-9-]/g,'-')+'-'+new URL(pagina,raiz).pathname.replaceAll(/[^a-z0-9-]/g,'-');await writeFile(new URL(nome+'.png',pasta),b);});
console.log(`PASSOU: ${imagens.size} capas PNG válidas em 1200×630; maior arquivo ${Math.round(maiorImagem/1024)} KiB.`);
for(const [p,n]of [['/icone-32.png',32],['/icone-192.png',192],['/icone-512.png',512],['/apple-touch-icon.png',180]]){const b=Buffer.from(await(await obter(p)).arrayBuffer());assert.equal(b.readUInt32BE(16),n,p);assert.equal(b.readUInt32BE(20),n,p);}
const ico=Buffer.from(await(await obter('/favicon.ico')).arrayBuffer());assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
const naoEncontrada=await fetch(raiz+'/pagina-inexistente-auditoria',{signal:AbortSignal.timeout(30000)});assert.equal(naoEncontrada.status,404);assert((await naoEncontrada.text()).includes('data-visual="governo-v1"'));
assert.equal((await fetch(raiz+'/compartilhar?pagina=/nao-publicada')).status,404);
for(const [agente,p]of [['facebookexternalhit/1.1','/'],['Twitterbot/1.0','/economia/inflacao'],['WhatsApp/2.0','/economia/populacao/sao-paulo/campinas']]){
 const html=await(await obter(p,{headers:{'user-agent':agente}})).text();assert(html.split('</head>')[0].includes('property="og:image"'),agente+' imagem no HTML inicial');
}
await writeFile(new URL('cobertura.json',pasta),JSON.stringify({total:urls.length,modelos:Object.fromEntries([...grupos].map(([k,g])=>[k,g.length])),amostras:amostras.size,capas:imagens.size,maiorImagem},null,2));
console.log('PASSOU: ícones PNG/Apple/ICO, página 404 com a identidade do site e rejeição de capas para URLs não publicadas.');
console.log('PASSOU: leitores de links do WhatsApp, Facebook e X recebem a capa no head, sem JavaScript.');
