"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChartModal } from "./ChartModal";

const BackgroundChart = dynamic(
  () =>
    import("@/components/BackgroundChart").then((mod) => mod.BackgroundChart),
  { ssr: false }
);

interface MetricCardProps {
  title: string;
  value: string;
  label: string;
  icon: string;
  tooltip: string;
  initialValue?: string;
  finalValue?: string;
  showInitialValue?: boolean;
  historicalData?: { date: string; value: number }[];
  chartColor?: string;
  type?: "area" | "bar";
  president: string;
  period: string;
}

export function MetricCard({
  title,
  value,
  label,
  icon,
  tooltip,
  initialValue,
  finalValue,
  showInitialValue = true,
  historicalData,
  chartColor = "#3b82f6",
  type = "area",
  president,
  period,
}: MetricCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div
        className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all h-full flex flex-col relative overflow-hidden cursor-pointer"
        title={tooltip}
        onClick={() => historicalData && setIsModalOpen(true)}
      >
        {historicalData && (
          <BackgroundChart
            data={historicalData}
            color={chartColor}
            type={type}
          />
        )}
        <div className="flex items-center gap-2 text-gray-600 mb-3 relative">
          <span>{icon}</span>
          <span className="text-sm font-medium">{title}</span>
        </div>

        {showInitialValue && initialValue && finalValue && (
          <div className="text-sm text-gray-500 mb-3 relative">
            <div className="flex items-baseline gap-1">
              <span>{initialValue}</span>
              <span className="text-gray-300 mx-1">→</span>
              <span>{finalValue}</span>
            </div>
          </div>
        )}

        <div className="mt-auto relative">
          <p className="text-3xl font-bold text-gray-800 mb-1">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>

      {historicalData && (
        <ChartModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          data={historicalData}
          title={title}
          color={chartColor}
          type={type}
          president={president}
          period={period}
          initialValue={initialValue}
          finalValue={finalValue}
          value={value}
        />
      )}
    </>
  );
}
