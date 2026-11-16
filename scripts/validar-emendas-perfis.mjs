/** node --env-file=.env.local scripts/validar-emendas-perfis.mjs [origem] [--falhas]
 * Confere todos os perfis da fotografia contra os marts, com duas requisições por vez.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const origem = new URL(process.argv[2] ?? 'http://localhost:3000');
const arquivo = new URL('../.cache/validacao-emendas-perfis.json', import.meta.url);
const anterior = process.argv.includes('--falhas') ? JSON.parse(await readFile(arquivo, 'utf8')) : null;
if (anterior && anterior.origem !== origem.origin) throw new Error('A origem deve ser a mesma da primeira rodada');
const sql = neon(process.env.DATABASE_URL);
const foto = JSON.parse(await readFile(new URL('../src/app/_painel/_dados/fotografia.json', import.meta.url), 'utf8'));
const ate = new Date().getFullYear();
const [municipios, recebimentos, planos, documentos] = await Promise.all([
  sql`select casa,parlamentar_id as id,uf,codigo_municipio as codigo,fase,
    case when count(valor)=count(*) then sum(valor) end::text as valor
    from mart.emendas_municipios where ano_emenda between 2014 and ${ate} and parlamentar_id is not null
    group by casa,parlamentar_id,uf,codigo_municipio,fase`,
  sql`select casa,parlamentar_id as id,uf,codigo_municipio as codigo,
    case when count(valor_pago)=count(*) then sum(valor_pago) end::text as valor
    from mart.emendas_parlamentar_municipio_recebido where ano_emenda between 2014 and ${ate}
      and tipo_destinatario='administracao_municipal' and codigo_municipio is not null
    group by casa,parlamentar_id,uf,codigo_municipio`,
  sql`select casa,parlamentar_id as id,uf,count(*)::int as n from mart.emendas_planos
    where ano_emenda between 2014 and ${ate} group by casa,parlamentar_id,uf`,
  sql`select casa,parlamentar_id as id,count(*)::int as n from mart.emendas_sem_municipio
    where ano_emenda between 2014 and ${ate} group by casa,parlamentar_id`,
]);
const indexar = linhas => {
  const mapa = new Map();
  for (const r of linhas) { const k = `${r.casa}:${r.id}`; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(r); }
  return mapa;
};
const [exec, receb, previstos, docs] = [municipios, recebimentos, planos, documentos].map(indexar);
const perfis = Object.entries(foto).filter(([c]) => ['deputados','senadores'].includes(c))
  .flatMap(([casa, pessoas]) => pessoas.map(p => ({ ...p, casa, chave: `${casa === 'deputados' ? 'camara' : 'senado'}:${p.id}` })));
const consultar = anterior ? perfis.filter(p => anterior.falhas.some(f => f.casa === p.casa && f.id === p.id)) : perfis;
if (anterior && anterior.total !== perfis.length) throw new Error('A fotografia mudou; execute uma nova rodada completa');
const centavos = v => Math.round(Number(v) * 100);
const soma = (ls, campo = 'valor') => ls.reduce((s,r) => s + (r[campo] == null ? 0 : centavos(r[campo])), 0);
const medida = ls => ls.some(r => r.valor === null) ? null : soma(ls);
const falhas = [], semExecucao = anterior?.semExecucao ?? [], semMunicipios = anterior?.semMunicipios ?? [];
let proximo = 0, concluidos = 0;
const inicio = Date.now();
await Promise.all(Array.from({ length: 2 }, async () => {
  while (proximo < consultar.length) {
    const p = consultar[proximo++];
    try {
      const url = new URL('/api/painel/congresso/emendas', origem);
      url.search = new URLSearchParams({ casa: p.casa, id: String(p.id), ano: 'historico' });
      const resposta = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (resposta.status !== 200) throw new Error(`HTTP ${resposta.status}`);
      const d = await resposta.json(), ls = exec.get(p.chave) ?? [];
      const conferir = (ok, motivo) => { if (!ok) throw new Error(motivo); };
      conferir(d.uf === p.uf && d.desde === 2014 && d.ate === ate, 'UF ou período divergente');
      conferir(d.coletadoEm && d.coletadoEmPlanos && d.coletadoEmSemMunicipio, 'proveniência incompleta');
      const locais = ls.filter(r => r.codigo && r.uf === p.uf);
      conferir(d.aplicacao.length === new Set(locais.map(r => r.codigo)).size, 'quantidade de municípios divergente');
      conferir(new Set(d.aplicacao.map(r => r.codigo)).size === d.aplicacao.length, 'município repetido');
      for (const [fase,campo] of [['Empenho','destinado'],['Pagamento','pago']]) {
        conferir(soma(d.aplicacao,campo) === soma(locais.filter(r => r.fase === fase)), `soma municipal de ${fase} divergente`);
        for (const m of d.aplicacao) {
          const esperados = locais.filter(r => r.codigo === m.codigo && r.fase === fase);
          const esperado = esperados.length ? medida(esperados) : null;
          conferir((m[campo] === null ? null : centavos(m[campo])) === esperado, `${m.codigo}: ${fase} divergente`);
        }
      }
      const empenhos = ls.filter(r => r.fase === 'Empenho');
      const cobertura = {
        destinadoTotal: empenhos.length ? medida(empenhos) : null,
        destinadoNoEstado: medida(empenhos.filter(r => r.codigo && r.uf === p.uf)),
        destinadoSemMunicipio: medida(empenhos.filter(r => !r.codigo)),
        destinadoForaEstado: medida(empenhos.filter(r => r.codigo && r.uf && r.uf !== p.uf)),
        pagoSemMunicipio: medida(ls.filter(r => r.fase === 'Pagamento' && !r.codigo)),
      };
      for (const [campo,esperado] of Object.entries(cobertura)) conferir((d.cobertura[campo] === null ? null : centavos(d.cobertura[campo])) === esperado, `${campo} divergente`);
      const rs = (receb.get(p.chave) ?? []).filter(r => r.uf === p.uf);
      conferir(d.prefeituras.length === new Set(rs.map(r => r.codigo)).size && soma(d.prefeituras,'pago') === soma(rs), 'recebimentos municipais divergentes');
      conferir(d.planos.length === (previstos.get(p.chave) ?? []).filter(r => r.uf === null || r.uf === p.uf).reduce((s,r) => s + r.n,0), 'planos divergentes');
      conferir(d.semMunicipio.length === (docs.get(p.chave)?.[0]?.n ?? 0), 'documentos sem município divergentes');
      const pessoa = { casa: p.casa, id: p.id, nome: p.nome };
      if (!ls.length) semExecucao.push(pessoa);
      if (!d.aplicacao.length) semMunicipios.push(pessoa);
    } catch (e) { falhas.push({ casa:p.casa,id:p.id,nome:p.nome,erro:e.message }); }
    concluidos++;
    if (concluidos % 25 === 0 || concluidos === consultar.length) console.log(JSON.stringify({ concluidos, total:consultar.length, falhas:falhas.length }));
  }
}));
const relatorio = { origem:origem.origin, verificadoEm:new Date().toISOString(), total:perfis.length,
  aprovados:perfis.length-falhas.length, falhas, semExecucao, semMunicipios, segundos:Math.round((Date.now()-inicio)/1000) };
await mkdir(new URL('../.cache/', import.meta.url), { recursive:true });
await writeFile(arquivo, JSON.stringify(relatorio,null,2));
console.log(JSON.stringify(relatorio));
if (falhas.length) process.exitCode = 1;
