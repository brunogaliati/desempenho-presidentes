# Desempenho do Governo

![Desempenho do Governo](https://img.shields.io/badge/Status-Em%20Desenvolvimento-brightgreen)

Uma plataforma interativa para visualização e comparação de indicadores econômicos durante diferentes governos brasileiros.

## SEO e páginas de indicadores

A rota `/economia/salario-minimo` entrega resposta, fontes e tabelas no HTML,
com histórico mensal, comparação nominal/real e imagem própria de compartilhamento.
Os dados vêm do Neon, com revalidação a cada hora e pelo webhook existente.
O histórico começa em 1995 e exclui meses futuros. O poder de compra reutiliza
a série real calculada pelo backend e informa o mês-base do IPCA.

A rota `/economia/inflacao` apresenta IPCA mensal, no ano e em 12 meses,
comparação de intervalos, tabela mensal completa desde julho de 1994 e anual
desde 1995. Os acumulados compõem fatores e preservam lacunas. Tem canônica,
JSON-LD, imagem de compartilhamento, entrada no sitemap e revalidação próprios.
As páginas herdam o visual do protótipo pelo layout de Economia:
cabeçalho, marca, fontes Geist, paleta, paisagem, painéis de vidro e tema escuro.

Também estão disponíveis `/economia/desemprego`, `/economia/gasolina` e
`/economia/desemprego/estados`. O desemprego nacional usa trimestre móvel;
a comparação estadual usa trimestre civil e mostra o CV da estimativa.
Gasolina usa médias mensais nominais da ANP, com o agregado Brasil da fonte.

### Publicação em escala

`src/lib/catalogoEconomia.ts` cadastra as cinco intenções principais e os
recortes aprovados. Esse cadastro alimenta navegação, geração estática e sitemap.
As três páginas novas e futuros recortes usam a rota `[...pagina]`, o mesmo
modelo de apresentação, dados estruturados e imagens em `/economia/imagens/…`.
Salário mínimo e inflação mantêm seus cálculos e apresentações específicos.

Para publicar um recorte estadual, adicionar a `RECORTES_PUBLICADOS`, após
revisão editorial e de demanda, por exemplo:

```ts
{ indicador: "gasolina", codigo: "29", nome: "Bahia", slug: "bahia", localizacao: "na Bahia" }
```

O catálogo cobre as 27 UFs nas duas famílias (54 páginas estaduais) e 305
municípios com gasolina mensal da ANP: 364 páginas de indicadores nesse catálogo.
O catálogo municipal adicional descrito abaixo amplia o total para 12.795 páginas
de indicadores, além de 70 diretórios. As UFs são cadastradas uma vez e compartilhadas pelas duas famílias;
cada página continua sujeita à validação real da sua própria fonte. Cada endereço
segue `/economia/{indicador}/{estado}`, com metadados, imagem, comparação com o
Brasil, histórico e entrada no sitemap próprios. As páginas principais e tabelas
estaduais oferecem links para os recortes; São Paulo e Rio explicitam o estado,
evitando confusão com a capital. O cadastro inclui a preposição em `localizacao`.
Os municípios usam `/economia/gasolina/{estado}/{municipio}`, evitando colisão
entre capital e UF e entre homônimos. As páginas estaduais levam às cidades da
UF; cada cidade liga ao estado, ao Brasil e a outras cidades da mesma UF. A
navegação estadual é alfabética; a municipal prioriza população como proxy de
alcance. A pesquisa de busca e suas limitações constam da seção 16 de
`docs/SEO-AEO-GEO-OBSERVATORIO.md`.
Desemprego territorial reutiliza a PNAD trimestral, nunca o trimestre móvel
nacional. O código e o nome precisam corresponder ao cadastro da fonte.

O carregador exige as últimas 12 observações mensais ou quatro trimestrais
completas, sem transformar ausência em zero. URLs desconhecidas, aliases do
mesmo território e colisões são recusados; recortes sem nenhuma janela histórica válida não são gerados nem entram no sitemap. Recortes publicados preservam a última janela consistente quando a divulgação seguinte está incompleta. Filtros do gráfico não criam URLs novas.
Os dois indicadores com páginas específicas já passam pelas suas validações de dados.

`src/lib/dadosEconomiaPublica.ts` mantém cache horário por fonte, compartilhado
entre os recortes com a tag `painel-economia`. Os agregados compartilham consulta
por fonte; os dados municipais compartilham consulta por UF. O webhook invalida a tag e toda a árvore `/economia`, incluindo
imagens, em vez de manter uma lista manual de caminhos para cada nova página.

Gasolina municipal tem adaptador próprio para `mart.gasolina_municipal`, com
cache por UF para respeitar o limite do Next e evitar consultas por cidade.
O catálogo é gerado, de forma revisável, por
`node --env-file=.env.local scripts/cadastrar-municipios-gasolina.mjs` após a carga
oficial `python -m desempenho anp_municipios` no backend. O script exige 12 meses
consecutivos com preço e amostra válidos, até a referência comum com o Brasil.
`src/lib/municipiosGasolina.ts` guarda somente o cadastro; valores e datas vêm da
fonte no banco. O cadastro novo exige cobertura atual. Em endereços já aprovados, o carregador conserva a última janela válida e mostra um aviso se estiver defasada em relação à fonte. A verificação de publicabilidade é sequencial para preencher
o cache antes do próximo recorte e não multiplicar consultas idênticas ao banco.
Desemprego permanece nacional/estadual: não recebe páginas municipais sem fonte.
Novos indicadores ou fontes exigem um adaptador e
revisão das unidades, frequência, regras de cobertura e texto de interpretação.
O sitemap é um índice em `/sitemap.xml`, com partes em `/sitemaps/{id}.xml` de até 4.000 URLs.

### Outros indicadores municipais

`src/lib/catalogoMunicipal.ts` e `municipiosIndicadores.json` cadastram 12.431
URLs adicionais: população (5.571), emprego formal/Caged (5.570), CadÚnico (645)
e BPC (645). Os dois últimos usam a cobertura municipal paulista da Fundação
Seade. Não há publicação de Bolsa Família com total atual ausente nem de taxa
municipal de desemprego inferida do Caged.

`mart.publicacao_indicador_municipal`, definida em `backend/sql/079_publicacao_municipal.sql`,
centraliza os critérios: dois anos recentes de população positivos; 12 meses
completos de emprego com estoque, admissões, desligamentos e saldo consistente;
12 meses de CadÚnico/BPC com campos documentados e contagens consistentes.
Depois de atualizar as fontes, executar
`node --env-file=.env.local scripts/cadastrar-indicadores-municipais.mjs` e revisar
o JSON gerado. Valores e datas continuam vindo do banco; a cobertura é revalidada
em bloco para o sitemap e na leitura de cada página.

As rotas seguem `/economia/{populacao|emprego-formal|cadunico|bpc}/{uf}/{municipio}`.
São renderizadas no primeiro acesso, com ISR horário; quatro cidades de maior
população por família são pré-geradas no build. Isso evita gerar mais de 12 mil
páginas em toda implantação. O adaptador compartilha blocos pelo prefixo de quatro
dígitos do código IBGE, com até 100 municípios, para respeitar o limite do cache.
Tudo usa a tag e o webhook de invalidação já existentes.

`/economia/municipios` permite escolher a UF. Os diretórios estaduais mostram até
100 cidades por página e ligam a todas as URLs elegíveis. Páginas subsequentes têm
canônica própria e entram no sitemap; busca por texto recebe `noindex,follow` e
canônica do diretório. A lista prioriza população como proxy de alcance, sem
afirmar volume de busca medido. Links de indicadores do diretório não disparam
pré-carregamento de centenas de páginas. O cadastro completo fica no servidor.

Verificação de integração reutilizável:
`node --env-file=.env.local scripts/verificar-indicadores-municipais.mjs`.
Por padrão usa `http://localhost:3000`; execute contra o build de produção com indexação habilitada. `SEO_PREVIEW_URL` permite outra origem.
Confere cobertura e descoberta de todas as URLs, sitemap e diretórios, amostra
de todas as UFs com valores e imagens, limites de publicação e rotas existentes.
Pesquisa e validação estão registradas na seção 17 do documento SEO na raiz.

- `SITE_URL`: origem canônica de produção; padrão `https://desempenhodogoverno.com.br`.
- `SEO_INDEXING=false`: desativa indexação em homologação. Desenvolvimento e
  `VERCEL_ENV=preview` recebem `noindex` automaticamente, mesmo com `SEO_INDEXING=true`.
- `GOOGLE_SITE_VERIFICATION` e `BING_SITE_VERIFICATION`: tokens públicos opcionais.
- `/robots.txt` e `/sitemap.xml`: gerados pelo Next.js; previews não listam URLs.
  URLs antigas de protótipo ficam fora do sitemap e redirecionam com 308.
- JSON-LD: organização/site; página, breadcrumbs e dataset de cada indicador.
- `npm run test:seo`: testes das regras de dados, catálogo, publicação, canônicas, indexação e JSON-LD
  usando o runner nativo do Node (Node 24 ou versão com suporte a TypeScript).

Após publicar, cadastrar/verificar o domínio no Search Console e Bing Webmaster
Tools e enviar `/sitemap.xml`. Tokens, cadastro externo, inspeção da URL pública
e eventual acesso dos crawlers pela CDN não são configurados automaticamente.
A marcação não garante indexação ou citação por IA.

### Revisão da arquitetura de SEO — novembro de 2026

O centro `/economia` conecta os indicadores e diretórios. Há 60 panoramas novos
para população, emprego formal, CadÚnico e BPC (quatro famílias e 56 recortes de UF).
Cada município aponta para indicador → UF → município; os endereços antigos são
preservados. O menu público usa links HTML para `/economia`, `/meio-ambiente` e
`/dinheiro`, sem depender de páginas de protótipo não indexáveis.

A página inicial `/` usa o painel definitivo com mapa, seleção de mandato,
estados e comparação entre governos. Os componentes/dados compartilhados ficam
na pasta privada `src/app/_painel`; as APIs ficam em `/api/painel` e os arquivos
estáticos em `/painel`. `/prototipo` e `/prototipo-2` são apenas redirecionamentos
permanentes para `/`, `/meio-ambiente` ou `/dinheiro`, preservando UF e mandato.
As URLs antigas de APIs e recursos também redirecionam. Os mapas municipais e
de áreas protegidas não dependem mais da variável `PROTOTIPO` em produção.

Promoção validada em 4/11/2026: 102 testes de dados/SEO/links, lint e build do
Worker aprovados; conferência visual em desktop e celular, tema e navegação com
preservação de UF. A integração no domínio oficial passou com a home definitiva,
cinco redirects HTTP 308, quatro APIs públicas, 59 páginas/imagens, 60 panoramas,
12.937 URLs no sitemap e webhook sem alteração indevida das datas. A versão
do Worker nessa promoção foi `7a725677-fb67-47c6-accb-cf44ecda3f51`. O build usa uma página
por vez (`cpus: 1`, `staticGenerationMaxConcurrency: 1`): a tentativa concorrente
encontrou falta de memória no Neon; a geração final terminou sem esses erros.

A revisão posterior unificou as páginas de presidentes, erros e 404, retirou
dados demonstrativos do carregamento público e padronizou ícones e capas de links.
Cobertura, verificações e comandos estão em [Identidade pública](docs/IDENTIDADE-PUBLICA.md).

Aplicar `backend/sql/080_publicacao_seo.sql` antes de implantar esta versão.
A visão `mart.historico_publicavel_municipal` preserva a última janela completa;
a visão 079 continua sendo o critério mais estrito para aprovar recortes novos.
Comparações municipais usam a mesma UF, período e unidade; agregados de UF/Brasil
são os publicados na fonte. CadÚnico e BPC mantêm cobertura paulista, sem total
nacional inferido.

`observatorio.revisao_publicacao` registra assinatura dos valores e a revisão
editorial (`REVISAO_EDITORIAL` em `src/lib/revisoesPublicadas.ts`). Coleta e horários
de consulta ficam fora da assinatura. A mesma assinatura não renova `modificado_em`.
Ao alterar texto ou estrutura relevante, atualizar a revisão editorial. O registro
começou nesta implantação; não tenta reconstruir datas históricas. Sitemap e
`dateModified` usam a mesma revisão. Os panoramas usam a revisão mais recente das
páginas que apresentam. Painéis temáticos sem assinatura de todos os seus dados
omitem `lastmod`, em vez de usar o horário de coleta.

`/sobre` identifica o projeto e declara que o responsável individual e um contato
público ainda não foram definidos. `/correcoes` registra relatos anônimos no banco,
sem solicitar nome, e-mail ou documento. Não envia e-mail nem promete atendimento.
Para acompanhar os relatos, consultar `observatorio.correcao_site` por `criado_em`
e atualizar `situacao` (`recebida`, `em_analise`, `concluida`) após análise; não tornar
os relatos públicos, pois podem conter texto pessoal apesar da orientação.

Core Web Vitals: `NEXT_PUBLIC_WEB_VITALS=true` habilita o hook nativo do Next e o
endpoint `/api/metricas-web`. Requer novo build. CLS, INP, LCP, FCP e TTFB são
registrados como JSON nos logs da hospedagem, por caminho, sem cookies, query ou
identificador de visitante. O padrão é desativado. A instalação não constitui uma
medição de campo: habilitar em produção e observar amostra suficiente antes de
concluir sobre desempenho. Nenhuma aprovação de Core Web Vitals ou posição de busca
é inferida do build local.

## 📊 Sobre o Projeto

Este projeto apresenta uma análise visual dos principais indicadores econômicos do Brasil durante diferentes mandatos presidenciais, permitindo aos cidadãos comparar o desempenho econômico de cada governo de forma objetiva e transparente.

### Indicadores Disponíveis

- **Inflação (IPCA)**: Índice acumulado durante o período do mandato
- **Taxa de Câmbio (Dólar)**: Variação da taxa PTAX calculada pelo Banco Central
- **Taxa SELIC**: Variação da taxa básica de juros da economia brasileira
- **Desemprego**: Variação da taxa de desemprego medida pela PNAD Contínua (IBGE)

## 🚀 Funcionalidades

- Visualização de indicadores econômicos por presidente
- Comparação direta entre diferentes governos
- Dashboard interativo com gráficos temporais
- Gráficos de radar para análise multidimensional
- Compartilhamento de métricas específicas nas redes sociais

## 💻 Tecnologias Utilizadas

- [Next.js 15](https://nextjs.org/) - Framework React com renderização híbrida
- [React 19](https://react.dev/) - Biblioteca para construção de interfaces
- [TypeScript](https://www.typescriptlang.org/) - Superset tipado de JavaScript
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS utilitário
- [Recharts](https://recharts.org/) - Biblioteca de gráficos para React
- [Google Sheets API](https://developers.google.com/sheets/api) - Fonte de dados

## 🛠️ Como Executar

### Pré-requisitos

- Node.js (versão 18 ou superior)
- Yarn ou npm

### Configuração

1. Clone o repositório:

   ```bash
   git clone https://github.com/seu-usuario/desempenho-do-governo.git
   cd desempenho-do-governo
   ```

2. Instale as dependências:

   ```bash
   yarn install
   # ou
   npm install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

   ```
   DATABASE_URL=postgresql://...
   REVALIDATE_TOKEN=...
   SITE_URL=https://desempenhodogoverno.com.br
   ```

4. Execute o servidor de desenvolvimento:

   ```bash
   yarn dev
   # ou
   npm run dev
   ```

5. Acesse `http://localhost:3000` no seu navegador.

## 📝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests com melhorias.

1. Faça um fork do projeto
2. Crie sua branch de feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 📊 Fonte dos Dados

Os dados utilizados neste projeto são obtidos de fontes oficiais como Banco Central do Brasil e IBGE, através de coletores do backend e armazenados no PostgreSQL/Neon.

---

Desenvolvido com ❤️ para promover transparência e análise objetiva dos indicadores econômicos brasileiros.


## Hospedagem no Cloudflare Workers

O frontend usa `@opennextjs/cloudflare` (OpenNext) e Wrangler. O Next foi atualizado
para o patch 15.5.29 exigido pelo adaptador; a aplicação continua usando Next 15.
`open-next.config.ts` configura cache incremental em R2, fila de revalidação e tags
em Durable Objects. O cache regional adicional fica desligado para que o webhook
não dependa de um segundo mecanismo de purge. `wrangler.jsonc` declara o Worker
`desempenho-do-governo`, bucket `desempenho-do-governo-cache`, assets e bindings.
O Neon continua sendo o banco dos dados oficiais; R2 armazena apenas cache.

Comandos, na raiz deste repositório:

```sh
npm ci
npm run build:worker
npm run preview:worker
# Depois de autenticar e configurar as variáveis da conta:
npm run deploy:worker
```

O preview usa a porta 3000 e deve substituir o servidor Next durante o teste,
sem manter dois servidores. O deploy utiliza o pacote já gerado por `build:worker`
e o comando OpenNext inicializa os caches. Um `wrangler deploy` isolado não substitui
esse fluxo. Artefatos `.open-next`, `.wrangler` e arquivos de segredos locais não
são versionados. As fontes das imagens são servidas pelo binding ASSETS no Worker
e lidas de `public/fontes` durante builds ou execução em Node.

Para deploy automático em **Workers & Pages → Workers Builds**, conectar
`brunogaliati/desempenho-presidentes`, branch `main`, diretório raiz `/`.
Build command: `npm run build:worker`. Deploy command: `npm run deploy:worker`.
Usar Node 24 (variável de build `NODE_VERSION=24`) e npm. Os segredos precisam ser
cadastrados no painel, sem publicá-los no Git:

- Build: `DATABASE_URL` como segredo; `SITE_URL`, `SEO_INDEXING=true` e, se desejado,
  `NEXT_PUBLIC_WEB_VITALS` e tokens públicos de verificação.
- Runtime: `DATABASE_URL` e `REVALIDATE_TOKEN` como segredos. Os valores públicos
  principais já estão em `wrangler.jsonc`; o deploy preserva variáveis do painel.
- Backend no GitHub: `REVALIDATE_URL=https://desempenhodogoverno.com.br/api/revalidate`
  e `REVALIDATE_TOKEN` igual ao segredo do Worker.

Antes do primeiro deploy em outra conta, autenticar com `npx wrangler login` e
habilitar/criar o bucket R2. Os Durable Objects são provisionados pela migração
`v1` do Wrangler. Na conta de produção, o bucket e os segredos já estão cadastrados.

Validação da adaptação: build do Worker, lint, 30 testes SEO/dados e simulação de
deploy aprovados. O carregador compartilhado das imagens usa ASSETS no Worker;
as quatro partes do sitemap são pré-geradas e a elegibilidade usa cache por fonte.
O npm audit ainda sinaliza dependências transitivas (incluindo ferramentas de build
e o PostCSS interno do Next 15); as correções compatíveis foram aplicadas, sem usar
`audit fix --force`, que propõe downgrade do adaptador e mudança de versão principal.
Não se declara aprovação integral de segurança a partir desses testes funcionais.


### Produção validada em 4 de novembro de 2026

Site publicado em **https://desempenhodogoverno.com.br**, também acessível por
`www.desempenhodogoverno.com.br`. O endereço workers.dev continua habilitado.
O titular ativou o Workers Paid (US$ 5/mês + uso excedente); o domínio/DNS continua
no plano gratuito. `limits.cpu_ms=5000` limita o processamento por requisição.
O plano Workers Free havia interrompido requisições com erro 1102 (`exceededCpu`).

Com autorização do titular, os nameservers no Registro.br foram substituídos por
`dayana.ns.cloudflare.com` e `kaiser.ns.cloudflare.com`. A zona está **ativa** e
a delegação foi confirmada no DNS público e no RDAP. Os dois registros A importados
continuam com proxy e o Worker atende os dois hosts por **Worker Routes**,
versionadas em `wrangler.jsonc`. Custom Domain encontrou conflito com os registros
importados e não foi usado. O certificado universal está ativo e a opção
**SSL/TLS → Certificados de borda → Sempre usar HTTPS** está habilitada.

A integração remota completa passou no workers.dev e no domínio oficial:
12.937 URLs únicas no sitemap, 12.431 páginas municipais descobertas pelos 70
diretórios, 59 páginas/imagens com valores conferidos na fonte, 60 panoramas,
limites/404, navegação pública, metadados e webhook de revalidação. Dados idênticos
preservaram todas as revisões e datas editoriais. O robots.txt permite rastreamento
e aponta para o sitemap canônico. A página de inflação foi conferida no navegador.

Durante a troca, o resolvedor local ainda retornava o IP antigo para o domínio
principal. O teste completo usou o IP obtido do DNS público apenas no processo de
validação, mantendo a verificação normal do certificado e do hostname; o DNS do
sistema não foi alterado. A propagação dos caches de outros resolvedores pode
terminar depois da publicação. Não se declara indexação no Google, métricas reais
de Core Web Vitals ou deploy automático pelo GitHub como concluídos nesta etapa.

### Imagens dos recortes compartilhados

As seções dos painéis geram PNGs com tabelas, séries, barras, treemap e mapas dos dados oficiais, pelos filtros validados do link. `visualizacaoSecao.ts` monta a representação; `ImagemDadosSecao.tsx` desenha a imagem. Grade, ritmos, Caged, temporadas e seletores de orçamento reutilizam modelos do painel. As consultas adicionais usam os mesmos carregadores das APIs públicas.

Tabelas extensas mostram as primeiras sete linhas na ordem selecionada e identificam o total; o link abre o componente completo. A URL da imagem inclui somente os filtros da seção e uma versão de conteúdo, para separar os recortes no cache. Ano e período calculados são preservados mesmo quando o estado interno usa `null` como padrão.

Validação: `node --test scripts/test-secoes-visuais.mjs scripts/test-compartilhamento.mjs` e `node scripts/test-capa-recorte.mjs` contra o servidor ou Worker em 3000 (`BASE` muda a origem). A integração compara os PNGs de quinze pares de filtros. `CAPAS_DIR` permite salvar as imagens para inspeção.

## Google Analytics 4

Fluxo web público: `G-DSETD1YL9C`, propriedade Desempenho do Governo, na conta do projeto.
`src/components/Analytics.tsx` fica no layout raiz. A tag só carrega nos hosts públicos,
em produção e após permitir estatísticas. A escolha pode ser alterada no rodapé;
a revogação remove os cookies e recarrega a página para encerrar a biblioteca.

A medição otimizada está desativada no fluxo GA4. As visualizações são enviadas
manualmente por mudança de caminho, sem query, fragmento ou duplicação por filtro.
Não ativar simultaneamente o rastreamento automático de histórico no GA4.
Publicidade e Google Signals ficam desativados. Cookies configurados para 180 dias;
a política está em `/sobre#privacidade`. O identificador da propriedade é público.

Verificação: `node --test scripts/test-analytics.mjs`, lint, TypeScript e build do Worker.
Em produção, conferir recusa sem carregar tag, aceite com `page_view`, navegação
entre temas, filtro sem nova visualização e revogação com remoção dos cookies.
