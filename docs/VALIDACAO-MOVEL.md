# Validação responsiva dos painéis

Validado em 04/11/2026 no Chromium, com viewports de 360×800, 390×844 e 430×844. O teste cobre layout responsivo, não um aparelho físico ou o motor Safari/WebKit.

| Aba | 360 px | 390 px | 430 px |
| --- | --- | --- | --- |
| Economia | Passou | Passou | Passou |
| Meio ambiente | Passou | Passou | Passou |
| Dinheiro | Passou | Passou | Passou |

Em todas as combinações: skeleton do tema de destino presente durante a troca, removido ao concluir; H1 compacto visível; largura do documento igual à largura útil da janela; console sem erros.

Correções encontradas na conferência:

- Reserva de altura do cabeçalho no skeleton móvel alinhada às linhas de marca, abas e mandato.
- H1 de Dinheiro antes do treemap no celular, preservando a coluna lateral no desktop; skeleton com a mesma ordem.
- Seletor do indicador de Economia ocupa o espaço disponível, evitando abreviar nomes curtos.
- Rolagem do documento suspensa enquanto o overlay da troca está aberto, evitando duas barras de rolagem.

Build, TypeScript e lint passaram. Conferência visual adicional em 1280 px preservou o layout de desktop.
