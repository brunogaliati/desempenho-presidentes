# Desempenho do Governo

![Desempenho do Governo](https://img.shields.io/badge/Status-Em%20Desenvolvimento-brightgreen)

Uma plataforma interativa para visualização e comparação de indicadores econômicos durante diferentes governos brasileiros.

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
   GOOGLE_SERVICE_ACCOUNT_EMAIL=seu-email@google-service-account.com
   GOOGLE_PRIVATE_KEY=sua-chave-privada
   GOOGLE_SHEET_ID=id-da-sua-planilha
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

Os dados utilizados neste projeto são obtidos de fontes oficiais como Banco Central do Brasil e IBGE, através de uma planilha Google Sheets que é atualizada regularmente.

---

Desenvolvido com ❤️ para promover transparência e análise objetiva dos indicadores econômicos brasileiros.
