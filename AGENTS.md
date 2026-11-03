# Regras para agentes

## Servidor de desenvolvimento

- Este projeto tem um servidor só, na porta 3000: `npm run dev`.
- Antes de subir um, veja se já há um ligado: `netstat -ano | findstr :3000`. Se houver, use esse.
- Não suba outro servidor em outra porta. Se o da 3000 estiver quebrado, feche-o e suba de novo na mesma porta.
- Terminou de usar um servidor que você mesmo abriu para teste? Feche-o.
- Se o navegador abrir outro app ou recusar a conexão em `localhost:3000`, use o endereço "Network" que o `next dev` imprime.

## Build com o servidor ligado

`next build` e o servidor disputam a pasta `.next`. Use uma pasta separada:

```
NEXT_DIST_DIR=.next-build npx next build
```

Isso faz o Next acrescentar a pasta ao `include` do `tsconfig.json`. Não commite essa linha.

## Git

- Trabalhe direto na `main`. Não crie branch nem worktree, a não ser que o dono peça.
- Mais de um agente pode estar nesta pasta ao mesmo tempo. Antes de commitar, confira `git status` e não reverta o que não for seu.
- Faça push só quando o dono pedir.
