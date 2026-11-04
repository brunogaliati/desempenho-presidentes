import Link from "next/link";
import { metadataPagina } from "@/lib/seo";
import { PAGINAS_ECONOMIA, rotaEconomia } from "@/lib/catalogoEconomia";

export const metadata = metadataPagina("Desempenho do Governo", "Indicadores econômicos de cada mandato presidencial desde o Plano Real, calculados com o mesmo critério e comparados com o mundo.", "/");

import { Abertura } from "@/components/Abertura";
import { Benchmark } from "@/components/Benchmark";
import { Compartilhar } from "@/components/Compartilhar";
import { Heranca } from "@/components/Heranca";
import { Jogo } from "@/components/Jogo";
import { Narrativa, type Ato } from "@/components/Narrativa";
import { Newsletter } from "@/components/Newsletter";
import { Regua } from "@/components/Regua";
import { Tabela } from "@/components/Tabela";
import { anualizado, mesPorExtenso, numero, reais } from "@/lib/formatar";
import { carregarDados } from "@/lib/dados";
import type { DadosSite, Indicador } from "@/types/dados";

/**
 * Página única.
 *
 * Os dados vêm do Neon em build time e nas revalidações do ISR — nunca a cada
 * visita. Sob pico eleitoral a página inteira sai do CDN.
 */
export const revalidate = 3600;

function ind(
  dados: DadosSite,
  presidenteId: string,
  serieId: string,
): Indicador | undefined {
  return dados.presidentes
    .find((p) => p.id === presidenteId)
    ?.indicadores.find((i) => i.serieId === serieId);
}

/** Maior ou menor valor de uma série, com o mês em que aconteceu. */
function extremo(dados: DadosSite, serieId: string, tipo: "max" | "min") {
  const s = dados.series[serieId];
  if (!s || s.valores.length === 0) return null;
  let idx = 0;
  s.valores.forEach((v, i) => {
    const melhor = tipo === "max" ? v > s.valores[idx] : v < s.valores[idx];
    if (melhor) idx = i;
  });
  return { valor: s.valores[idx], mes: s.datas[idx] };
}

function benchmark(
  dados: DadosSite,
  presidenteId: string,
  indicadorWb: string,
  regiao: string,
) {
  return dados.presidentes
    .find((p) => p.id === presidenteId)
    ?.benchmark.find((b) => b.indicadorWb === indicadorWb && b.regiao === regiao);
}

function N({ children }: { children: React.ReactNode }) {
  return (
    <strong className="tabular font-semibold" style={{ color: "var(--tinta)" }}>
      {children}
    </strong>
  );
}

/**
 * Monta o destaque e o número-manchete a partir do MESMO indicador.
 *
 * Existe por causa de um erro real: uma seção mostrava o rosto de Dilma
 * Rousseff com o período 2015–2016 e, ao lado, o número 5,40% — que é o
 * desemprego de hoje, do mandato de Lula 3. Rosto de um, número de outro,
 * porque os dois campos eram preenchidos à mão e de forma independente.
 *
 * Derivando ambos de um único par presidente + série, divergir deixa de ser
 * possível.
 */
function foco(
  dados: DadosSite,
  presidenteId: string,
  serieId: string,
  legenda: string,
  campo: "anualizado" | "nivelFinal" = "anualizado",
) {
  const i = ind(dados, presidenteId, serieId);
  const valor =
    campo === "anualizado"
      ? i
        ? anualizado(i)
        : "—"
      : `${numero(i?.valorFinal ?? null)}${i?.unidade.includes("%") ? "%" : ""}`;

  return { destaque: presidenteId, numero: valor, numeroLegenda: legenda };
}

export default async function Home() {
  const dados = await carregarDados();

  const smFhc1 = ind(dados, "fhc_1", "salario_minimo_real");
  const smLula1 = ind(dados, "lula_1", "salario_minimo_real");
  const smBolso = ind(dados, "bolsonaro", "salario_minimo_real");
  const smLula3 = ind(dados, "lula_3", "salario_minimo_real");
  const ipcaLula3 = ind(dados, "lula_3", "ipca");
  const desLula3 = ind(dados, "lula_3", "desemprego");
  const desDilma2 = ind(dados, "dilma_2", "desemprego");
  const desBolso = ind(dados, "bolsonaro", "desemprego");
  const pibDilma2 = ind(dados, "dilma_2", "pib_volume");
  const rendaLula3 = ind(dados, "lula_3", "massa_renda_real");

  const picoDesemprego = extremo(dados, "desemprego", "max");
  const minimaDesemprego = extremo(dados, "desemprego", "min");
  const mundoDesemprego = benchmark(dados, "lula_3", "SL.UEM.TOTL.ZS", "WLD");
  const brasilDesemprego = benchmark(dados, "lula_3", "SL.UEM.TOTL.ZS", "BRA");

  const atos: Ato[] = [
    {
      id: "hoje",
      serieId: "salario_minimo_real",
      titulo: "Onde o Brasil está hoje",
      numero: reais(smLula3?.valorFinal ?? null),
      numeroLegenda: "é o que o salário mínimo compra hoje",
      texto: (
        <>
          <p>
            Comecemos pelo presente. O piso salarial está no maior poder de
            compra da série, o desemprego em{" "}
            <N>{numero(desLula3?.valorFinal ?? null, 1)}%</N>, o menor já
            registrado, e a inflação corre a{" "}
            <N>{ipcaLula3 ? anualizado(ipcaLula3) : "—"}</N>.
          </p>
          <p>
            Nenhum desses três números diz muita coisa sozinho. Um salário
            mínimo de <N>{reais(smLula3?.valorFinal ?? null)}</N> é bom ou ruim
            comparado a quê? É para responder isso que existem os outros trinta
            anos desta linha.
          </p>
        </>
      ),
    },
    {
      id: "poder_de_compra",
      serieId: "salario_minimo_real",
      titulo: "O que o salário mínimo comprava",
      texto: (
        <>
          <p>
            Esta linha é o salário mínimo já descontada a inflação: o que ele
            de fato comprava, e não o número que aparece no papel. Cada dente da
            serra é um reajuste de janeiro seguido da erosão pelos preços ao
            longo do ano.
          </p>
          <p>
            Em julho de 1994 o piso valia{" "}
            <N>{reais(smFhc1?.valorInicial ?? null)}</N> em dinheiro de hoje.
            Triplicou de lá para cá, mas não em linha reta, e não sob todos os
            governos.
          </p>
        </>
      ),
    },
    {
      id: "ganho",
      serieId: "salario_minimo_real",
      ...foco(
        dados,
        "lula_1",
        "salario_minimo_real",
        "de aumento no poder de compra, a cada ano do mandato",
      ),
      titulo: "O período de maior ganho",
      texto: (
        <p>
          Entre 2003 e 2006 o poder de compra do mínimo subiu{" "}
          <N>{smLula1 ? anualizado(smLula1) : "—"}</N>. É o ritmo mais forte de
          qualquer mandato desde o Plano Real.
        </p>
      ),
    },
    {
      id: "perda",
      serieId: "salario_minimo_real",
      ...foco(
        dados,
        "bolsonaro",
        "salario_minimo_real",
        "de perda no poder de compra, a cada ano do mandato",
      ),
      titulo: "E o de maior perda",
      texto: (
        <p>
          Entre 2019 e 2022 o mesmo indicador andou para trás:{" "}
          <N>{smBolso ? anualizado(smBolso) : "—"}</N>. O piso subiu em reais e
          caiu em poder de compra, porque os preços correram mais rápido que o
          reajuste.
        </p>
      ),
    },
    {
      id: "precos",
      serieId: "ipca",
      titulo: "Quem manda no poder de compra é a inflação",
      texto: (
        <>
          <p>
            É a inflação que separa o salário no papel do salário no mercado.
            Depois do Plano Real ela nunca mais voltou aos três dígitos, mas
            ainda decide o que sobra no fim do mês.
          </p>
          <p>
            E é também o indicador em que a comparação entre governos mais
            engana, e a próxima seção mostra por quê.
          </p>
        </>
      ),
    },
    {
      id: "emprego_pico",
      serieId: "desemprego",
      titulo: "Um em cada sete brasileiros",
      numero: `${numero(picoDesemprego?.valor ?? null, 1)}%`,
      numeroLegenda: picoDesemprego
        ? `foi o pico da desocupação, em ${mesPorExtenso(picoDesemprego.mes)}`
        : undefined,
      texto: (
        <>
          <p>
            No auge da pandemia, quase quinze em cada cem brasileiros na força
            de trabalho procuravam emprego e não achavam. É o maior valor desde
            que essa pesquisa existe.
          </p>
          <p>
            A desocupação já vinha subindo antes: saiu de{" "}
            <N>{numero(desDilma2?.valorInicial ?? null, 1)}%</N> em 2015 para{" "}
            <N>{numero(desDilma2?.valorFinal ?? null, 1)}%</N> em 2016, na
            recessão, e ficou em dois dígitos por seis anos seguidos.
          </p>
        </>
      ),
    },
    {
      id: "emprego_hoje",
      serieId: "desemprego",
      titulo: "Hoje é um em cada vinte",
      numero: `${numero(minimaDesemprego?.valor ?? null, 1)}%`,
      numeroLegenda: minimaDesemprego
        ? `o menor valor da série, em ${mesPorExtenso(minimaDesemprego.mes)}`
        : undefined,
      texto: (
        <>
          <p>
            Do pico até a mínima foram menos de cinco anos e uma queda de quase
            dez pontos percentuais. É a maior reviravolta de qualquer indicador
            deste site.
          </p>
          <p>
            E não é só gente empregada: a massa de renda real, que soma tudo o
            que os ocupados ganham, cresce{" "}
            <N>{rendaLula3 ? anualizado(rendaLula3) : "—"}</N> no mandato atual,
            o ritmo mais forte da série. Mais gente trabalhando e mais dinheiro
            circulando ao mesmo tempo.
          </p>
        </>
      ),
    },
    {
      id: "emprego_credito",
      serieId: "desemprego",
      titulo: "E a queda não é de um governo só",
      texto: (
        <>
          <p>
            Aqui os dois lados costumam errar. A desocupação despencou{" "}
            <N>{desBolso ? anualizado(desBolso) : "—"}</N> no mandato de
            Bolsonaro, que recebeu{" "}
            <N>{numero(desBolso?.valorInicial ?? null, 1)}%</N>, atravessou o
            pico da pandemia e entregou{" "}
            <N>{numero(desBolso?.valorFinal ?? null, 1)}%</N>.
          </p>
          <p>
            E continuou caindo{" "}
            <N>{desLula3 ? anualizado(desLula3) : "—"}</N> no mandato de Lula,
            que recebeu <N>{numero(desLula3?.valorInicial ?? null, 1)}%</N> e
            está em <N>{numero(desLula3?.valorFinal ?? null, 1)}%</N>.
          </p>
          <p>
            A queda atravessa os dois. Quem atribui o resultado inteiro a um
            deles está escolhendo onde começar a contar.
          </p>
        </>
      ),
    },
    {
      id: "emprego_mundo",
      serieId: "desemprego",
      titulo: "Mas mínima nossa ainda é alta lá fora",
      numero: `${numero(mundoDesemprego?.mediaPeriodo ?? null, 1)}%`,
      numeroLegenda: "é o desemprego médio do mundo no mesmo período",
      texto: (
        <>
          <p>
            No mandato atual o Brasil tem média de{" "}
            <N>{numero(brasilDesemprego?.mediaPeriodo ?? null, 1)}%</N> contra{" "}
            <N>{numero(mundoDesemprego?.mediaPeriodo ?? null, 1)}%</N> do mundo.
            Recorde para nós, acima da média para o resto.
          </p>
          <p>
            Duas ressalvas que valem para todo mundo: a taxa conta quem procura
            emprego, não a qualidade dele, então informalidade não aparece aqui. E a
            série tem catorze anos, então &ldquo;o menor já registrado&rdquo;
            não é o menor da história do país.
          </p>
          <p className="text-sm" style={{ color: "var(--tinta-3)" }}>
            Antes de 2012 havia outra pesquisa, a PME, mas ela cobria só seis
            regiões metropolitanas e contava como inativo quem desistira de
            procurar trabalho. Emendar as duas criaria um degrau de metodologia,
            não de economia. Por isso FHC, Lula 1, Lula 2 e Dilma 1 aparecem em
            branco neste indicador, e não com zero.
          </p>
        </>
      ),
    },
    {
      id: "pib",
      serieId: "pib_volume",
      ...foco(
        dados,
        "dilma_2",
        "pib_volume",
        "de queda do PIB por ano, o único mandato negativo",
      ),
      titulo: "A única recessão de dois anos",
      texto: (
        <p>
          O PIB real encolheu <N>{pibDilma2 ? anualizado(pibDilma2) : "—"}</N>{" "}
          entre 2015 e 2016, o único mandato com crescimento negativo desde que
          o IBGE mantém a série trimestral.
        </p>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24">
      {/* Barra fina: o título de verdade está na abertura, em corpo grande. */}
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b py-3 text-sm"
        style={{ borderColor: "var(--borda)" }}
      >
        <span className="font-semibold tracking-tight">
          desempenhodogoverno.com.br
        </span>
        <nav className="flex flex-wrap gap-4" style={{ color: "var(--tinta-2)" }}>
          <Link href="/economia" className="hover:underline">Economia</Link>
          <Link href="/economia/municipios" className="hover:underline">Municípios</Link>
          <Link href="/meio-ambiente" className="hover:underline">Meio ambiente</Link>
          <Link href="/dinheiro" className="hover:underline">Dinheiro público</Link>
          {PAGINAS_ECONOMIA.map((p) => <Link key={p.slug} href={rotaEconomia(p)} className="hover:underline">{p.rotulo}</Link>)}
          <a href="#tabela" className="hover:underline">Tabela</a>
          <a href="#mundo" className="hover:underline">Mundo</a>
          <Link href="/metodologia" className="hover:underline">Metodologia</Link><Link href="/sobre" className="hover:underline">Sobre o projeto</Link><Link href="/correcoes" className="hover:underline">Relatar um erro</Link>
        </nav>
      </header>

      <Abertura dados={dados} />

      <Narrativa dados={dados} atos={atos} />

      <Regua presidentes={dados.presidentes} />
      <Benchmark presidentes={dados.presidentes} />
      <Heranca presidentes={dados.presidentes} />
      <Tabela presidentes={dados.presidentes} />
      <Jogo presidentes={dados.presidentes} />

      <div className="py-8">
        <Newsletter origem="fim-da-pagina" />
      </div>

      <div className="border-t py-8" style={{ borderColor: "var(--borda)" }}>
        {/* O rótulo tem que nomear o indicador que os números são. Uma versão
            anterior desta frase dizia "inflação de" e mostrava os valores de
            salário mínimo real. */}
        <Compartilhar
          mensagem={
            `Os nove governos brasileiros desde o Plano Real, medidos com a mesma régua. ` +
            `Poder de compra do salário mínimo: ` +
            `${smLula3 ? anualizado(smLula3) : "—"} no mandato atual, ` +
            `${smBolso ? anualizado(smBolso) : "—"} no anterior.`
          }
        />
      </div>

      <footer
        className="mt-8 border-t pt-6 text-sm"
        style={{ borderColor: "var(--borda)", color: "var(--tinta-3)" }}
      >
        <p className="max-w-prose">
          Fontes: Banco Central do Brasil (SGS), IBGE (SIDRA) e World Bank. Todo
          código de série foi conferido contra o catálogo oficial da fonte.{" "}
          <Link href="/metodologia" className="underline">
            Como os números são calculados
          </Link>
          .
        </p>
        <p className="mt-3">
          Dados atualizados em{" "}
          {new Date(dados.geradoEm).toLocaleDateString("pt-BR")}.
        </p>
      </footer>
    </div>
  );
}
