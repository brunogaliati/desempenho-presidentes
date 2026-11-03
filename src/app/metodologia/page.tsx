import Link from "next/link";
import type { Metadata } from "next";
import { metadataPagina } from "@/lib/seo";
import retratos from "../../../public/presidentes/fontes.json";
import governadores from "../../../public/prototipo/governadores/fontes.json";

export const metadata: Metadata = metadataPagina("Metodologia · Desempenho do Governo", "Como os indicadores são calculados: anualização, cobertura de dados, herança entre mandatos e comparação internacional.", "/metodologia");

/**
 * A página que sustenta o resto do site.
 *
 * Num ano eleitoral, um site que compara governos vai ser acusado de viés
 * pelos dois lados. A defesa não é o gráfico — é isto aqui estar público,
 * escrito de forma que o leitor consiga conferir.
 *
 * Conteúdo derivado de `backend/README.md`, reescrito em tom de leitor.
 */

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-t py-8" style={{ borderColor: "var(--borda)" }}>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-3 max-w-prose space-y-3 text-[15px] leading-relaxed"
           style={{ color: "var(--tinta-2)" }}>
        {children}
      </div>
    </section>
  );
}

export default function Metodologia() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <header className="py-6">
        <Link href="/" className="text-sm hover:underline" style={{ color: "var(--tinta-2)" }}>
          ← Voltar
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Metodologia</h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed"
           style={{ color: "var(--tinta-2)" }}>
          Este site existe porque quase toda comparação entre governos no Brasil
          é feita com o número que favorece quem está comparando. Aqui a regra é
          uma só, aplicada igual a todos os mandatos, inclusive quando o
          resultado desagrada.
        </p>
      </header>

      <Secao titulo="Todo número é anual">
        <p>
          Os mandatos duraram tempos diferentes. Dilma 2 durou 1 ano e 8 meses
          até o impeachment; Temer, 2 anos e 4 meses; os demais, 4 anos. Somar a
          inflação de cada período mede duração, não desempenho.
        </p>
        <p>
          Por isso tudo aqui é convertido em taxa anual. E a inflação é composta,
          nunca somada: 1% ao mês por 12 meses dá 12,68% ao ano, não 12%.
        </p>
        <p>
          Indicadores que já são porcentagem, como desemprego e dívida sobre o PIB,
          aparecem em <strong>pontos percentuais por ano</strong>. Desemprego
          que cai de 12% para 8% caiu 4 pontos; dizer que &ldquo;caiu 33%&rdquo;
          é aritmeticamente verdadeiro e comunicativamente enganoso.
        </p>
      </Secao>

      <Secao titulo="Nada atravessa o Plano Real">
        <p>
          Nenhum dado anterior a 1º de julho de 1994 entra nas contas. Antes
          disso os valores estavam em cruzeiros reais e a inflação corria a três
          dígitos ao ano. A série do salário mínimo chega a misturar 64,79 e
          147.627,08 no mesmo ano de 1994.
        </p>
        <p>
          Sem essa trava, a tendência que FHC herdou apareceria como inflação de
          1.518% ao ano e juros reais de −80%: aritmética correta sobre dados que
          não pertencem à mesma economia.
        </p>
      </Secao>

      <Secao titulo="Falta de dado é resultado, não zero">
        <p>
          A PNAD Contínua, que mede o desemprego hoje, começou em 2012. FHC,
          Lula 1, Lula 2 e Dilma 1 não têm taxa de desemprego nesta metodologia,
          e o site marca a célula como vazia com a explicação.
        </p>
        <p>
          Isso não significa que ninguém media desemprego antes. A Pesquisa
          Mensal de Emprego funcionou até março de 2016, e a PNAD anual, por
          décadas. Elas não entram aqui porque não são comparáveis: a PME cobria
          apenas seis regiões metropolitanas (Recife, Salvador, Belo Horizonte,
          Rio de Janeiro, São Paulo e Porto Alegre), e não o país, e
          classificava como inativo quem havia desistido de procurar trabalho,
          o que reduz a taxa. A PNAD Contínua é nacional e resultou justamente
          da fusão das duas.
        </p>
        <p>
          Emendar as séries numa linha só criaria um degrau que é de
          metodologia, não de economia. Existem trabalhos acadêmicos que
          reconstroem a PNAD Contínua para trás, mas são estimativas, não
          estatística oficial, e este site só publica o que a fonte publica.
        </p>
        <p>
          A versão anterior deste projeto gravava zero nesses casos, e a página
          exibia &ldquo;variação de 0%&rdquo;, uma afirmação falsa sobre
          governos que simplesmente não têm o dado.
        </p>
        <p>
          Cada indicador carrega um de três estados: <strong>completo</strong>{" "}
          (cobre pelo menos 95% do mandato), <strong>parcial</strong> (cobre
          menos, e o site avisa) ou <strong>indisponível</strong>.
        </p>
      </Secao>

      <Secao titulo="Herança e tendência prévia">
        <p>
          Nenhum presidente recebe uma economia zerada. Para cada indicador o
          site calcula o nível herdado na posse e o ritmo que já vinha nos 24
          meses anteriores. A janela termina no dia anterior à posse, para não
          contaminar o &ldquo;antes&rdquo; com o primeiro dado do mandato.
        </p>
        <p>
          Isso responde o que o número isolado não responde: o governo mudou a
          direção, ou seguiu o que já estava em curso?
        </p>
      </Secao>

      <Secao titulo="O mundo no mesmo período">
        <p>
          Cada indicador é comparado com a média da América Latina, dos países de
          renda média e do mundo, no mesmo intervalo de cada mandato, com dados
          do World Bank.
        </p>
        <p>
          É a única forma honesta de separar política doméstica de choque global.
          A inflação de 2021-22 subiu no mundo inteiro e a recessão de 2020 foi
          global. Atribuir esses movimentos a um presidente sem mostrar o
          contrafactual é desinformação, mesmo com os números certos.
        </p>
      </Secao>

      <Secao titulo="Câmbio usa média, não um dia">
        <p>
          A cotação de um único dia perto da posse é ruído. As pontas do câmbio
          usam a média do primeiro e do último trimestre, para que um pico
          isolado não defina o mandato inteiro.
        </p>
      </Secao>

      <Secao titulo="Sem nota, mas com posição">
        <p>
          Duas coisas costumam ser confundidas, e o site trata cada uma de um
          jeito.
        </p>
        <p>
          <strong>Nota</strong> seria um número único somando indicadores, com
          pesos que eu escolheria. Quanto vale um ponto de inflação contra um
          ponto de desemprego? Não existe resposta técnica para isso, só
          preferência. Por isso o site não dá nota, e nunca vai dar.
        </p>
        <p>
          <strong>Posição num indicador</strong> é outra coisa. Dizer que um
          mandato teve a terceira menor inflação entre os que têm esse dado é
          ordenar uma grandeza medida, não emitir julgamento. Isso o site mostra,
          nas páginas de cada presidente.
        </p>
        <p>
          A base é sempre declarada junto. O desemprego só existe para cinco dos
          nove mandatos, então a colocação nesse indicador diz &ldquo;entre os
          cinco com esse dado&rdquo;, e não &ldquo;entre os nove&rdquo;.
        </p>
        <p>
          Onde subir é inequivocamente melhor ou pior, o site mostra a direção.
          Onde é ambíguo, como câmbio e juros, não mostra nenhuma nem atribui
          colocação: dólar alto é bom para quem exporta e ruim para quem viaja,
          e ordenar isso seria opinião disfarçada de dado.
        </p>
      </Secao>

      <Secao titulo="Períodos seguidos de governo">
        <p>
          Quando a mesma pessoa governou mandatos consecutivos, o site também
          mede o período inteiro de uma vez: FHC de 1995 a 2002, Lula de 2003 a
          2010, Dilma de 2011 a 2016. É o que responde &ldquo;como foi o governo
          FHC&rdquo; sem fingir que oito anos foram um mandato só.
        </p>
        <p>
          O cálculo é exatamente o mesmo dos mandatos, aplicado ao intervalo
          completo. Não é média dos dois números: é o dado do período inteiro,
          o que faz o mandato mais longo pesar mais, como deve.
        </p>
        <p>
          Só vale quando não houve interrupção. Lula tem dois períodos
          separados, 2003–2010 e 2023–2026, porque doze anos fora do cargo os
          separam e um número atravessando esse intervalo não descreveria
          governo nenhum.
        </p>
      </Secao>

      <Secao titulo="As fontes, e como foram conferidas">
        <p>
          Banco Central do Brasil (SGS), IBGE (SIDRA) e World Bank. Nenhum código
          de série foi escrito de memória: cada um foi confirmado contra a
          resposta real da API e, quando possível, contra o catálogo oficial.
        </p>
        <p>
          Isso não é zelo decorativo. A versão anterior deste projeto rotulava a
          série 4513 do Banco Central como &ldquo;resultado primário&rdquo;
          quando ela é, na verdade, a <strong>Dívida Líquida do Setor
          Público</strong>, e publicou o rótulo errado por dois anos.
        </p>
        <p>
          A série do salário mínimo, que não aparece no catálogo público do
          Banco Central, foi validada comparando os 35 valores legais de reajuste
          entre 1995 e 2026 com a série. Bateu em 35 de 35, com diferença zero.
        </p>
      </Secao>

      <Secao titulo="Onde este site ainda é incompleto">
        <p>
          O recorte é econômico. Violência é hoje a principal preocupação do
          eleitor brasileiro e não está aqui. Saúde e educação também não.
        </p>
        <p>
          O mandato em curso é comparado com mandatos completos, o que sempre
          embute alguma injustiça, mesmo com tudo anualizado.
        </p>
        <p>
          E o poder de compra é medido pelo salário mínimo, que é um bom símbolo
          mas não é a renda de todo mundo.
        </p>
      </Secao>

      <Secao titulo="Créditos das fotografias">
        <p>Fotos da época de cada mandato, exibidas com recorte circular. As novas imagens foram redimensionadas, sem alterar as feições.</p>
        <ul className="space-y-2 text-sm">
          {retratos.map((foto) => (
            <li key={foto.id}>
              <a href={foto.fonte} className="underline" title={`Data da fotografia: ${foto.data}`}>{foto.mandato}</a>
              {" — "}{foto.autor}.{" "}
              <a href={foto.licencaUrl} className="underline">{foto.licenca}</a>.
            </li>
          ))}
        </ul>
        <details>
          <summary className="cursor-pointer font-medium">Fotografias de governadores</summary>
          <p className="mt-2">Imagens redimensionadas e exibidas com recorte circular.</p>
          <ul className="mt-2 space-y-2 text-sm">
            {governadores.map((foto) => (
              <li key={`${foto.uf}-${foto.nome}`}>
                <a href={foto.fonte} className="underline" title={`Data da fotografia: ${foto.data}`}>{foto.nome} · {foto.uf}</a>
                {" — "}{foto.autor}.{" "}<a href={foto.licencaUrl} className="underline">{foto.licenca}</a>.
              </li>
            ))}
          </ul>
        </details>
      </Secao>

      <footer className="border-t py-8" style={{ borderColor: "var(--borda)" }}>
        <Link href="/" className="text-sm hover:underline" style={{ color: "var(--serie)" }}>
          ← Ver os números
        </Link>
      </footer>
    </div>
  );
}
