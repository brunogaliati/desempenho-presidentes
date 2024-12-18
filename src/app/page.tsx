import getSheetData from "@/services/sheets";
import { MetricCard } from "@/components/MetricCard";
import { ShareButtons } from "@/components/ShareButtons";
import { TwitterFollow } from "@/components/TwitterFollow";

export default async function Home() {
  const { presidents, indicators } = await getSheetData();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <main className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center text-gray-800">
          🏛️ Desempenho Econômico dos Presidentes
        </h1>
        <p className="text-center text-gray-600 mb-2">
          Acompanhamento dos principais indicadores econômicos por mandato
        </p>
        <TwitterFollow />

        <div className="space-y-8">
          {presidents.map((president) => {
            const indicator = indicators.find(
              (i) => i.presidente === president.id
            );
            if (!indicator) return null;

            return (
              <div
                key={president.id}
                className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="md:w-1/4 text-center">
                    <img
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
                      title="Câmbio"
                      value={`${indicator.variacaoCambial.toFixed(2)}%`}
                      label={`até ${new Date(
                        indicator.dataFinalDolar
                      ).toLocaleDateString("pt-BR")}`}
                      icon="💵"
                      tooltip="Variação cambial do dólar no período"
                      initialValue={`R$ ${indicator.valorInicialDolar?.toFixed(
                        2
                      )}`}
                      finalValue={`R$ ${indicator.valorFinalDolar?.toFixed(2)}`}
                      showInitialValue={true}
                      historicalData={indicator.historicoCambio}
                      chartColor="#10b981"
                    />
                    <MetricCard
                      title="SELIC"
                      value={`${indicator.variacaoSelic.toFixed(2)}%`}
                      label={`até ${new Date(
                        indicator.dataFinalSelic
                      ).toLocaleDateString("pt-BR")}`}
                      icon="🏦"
                      tooltip="Variação da taxa SELIC no período"
                      initialValue={`${indicator.valorInicialSelic.toFixed(
                        2
                      )}%`}
                      finalValue={`${indicator.valorFinalSelic.toFixed(2)}%`}
                      showInitialValue={true}
                      historicalData={indicator.historicoSelic}
                      chartColor="#f59e0b"
                    />
                    {indicator.variacaoDesemprego !== null && (
                      <MetricCard
                        title="Desemprego"
                        value={`${indicator.variacaoDesemprego.toFixed(2)}%`}
                        label={`até ${new Date(
                          indicator.dataFinalDesemprego!
                        ).toLocaleDateString("pt-BR")}`}
                        icon="👥"
                        tooltip="Variação da taxa de desemprego no período"
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
      </main>
    </div>
  );
}
