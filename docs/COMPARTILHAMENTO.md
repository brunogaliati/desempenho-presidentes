# Compartilhamento de recortes

Os botões do cabeçalho, blocos, métricas e seções usam a mesma página pública. Não são criadas páginas para cada combinação; só o cartão muda (ver "O cartão do recorte").

- `uf` e `mandato`: território e governo explícitos.
- `r.*`: estado de apresentação validado pelo componente (indicador, datas, medida, mapa, ordenação, comparação, orçamento e emendas).
- `painel` + hash: destino estável; após a hidratação, espera o componente, rola e move o foco. O usuário interrompe a rolagem automática ao interagir.
- `null` é um valor explícito para filtros opcionais; ausência mantém o padrão. As opções vêm dos dados reais, inclusive quando chegam por API.
- O menu oferece copiar link/texto, compartilhamento nativo quando disponível e links para WhatsApp, Telegram, X, Facebook e LinkedIn.

A restauração acontece no cliente: as canônicas, o sitemap e o HTML indexável continuam sendo os das páginas públicas existentes. Nenhum valor numérico ou rótulo recebido pela URL substitui a fonte oficial. O formulário de correções não registra dados pessoais neste contrato.

Os links preservam a seleção, mas os dados continuam sujeitos a atualizações e correções da fonte. No painel, a capa social acompanha o indicador e o mandato do link; nas demais páginas, é a da página. O compartilhamento atual é de link, não exportação de uma imagem do gráfico.

## A frase que acompanha o link

Sai dos números da página (`src/lib/fraseCompartilhamento.ts` e `src/app/_painel/_componentes/frases.ts`), nunca de texto da URL, e o leitor pode mudá-la antes de enviar.

- A conta é uma só para qualquer governo e direção: "subiu", "caiu", "cresceu", "encolheu". Nenhum adjetivo, nenhum verbo que atribua causa, nenhum juízo que dependa de quem governa. "No governo" marca o período, como no resto do site.
- O de/para não leva a diferença ao lado: o placar subtrai antes de arredondar e diz +11,3 onde 82,9 − 71,7 dá 11,2. Na frase, os dois lado a lado pareceriam erro.
- A posição entre os mandatos usa o ritmo por ano, a conta da grade "Governo a governo", e só aparece quando se destaca: 1º ou 2º de um lado, entre pelo menos 4 mandatos. "Com dado" aparece quando a série não cobre todos.
- O botão do painel repete a contagem que o placar mostra na tela, pela mesma função.
- As páginas de indicador têm o botão no layout, que não vê os dados: a página diz a frase por `FraseDaPagina`.

O link leva só o que difere do que a página abriria sozinha (`useEstadoCompartilhavel`). A medida que o mapa mostra no passeio não é escolha de ninguém e fica de fora, a não ser no compartilhar do próprio mapa, cuja frase fala dela.

## O cartão do recorte

O link do painel chega com o cartão do que foi compartilhado, e não com a capa genérica. A conta está em `src/app/_painel/_componentes/capaRecorte.ts`, pura e usada dos dois lados: o servidor escreve as metatags (`_dados/metadataRecorte.ts`) e desenha a imagem (`/compartilhar/recorte`, `components/ImagemRecorte.tsx`); o navegador monta a prévia do diálogo (`capaDoLink`). Por isso a prévia não pode prometer outro cartão.

| O link | O cartão |
|---|---|
| `mandato`, sem estado (botão do painel, blocos do mandato, mapa do meio ambiente) | Placar: a contagem e um bloco por indicador |
| `painel=de-perto` | A série de `r.serie`, ou a que o painel abre sozinho |
| `painel=de-perto` com `uf` | A medida daquele estado (`r.leitura`); com `r.leitura=null`, a série nacional |
| `painel=mapa-economia` | A medida do mapa no Brasil ou no estado; governo sem dado por estado cai no placar |
| Sem recorte, estado sem medida, Dinheiro, id que não existe | A capa da página |

- O cartão só tem ids e dados do servidor. Nenhum texto vem da URL: a rota da imagem responde 404 para id que não existe, então ninguém gera imagem com a marca do site dizendo o que quiser.
- Número, ritmo e veredito saem das mesmas funções da frase e do placar (`numerosDaSerie`, `placarDoMandato`). A cor é a do placar, para todo governo, e vem com a palavra ("Pior que na posse"): a cor nunca fala sozinha. O desenho não escreve a diferença ao lado do de/para, pelo mesmo motivo da frase.
- A canônica continua sendo a página: o recorte é para quem recebe o link, não para a busca. `og:url` leva o recorte inteiro, porque o Facebook raspa o endereço que ela disser. O Next corta a busca de qualquer URL em `/` quando há `metadataBase`, por isso `metadataComRecorte` zera a base e escreve URLs absolutas.
- A metadata depende da busca, o que não custa cache: a home já é dinâmica (`connection()` no layout). Sem `mandato` nem `painel`, ela nem carrega os dados.
- Para robôs de prévia, as metatags precisam estar no `<head>`. O Next só faz isso para a lista dele, que não inclui o Telegram: `htmlLimitedBots` em `next.config.ts` acrescenta quem falta.
- A URL da imagem leva o dia (`d`): os aplicativos guardam a imagem pelo endereço, e o número muda.

## O cartão em cache

Gerar um cartão leva de 2 a 4 s, e a resposta de um Worker não passa pelo cache do CDN. `src/lib/imagemEmCache.ts` guarda cada cartão por um dia no Cache API, com a URL inteira como chave (inclusive o `?v=` de `src/lib/seo.ts`). Fora do Worker não há `caches.default`: no `next dev`, a imagem é gerada a cada pedido.

## Verificação

`node scripts/test-capa-recorte.mjs`, com o site na 3000, pede cada tipo de link como os robôs pedem e confere o cartão, a canônica, o `og:url` e os 404 da imagem. `scripts/test-catalogo-perfil.mjs` confere no navegador que a prévia do diálogo é a imagem que o robô recebe.

`node --test scripts/test-compartilhamento.mjs` verifica o contrato, tipos, limites e isolamento de parâmetros. A bateria existente passou com 106 testes, além de TypeScript e lint. No navegador, abertura em nova aba validou dólar/Lula 1, gráfico/tabela, comparação/Bolsonaro, inflação com medida e datas, tabela expandida, perfil com gráfico aberto, mapa ambiental, orçamento estadual de Saúde e período municipal. Entradas inválidas retornaram a opções válidas.

A ferramenta de viewport manteve 1280px mesmo após solicitar 390px; revisão visual em celular permanece pendente. O CSS limita o menu à largura e altura da janela e amplia alvos em dispositivos de toque.
