"use client";

import { useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { TwitterFollow } from "@/components/TwitterFollow";
import { MetricShareButtons } from "@/components/MetricShareButtons";
import { SubscribeModal } from "@/components/SubscribeModal";
import { ComparePresidents } from "@/components/ComparePresidents";
import { DashboardInterativo } from "@/components/DashboardInterativo";
import { RadarChartComponent } from "@/components/RadarChart";
import Image from "next/image";

export function MainContent({ presidents, indicators }: any) {
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("presidentes");

  const getIndicatorDescription = (title: string) => {
    if (title.includes("Dólar")) {
      return "Taxa de câmbio PTAX - média diária calculada pelo Banco Central do Brasil. A variação é calculada entre a PTAX do primeiro e último dia útil do período.";
    }
    if (title.includes("Inflação")) {
      return "IPCA acumulado durante o período do mandato. Mandatos mais longos tendem a apresentar inflação acumulada maior devido ao maior período de acumulação.";
    }
    if (title.includes("SELIC")) {
      return "Taxa SELIC - taxa básica de juros da economia brasileira, definida pelo Comitê de Política Monetária (Copom).";
    }
    if (title.includes("Desemprego")) {
      return "Taxa de desemprego medida pela Pesquisa Nacional por Amostra de Domicílios Contínua (PNAD Contínua) do IBGE.";
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-3 md:p-6">
      <main className="max-w-5xl mx-auto">
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-block animate-bounce mb-2">
            <span className="text-3xl md:text-4xl text-black">🏛️</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold mb-2">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">
              Desempenho por Presidente
            </span>{" "}
            <span className="text-black">🇧🇷</span>
          </h1>
          <p className="text-sm md:text-lg text-gray-600 mb-4 max-w-2xl mx-auto px-2">
            Acompanhe a evolução dos principais indicadores econômicos durante
            cada mandato presidencial do Brasil.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4 px-2">
            <div className="flex items-center gap-1 text-gray-600 bg-white px-2 py-1 md:px-3 md:py-1.5 rounded-full shadow-sm text-xs md:text-sm">
              <span className="text-black">📈</span> Inflação
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
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <TwitterFollow />
            <button
              onClick={() => setIsSubscribeModalOpen(true)}
              className="text-sm bg-blue-50 px-3 py-1.5 rounded-full text-blue-600 hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
            >
              <span>📫</span> Receber atualizações
            </button>
          </div>
        </div>

        {/* Tabs de navegação */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-full shadow-sm p-1 flex">
            <button
              onClick={() => setActiveTab("presidentes")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "presidentes"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Por Presidente
            </button>
            <button
              onClick={() => setActiveTab("comparacao")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "comparacao"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Comparação
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "dashboard"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("radar")}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === "radar"
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Radar
            </button>
          </div>
        </div>

        {/* Conteúdo da aba "Por Presidente" */}
        {activeTab === "presidentes" && (
          <div className="space-y-4 md:space-y-8">
            {presidents.map((president: any) => {
              const indicator = indicators.find(
                (i: any): i is NonNullable<typeof i> =>
                  i?.presidente === president.id
              );
              if (!indicator) return null;

              return (
                <div
                  key={president.id}
                  className="bg-white rounded-xl md:rounded-2xl px-4 py-3 md:px-5 md:py-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                    <div className="md:w-1/4 text-center">
                      <Image
                        src={president.foto}
                        alt={president.nome}
                        width={120}
                        height={120}
                        className="rounded-full object-cover border-4 border-gray-100 mx-auto mb-3 shadow-md md:w-[160px] md:h-[160px]"
                      />
                      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1 md:mb-2">
                        {president.nome}
                      </h2>
                      <p className="text-xs md:text-sm text-gray-500 flex items-center justify-center gap-1 mb-2">
                        📅 {new Date(president.inicio).getFullYear()} →{" "}
                        {new Date(president.fim).getFullYear()}
                      </p>
                    </div>

                    <div className="md:w-3/4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
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
                          president={president.nome}
                          period={`${new Date(
                            president.inicio
                          ).getFullYear()} - ${new Date(
                            president.fim
                          ).getFullYear()}`}
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
                          finalValue={`R$ ${indicator.valorFinalDolar?.toFixed(
                            2
                          )}`}
                          showInitialValue={true}
                          historicalData={indicator.historicoCambio}
                          chartColor="#10b981"
                          president={president.nome}
                          period={`${new Date(
                            president.inicio
                          ).getFullYear()} - ${new Date(
                            president.fim
                          ).getFullYear()}`}
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
                          president={president.nome}
                          period={`${new Date(
                            president.inicio
                          ).getFullYear()} - ${new Date(
                            president.fim
                          ).getFullYear()}`}
                        />
                        {indicator.variacaoDesemprego !== null && (
                          <MetricCard
                            title="Variação do Desemprego"
                            value={`${indicator.variacaoDesemprego.toFixed(
                              2
                            )}%`}
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
                            president={president.nome}
                            period={`${new Date(
                              president.inicio
                            ).getFullYear()} - ${new Date(
                              president.fim
                            ).getFullYear()}`}
                          />
                        )}
                      </div>
                      <div className="mt-2 md:mt-1 flex justify-end">
                        <MetricShareButtons
                          president={president.nome}
                          period={`${new Date(
                            president.inicio
                          ).getFullYear()} - ${new Date(
                            president.fim
                          ).getFullYear()}`}
                          indicators={indicator}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Conteúdo da aba "Comparação" */}
        {activeTab === "comparacao" && (
          <ComparePresidents presidents={presidents} indicators={indicators} />
        )}

        {/* Conteúdo da aba "Dashboard" */}
        {activeTab === "dashboard" && (
          <DashboardInterativo
            presidents={presidents}
            indicators={indicators}
          />
        )}

        {/* Conteúdo da aba "Radar" */}
        {activeTab === "radar" && (
          <RadarChartComponent
            presidents={presidents}
            indicators={indicators}
          />
        )}

        <SubscribeModal
          isOpen={isSubscribeModalOpen}
          onClose={() => setIsSubscribeModalOpen(false)}
        />
      </main>
    </div>
  );
}
