"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { ReportSectionHeading, ReportSummaryCell } from "@/components/report-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { XReportData } from "@/lib/db/reports";
import { formatBusinessDateTime, getBusinessDateKey, getBusinessHour } from "@/lib/report-time";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  report: XReportData;
};

type ChartBar = {
  hour: number;
  totalSales: number;
};

type ChartTick = {
  label: string;
  value: number;
};

function formatAxisCurrency(value: number, step: number) {
  return `$${value.toFixed(step >= 10 ? 0 : 2).replace(/\.00$/, "")}`;
}

function formatChartHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function buildChartBars(report: XReportData): ChartBar[] {
  if (report.hourlySales.length === 0) {
    return [];
  }

  const salesByHour = new Map(report.hourlySales.map((row) => [row.hour, row.totalSales]));
  const windowStart = report.windowStartedAt;
  const now = new Date();
  const sharesCurrentDay = getBusinessDateKey(windowStart) === getBusinessDateKey(now);

  if (!sharesCurrentDay) {
    return report.hourlySales;
  }

  const startHour = getBusinessHour(windowStart);
  const endHour = getBusinessHour(now);
  const totalHours = Math.max(endHour - startHour + 1, 1);

  return Array.from({ length: totalHours }, (_, index) => {
    const hour = startHour + index;

    return {
      hour,
      totalSales: salesByHour.get(hour) ?? 0
    };
  });
}

function getNiceChartMax(value: number) {
  if (value <= 0) {
    return 10;
  }

  const roughStep = value / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  let step = magnitude;

  if (normalized > 5) {
    step = 10 * magnitude;
  } else if (normalized > 2) {
    step = 5 * magnitude;
  } else if (normalized > 1) {
    step = 2 * magnitude;
  }

  return Math.ceil(value / step) * step;
}

function buildChartTicks(maxValue: number): ChartTick[] {
  const tickCount = 5;
  const step = maxValue / tickCount;

  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = maxValue - step * index;

    return {
      value,
      label: formatAxisCurrency(value, step)
    };
  });
}

export function XReportClient({ report }: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const chartBars = buildChartBars(report);
  const chartMax = getNiceChartMax(Math.max(...chartBars.map((row) => row.totalSales), 1));
  const chartTicks = buildChartTicks(chartMax);
  const reportStartedAt = report.lastZReportGeneratedAt ?? report.windowStartedAt;

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-xl">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">Current Window</h2>
              <p className="text-sm text-stone-500">Since {formatBusinessDateTime(reportStartedAt)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <div className="grid sm:grid-cols-3">
            <ReportSummaryCell label="Total Sales" value={formatCurrency(report.totalSales)} />
            <ReportSummaryCell label="Order Count" value={report.orderCount} />
            <ReportSummaryCell label="Average Ticket" value={formatCurrency(report.averageOrderValue)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_340px]">
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <ReportSectionHeading title="Hourly Sales" meta="Revenue by completed order hour" />
            <div className="p-4">
              {chartBars.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-[rgb(var(--surface-alt))] px-4 py-10 text-center text-sm text-stone-500">
                  No sales recorded.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-[rgb(var(--surface-alt))] p-3">
                  <div className="min-w-[640px]">
                    <svg
                      viewBox="0 0 960 344"
                      role="img"
                      aria-label="Hourly sales bar chart"
                      className="h-auto w-full"
                    >
                      {(() => {
                        const marginLeft = 64;
                        const marginTop = 10;
                        const marginRight = 12;
                        const marginBottom = 60;
                        const plotWidth = 960 - marginLeft - marginRight;
                        const plotHeight = 344 - marginTop - marginBottom;
                        const columnWidth = plotWidth / chartBars.length;
                        const barWidth = Math.max(Math.min(columnWidth * 0.66, 40), 12);

                        return (
                          <>
                            <text
                              x={marginLeft}
                              y={marginTop - 2}
                              fontSize="11"
                              fill="#57534e"
                            >
                              Sales ($)
                            </text>

                            {chartTicks.map((tick) => {
                              const y = marginTop + plotHeight - (tick.value / chartMax) * plotHeight;

                              return (
                                <g key={tick.value}>
                                  <line
                                    x1={marginLeft}
                                    y1={y}
                                    x2={marginLeft + plotWidth}
                                    y2={y}
                                    stroke="#d6d3d1"
                                    strokeDasharray="5 5"
                                  />
                                  <text
                                    x={marginLeft - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="#78716c"
                                  >
                                    {tick.label}
                                  </text>
                                </g>
                              );
                            })}

                            {chartBars.map((row, index) => {
                              const x = marginLeft + columnWidth * index + (columnWidth - barWidth) / 2;
                              const rawBarHeight = (row.totalSales / chartMax) * plotHeight;
                              const renderedBarHeight = row.totalSales === 0 ? 0 : Math.max(rawBarHeight, 2);
                              const y = marginTop + plotHeight - renderedBarHeight;
                              const labelX = marginLeft + columnWidth * index + columnWidth / 2;

                              return (
                                <g key={row.hour}>
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={renderedBarHeight}
                                    fill="#171717"
                                  >
                                    <title>{`${formatChartHour(row.hour)}: ${formatCurrency(row.totalSales)}`}</title>
                                  </rect>
                                  <text
                                    x={labelX}
                                    y={marginTop + plotHeight + 18}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="#57534e"
                                  >
                                    {formatChartHour(row.hour)}
                                  </text>
                                </g>
                              );
                            })}

                            <line
                              x1={marginLeft}
                              y1={marginTop}
                              x2={marginLeft}
                              y2={marginTop + plotHeight}
                              stroke="#78716c"
                              strokeWidth="1.5"
                            />
                            <line
                              x1={marginLeft}
                              y1={marginTop + plotHeight}
                              x2={marginLeft + plotWidth}
                              y2={marginTop + plotHeight}
                              stroke="#78716c"
                              strokeWidth="1.5"
                            />
                            <text
                              x={marginLeft + plotWidth / 2}
                              y={marginTop + plotHeight + 42}
                              textAnchor="middle"
                              fontSize="11"
                              fill="#57534e"
                            >
                              Hour of day
                            </text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-0">
            <ReportSectionHeading title="Top Selling Items" meta={`${report.topSellingItems.length} item${report.topSellingItems.length === 1 ? "" : "s"}`} />
            {report.topSellingItems.length === 0 ? (
              <div className="px-4 py-6 text-sm text-stone-500">No item sales recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[rgb(var(--surface-alt))] text-xs uppercase tracking-[0.14em] text-stone-500">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">#</th>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-right font-semibold">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.topSellingItems.map((row, index) => (
                      <tr key={row.name}>
                        <td className="px-4 py-3 text-stone-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                        <td className="px-4 py-3 text-right text-stone-600">{row.quantitySold}</td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          <ReportSectionHeading title="Sales By Item" meta={`${report.salesByItem.length} item${report.salesByItem.length === 1 ? "" : "s"}`} />
          {report.salesByItem.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-500">No item sales recorded.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--surface-alt))] text-xs uppercase tracking-[0.14em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Item</th>
                    <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                    <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.salesByItem.map((row) => (
                    <tr key={row.name}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{row.quantitySold}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
