export type QuickChartPayload = {
  title: string;
  type: "bar" | "line";
  labels: string[];
  datasetLabel?: string;
  values?: number[];
  datasets?: Array<{
    label: string;
    values: number[];
    type?: "bar" | "line";
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    borderDash?: number[];
  }>;
};

export type QuickChartResult = {
  title: string;
  type: "bar" | "line";
  url: string;
};

export function createQuickChart(payload: QuickChartPayload): QuickChartResult {
  const datasets =
    payload.datasets && payload.datasets.length > 0
      ? payload.datasets.map((dataset) => ({
          label: dataset.label,
          type: dataset.type ?? payload.type,
          data: dataset.values,
          backgroundColor:
            dataset.backgroundColor ??
            (dataset.type ?? payload.type) === "bar"
              ? ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"]
              : "rgba(23, 23, 23, 0.2)",
          borderColor: dataset.borderColor ?? "#171717",
          borderWidth: dataset.borderWidth ?? 2,
          fill: dataset.fill ?? false,
          tension: dataset.tension ?? 0.35,
          borderDash: dataset.borderDash
        }))
      : [
          {
            label: payload.datasetLabel ?? "Value",
            data: payload.values ?? [],
            backgroundColor:
              payload.type === "bar"
                ? ["#171717", "#404040", "#737373", "#a3a3a3", "#d4d4d4"]
                : "rgba(23, 23, 23, 0.85)",
            borderColor: "#171717",
            borderWidth: 2,
            fill: false,
            tension: 0.35
          }
        ];

  const config = {
    type: payload.type,
    data: {
      labels: payload.labels,
      datasets
    },
    options: {
      plugins: {
        legend: {
          display: datasets.length > 1
        },
        title: {
          display: true,
          text: payload.title,
          color: "#171717",
          font: {
            size: 16
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#57534e"
          },
          grid: {
            display: false
          }
        },
        y: {
          ticks: {
            color: "#57534e"
          },
          grid: {
            color: "rgba(87, 83, 78, 0.12)"
          }
        }
      }
    }
  };

  return {
    title: payload.title,
    type: payload.type,
    url: `https://quickchart.io/chart?width=720&height=360&format=png&chart=${encodeURIComponent(JSON.stringify(config))}`
  };
}
