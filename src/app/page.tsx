import getSheetData from "@/services/sheets";
import { MetricCard } from "@/components/MetricCard";
import { ShareButtons } from "@/components/ShareButtons";
import { TwitterFollow } from "@/components/TwitterFollow";
import Image from "next/image";

export default async function Home() {
  const { presidents, indicators } = await getSheetData();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6">
      <main className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block animate-bounce mb-2">
            <span className="text-4xl text-black">🏛️</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">
              Desempenho por Presidente
            </span>{" "}
            <span className="text-black">🇧🇷</span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-4 max-w-2xl mx-auto">
            Acompanhe a evolução dos principais indicadores econômicos durante
            cada mandato presidencial do Brasil.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm">
              <span className="text-black">📈</span> Variação da Inflação
            </div>
            <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm">
              <span className="text-black">💵</span> Variação do Dólar
            </div>
            <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm">
              <span className="text-black">🏦</span> Variação da SELIC
            </div>
            <div className="flex items-center gap-2 text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm">
              <span className="text-black">👥</span> Variação do Desemprego
            </div>
          </div>
          <TwitterFollow />
        </div>

        <div className="space-y-8">
          {presidents.map((president) => {
            const indicator = indicators.find(
              (i): i is NonNullable<typeof i> => i?.presidente === president.id
            );
            if (!indicator) return null;

            return (
              <div
                key={president.id}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="md:w-1/4 text-center">
                    <Image
                      src={president.foto}
                      alt={president.nome}
                      width={160}
                      height={160}
                      className="rounded-full object-cover border-4 border-gray-100 mx-auto mb-4 shadow-md"
                    />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                      {president.nome}
                    </h2>
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mb-2">
                      📅 {new Date(president.inicio).getFullYear()} →{" "}
                      {new Date(president.fim).getFullYear()}
                    </p>
                    <ShareButtons
                      president={president.nome}
                      period={`${new Date(
                        president.inicio
                      ).getFullYear()} - ${new Date(
                        president.fim
                      ).getFullYear()}`}
                      indicators={{
                        inflacao: `${indicator.inflacaoAcumulada.toFixed(2)}%`,
                        cambio: `${indicator.variacaoCambial.toFixed(2)}%`,
                        selic: `${indicator.variacaoSelic.toFixed(2)}%`,
                        desemprego:
                          indicator.variacaoDesemprego !== null
                            ? `${indicator.variacaoDesemprego.toFixed(2)}%`
                            : undefined,
                      }}
                    />
                  </div>

                  <div className="md:w-3/4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MetricCard
                      title="Inflação acumulada (IPCA)"
                      value={`${indicator.inflacaoAcumulada.toFixed(2)}%`}
                      label={`até ${new Date(
                        indicator.dataFinalIPCA
                      ).toLocaleDateString("pt-BR")}`}
                      icon="📈"
                      tooltip="Inflação acumulada no período (IPCA)"
                      showInitialValue={false}
                      historicalData={indicator.historicoIPCA}
                      chartColor="#ef4444"
                      type="bar"
                    />
                    <MetricCard
                      title="Variação do Dólar"
                      value={`${indicator.variacaoCambial.toFixed(2)}%`}
                      label={`até ${new Date(
                        indicator.dataFinalDolar
                      ).toLocaleDateString("pt-BR")}`}
                      icon="💵"
                      tooltip="Variação percentual do dólar durante o mandato"
                      initialValue={`R$ ${indicator.valorInicialDolar?.toFixed(
                        2
                      )}`}
                      finalValue={`R$ ${indicator.valorFinalDolar?.toFixed(2)}`}
                      showInitialValue={true}
                      historicalData={indicator.historicoCambio}
                      chartColor="#10b981"
                    />
                    <MetricCard
                      title="Variação da SELIC"
                      value={`${indicator.variacaoSelic.toFixed(2)}%`}
                      label={`até ${new Date(
                        indicator.dataFinalSelic
                      ).toLocaleDateString("pt-BR")}`}
                      icon="🏦"
                      tooltip="Variação percentual da taxa SELIC durante o mandato"
                      initialValue={`${
                        indicator.valorInicialSelic?.toFixed(2) ?? 0
                      }%`}
                      finalValue={`${
                        indicator.valorFinalSelic?.toFixed(2) ?? 0
                      }%`}
                      showInitialValue={true}
                      historicalData={indicator.historicoSelic}
                      chartColor="#f59e0b"
                    />
                    {indicator.variacaoDesemprego !== null && (
                      <MetricCard
                        title="Variação do Desemprego"
                        value={`${indicator.variacaoDesemprego.toFixed(2)}%`}
                        label={`até ${new Date(
                          indicator.dataFinalDesemprego!
                        ).toLocaleDateString("pt-BR")}`}
                        icon="👥"
                        tooltip="Variação percentual da taxa de desemprego durante o mandato"
                        initialValue={`${indicator.valorInicialDesemprego?.toFixed(
                          2
                        )}%`}
                        finalValue={`${indicator.valorFinalDesemprego?.toFixed(
                          2
                        )}%`}
                        showInitialValue={true}
                        historicalData={indicator.historicoDesemprego}
                        chartColor="#ef4444"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center text-sm text-gray-500 mt-8">
          <p>
            Fonte:{" "}
            <a
              href="https://www.bcb.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-gray-800 underline"
            >
              Banco Central do Brasil
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
