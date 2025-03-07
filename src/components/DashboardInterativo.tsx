"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { President, Indicator } from "@/services/sheets";
import { formatDate } from "@/utils/formatDate";

interface DashboardInterativoProps {
  presidents: President[];
  indicators: Indicator[];
}

export function DashboardInterativo({
  presidents,
  indicators,
}: DashboardInterativoProps) {
  const [selectedIndicator, setSelectedIndicator] =
    useState<string>("historicoIPCA");
  const [selectedPresidents, setSelectedPresidents] = useState<string[]>([]);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);

  const indicatorOptions = [
    { value: "historicoIPCA", label: "Inflação (IPCA)", unit: "%" },
    { value: "historicoCambio", label: "Câmbio (PTAX)", unit: "R$" },
    { value: "historicoSelic", label: "Taxa SELIC", unit: "%" },
    { value: "historicoDesemprego", label: "Taxa de Desemprego", unit: "%" },
  ];

  const togglePresident = (id: string) => {
    if (selectedPresidents.includes(id)) {
      setSelectedPresidents(selectedPresidents.filter((p) => p !== id));
    } else {
      setSelectedPresidents([...selectedPresidents, id]);
    }
  };

  const getIndicatorLabel = () => {
    return (
      indicatorOptions.find((opt) => opt.value === selectedIndicator)?.label ||
      ""
    );
  };

  const getIndicatorUnit = () => {
    return (
      indicatorOptions.find((opt) => opt.value === selectedIndicator)?.unit ||
      ""
    );
  };

  // Função para normalizar os dados históricos para o gráfico
  const getNormalizedData = () => {
    if (selectedPresidents.length === 0) return [];

    // Obter todos os dados históricos dos presidentes selecionados
    const allData: { date: string; [key: string]: string | number }[] = [];

    selectedPresidents.forEach((presidentId) => {
      const president = presidents.find((p) => p.id === presidentId);
      const indicator = indicators.find((i) => i.presidente === presidentId);

      if (!president || !indicator) return;

      const historicalData = indicator[
        selectedIndicator as keyof typeof indicator
      ] as { date: string; value: number }[];

      if (!historicalData || !Array.isArray(historicalData)) return;

      historicalData.forEach((item) => {
        const existingEntry = allData.find((d) => d.date === item.date);

        if (existingEntry) {
          existingEntry[president.nome] = item.value;
        } else {
          const newEntry: { date: string; [key: string]: string | number } = {
            date: item.date,
          };
          newEntry[president.nome] = item.value;
          allData.push(newEntry);
        }
      });
    });

    return allData.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  };

  // Função para obter os períodos de mandato para destacar no gráfico
  const getPresidentialPeriods = () => {
    return selectedPresidents
      .map((presidentId) => {
        const president = presidents.find((p) => p.id === presidentId);
        if (!president) return null;

        return {
          name: president.nome,
          start: president.inicio,
          end: president.fim,
          color: getPresidentColor(presidentId),
        };
      })
      .filter(Boolean);
  };

  // Função para atribuir cores diferentes a cada presidente
  const getPresidentColor = (id: string): string => {
    const colors = [
      "#3b82f6", // blue
      "#ef4444", // red
      "#10b981", // green
      "#f59e0b", // amber
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#f97316", // orange
    ];

    const index = presidents.findIndex((p) => p.id === id) % colors.length;
    return colors[index];
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      const formattedDate = date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Encontrar em qual mandato presidencial esta data se encaixa
      const presidentsForDate = selectedPresidents
        .map((id) => {
          const president = presidents.find((p) => p.id === id);
          if (!president) return null;

          const startDate = new Date(president.inicio);
          const endDate = new Date(president.fim);

          if (date >= startDate && date <= endDate) {
            return president;
          }
          return null;
        })
        .filter(Boolean);

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">
            {formattedDate}
          </p>

          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center mb-1">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700">{entry.name}: </span>
              <span
                className="text-sm font-medium ml-1"
                style={{ color: entry.color }}
              >
                {entry.value.toFixed(2)}
                {getIndicatorUnit()}
              </span>
            </div>
          ))}

          {presidentsForDate.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Mandato: {presidentsForDate.map((p) => p?.nome).join(", ")}
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const handleLineMouseEnter = (dataKey: any) => {
    if (typeof dataKey === "string") {
      setHoveredLine(dataKey);
    }
  };

  const handleLineMouseLeave = () => {
    setHoveredLine(null);
  };

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 mb-8">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
        Dashboard Interativo
      </h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o indicador:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {indicatorOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedIndicator(option.value)}
              className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                selectedIndicator === option.value
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione os presidentes para visualizar:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {presidents.map((president) => {
            const color = getPresidentColor(president.id);
            return (
              <div
                key={president.id}
                className={`flex items-center p-2 rounded-lg transition-colors ${
                  selectedPresidents.includes(president.id)
                    ? "bg-gray-100"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => togglePresident(president.id)}
              >
                <input
                  type="checkbox"
                  id={`dashboard-president-${president.id}`}
                  checked={selectedPresidents.includes(president.id)}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  style={{ accentColor: color }}
                />
                <label
                  htmlFor={`dashboard-president-${president.id}`}
                  className="ml-2 block text-sm text-gray-900 cursor-pointer"
                >
                  <span className="font-medium">{president.nome}</span>
                  <span className="text-xs text-gray-500 block">
                    {new Date(president.inicio).getFullYear()} -{" "}
                    {new Date(president.fim).getFullYear()}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {selectedPresidents.length > 0 ? (
        <div className="h-96 relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={getNormalizedData()}
              margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getFullYear()}`;
                }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(value) =>
                  `${value.toFixed(1)}${getIndicatorUnit()}`
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 10 }}
                onMouseEnter={(e) => handleLineMouseEnter(e.dataKey)}
                onMouseLeave={handleLineMouseLeave}
              />

              {/* Áreas de referência para os períodos presidenciais */}
              {getPresidentialPeriods().map((period: any, index: number) => {
                if (!period) return null;
                const startDate = new Date(period.start);
                const endDate = new Date(period.end);

                // Verificar se há dados para este período
                const data = getNormalizedData();
                if (data.length === 0) return null;

                // Encontrar as datas mais próximas no conjunto de dados
                const firstDate = new Date(data[0].date);
                const lastDate = new Date(data[data.length - 1].date);

                // Ajustar as datas para estarem dentro do intervalo de dados
                const adjustedStart =
                  startDate < firstDate ? firstDate : startDate;
                const adjustedEnd = endDate > lastDate ? lastDate : endDate;

                return (
                  <ReferenceArea
                    key={`period-${index}`}
                    x1={adjustedStart.toISOString().split("T")[0]}
                    x2={adjustedEnd.toISOString().split("T")[0]}
                    strokeOpacity={0}
                    fill={period.color}
                    fillOpacity={0.05}
                  />
                );
              })}

              {selectedPresidents.map((presidentId) => {
                const president = presidents.find((p) => p.id === presidentId);
                if (!president) return null;

                const color = getPresidentColor(presidentId);
                const isHovered = hoveredLine === president.nome;

                return (
                  <Line
                    key={presidentId}
                    type="monotone"
                    dataKey={president.nome}
                    stroke={color}
                    strokeWidth={isHovered ? 3 : 2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      fill: color,
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-lg font-medium mb-2">
            Selecione presidentes para visualizar
          </p>
          <p className="text-sm text-gray-400">
            Escolha pelo menos um presidente para ver a evolução do indicador ao
            longo do tempo
          </p>
        </div>
      )}
    </div>
  );
}
