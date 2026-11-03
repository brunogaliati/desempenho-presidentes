// node --env-file=.env.local scripts/cadastrar-indicadores-municipais.mjs
import { neon } from '@neondatabase/serverless';
import { writeFile } from 'node:fs/promises';
const sql=neon(process.env.DATABASE_URL);
const rows=await sql`select c.*,p.populacao::float8 populacao
  from mart.publicacao_indicador_municipal c left join lateral (
    select populacao from mart.populacao_estimada p where p.nivel='N6' and p.codigo_ibge=c.codigo_ibge order by ano desc limit 1
  )p on true order by p.populacao desc nulls last,c.nome,c.uf,c.indicador`;
if(!rows.length)throw new Error('Cadastro vazio; arquivo anterior preservado.');
const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const municipios=new Map(),totais={};
for(const r of rows){
 const m=municipios.get(r.codigo_ibge)??{codigo:r.codigo_ibge,nome:r.nome,slug:slug(r.nome),uf:{codigo:r.codigo_uf,nome:r.nome_uf,sigla:r.uf,slug:slug(r.nome_uf)},indicadores:[]};
 if(m.indicadores.includes(r.indicador))throw new Error('Observação duplicada no cadastro.');
 m.indicadores.push(r.indicador);municipios.set(r.codigo_ibge,m);totais[r.indicador]=(totais[r.indicador]??0)+1;
}
const lista=[...municipios.values()];
if(new Set(lista.map(m=>`${m.uf.slug}/${m.slug}`)).size!==lista.length)throw new Error('Slug municipal ambíguo.');
await writeFile(new URL('../src/lib/municipiosIndicadores.json',import.meta.url),JSON.stringify(lista));
console.log(JSON.stringify({municipios:lista.length,paginas:rows.length,indicadores:totais,primeiros:lista.slice(0,8).map(m=>`${m.nome}/${m.uf.sigla}`)}));
