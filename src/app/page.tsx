import getSheetData from "@/services/sheets";

export default async function Home() {
  const { presidents, indicators } = await getSheetData();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <main className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-center text-gray-800">
          🏛️ Desempenho Econômico dos Presidentes
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Acompanhamento dos principais indicadores econômicos por mandato
        </p>

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
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
                      📅 {new Date(president.inicio).getFullYear()} →{" "}
                      {new Date(president.fim).getFullYear()}
                    </p>
                  </div>

                  <div className="md:w-3/4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                      <MetricCard
                        title="Inflação acumulada (IPCA)"
                        value={`${indicator.inflacaoAcumulada.toFixed(2)}%`}
                        label={`até ${new Date(
                          indicator.dataFinalIPCA
                        ).toLocaleDateString("pt-BR")}`}
                        icon="📈"
                        tooltip="Inflação acumulada no período (IPCA)"
                        showInitialValue={false}
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
                        finalValue={`R$ ${indicator.valorFinalDolar?.toFixed(
                          2
                        )}`}
                        showInitialValue={true}
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
                        />
                      )}
                    </div>
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

function MetricCard({
  title,
  value,
  label,
  icon,
  tooltip,
  initialValue,
  finalValue,
  showInitialValue = true,
}: {
  title: string;
  value: string;
  label: string;
  icon: string;
  tooltip: string;
  initialValue?: string;
  finalValue?: string;
  showInitialValue?: boolean;
}) {
  return (
    <div
      className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full flex flex-col"
      title={tooltip}
    >
      <div className="flex items-center gap-2 text-gray-600 mb-3">
        <span>{icon}</span>
        <span className="text-sm font-medium">{title}</span>
      </div>

      {showInitialValue && initialValue && finalValue && (
        <div className="text-sm text-gray-500 mb-3">
          <div className="flex items-baseline gap-1">
            <span>{initialValue}</span>
            <span className="text-gray-300 mx-1">→</span>
            <span>{finalValue}</span>
          </div>
        </div>
      )}

      <div className="mt-auto">
        <p className="text-3xl font-bold text-gray-800 mb-1">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
