import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { formatDate } from "@/utils/formatDate";

interface ChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: { date: string; value: number }[];
  title: string;
  color: string;
  type?: "area" | "bar";
  president: string;
  period: string;
  initialValue?: string;
  finalValue?: string;
  value: string;
}

const CustomTooltip = ({ active, payload, label, title }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 shadow-lg rounded-lg p-3">
        <p className="text-sm font-medium text-gray-900 mb-1">
          {formatDate(label)}
        </p>
        <p className="text-sm text-gray-600">
          {title?.includes("Dólar") || title?.includes("Câmbio")
            ? "PTAX: "
            : "Valor: "}
          <span className="font-medium">{payload[0].value.toFixed(2)}</span>
        </p>
      </div>
    );
  }
  return null;
};

const getIndicatorDescription = (title: string) => {
  if (title.includes("Dólar") || title.includes("Câmbio")) {
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

const formatShareMessage = (
  title: string,
  president: string,
  period: string,
  value: string,
  initialValue?: string,
  finalValue?: string
) => {
  const getEmoji = (title: string) => {
    if (title.includes("Inflação")) return "📈";
    if (title.includes("Dólar")) return "💵";
    if (title.includes("SELIC")) return "🏦";
    if (title.includes("Desemprego")) return "👥";
    return "📊";
  };

  const emoji = getEmoji(title);
  const variation = value;
  const arrow = variation.includes("-") ? "↘️" : "↗️";

  return `${emoji} ${title} - Governo ${president} (${period})

${initialValue ? `Inicial: ${initialValue}` : ""}${
    initialValue && finalValue ? " → " : ""
  }${finalValue ? `Final: ${finalValue}` : ""}
${arrow} Variação: ${variation}

Veja mais indicadores em: ${window.location.href}`;
};

export function ChartModal({
  isOpen,
  onClose,
  data,
  title,
  color,
  type = "area",
  president,
  period,
  initialValue,
  finalValue,
  value,
}: ChartModalProps) {
  if (!isOpen) return null;

  const Chart = type === "bar" ? BarChart : AreaChart;
  const DataComponent = type === "bar" ? Bar : Area;

  const shareMessage = formatShareMessage(
    title,
    president,
    period,
    value,
    initialValue,
    finalValue
  );

  const shareOnTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareMessage
      )}`,
      "_blank"
    );
  };

  const shareOnWhatsApp = () => {
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`,
      "_blank"
    );
  };

  const shareOnTelegram = () => {
    window.open(
      `https://telegram.me/share/url?url=${encodeURIComponent(
        window.location.href
      )}&text=${encodeURIComponent(shareMessage)}`,
      "_blank"
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            {title.includes("Câmbio") && (
              <p className="text-sm text-gray-600">Cotação PTAX</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            title="Fechar"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="p-4 h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <Chart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 30 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatDate(date)}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis />
              <Tooltip
                content={(props) => <CustomTooltip {...props} title={title} />}
              />
              <DataComponent
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={color}
                strokeWidth={2}
              />
            </Chart>
          </ResponsiveContainer>
        </div>
        <div className="px-4 pb-2">
          <p className="text-sm text-gray-600 italic">
            {getIndicatorDescription(title)}
          </p>
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-end gap-3">
            <span className="text-sm text-gray-600">
              Compartilhar indicador
            </span>
            <button
              onClick={shareOnTwitter}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Compartilhar no X (Twitter)"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </button>
            <button
              onClick={shareOnWhatsApp}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Compartilhar no WhatsApp"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </button>
            <button
              onClick={shareOnTelegram}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              title="Compartilhar no Telegram"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
