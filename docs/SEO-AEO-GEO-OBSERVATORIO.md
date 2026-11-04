# SEO, AEO e GEO — Observatório do Brasil

Estratégia registrada em 26/10/2026, com pesquisa inicial de palavras-chave em 03/11/2026 na seção 11. A pesquisa combina Google Trends, amostra de resultados de busca e viabilidade no código; volumes mensais absolutos e dificuldade orgânica não foram medidos. Não representa implementação ou auditoria do site publicado.

## 1. Objetivo e nomenclatura

Construir um observatório gratuito para acompanhar o governo e a situação do país: economia, legislação, orçamento, meio ambiente e diferenças entre territórios. A busca deve levar as pessoas a respostas específicas, que também funcionem como entradas para explorar o restante do site.

- **SEO — Search Engine Optimization:** melhorar a descoberta e a apresentação do site em mecanismos de busca.
- **AEO — Answer Engine Optimization:** expressão usada para otimização de conteúdo para mecanismos que respondem perguntas.
- **GEO — Generative Engine Optimization:** expressão usada para descoberta e uso de conteúdo em respostas de sistemas generativos.

AEO e GEO têm usos sobrepostos. Não são uma configuração única nem uma garantia de citação. Neste projeto, o trabalho prático é tornar as páginas acessíveis, úteis, verificáveis e fáceis de referenciar por Google, ChatGPT e Claude.

## 2. Estratégia de aquisição

Organizar o crescimento em torno de perguntas reais que os dados conseguem responder: “desemprego na Bahia”, “queimadas no Pará”, “andamento de determinado projeto de lei” e “repasses para meu município”.

O acompanhamento do governo atual é a proposta editorial. As páginas sobre temas e territórios podem continuar úteis ao longo de diferentes governos, preservando os históricos e os critérios de comparação.

Para sustentar patrocínios, medir também quais temas atraem leitores recorrentes e interessados. Volume total de visitas, sozinho, não descreve o valor comercial da audiência.

## 3. Ponto de partida observado no código

Na leitura local feita em 26/10/2026:

- Existem página inicial, páginas por presidente e página de metodologia.
- O frontend tem metadados básicos, idioma `pt-BR` e geração de páginas com revalidação dos dados.
- Há conteúdo textual e tabela, além dos componentes visuais.
- Não foram encontrados arquivos de sitemap ou robots, configuração explícita de URL canônica ou marcação JSON-LD nas buscas realizadas no frontend.
- Ainda não foram encontradas rotas dedicadas a cada indicador e território.

Essas observações não confirmam o comportamento da hospedagem, a indexação real ou o estado atual de uma versão publicada. A presença de componentes de cliente também não significa, por si só, ausência de conteúdo no HTML.

## 4. Grupos iniciais de palavras-chave

**Os termos abaixo são candidatos, sem volumes ou dificuldade medidos.** A prioridade definitiva depende da pesquisa e da disponibilidade dos dados.

| Grupo | Exemplos de buscas | Página e utilidade propostas |
| --- | --- | --- |
| Inflação | inflação acumulada 12 meses; IPCA histórico | Valor mais recente, série histórica, tabela e explicação do período |
| Emprego | desemprego por estado; taxa de desemprego Bahia | Mapa, comparação com Brasil e evolução estadual |
| Poder de compra | salário mínimo descontada inflação; poder de compra por governo | Evolução do salário real e comparação com metodologia consistente |
| Comparação de governos | inflação por governo; desemprego Lula e Bolsonaro | Comparação de períodos e indicadores com limites explícitos |
| Queimadas | queimadas no Pará; mapa de focos de calor | Mapa, período observado e comparação com a mesma época de outros anos |
| Leis | PL [número/ano] andamento; o que muda com [lei] | Identificação, situação, mudanças, etapas e fontes oficiais |
| Dinheiro público | repasses federais para [município] | Valores, origem, finalidade e histórico |
| Crédito | crédito rural por estado; Pronaf recursos liberados | Distribuição territorial e evolução dos recursos |

Não usar “hoje”, “ao vivo” ou “tempo real” se a frequência e a cobertura da fonte não sustentarem essa promessa. Em leis, distinguir projeto em tramitação, aprovação, sanção e vigência. Em meio ambiente, distinguir focos de calor, área queimada e desmatamento.

## 5. Como pesquisar e escolher as oportunidades

1. **Levantar perguntas.** Partir dos temas, dúvidas dos leitores, sugestões de busca e páginas existentes. Não presumir demanda apenas porque conseguimos criar uma integração.
2. **Agrupar pela intenção.** Variações que pedem a mesma resposta devem, em geral, compartilhar uma página. “Desemprego Bahia” e “taxa de desemprego na Bahia” são um exemplo.
3. **Medir demanda.** Consultar as métricas históricas do Planejador de Palavras-chave com localização, período e rede documentados. Registrar estimativas ou faixas exatamente como a ferramenta fornecer.
4. **Examinar sazonalidade.** Comparar termos no Google Trends, usando Brasil e períodos de 12 meses e cinco anos. Separar interesse recorrente de picos eleitorais, climáticos ou noticiosos.
5. **Analisar os resultados existentes.** Inspecionar os primeiros resultados: formato, atualização, profundidade, clareza, fontes, mapas e comparações disponíveis. Registrar o que nossa página acrescentaria.
6. **Priorizar.** Combinar demanda, qualidade da resposta que podemos oferecer, custo de manutenção, possibilidade de retorno do leitor e afinidade com potenciais patrocinadores.

Cuidados de interpretação:

- O Google Trends apresenta interesse relativo de 0 a 100, não volume absoluto. Um zero pode refletir volume insuficiente para exibição.
- A “concorrência” no Planejador se refere a anunciantes, não à dificuldade de ranquear organicamente.
- Volume estimado de buscas não é previsão de visitas. CPC de anúncios também não determina o preço de um patrocínio.
- Não somar indiscriminadamente termos semelhantes: pode haver sobreposição de variantes e de intenção.
- A pesquisa do Google ajuda a descobrir perguntas, mas não mede diretamente quantas pessoas fazem essas perguntas no ChatGPT ou no Claude.

O levantamento pode começar em uma tabela simples:

| Campo | O que registrar |
| --- | --- |
| Busca e grupo | Expressão pesquisada e conjunto de intenção equivalente |
| Demanda | Volume/faixa, ferramenta, localização e data da consulta |
| Sazonalidade | Recorrência, tendência e períodos de pico |
| Resultados atuais | Páginas concorrentes e formatos encontrados |
| Diferencial | Resposta ou ferramenta que podemos oferecer melhor |
| Dados | Fonte, cobertura territorial e periodicidade |
| Destino | Página existente ou URL proposta |
| Valor comercial | Hipótese de público e categoria de patrocinador |
| Prioridade | Fazer primeiro, investigar ou adiar, com justificativa |

## 6. Estrutura de conteúdo e navegação

Cada intenção relevante deve ter uma URL estável, título específico e links a partir das páginas relacionadas. Exemplo de estrutura proposta:

- `/economia/inflacao`
- `/economia/desemprego`
- `/economia/desemprego/bahia`
- `/meio-ambiente/queimadas/para`
- `/legislacao/projetos/[identificador]`
- `/municipios/[identificador]/repasses`

As URLs são exemplos, não rotas já implementadas. O mapa deve permitir acessar páginas de estados e municípios por links comuns. Criar páginas territoriais somente quando houver informação suficiente e útil para aquele recorte.

Modelo de página:

1. Título que corresponda à pergunta do leitor.
2. Resposta curta com indicador, unidade, território e período de referência.
3. Data da última atualização do conteúdo e referência temporal dos dados, sem confundir as duas.
4. Gráfico ou mapa, acompanhado de texto e tabela acessíveis.
5. Comparação histórica ou territorial que ajude a interpretar o número.
6. Fontes oficiais, metodologia e limitações próximas da informação.
7. Links para temas relacionados, download quando disponível e opção de acompanhar atualizações.

Exemplo: **“Desemprego na Bahia: taxa mais recente e evolução”** → último trimestre disponível → comparação com Brasil → histórico → tabela → fonte e limites da pesquisa.

Evitar gerar centenas de páginas que apenas troquem o nome de um lugar ou reformulem a mesma resposta. Preservar a URL principal de indicadores recorrentes; criar arquivos históricos separados quando tiverem utilidade própria.

## 7. Base técnica para busca e IA

- Disponibilizar conteúdo principal no HTML, incluindo os números necessários para entender gráficos e mapas.
- Manter títulos e descrições específicos, URLs estáveis e definição coerente de URLs canônicas.
- Criar sitemap com páginas relevantes e mantê-lo compatível com as URLs publicadas.
- Conferir `robots.txt`, eventuais instruções de não indexação e bloqueios da hospedagem ou CDN.
- Garantir navegação por links, experiência móvel e carregamento adequado.
- Usar dados estruturados quando corresponderem ao conteúdo visível; não tratá-los como garantia de destaque.
- Configurar e verificar a propriedade no Search Console para acompanhar descoberta, indexação e buscas reais.

O Google informa que os fundamentos de SEO continuam válidos nas suas experiências de IA. Não exige um arquivo especial ou uma marcação exclusiva para aparecer nelas. Por isso, `llms.txt` não é prioridade para este plano nem substitui os fundamentos acima.

### Acesso do ChatGPT

- `OAI-SearchBot` é o robô relacionado à descoberta para busca no ChatGPT. Conferir permissão no `robots.txt` e acesso pela infraestrutura.
- `ChatGPT-User` atende determinadas ações iniciadas por usuários e não é o mecanismo que decide inclusão na busca.
- `GPTBot` está relacionado a conteúdo que pode ser usado em treinamento. Sua configuração é independente da permissão de busca.

### Acesso do Claude

- `Claude-SearchBot` está relacionado à busca.
- `Claude-User` acessa conteúdo em resposta a solicitações de usuários.
- `ClaudeBot` está relacionado à coleta para possível treinamento.

Permitir acesso facilita a descoberta, mas não garante indexação, citação ou visitas. Não é necessário confundir autorização de treinamento com presença em respostas baseadas em busca.

## 8. O que pode tornar o conteúdo uma boa referência

A proposta é facilitar a conferência: números com período e unidade, fontes próximas, metodologia pública, histórico de atualizações relevantes e explicações que preservem as incertezas dos dados.

O diferencial do observatório pode ser conectar fontes e tornar comparações compreensíveis: decisão pública, execução financeira e mudança observada. Não atribuir automaticamente ao governo toda variação de um indicador.

Também oferecer razões para visitar a página após ler uma resposta resumida: explorar um mapa, escolher períodos, comparar territórios, consultar a tabela e acompanhar futuras mudanças. Ser citado e receber cliques são resultados diferentes.

## 9. Primeira etapa e medição

Começar com aproximadamente **10–15 páginas úteis de economia e poder de compra**, aproveitando dados existentes. A seleção final deve vir da pesquisa de palavras-chave. Expandir para territórios, meio ambiente e legislação conforme a demanda observada e a capacidade de manter as fontes.

Acompanhar por página e grupo temático:

- Indexação, impressões, cliques, CTR e consultas no Search Console.
- Visitas provenientes de buscadores e referências identificáveis de serviços de IA.
- Uso de comparações, mapas e downloads.
- Inscrições na newsletter e retorno dos leitores.
- Perfil e engajamento por tema, úteis para o mídia kit.

Consultas manuais a IAs podem servir como observações pontuais de citações, mas não como medição completa de presença ou tráfego. Refinar o plano com evidências de desempenho, sem prometer volume ou prazo de crescimento antes da validação.

## 10. Referências

- [Google: recursos de IA e seu site](https://developers.google.com/search/docs/appearance/ai-features).
- [Google: métricas e previsões do Planejador de Palavras-chave](https://support.google.com/google-ads/answer/3022575?hl=pt-BR).
- [Google: interpretação dos dados do Trends](https://support.google.com/trends/answer/4365533?hl=pt-BR).
- [OpenAI: robôs de busca, ações de usuários e treinamento](https://developers.openai.com/api/docs/bots).
- [Anthropic: robôs e controles de acesso](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler).

Documentos relacionados: [monetização](MONETIZACAO-OBSERVATORIO.md) e [APIs e fontes](APIS-E-FONTES-OBSERVATORIO.md).

## 11. Pesquisa de palavras-chave e primeiras cinco páginas

Pesquisa realizada em **03/11/2026**, para conteúdo em português e público brasileiro. A recomendação é começar por **salário mínimo, IPCA, desemprego nacional, gasolina e desemprego por estado**, nessa ordem. As cinco páginas atendem intenções distintas e aproveitam integrações existentes. A ordem é uma decisão de produção e aquisição a testar, não um ranking comprovado de tráfego futuro.

### 11.1 Evidências de procura e limites da medição

No Google Trends foram comparados termos de pesquisa, não tópicos, com localização Brasil, todas as categorias e Pesquisa na Web. A comparação de 12 meses exibiu semanas de 02/11/2025 a 01/11/2026, incluindo a semana final em andamento.

| Termo exato consultado | Média exibida do índice relativo nos últimos 12 meses |
| --- | ---: |
| salário mínimo | 43 |
| taxa de desemprego | 1 |
| ipca acumulado | 2 |
| preço da gasolina | 2 |
| desemprego por estado | 0 |

Fonte: [comparação no Google Trends](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=sal%C3%A1rio%20m%C3%ADnimo,taxa%20de%20desemprego,ipca%20acumulado,pre%C3%A7o%20da%20gasolina,desemprego%20por%20estado), acessada pelo navegador. O link usa uma janela móvel; os números acima registram a consulta desta data.

Essas médias são índices normalizados na mesma comparação, **não buscas mensais, percentuais de pessoas ou estimativas de visitas**. O zero de uma expressão pequena, comparada a uma expressão muito maior, não demonstra ausência de demanda. Tampouco a procura pelo termo amplo comprova a demanda de cada variante longa. [Como interpretar o Trends](https://support.google.com/trends/answer/4365533?hl=pt-BR).

As pesquisas relacionadas mostraram:

- Para salário mínimo: “percentual de aumento do salário mínimo 2026” e “quanto aumentou o salário mínimo 2026”, em ascensão. Também apareceram piso paulista e cálculos ligados à pensão; são intenções diferentes do histórico do piso nacional.
- Para taxa de desemprego: “taxa de desemprego no brasil 2026” e “indice de desemprego no brasil 2026”, em ascensão.
- Para IPCA acumulado: “ipca acumulado 12 meses fevereiro 2026” e consultas por mês, em ascensão. Isso favorece uma tabela mensal em uma URL permanente.
- Para preço da gasolina: “porque o preço da gasolina subiu”, “preço da gasolina subiu?” e “preço da gasolina em 2026”, em ascensão. A pergunta causal exige apuração adicional; a série de preços, sozinha, só confirma a variação.
- Para desemprego por estado: “taxa de desemprego por estado” entre as principais relacionadas.

Uma comparação adicional de cinco anos entre “salário mínimo”, “desemprego”, “IPCA” e “preço da gasolina” mostrou consultas de seguro-desemprego entre as relacionadas a “desemprego”. Portanto, não usar a demanda do termo amplo como se toda ela procurasse o indicador econômico. [Comparação de cinco anos](https://trends.google.com/trends/explore?date=today%205-y&geo=BR&q=sal%C3%A1rio%20m%C3%ADnimo,desemprego,IPCA,pre%C3%A7o%20da%20gasolina).

Não foram obtidos volumes absolutos, CPC ou dificuldade orgânica por palavra. O Planejador de Palavras-chave não está conectado nesta sessão; os resultados de busca foram consultados pela ferramenta de pesquisa web, sem comprovar posições no Google brasileiro. Os resultados existentes demonstram oferta de conteúdo, não volume de procura. Os sinais do Trends também não medem o número de perguntas feitas a IAs.

### 11.2 Consultas investigadas e concorrência observada

Foram pesquisados grupos de consultas como “inflação acumulada 12 meses IPCA histórico”, “salário mínimo poder de compra evolução inflação”, “taxa desemprego por estado Bahia histórico”, “preço cesta básica salário mínimo evolução”, “inflação dos alimentos acumulada histórico”, “preço da gasolina histórico por estado”, “taxa de desemprego Brasil histórico” e “taxa Selic hoje histórico”. A inspeção direta abaixo cobre páginas selecionadas, não uma auditoria completa de concorrentes.

| Grupo | Páginas consultadas e oferta observada | Implicação para nossa página |
| --- | --- | --- |
| Salário mínimo e poder de compra | [O Preço do Seu Tempo](https://precodoseutempo.com.br/calculadoras/salario-minimo-historico) já oferece comparação nominal/real e tabelas históricas | Um gráfico corrigido pela inflação já tem concorrência. Explicitar mês-base, reajustes no meio do ano e comparação consistente entre períodos |
| IPCA acumulado | [Taxa de Juros](https://www.taxadejuros.com.br/ipca/) já entrega resposta curta, mês, ano, 12 meses e tabelas | Precisamos oferecer esse mínimo e acrescentar leitura por períodos e conexão com poder de compra |
| Desemprego territorial | [BRradar](https://brradar.com.br/estados) já oferece mapa, ranking e histórico; [ValorFinal](https://valorfinal.com.br/custo-de-vida/estados) também compara mudanças por governo | Mapa ou comparação por governo, isoladamente, não constituem diferencial. Explicar mudanças, precisão e períodos comparáveis |
| Gasolina | [ANP](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos) oferece planilhas históricas por território; [ValorFinal](https://valorfinal.com.br/custo-de-vida/preco-da-gasolina-por-governo) já oferece histórico, comparação real por governo e CSV | Facilitar comparação territorial e por período. Preços, inflação e contexto precisam ser apresentados com medidas claras |

Essas observações não permitem classificar nenhum grupo como de baixa concorrência. O diferencial proposto é a qualidade conjunta da resposta, da interpretação e da exploração dos dados; seu efeito em cliques e citações ainda precisa ser validado.

### 11.3 Lista priorizada

A ordem considera evidência de intenção no Trends, utilidade recorrente, disponibilidade das integrações, custo de manutenção e clareza da diferença entre as páginas. Não atribuímos notas de demanda a expressões sem volume medido.

| Ordem | Página e URL proposta | Palavra-chave principal e variantes no mesmo destino | Por que entra agora |
| --- | --- | --- | --- |
| 1 | Salário mínimo atual e histórico do poder de compra — `/economia/salario-minimo` | salário mínimo; salário mínimo 2026; valor do salário mínimo; aumento do salário mínimo; salário mínimo histórico; salário mínimo corrigido pela inflação; poder de compra do salário mínimo | Maior sinal relativo entre os termos comparados e consultas relacionadas explícitas sobre valor/reajuste. Séries nominal e real já registradas no projeto |
| 2 | IPCA acumulado em 12 meses e histórico da inflação — `/economia/inflacao` | IPCA acumulado; IPCA acumulado 12 meses; IPCA mensal; IPCA acumulado no ano; inflação acumulada; inflação por ano | Intenção clara por mês e acumulado, atualização recorrente e integração existente. A página também sustenta as explicações de salário e gasolina |
| 3 | Taxa de desemprego no Brasil e evolução histórica — `/economia/desemprego` | taxa de desemprego no Brasil; desemprego no Brasil 2026; índice de desemprego; taxa de desocupação; desemprego histórico | Consultas relacionadas alinhadas à proposta e série nacional já usada pelo site. Evita a intenção diferente de seguro-desemprego |
| 4 | Preço médio da gasolina e evolução por estado — `/economia/gasolina` | preço da gasolina; preço médio da gasolina; preço da gasolina por estado; histórico do preço da gasolina; preço da gasolina por ano | Consulta recorrente de custo de vida, histórico e territórios já integrados. Priorizar média mensal e evolução, compatíveis com os dados disponíveis |
| 5 | Desemprego por estado e comparação com o Brasil — `/economia/desemprego/estados` | desemprego por estado; taxa de desemprego por estado; ranking desemprego estados; estados com maior desemprego; estados com menor desemprego | Intenção territorial observada nas relacionadas e dados trimestrais por UF já integrados. Fica depois da página nacional porque a demanda do recorte é menos bem dimensionada |

As variantes propostas formam um mapa editorial; apenas as expressões explicitamente identificadas como relacionadas na seção 11.1 tiveram esse sinal de demanda observado. Não gerar uma página para cada sinônimo ou ano.

### 11.4 Briefing das cinco páginas

#### 1. Salário mínimo

- **Título:** “Salário mínimo: valor atual, reajuste e poder de compra”. O ano corrente pode entrar nos metadados sem mudar a URL.
- **Resposta para busca e IA:** qual é o piso nacional vigente, desde quando vale, quanto mudou nominalmente e como evoluiu em termos reais.
- **Conteúdo mínimo:** valor e vigência conferidos na legislação; tabela por data de reajuste; gráfico nominal/real; comparação entre períodos; explicação do IPCA e mês-base. Exibir o intervalo real disponível, sem prometer série desde 1940.
- **Base existente:** `backend/desempenho/registro.py` registra `salario_minimo` (SGS 1619) e `salario_minimo_real`, com início conhecido em 1995; `backend/desempenho/pipeline.py` e `derivadas.py` calculam a série real. A regra de reajuste legal não deve ser confundida com nossa escolha do IPCA para comparar poder de compra.
- **Conversão proposta:** explorar um período e, quando houver newsletter funcional, acompanhar atualizações de preços e renda. Medir uso da comparação e inscrições atribuídas à página.
- **Limite:** piso nacional, não pisos estaduais, salários de categorias, pensão ou benefícios. Não abrir páginas adicionais para esses assuntos nesta etapa.

#### 2. Inflação

- **Título:** “IPCA acumulado: inflação em 12 meses, no ano e mês a mês”.
- **Resposta para busca e IA:** último mês publicado, inflação mensal, acumulada no ano e em 12 meses, com referência temporal explícita.
- **Conteúdo mínimo:** tabela mensal, histórico anual, acumulado em período selecionado e explicação de que inflação menor não significa necessariamente queda dos preços.
- **Base existente:** `ipca`, SGS 433, em `backend/desempenho/registro.py`; transformação `acumulado12` em `frontend/src/app/prototipo/_dados/economiaModelo.ts`, utilizada em `economia.ts`.
- **Conversão proposta:** selecionar datas para entender a mudança dos preços e seguir para salário mínimo. Medir comparação de períodos e retorno após novas divulgações.
- **Limite:** IPCA geral não substitui inflação dos alimentos ou custo de vida específico de cada família. Não tratar IPCA de regiões pesquisadas como indicador disponível para todos os municípios ou estados.

#### 3. Desemprego no Brasil

- **Título:** “Taxa de desemprego no Brasil: último dado e histórico”.
- **Resposta para busca e IA:** taxa de desocupação, trimestre móvel de referência e comparação com o mesmo período do ano anterior.
- **Conteúdo mínimo:** último dado, histórico desde a cobertura efetiva da PNAD Contínua, diferença em pontos percentuais e explicação de quem entra na força de trabalho. Subutilização pode aparecer como medida separada.
- **Base existente:** `desemprego` no registro e nas séries nacionais; `economia.ts` já identifica o trimestre móvel. A PNAD trimestral civil também está integrada para comparação com UFs.
- **Conversão proposta:** abrir a comparação entre estados e explorar o histórico. Medir essas ações e retorno nas divulgações.
- **Limite:** não misturar trimestre móvel nacional e trimestre civil estadual no mesmo ranking. Comparações entre UFs e Brasil usam a mesma pesquisa, medida e trimestre civil. Não anunciar empregos criados ou beneficiários de programas como se fossem essa taxa.

#### 4. Gasolina

- **Título:** “Preço da gasolina: média mensal, histórico e comparação por estado”.
- **Resposta para busca e IA:** preço médio de revenda da gasolina comum no último mês completo disponível, localidade e mudança contra período comparável.
- **Conteúdo mínimo:** média Brasil, tabela por UF, série histórica, seleção de período e explicação da diferença entre preço nominal e real quando a comparação corrigida for implementada.
- **Base existente:** `carregarGasolina()` em `frontend/src/app/prototipo/_dados/economia.ts` lê `mart.preco_combustivel_mensal`; `carregar.ts` prepara os recortes territoriais. A consulta exclui mês em andamento. A [ANP disponibiliza séries semanais e mensais](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos).
- **Conversão proposta:** escolher estado e comparar datas. Medir seleção territorial, comparação e retorno.
- **Limite:** não usar “hoje”, “posto mais barato” ou “tempo real” com essa base mensal. A resposta a “por que subiu?” precisa de fontes explicativas além da série e não deve atribuir automaticamente a mudança ao governo.

#### 5. Desemprego por estado

- **Título:** “Desemprego por estado: taxas, ranking e evolução”.
- **Resposta para busca e IA:** quais UFs têm as maiores e menores taxas no último trimestre civil disponível e como se comparam ao Brasil.
- **Conteúdo mínimo:** tabela das 27 UFs no HTML, trimestre comum, mapa como complemento, histórico da UF selecionada e diferença para Brasil. Considerar os coeficientes de variação e limites de precisão antes de apresentar pequenas diferenças como posições conclusivas.
- **Base existente:** `backend/desempenho/pnad.py` ingere SIDRA 4099; `carregarPnad()` em `economia.ts` lê Brasil, regiões e UFs e separa desocupação de subutilização.
- **Conversão proposta:** selecionar e comparar UFs. Medir quais estados despertam interesse para decidir as próximas páginas territoriais.
- **Limite:** a página nacional atende a evolução do Brasil; esta atende a comparação territorial. Títulos, respostas e canônicas próprios, com links entre ambas. Bahia não foi escolhida como primeira página estadual porque ainda não há evidência comparativa de demanda entre UFs.

### 11.5 Oportunidades adiadas

| Grupo | Decisão e condição para entrar |
| --- | --- |
| Inflação dos alimentos | Investigar em seguida. A pesquisa encontrou conteúdo específico, mas não confirmou no código uma série dedicada já pronta; integrar grupo/subgrupo correto do IPCA e medir a intenção |
| Cesta básica e salário mínimo necessário | Adiar até confirmar integração, metodologia e cobertura territorial do DIEESE. Cesta básica não é sinônimo do IPCA geral |
| Selic hoje | Adiar esse alvo: a série exposta no painel é Selic efetiva mensal anualizada, não a meta vigente do Copom. O [histórico de decisões do BCB](https://www.bcb.gov.br/controleinflacao/historicotaxasjuros) é a referência para esse outro dado |
| Desemprego na Bahia ou em outro estado | Escolher a primeira UF com demanda por termo/localidade e interesse observado; não gerar 27 páginas apenas trocando o nome |
| Comparações entre presidentes | Começar como seções e links para as páginas por presidente existentes; avaliar URLs novas somente se a intenção e o conteúdo forem distintos |
| Repasses municipais, legislação e ambiente | Mantêm aderência ao projeto, mas ficam fora desta primeira campanha de economia cotidiana; exigem pesquisa própria de intenção e manutenção |

### 11.6 Validação e medição após publicação

Antes de publicar, confirmar no banco a cobertura e atualização de cada série; esta pesquisa verificou os caminhos no código, não executou uma auditoria do banco. Cada página precisa entregar resposta, período, unidade, fonte e tabela no HTML, URL permanente, canônica própria e links relacionados. Usar dados estruturados compatíveis com o conteúdo visível; não há garantia de destaque ou citação.

Para completar a dimensão quantitativa, consultar as palavras da seção 11.3 no Planejador com Brasil, português, rede Google e últimos 12 meses. Registrar ferramenta, data, configurações e faixas/estimativas recebidas; preservar a distribuição mensal e não somar variantes sobrepostas. Volume é demanda de pesquisa, não previsão de visitas; concorrência de anúncios não é dificuldade orgânica. [Documentação do Planejador](https://support.google.com/google-ads/answer/3022575?hl=pt-BR).

Depois da publicação, acompanhar por URL: indexação, consultas relevantes, impressões e cliques no Search Console; visitas identificáveis de IA; uso das comparações; inscrições quando disponíveis; e retorno dos leitores. Revisar os dados em 30 e 60 dias para aprender, sem tratar ausência inicial de tráfego como reprovação automática. Acompanhar consultas que já geram impressões para melhorar o conteúdo e escolher recortes adicionais.

Para verificar capacidade de resposta por IA, usar como perguntas de avaliação: “Quanto aumentou o salário mínimo acima da inflação?”, “Qual o IPCA dos últimos 12 meses e de qual mês é esse dado?”, “Qual a taxa de desemprego no Brasil e a referência?”, “Como mudou a gasolina no meu estado?” e “Quais estados têm maior desemprego no mesmo trimestre?”. Conferir se uma pessoa consegue responder e citar a fonte usando a página. Consultas manuais a IAs são observações pontuais, não um medidor completo de visibilidade.

## 12. Implementação local em 03 de novembro de 2026

Implementadas a infraestrutura inicial e a rota `/economia/salario-minimo` no frontend, sem publicação remota nesta etapa.

- Sitemap das páginas públicas, robots por ambiente, domínio canônico centralizado e canônicas específicas na home, metodologia, presidentes e salário mínimo.
- Desenvolvimento e previews da Vercel com `noindex`; desativação explícita por `SEO_INDEXING=false` para outras homologações. Protótipos preservam `noindex` e ficam fora do sitemap.
- Campos opcionais para verificação Google/Bing. O rastreamento público é permitido pela regra geral de robots; o acesso efetivo da CDN ainda depende do ambiente publicado.
- JSON-LD de organização/site, página, breadcrumbs e dataset, sem prometer inclusão ou destaque.
- Salário mínimo com resposta no HTML, tabela anual, todos os reajustes desde 1995, comparação de datas e de valor nominal/real, fontes e imagem própria de compartilhamento.
- Reutilização das séries do Neon, exclusão de meses futuros e separação entre último mês nominal e mês-base do IPCA. Revalidação horária e atualização pelo webhook existente.

Validação: seis testes de dados e SEO aprovados, TypeScript aprovado, build de produção aprovado e sete rotas HTTP aprovadas. Conferência em navegador no desktop e a 390 px: alternância nominal/real, comparação de datas, mês sem IPCA e intervalo inválido funcionando. O gráfico recebeu largura medida para manter os eixos legíveis no celular, preservando o comportamento padrão nas outras páginas. O lint inicial teve somente dois avisos preexistentes de fontes não utilizadas no layout. A configuração e o comando de teste estão no [README do frontend](frontend/README.md).

Após a publicação, faltam a verificação das propriedades no Search Console/Bing, envio do sitemap e inspeção de indexação/acesso no domínio público.

### Página de inflação e apresentação dos indicadores

Implementada também `/economia/inflacao`, com IPCA do mês, acumulado no ano e em 12 meses, histórico, comparação de intervalos, tabelas no HTML, fontes e dúvidas frequentes. Foram integrados canônica, JSON-LD, imagem própria de compartilhamento, sitemap, links entre indicadores e revalidação pelo webhook. Os cálculos reutilizam a regularização mensal e o acumulado de 12 meses existentes, com composição de fatores no intervalo e no ano, preservação de lacunas e exclusão de datas futuras.

**Diretriz visual confirmada pelo usuário:** as páginas públicas de indicadores seguem o protótipo. Inflação e salário mínimo usam um layout compartilhado com o cabeçalho e a marca existentes, fontes Geist, paleta, paisagem, vidro e alternância de tema do protótipo. A estrutura de respostas e os metadados permanecem próprios de cada indicador.

Validação desta entrega: 29 testes aprovados (13 de SEO/indicadores e 16 de regressão econômica), lint e detector sem apontamentos, TypeScript e build de produção aprovados. HTTP, HTML, canônicas e JSON-LD conferidos; visual e navegação entre indicadores verificados em desktop e celular, incluindo tema escuro. A referência disponível no banco é setembro de 2026: IPCA de 0,82% no mês, 3,95% no ano e 4,58% em 12 meses.

As implementações permanecem locais, sem publicação remota.

## 13. Cinco páginas e arquitetura de expansão

Concluídas localmente as cinco páginas iniciais, todas no visual do protótipo:
salário mínimo, inflação, desemprego nacional, gasolina e desemprego por estado.
As três últimas compartilham modelo de apresentação, gráficos, tabelas, metadados,
JSON-LD e geração de imagens. Os estados são comparados na mesma referência,
com o agregado nacional da fonte; a PNAD estadual apresenta também o CV.

O catálogo editorial alimenta rotas, navegação e sitemap. Novos recortes entram
por cadastro explícito e precisam de cobertura recente completa: 12 pontos
mensais ou quatro trimestrais. Colisões de URL, aliases do mesmo território,
períodos futuros e dados ausentes são tratados sem fabricar valores. A lista
de recortes territoriais começou vazia e recebeu o primeiro lote descrito abaixo;
não gera centenas de páginas automaticamente. O [README do frontend](frontend/README.md) descreve
o cadastro e as condições de publicação.

O cache é compartilhado por fonte e invalidado pelo webhook existente, junto
com toda a árvore de páginas de economia. As fontes atuais dessas três páginas
permitem recortes estaduais. A expansão para municípios ou novos temas exige
fonte adequada e revisão editorial; a quantidade de URLs não substitui demanda.

Validação: 38 testes aprovados (22 de SEO/indicadores/publicação e 16 de regressão
econômica), TypeScript e lint aprovados, build de produção aprovado e detector
visual sem apontamentos. HTTP conferido para cinco páginas, três imagens e três
URLs não publicadas (404). Sitemap com 12 URLs públicas, excluindo protótipos,
imagens isoladas e recortes não cadastrados. Navegação, seleção de UFs e comparação
de períodos conferidas no navegador em desktop e celular.

Publicação remota, verificação no Search Console/Bing e acompanhamento da demanda
continuam pendentes. A arquitetura de expansão foi implementada; a validação
de aquisição começa com o site público e suas métricas reais.

## 14. Primeiro lote estadual — 03/11/2026

Sete recortes cadastrados, reutilizando o visual do protótipo e os adaptadores
existentes. Auditoria no banco: as 27 UFs têm 302 meses de gasolina, até setembro
de 2026, e 58 trimestres de desocupação, até o segundo trimestre de 2026. Todas
passam no mínimo recente de 12 meses ou quatro trimestres sem lacunas. A cobertura
nesta data é suficiente; ela não implica igual potencial de busca.

| Ordem dentro da família | Página | Evidência e hipótese |
|---|---|---|
| Gasolina 1 | `/economia/gasolina/sao-paulo` | Maior média relativa da comparação de termos; relacionada sobre preço em São Paulo em 2026. Escopo estadual explícito |
| Gasolina 2 | `/economia/gasolina/bahia` | Segundo sinal relativo; demanda também pede preço de hoje, que a fonte mensal não atende |
| Gasolina 3 | `/economia/gasolina/minas-gerais` | Relacionada “preço medio gasolina mg” em crescimento, compatível com média mensal |
| Gasolina 4 | `/economia/gasolina/rio-de-janeiro` | Sinal menor; relacionada histórica sobre 2022. Escopo estadual explícito |
| Desemprego 1 | `/economia/desemprego/bahia` | Único sinal mensurável na comparação específica de taxa; relacionada de taxa em crescimento |
| Desemprego 2 | `/economia/desemprego/sao-paulo` | Hipótese exploratória: termo amplo tem sinal, mas mistura seguro-desemprego. Taxa específica sem volume suficiente no Trends |
| Desemprego 3 | `/economia/desemprego/rio-de-janeiro` | Hipótese exploratória de menor confiança, com a mesma limitação de intenção do termo amplo |

Pesquisa no Google Trends: Brasil, últimos 12 meses, pesquisa na Web, termos de
pesquisa (não tópicos). Na [comparação de gasolina](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=pre%C3%A7o%20gasolina%20sp,pre%C3%A7o%20gasolina%20rj,pre%C3%A7o%20gasolina%20mg,pre%C3%A7o%20gasolina%20bahia,pre%C3%A7o%20gasolina%20paran%C3%A1),
as médias relativas foram SP 7, RJ 1, MG 1, Bahia 4 e Paraná 0. Paraná fica para
outro lote. Na [comparação específica de taxa](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=taxa%20desemprego%20bahia,taxa%20desemprego%20s%C3%A3o%20paulo,taxa%20desemprego%20rio%20de%20janeiro,taxa%20desemprego%20minas%20gerais,taxa%20desemprego%20pernambuco),
Bahia teve média 5 e os demais 0. Zero indica sinal insuficiente, não ausência de
buscas. Escalas de gráficos diferentes não são comparáveis, e esses índices não
são buscas mensais nem prova de conversão. O lote é uma priorização qualitativa,
não um ranking de volume das 27 UFs. Após publicação, validar com consultas e
cliques no Search Console e uso dos gráficos; ampliar a partir dessa evidência.

As páginas entregam resposta estadual no HTML, período e fonte, comparação anual,
diferença para o Brasil no mesmo período, histórico e CV no desemprego. Títulos,
canônicas, imagens e Dataset são próprios; breadcrumbs levam à página principal.
Links das tabelas e entre indicadores do mesmo estado tornam o lote navegável.
São 12 páginas de economia ao todo; não há promessa de preço de hoje nem dados
municipais. Implementação local, sem publicação remota.

Validação do lote: 23 testes de SEO/dados aprovados, lint e TypeScript sem erros,
build de produção aprovado. HTTP 200 para as sete páginas e sete imagens;
canônicas, Dataset estadual e breadcrumbs conferidos. Valores das sete páginas
coincidem com a consulta direta ao banco. Sitemap contém 19 URLs únicas, incluindo
as 12 de economia; três URLs não cadastradas retornaram 404. Navegação entre
página principal, estados e indicadores, filtros mensais/trimestrais e visual
claro/escuro conferidos em desktop e celular, sem overflow horizontal da página.
Prévia local atualizada na porta 3100. Publicação e medição de demanda continuam
pendentes.

## 15. Segundo lote estadual: cobertura completa — 03/11/2026

A pedido do usuário, o maior lote suportado pelas duas famílias atuais acrescenta
47 páginas: 23 de gasolina e 24 de desemprego. São 54 recortes territoriais
(27 UFs × dois indicadores), 59 páginas de economia e 66 URLs no sitemap. As sete
URLs do primeiro lote foram preservadas. O Distrito Federal é tratado como UF;
não foram criadas URLs municipais ou combinações artificiais de filtros.

Revalidação de cobertura em 03/11/2026: todas as 27 UFs têm 302 observações de
gasolina, até setembro de 2026, e 58 de desemprego por trimestre civil, até o
segundo trimestre de 2026. Os últimos 12 meses e quatro trimestres têm valores
válidos em cada UF. Cada página continua passando pelo gate de regularização,
ausência, períodos encerrados e correspondência do território na fonte. A
[ANP](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/informacoes-levantamento-de-precos-de-combustiveis)
descreve cobertura dos estados e DF; a PNAD trimestral usa a
[tabela 4099 do SIDRA](https://sidra.ibge.gov.br/tabela/4099).

| Prioridade de acompanhamento no novo lote | Evidência observada | Limite |
|---|---|---|
| Gasolina: Rio Grande do Sul, Santa Catarina e Paraná | Médias relativas 8, 7 e 2 no mesmo gráfico de termos abreviados; relacionada “preço da gasolina rs” | Interesse relativo amostrado, não volume mensal |
| Desemprego: Minas Gerais | Média relativa 2 para termo específico de taxa; há [boletim estadual sobre PNAD](https://observatoriotrabalho.mg.gov.br/html%20boletins/4.Texto%20PnadC-T%202026-1T.pdf?_t=1781179741) | Publicação oficial mostra utilidade editorial, não demanda ou conversão |
| Pernambuco e Ceará nas duas famílias; PR e SC em desemprego | Termos consultados sem sinal suficiente no Trends | Hipóteses de busca; não classificar como demanda comprovada |
| Demais UFs agora incluídas | Cobertura validada e conteúdo próprio: valor, diferença nacional, variação anual, histórico e CV quando disponível | Não há medição individual de volume; expansão exploratória autorizada para maximizar o lote útil |

Comparações adicionais no Trends: Brasil, últimos 12 meses, pesquisa na Web,
termos de pesquisa (não tópicos), consultadas em 03/11/2026:
[gasolina PR/RS/SC/PE/CE](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=pre%C3%A7o%20gasolina%20pr,pre%C3%A7o%20gasolina%20rs,pre%C3%A7o%20gasolina%20sc,pre%C3%A7o%20gasolina%20pe,pre%C3%A7o%20gasolina%20ce)
e [taxa de desemprego MG/PE/PR/SC/CE](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=taxa%20desemprego%20minas%20gerais,taxa%20desemprego%20pernambuco,taxa%20desemprego%20paran%C3%A1,taxa%20desemprego%20santa%20catarina,taxa%20desemprego%20cear%C3%A1).
PE e CE tiveram média zero no gráfico de gasolina; MG teve 2 e os demais zero no
gráfico específico de desemprego. Zero não prova ausência de buscas; gráficos e
grafias diferentes não permitem comparar seus índices diretamente. Não há
ranking confiável de volume para todas as UFs, nem garantia de tráfego para as 54
páginas. Medir impressões, consultas, cliques e uso das comparações após publicação
para decidir onde aprofundar o conteúdo.

O visual permanece o do protótipo. O cadastro compartilhado fornece nomes,
códigos oficiais, slugs e preposições; os links dos estados ficam em ordem
alfabética. Permanecem próprios por URL: título, resposta, canônica, imagem,
breadcrumbs e Dataset. O conteúdo distingue UF de município, mantém o período da
fonte e não apresenta médias mensais como preço de hoje. Cache, revalidação e
sitemap são compartilhados com a infraestrutura existente.

Validação do segundo lote: 23 testes SEO/dados, lint, TypeScript e build de
produção aprovados. As 54 páginas e 54 imagens responderam 200; valores e
referências de todas as páginas foram comparados às consultas diretas às duas
fontes. Canônicas, Dataset com código de UF, breadcrumbs, links de entrada e
links entre indicadores da mesma UF conferidos. Quatro URLs desconhecidas ou
municipais retornaram 404. Sitemap validado com 66 URLs únicas, incluindo as 59
de economia. Visual do protótipo, navegação com 27 UFs, filtros e temas claro e
escuro conferidos no navegador em desktop/celular, sem overflow horizontal da
página. Prévia local na porta 3100; publicação remota e medição real da demanda
permanecem pendentes.

## 16. Lote municipal de gasolina — 03/11/2026

Integradas as médias mensais oficiais municipais da ANP, além dos agregados
estaduais já existentes. As planilhas de 2022–2025 e desde janeiro de 2026 foram
obtidas na [série histórica oficial](https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/precos-revenda-e-de-distribuicao-combustiveis/serie-historica-do-levantamento-de-precos),
arquivadas pelo fluxo existente e publicadas com proveniência por fotografia de
arquivo. São 23.022 observações de gasolina comum, cobrindo 459 localidades. O
cruzamento usa nome e UF do cadastro IBGE, incluindo a grafia oficial Sant’Ana do
Livramento, sem correspondência por nome isolado ou aproximação geográfica.

O maior lote que passou no critério recente contém **305 municípios nas 27 UFs**:
12 meses consecutivos com preço médio positivo e amostra informada, na última
referência comum com o Brasil, setembro de 2026. As outras 154 localidades não
passaram nesse critério; não recebem página. O histórico municipal começa em
2022 nesta integração e preserva lacunas. A expansão não cria desemprego
municipal: a fonte de PNAD integrada continua limitada a Brasil, regiões e UFs.

As novas URLs seguem `/economia/gasolina/{estado}/{municipio}`. Isso preserva
todas as URLs estaduais e diferencia capital de estado e cidades homônimas.
Exemplos: `/economia/gasolina/sao-paulo/sao-paulo`,
`/economia/gasolina/minas-gerais/belo-horizonte` e
`/economia/gasolina/parana/curitiba`. Há **364 páginas de economia** e **371 URLs
públicas no sitemap**. O cadastro revisável é gerado por cobertura; a lista não
contém preços congelados, que vêm da fonte no banco e são revalidados.

Pesquisa complementar no [Google Trends municipal](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=pre%C3%A7o%20gasolina%20curitiba,pre%C3%A7o%20gasolina%20belo%20horizonte,pre%C3%A7o%20gasolina%20salvador,pre%C3%A7o%20gasolina%20bras%C3%ADlia,pre%C3%A7o%20gasolina%20fortaleza),
consultada em 03/11/2026, Brasil, últimos 12 meses, Web, termos de pesquisa:

| Termo consultado | Média relativa no mesmo gráfico | Uso editorial |
|---|---|---|
| preço gasolina curitiba | 13 | Priorizar acompanhamento de aquisição |
| preço gasolina salvador | 8 | Priorizar acompanhamento de aquisição |
| preço gasolina fortaleza | 5 | Priorizar acompanhamento de aquisição |
| preço gasolina belo horizonte | 3 | Acompanhar intenção de média e histórico |
| preço gasolina brasília | 1 | Acompanhar intenção local, com UF explícita |

As relacionadas de Curitiba incluem intenção de preço de hoje. A página informa
claramente que entrega média mensal, sem prometer cotação atual ou o posto mais
barato. Os índices são relativos e amostrados; não são buscas mensais, previsão
de conversão ou ranking das 305 cidades. População é usada como proxy editorial
de alcance para ordenar os links municipais: São Paulo, Rio, Brasília, Fortaleza,
Salvador, Belo Horizonte e outras cidades maiores aparecem primeiro. Nos demais
recortes, a demanda permanece hipótese a medir no Search Console após publicação.

Cada página mantém o visual do protótipo e entrega: resposta municipal no HTML,
UF, código IBGE no Dataset do tipo City, referência, média da UF e Brasil no mesmo
mês, diferença local, variação anual, número de postos informado pela ANP,
mínimo/máximo históricos, gráfico, tabela e metodologia. Breadcrumbs têm quatro
níveis. As páginas estaduais ligam a todas as cidades elegíveis da UF; a cidade
liga ao estado e a outras cidades da mesma UF. Títulos, canônicas e imagens são
próprios; filtros do gráfico não criam URLs.

A nova tarefa `anp_municipios` integra a rotina semanal no código. O adaptador
compartilha cache por UF e invalidação existente. A checagem do catálogo preenche
o cache sequencialmente para evitar múltiplas consultas simultâneas da mesma UF;
isso resolveu o limite de memória observado no primeiro build. Novos municípios
exigem regenerar e revisar o cadastro depois da atualização da fonte; recortes
que deixam de satisfazer os critérios são recusados pelo carregador.

Validação: 24 testes de SEO/dados e 26 testes únicos de backend aprovados, lint
Python/TypeScript e build de produção aprovados. As 305 páginas e 305 imagens
responderam 200, com valores, referências e amostras conferidos na fonte. Todas
as 54 páginas estaduais e os links de entrada de cada município foram conferidos.
Sitemap com 371 URLs únicas; cinco caminhos inválidos ou sem fonte retornaram
404. Visual, filtro mensal e navegação conferidos em desktop/celular, temas claro
e escuro, sem overflow horizontal da página. Prévia local na porta 3100;
publicação remota e medição de demanda continuam pendentes. A carga oficial no
banco foi concluída; não foi criado agendamento remoto novo.

## 17. Outros indicadores municipais — 03/11/2026

Quatro famílias adicionais, com dados municipais existentes no banco, passaram
nos critérios de publicação. O lote contém **12.431 novas páginas de indicadores**:

| Família | Páginas aprovadas | Referência | Critério recente |
|---|---:|---|---|
| População estimada | 5.571 | 1º de julho de 2026 | Estimativas de 2025 e 2026 positivas, sem preencher anos ausentes com Censo |
| Emprego formal / Novo Caged | 5.570 | Agosto de 2026 | 12 meses com estoque, admissões e desligamentos não negativos e saldo igual à diferença dos fluxos |
| CadÚnico | 645, todas em SP | Agosto de 2026 | 12 meses documentados de famílias e pessoas, sem converter cadastros em beneficiários |
| BPC | 645, todas em SP | Julho de 2026 | 12 meses documentados de total e categorias, conferindo idosos + pessoas com deficiência |

População usa a [tabela 6579 do IBGE](https://sidra.ibge.gov.br/tabela/6579),
com referência anual descrita nas [estimativas municipais](https://www.ibge.gov.br/estatisticas/sociais/populacao/9103).
Emprego usa a série com ajustes do [Novo Caged/MTE](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/estatisticas-trabalho/novo-caged),
desde 2020, sem emendar o Caged antigo nem apresentar vínculos como moradores
ocupados, vagas abertas ou taxa de desemprego. O estoque de Bacurituba (MA) está
ausente em setembro, outubro e novembro de 2025; a cidade fica fora desta família
por não completar os 12 meses, mesmo tendo fluxos publicados.

CadÚnico e BPC vêm do [repositório da Fundação Seade](https://repositorio.seade.gov.br/dataset/648ae821-4df3-43d1-8d69-850d345f22a2),
com dados MDS/Sagicad e cobertura municipal de São Paulo. Os campos documentados
de total do Bolsa Família (`Fam_PBF`/`Pes_PBF`) estão ausentes nas referências
recentes verificadas. Não foram substituídos por variáveis sem documentação ou
por famílias de uma faixa específica de renda. Ideb, PIB e Sinisa integrados
continuam agregados acima do município nesta auditoria; não receberam recortes
municipais artificiais neste lote.

Na [comparação exploratória do Google Trends](https://trends.google.com/trends/explore?date=today%2012-m&geo=BR&q=popula%C3%A7%C3%A3o%20campinas,popula%C3%A7%C3%A3o%20guarulhos,caged%20campinas,cad%C3%BAnico%20campinas,bpc%20campinas),
Brasil, últimos 12 meses, Web, termos de pesquisa, consultada em 03/11/2026:
“população campinas” teve média relativa 58; “população guarulhos”, 16;
“cadúnico campinas”, 1; “caged campinas” e “bpc campinas”, 0. Esses valores não são
buscas mensais nem um ranking nacional de cidades. O sinal favorece acompanhar
primeiro população nas cidades maiores. Caged e programas sociais permanecem
hipóteses de aquisição; consultas sobre vagas, atendimento ou benefício individual
não são atendidas por páginas de estatística e não são prometidas no conteúdo.
Zero significa sinal insuficiente no recorte, não ausência de demanda.

As páginas têm resposta no HTML, unidade, referência e data da fonte, comparação
anual quando disponível, gráficos com seleção de medida e período, tabela,
limitações e links entre indicadores da mesma cidade. População mantém lacunas
de anos sem publicação; Caged permite saldo negativo sem aceitar estoque negativo;
CadÚnico separa famílias e pessoas; BPC separa total, idosos e pessoas com
deficiência. Há títulos, canônicas, Dataset do tipo City, breadcrumbs e imagens
próprias. O cabeçalho e os componentes mantêm o visual do protótipo.

O novo diretório `/economia/municipios` leva às UFs, com até 100 cidades por página
e busca local. A paginação pública tem canônica própria e links comuns, inclusive
para páginas não pré-geradas. A busca por texto não é indexada. São **12.795 páginas
de indicadores**, mais **70 diretórios**, e **12.872 URLs no sitemap**. As 364
páginas anteriores foram preservadas; gasolina municipal liga aos outros
indicadores quando disponíveis.

A cobertura é centralizada em uma visão de leitura e revalidada em bloco, sem
uma consulta de elegibilidade por URL. O cadastro JSON é gerado de forma
revisável e fica no servidor. As séries compartilham cache por prefixo IBGE de
quatro dígitos, até 100 cidades por bloco, abaixo do limite de 2 MB. As novas
páginas usam renderização no primeiro acesso e ISR horário; quatro cidades por
família são pré-geradas. Não é necessário reconstruir as 12.431 páginas em cada
build. Cache e páginas são invalidados pelo webhook existente.

Validação: 28 testes de SEO/dados, TypeScript, lint e build de produção aprovados.
Cobertura das 12.431 URLs comparada à visão de origem; todos os links de entrada
conferidos nos 70 diretórios, incluindo paginação. Sitemap com 12.872 URLs únicas.
Teste HTTP de 59 páginas e suas imagens, com valores conferidos diretamente nas
fontes, cobrindo as 27 UFs, famílias sociais, geração sob demanda e município com
apenas dois anos de histórico. Seis limites/404, busca sem indexação e quatro
rotas anteriores conferidos. A renderização HTTP foi amostral: não se afirma teste
individual das 12.431 páginas. Busca, gráficos anuais/mensais, troca de medida,
navegação entre famílias e temas claro/escuro verificados no navegador em desktop
e celular. Prévia local na porta 3100; publicação remota e medição da aquisição
continuam pendentes. A criação da visão não alterou dados de origem nem criou
um novo agendamento remoto.


## 18. Revisão da arquitetura pública — 4 de novembro de 2026

Implementados o centro `/economia`, quatro panoramas nacionais de indicadores
municipais e 56 panoramas de UF. Os 60 panoramas conectam indicador → UF → município,
sem alterar as 12.795 URLs de indicadores existentes. O menu temático público agora
usa links para Economia, Meio ambiente e Dinheiro, com destinos próprios indexáveis;
o protótipo continua fora da indexação. A navegação principal e o rodapé expõem
municípios, metodologia, expediente e correções. O visual do protótipo foi preservado.

A migração `backend/sql/080_publicacao_seo.sql` acrescenta a visão de última janela
histórica publicável e duas tabelas operacionais, sem alterar observações de origem.
Novas aprovações continuam exigindo cobertura atual pela visão 079; uma página
aprovada conserva a última janela válida quando a divulgação seguinte falha, com
aviso explícito. População usa dois anos consecutivos; séries mensais, 12 meses.
Ausência não vira zero. A manutenção não aprova automaticamente novos municípios.

As páginas municipais ganharam posição descritiva na UF, localidades vizinhas na
ordenação e agregados de UF/Brasil quando a fonte oferece a mesma medida no mesmo
período. CadÚnico e BPC mantêm cobertura paulista, sem inferência de total nacional.
A metodologia separa esses dados das medidas anualizadas de comparação presidencial.

As datas de revisão são persistidas por assinatura de conteúdo. As assinaturas
incluem valores, revisão editorial e contexto territorial que pode alterar posições;
excluem horários de coleta e consulta. `dateModified` e `lastmod` usam a mesma revisão.
O registro começa nesta implantação, sem inventar datas editoriais retroativas.
O sitemap é um índice com quatro partes de até 4.000 URLs: 12.937 URLs únicas nesta
base. Painéis sem assinatura completa de suas fontes omitem `lastmod`.

O expediente identifica o projeto e informa que ainda não há responsável individual
ou contato público definido. O formulário `/correcoes` registra relatos no banco,
com protocolo, sem pedir nome, e-mail ou documento; não envia mensagens externas
nem promete prazo. Um envio pelo navegador foi conferido no banco e o registro
sintético foi removido. A política descreve as limitações desse canal.

Validação local em modo de produção, exclusivamente na porta 3000: 30 testes de
SEO/dados, checagem de tipos e build aprovados (469 páginas pré-geradas). Lint sem
erros; dois avisos anteriores de fontes não usadas no layout principal. Detector
visual sem apontamentos. Conferidas cobertura e descoberta das 12.431 páginas
municipais nos 70 diretórios; amostra HTTP de 59 páginas/imagens com valores
comparados às fontes; seis limites/404 e quatro rotas anteriores. Conferidos os
60 panoramas, destinos públicos, sete correspondências de data entre sitemap e
schema, validações negativas do formulário e limites dos novos sitemaps. O webhook local também foi acionado: dados idênticos preservaram todas as assinaturas e datas de revisão. O leitor
XML do teste foi corrigido para não juntar entradas sem `lastmod`. A renderização
foi amostral, sem alegar teste HTTP individual de todas as páginas.

Core Web Vitals possuem instrumentação opcional com o hook nativo do Next,
ativada por `NEXT_PUBLIC_WEB_VITALS=true` antes do build. As métricas vão para os
logs da hospedagem por caminho, sem cookies ou identificador de visitante.
O padrão permanece desativado. Build e verificação local não comprovam desempenho
de campo, indexação ou citação por IA. Publicação remota, validação do domínio,
Search Console/Bing e observação de tráfego real continuam pendentes; não houve
push ou implantação remota nesta revisão. A tentativa de leitura do domínio público
não permitiu validar a versão de produção.
