// Executar com node --env-file=.env.local scripts/cadastrar-municipios-gasolina.mjs.
// Atualiza o cadastro revisável; não cria páginas para municípios sem cobertura.
import { neon } from '@neondatabase/serverless';
import { writeFile } from 'node:fs/promises';
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`with referencia as (
  select least(max(mes),(select max(mes) from mart.preco_combustivel_mensal
    where produto='GASOLINA COMUM' and nivel='brasil' and not coalesce(mes_em_andamento,false)
    and mes<date_trunc('month',now() at time zone 'America/Sao_Paulo'))) mes
  from mart.gasolina_municipal where mes<date_trunc('month',now() at time zone 'America/Sao_Paulo')
), aptos as (
  select g.codigo_ibge from mart.gasolina_municipal g cross join referencia r
  where g.mes between r.mes-interval '11 months' and r.mes and g.preco_medio>0 and g.postos>0
  group by g.codigo_ibge having count(distinct g.mes)=12
)
select m.codigo_ibge codigo,m.nome,m.codigo_uf,m.nome_uf,m.uf,
  (select populacao::float8 from mart.populacao_estimada p where p.nivel='N6'
   and p.codigo_ibge=m.codigo_ibge order by ano desc limit 1) populacao
from aptos a join mart.municipio m on m.codigo_ibge=a.codigo_ibge
order by populacao desc nulls last,m.nome,m.uf`;
if (!rows.length) throw new Error('Nenhum município elegível; cadastro anterior preservado.');
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const municipios = rows.map(r => ({codigo:r.codigo,nome:r.nome,slug:slug(r.nome),uf:{codigo:r.codigo_uf,nome:r.nome_uf,sigla:r.uf,slug:slug(r.nome_uf)}}));
if (new Set(municipios.map(m=>m.codigo)).size!==municipios.length || new Set(municipios.map(m=>`${m.uf.slug}/${m.slug}`)).size!==municipios.length) throw new Error('Código ou URL municipal duplicados.');
await writeFile(new URL('../src/lib/municipiosGasolina.ts',import.meta.url),`// Gerado pelo cadastro de cobertura ANP; ordem por população como proxy editorial de alcance.\nexport const MUNICIPIOS_GASOLINA = ${JSON.stringify(municipios,null,2)};\n`);
console.log(JSON.stringify({municipios:municipios.length,primeiros:municipios.slice(0,12).map(m=>`${m.nome}/${m.uf.sigla}`)}));
