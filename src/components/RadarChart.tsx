"use client";

import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { President, Indicator } from "@/services/sheets";

interface RadarChartComponentProps {
  presidents: President[];
  indicators: Indicator[];
}

export function RadarChartComponent({
  presidents,
  indicators,
}: RadarChartComponentProps) {
  const [selectedPresidents, setSelectedPresidents] = useState<string[]>([]);
  const [hoveredPresident, setHoveredPresident] = useState<string | null>(null);

  const togglePresident = (id: string) => {
    if (selectedPresidents.includes(id)) {
      setSelectedPresidents(selectedPresidents.filter((p) => p !== id));
    } else {
      setSelectedPresidents([...selectedPresidents, id]);
    }
  };

  // Normaliza os valores para uma escala de 0-100 para melhor visualização no radar
  const normalizeValue = (value: number, min: number, max: number): number => {
    if (min === max) return 50; // Valor médio se min e max forem iguais
    return ((value - min) / (max - min)) * 100;
  };

  // Inverte valores para indicadores onde menor é melhor (inflação, desemprego, etc)
  const invertIfNeeded = (value: number, indicatorName: string): number => {
    // Lista de indicadores onde menor valor é melhor
    const invertedIndicators = [
      "inflacaoAcumulada",
      "variacaoCambial",
      "variacaoDesemprego",
    ];

    if (invertedIndicators.includes(indicatorName)) {
      return 100 - value;
    }

    return value;
  };

  const getRadarData = () => {
    if (selectedPresidents.length === 0) return [];

    // Definir os indicadores que serão exibidos no radar
    const radarIndicators = [
      {
        key: "inflacaoAcumulada",
        name: "Inflação",
        description: "Menor inflação = melhor pontuação",
      },
      {
        key: "variacaoCambial",
        name: "Câmbio",
        description: "Menor variação cambial = melhor pontuação",
      },
      {
        key: "variacaoSelic",
        name: "SELIC",
        description: "Maior SELIC = melhor pontuação",
      },
      {
        key: "variacaoDesemprego",
        name: "Desemprego",
        description: "Menor desemprego = melhor pontuação",
      },
    ];

    // Encontrar valores mínimos e máximos para cada indicador
    const minMax = radarIndicators.reduce((acc, indicator) => {
      const values = indicators
        .filter((ind) => selectedPresidents.includes(ind.presidente))
        .map((ind) => Number(ind[indicator.key as keyof typeof ind]) || 0);

      return {
        ...acc,
        [indicator.key]: {
          min: Math.min(...values),
          max: Math.max(...values),
        },
      };
    }, {} as Record<string, { min: number; max: number }>);

    // Transformar os dados para o formato do gráfico de radar
    return radarIndicators.map((indicator) => {
      const dataPoint: { [key: string]: string | number } = {
        subject: indicator.name,
        description: indicator.description,
        key: indicator.key,
      };

      selectedPresidents.forEach((presidentId) => {
        const president = presidents.find((p) => p.id === presidentId);
        const presidentData = indicators.find(
          (ind) => ind.presidente === presidentId
        );

        if (president && presidentData) {
          const value =
            Number(
              presidentData[indicator.key as keyof typeof presidentData]
            ) || 0;
          const normalizedValue = normalizeValue(
            value,
            minMax[indicator.key].min,
            minMax[indicator.key].max
          );

          dataPoint[president.nome] = invertIfNeeded(
            normalizedValue,
            indicator.key
          );
          dataPoint[`${president.nome}_raw`] = value;
        }
      });

      return dataPoint;
    });
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {data.subject}
          </p>
          <p className="text-xs text-gray-500 mb-2">{data.description}</p>

          {payload.map((entry: any, index: number) => {
            const presidentId = selectedPresidents.find((id) => {
              const president = presidents.find((p) => p.id === id);
              return president && president.nome === entry.name;
            });

            if (!presidentId) return null;

            const president = presidents.find((p) => p.id === presidentId);
            const rawValue = data[`${entry.name}_raw`];

            return (
              <div key={index} className="mb-1">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700">{entry.name}: </span>
                  <span
                    className="text-sm font-medium ml-1"
                    style={{ color: entry.color }}
                  >
                    {entry.value.toFixed(0)} pontos
                  </span>
                </div>
                <p className="text-xs text-gray-500 ml-5">
                  Valor real: {rawValue.toFixed(2)}%
                </p>
              </div>
            );
          })}

          <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
            *Valores normalizados (maior = melhor desempenho)
          </p>
        </div>
      );
    }
    return null;
  };

  const handleRadarMouseEnter = (dataKey: any) => {
    if (typeof dataKey === "string") {
      const presidentId = selectedPresidents.find((id) => {
        const president = presidents.find((p) => p.id === id);
        return president && president.nome === dataKey;
      });

      if (presidentId) {
        setHoveredPresident(presidentId);
      }
    }
  };

  const handleRadarMouseLeave = () => {
    setHoveredPresident(null);
  };

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 mb-8">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
        Desempenho Geral (Gráfico de Radar)
      </h2>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6">
        <p className="text-sm text-blue-700">
          <span className="font-medium">Como interpretar:</span> Este gráfico
          mostra o desempenho relativo de cada presidente em todos os
          indicadores. Valores mais altos (mais distantes do centro) indicam
          melhor desempenho. Os valores são normalizados para permitir
          comparação justa.
        </p>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione os presidentes para comparar:
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {presidents.map((president) => {
            const color = getPresidentColor(president.id);
            const isSelected = selectedPresidents.includes(president.id);
            const isHovered = hoveredPresident === president.id;

            return (
              <div
                key={president.id}
                className={`flex items-center p-2 rounded-lg transition-all ${
                  isSelected
                    ? "bg-gray-100 border border-gray-200"
                    : "hover:bg-gray-50 border border-transparent"
                } ${isHovered ? "ring-2 ring-offset-1 ring-blue-300" : ""}`}
                onClick={() => togglePresident(president.id)}
              >
                <input
                  type="checkbox"
                  id={`radar-president-${president.id}`}
                  checked={isSelected}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  style={{ accentColor: color }}
                />
                <label
                  htmlFor={`radar-president-${president.id}`}
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
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              outerRadius="80%"
              data={getRadarData()}
              margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
            >
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#6b7280", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "#6b7280", fontSize: 10 }}
                tickCount={5}
                stroke="#e5e7eb"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                onMouseEnter={handleRadarMouseEnter}
                onMouseLeave={handleRadarMouseLeave}
              />
              {selectedPresidents.map((presidentId) => {
                const president = presidents.find((p) => p.id === presidentId);
                if (!president) return null;

                const color = getPresidentColor(presidentId);
                const isHovered = hoveredPresident === presidentId;

                return (
                  <Radar
                    key={presidentId}
                    name={president.nome}
                    dataKey={president.nome}
                    stroke={color}
                    fill={color}
                    fillOpacity={isHovered ? 0.4 : 0.2}
                    strokeWidth={isHovered ? 3 : 2}
                  />
                );
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-medium mb-2">
            Selecione presidentes para comparar
          </p>
          <p className="text-sm text-gray-400">
            Escolha pelo menos um presidente para visualizar o gráfico de radar
          </p>
        </div>
      )}
    </div>
  );
}
