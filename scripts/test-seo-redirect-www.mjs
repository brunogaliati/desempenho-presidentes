import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../redirect-www.mjs";

const www = "www.desempenhodogoverno.com.br";
const canonical = "desempenhodogoverno.com.br";

test("www redireciona em caráter permanente e conserva caminho e parâmetros", () => {
  for (const protocol of ["http", "https"]) {
    for (const path of [
      "/",
      "/economia/populacao/sao-paulo/jundiai?uf=SP&ano=2025",
      "/congresso/deputados/nikolas-ferreira-209787?r.congresso.ano=2026",
      "/busca/S%C3%A3o%20Paulo/?q=a%2Bb&q=c+d&vazio=&sinal=%26",
      "/sitemap.xml",
      "/robots.txt",
    ]) {
      const response = worker.fetch(new Request(`${protocol}://${www}${path}`));
      assert.equal(response.status, 308);
      assert.equal(response.headers.get("location"), `https://${canonical}${path}`);
    }
  }
});

test("o Worker não redireciona o domínio canônico", () => {
  const response = worker.fetch(new Request(`https://${canonical}/`));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("location"), null);
});
