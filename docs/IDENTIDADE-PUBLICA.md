# Identidade visual e compartilhamento — 4/11/2026

Publicado no Worker `3a02525e-8a8a-4199-b8bf-ed192c64fc94` em
https://desempenhodogoverno.com.br.

## Cobertura das páginas

O inventário classificou todas as 12.937 URLs do sitemap em 25 modelos, sem
endereços sem modelo identificado. A inspeção de HTML e imagens utilizou
51 amostras: primeira, última e endereço mais longo de cada grupo, além de
todas as cinco páginas de presidentes. Não foi uma inspeção manual individual
de cada URL municipal.

| Família publicada | URLs | Estrutura de produção |
| --- | ---: | --- |
| Painéis: Brasil, Meio ambiente e Dinheiro | 3 | Painel público com mapa/terminal e navegação por tema |
| Centro Economia, Metodologia, Sobre e Correções | 4 | Cabeçalho, fontes, paleta e painéis compartilhados |
| Indicadores nacionais e comparação de desemprego por UF | 5 | Modelos públicos de indicadores |
| Gasolina e desemprego por estado | 54 | Mesmo modelo público com dados da UF |
| Gasolina por município | 305 | Modelo público com dados municipais |
| Panoramas por indicador e UF | 60 | Coleções de indicadores com identidade compartilhada |
| População, emprego formal, CadÚnico e BPC municipais | 12.431 | Modelos municipais com fontes e períodos identificados |
| Diretórios municipais, incluindo paginação | 70 | Diretório público no mesmo layout |
| Presidentes | 5 | Cabeçalho aprovado, navegação entre pessoas, painéis e gráficos com a mesma paleta |

As cinco páginas de presidentes eram o grupo ainda com cabeçalho e apresentação
antigos. Foram migradas sem alterar os cálculos ou os mandatos apresentados.
Os estados de erro e a página 404 também usam a identidade do site. A navegação
institucional não marca Economia como se fosse a página corrente.

## Dependências de demonstração

As URLs de protótipo permanecem somente como redirects permanentes de
compatibilidade. O carregamento público deixou de importar o gerador de
alinhamento político, emendas demonstrativas e feed fictício. O cache do painel
foi versionado para impedir reutilização desse payload. O caminho inativo do
painel de Congresso foi retirado do componente público; essa aba continua
indisponível. Dinheiro usa a API real do orçamento e das transferências.

## Ícones e capas

- Marca vetorial em `public/icone.svg`, PNGs de 32, 192 e 512 px, Apple Touch
  Icon de 180 px e ICO com 16/32/48 px. Regerar: `node scripts/gerar-icones.mjs`.
- Um renderizador de capas usa a marca, a paisagem do cabeçalho e a malha real
  das UFs do IBGE. As fontes Inter são locais e compatíveis com o Worker.
- Indicadores conservam valor, unidade, referência e fonte. Presidentes mostram
  mandatos separados, sem apresentar períodos descontínuos como governo único.
- Institucionais, temas, diretórios e panoramas têm capas contextuais.
- Open Graph e Twitter usam imagens de 1200×630, texto alternativo e URLs de
  imagem versionadas. As 51 capas amostradas renderizaram PNGs válidos; a maior
  tinha 93 KiB. Os leitores de links testados receberam `og:image` no `head` do
  HTML inicial, sem JavaScript.

## Validação

103 testes de dados, cálculos, SEO e metadados passaram. Lint sem erros ou
avisos, build do Worker aprovado e detector visual sem ocorrências nos arquivos
inspecionados. Conferência visual em desktop e celular, incluindo tema escuro,
tipografia Geist, navegação e títulos longos nas capas.

Na versão publicada passaram a auditoria de identidade e a integração de dados:
70 diretórios, 59 páginas/imagens com valores conferidos na fonte, 60 panoramas,
limites/404, redirects, formulário, sitemap/schema e webhook com preservação das
datas de revisão. As capas foram verificadas por HTTP e por renderização; o
resultado não depende de publicar mensagens em redes sociais.

Reexecutar contra o preview na porta 3000 ou definir `AUDITORIA_URL`:

```sh
node scripts/verificar-identidade-publica.mjs
```

O script salva o inventário e as capas amostradas em
`.wrangler/auditoria-identidade/`, fora do Git.
