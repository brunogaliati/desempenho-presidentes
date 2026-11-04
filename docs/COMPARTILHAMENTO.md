# Compartilhamento de recortes

Os botões do cabeçalho, blocos, métricas e seções usam a mesma página pública. Não são criadas rotas para cada combinação.

- `uf` e `mandato`: território e governo explícitos.
- `r.*`: estado de apresentação validado pelo componente (indicador, datas, medida, mapa, ordenação, comparação, orçamento e emendas).
- `painel` + hash: destino estável; após a hidratação, espera o componente, rola e move o foco. O usuário interrompe a rolagem automática ao interagir.
- `null` é um valor explícito para filtros opcionais; ausência mantém o padrão. As opções vêm dos dados reais, inclusive quando chegam por API.
- O menu oferece copiar link/texto, compartilhamento nativo quando disponível e links para WhatsApp, Telegram, X, Facebook e LinkedIn.

A restauração acontece no cliente: as canônicas, o sitemap e o HTML indexável continuam sendo os das páginas públicas existentes. Nenhum valor numérico ou rótulo recebido pela URL substitui a fonte oficial. O formulário de correções não registra dados pessoais neste contrato.

Os links preservam a seleção, mas os dados continuam sujeitos a atualizações e correções da fonte. A capa social é contextual à página, sem gerar uma imagem por combinação de filtros. O compartilhamento atual é de link, não exportação de uma imagem do gráfico.

## Verificação

`node --test scripts/test-compartilhamento.mjs` verifica o contrato, tipos, limites e isolamento de parâmetros. A bateria existente passou com 106 testes, além de TypeScript e lint. No navegador, abertura em nova aba validou dólar/Lula 1, gráfico/tabela, comparação/Bolsonaro, inflação com medida e datas, tabela expandida, perfil com gráfico aberto, mapa ambiental, orçamento estadual de Saúde e período municipal. Entradas inválidas retornaram a opções válidas.

A ferramenta de viewport manteve 1280px mesmo após solicitar 390px; revisão visual em celular permanece pendente. O CSS limita o menu à largura e altura da janela e amplia alvos em dispositivos de toque.
