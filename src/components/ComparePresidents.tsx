"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { President, Indicator } from "@/services/sheets";

interface ComparativeData {
  name: string;
  valor: number;
  cor: string;
  presidentId: string;
}

interface ComparePresidentsProps {
  presidents: President[];
  indicators: Indicator[];
}

export function ComparePresidents({
  presidents,
  indicators,
}: ComparePresidentsProps) {
  const [selectedIndicator, setSelectedIndicator] =
    useState<string>("inflacaoAcumulada");
  const [selectedPresidents, setSelectedPresidents] = useState<string[]>([]);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  const indicatorOptions = [
    { value: "inflacaoAcumulada", label: "Inflação Acumulada (%)" },
    { value: "variacaoCambial", label: "Variação Cambial (%)" },
    { value: "variacaoSelic", label: "Variação SELIC (%)" },
    { value: "variacaoDesemprego", label: "Variação Desemprego (%)" },
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

  const getComparisonData = (): ComparativeData[] => {
    if (selectedPresidents.length === 0) return [];

    return selectedPresidents.map((presidentId) => {
      const president = presidents.find((p) => p.id === presidentId);
      const indicator = indicators.find((i) => i.presidente === presidentId);

      if (!president || !indicator) {
        return {
          name: "Desconhecido",
          valor: 0,
          cor: "#cccccc",
          presidentId: presidentId,
        };
      }

      // Formatar o nome para incluir o período
      const startYear = new Date(president.inicio).getFullYear();
      const endYear = new Date(president.fim).getFullYear();
      const displayName = `${president.nome}\n(${startYear}-${endYear})`;

      return {
        name: displayName,
        valor:
          Number(indicator[selectedIndicator as keyof typeof indicator]) || 0,
        cor: getPresidentColor(presidentId),
        presidentId: presidentId,
      };
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const president = presidents.find((p) => p.id === data.presidentId);
      const indicator = indicators.find(
        (i) => i.presidente === data.presidentId
      );

      if (!president || !indicator) return null;

      let additionalInfo = "";
      if (selectedIndicator === "inflacaoAcumulada") {
        additionalInfo = `IPCA: ${indicator.valorInicialIPCA?.toFixed(
          2
        )}% → ${indicator.valorFinalIPCA?.toFixed(2)}%`;
      } else if (selectedIndicator === "variacaoCambial") {
        additionalInfo = `Dólar: R$ ${indicator.valorInicialDolar?.toFixed(
          2
        )} → R$ ${indicator.valorFinalDolar?.toFixed(2)}`;
      } else if (selectedIndicator === "variacaoSelic") {
        additionalInfo = `SELIC: ${indicator.valorInicialSelic?.toFixed(
          2
        )}% → ${indicator.valorFinalSelic?.toFixed(2)}%`;
      } else if (
        selectedIndicator === "variacaoDesemprego" &&
        indicator.valorInicialDesemprego &&
        indicator.valorFinalDesemprego
      ) {
        additionalInfo = `Desemprego: ${indicator.valorInicialDesemprego?.toFixed(
          2
        )}% → ${indicator.valorFinalDesemprego?.toFixed(2)}%`;
      }

      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {president.nome}
          </p>
          <p className="text-sm text-gray-700 mb-2">
            {new Date(president.inicio).getFullYear()} -{" "}
            {new Date(president.fim).getFullYear()}
          </p>
          <p className="text-sm font-bold" style={{ color: data.cor }}>
            {getIndicatorLabel()}: {data.valor.toFixed(2)}%
          </p>
          {additionalInfo && (
            <p className="text-xs text-gray-600 mt-1">{additionalInfo}</p>
          )}
        </div>
      );
    }
    return null;
  };

  const handleBarMouseEnter = (data: any) => {
    setHoveredBar(data.presidentId);
  };

  const handleBarMouseLeave = () => {
    setHoveredBar(null);
  };

  return (
    <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow border border-gray-100 mb-8">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">
        Comparação entre Presidentes
      </h2>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o indicador:
        </label>
        <select
          value={selectedIndicator}
          onChange={(e) => setSelectedIndicator(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        >
          {indicatorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione os presidentes para comparar:
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
                  id={`president-${president.id}`}
                  checked={selectedPresidents.includes(president.id)}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  style={{ accentColor: color }}
                />
                <label
                  htmlFor={`president-${president.id}`}
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
            <BarChart
              data={getComparisonData()}
              margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
              barCategoryGap={30}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(0, 0, 0, 0.05)" }}
              />
              <Legend wrapperStyle={{ paddingTop: 10 }} />
              <Bar
                dataKey="valor"
                name={getIndicatorLabel()}
                radius={[4, 4, 0, 0]}
                onMouseEnter={handleBarMouseEnter}
                onMouseLeave={handleBarMouseLeave}
              >
                {getComparisonData().map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.cor}
                    fillOpacity={hoveredBar === entry.presidentId ? 1 : 0.8}
                    stroke={
                      hoveredBar === entry.presidentId ? entry.cor : "none"
                    }
                    strokeWidth={2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-lg font-medium mb-2">
            Selecione presidentes para comparar
          </p>
          <p className="text-sm text-gray-400">
            Escolha pelo menos um presidente para visualizar o gráfico
            comparativo
          </p>
        </div>
      )}
    </div>
  );
}
