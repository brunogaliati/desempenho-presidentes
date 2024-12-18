"use client";

import { AreaChart, Area, BarChart, Bar, ResponsiveContainer } from "recharts";

interface DataPoint {
  date: string;
  value: number;
}

interface BackgroundChartProps {
  data: DataPoint[];
  color: string;
  type?: "area" | "bar";
}

export function BackgroundChart({
  data,
  color,
  type = "area",
}: BackgroundChartProps) {
  if (type === "bar") {
    return (
      <div className="absolute inset-0 opacity-10">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          >
            <Bar dataKey="value" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 opacity-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            strokeWidth={1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
