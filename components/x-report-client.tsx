"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Clock3, ReceiptText, RefreshCw, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { XReportData } from "@/lib/db/reports";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  report: XReportData;
};

type ChartBar = {
  hour: number;
  totalSales: number;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatHour(hour: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric"
  }).format(new Date(2000, 0, 1, hour));
}

function buildChartBars(report: XReportData): ChartBar[] {
  if (report.hourlySales.length === 0) {
    return [];
  }

  const salesByHour = new Map(report.hourlySales.map((row) => [row.hour, row.totalSales]));
  const windowStart = new Date(report.windowStartedAt);
  const now = new Date();
  const sharesCurrentDay = windowStart.toDateString() === now.toDateString();

  if (!sharesCurrentDay) {
    return report.hourlySales;
  }

  const totalHours = Math.max(now.getHours() - windowStart.getHours() + 1, 1);

  return Array.from({ length: totalHours }, (_, index) => {
    const hour = windowStart.getHours() + index;

    return {
      hour,
      totalSales: salesByHour.get(hour) ?? 0
    };
  });
}

function StatCard({
  title,
  value,
  icon
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">{title}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-[rgb(var(--surface-alt))] text-stone-700">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function XReportClient({ report }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const chartBars = buildChartBars(report);
  const maxSales = Math.max(...chartBars.map((row) => row.totalSales), 1);
  const reportStartedAt = report.lastZReportGeneratedAt ?? report.windowStartedAt;

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <Card className="overflow-hidden border-stone-900/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(240,236,230,0.92)_45%,_rgba(230,223,214,0.85)_100%)]">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-stone-300 bg-white/80 text-stone-700">
                {report.cutoffSource === "last-z-report" ? "Since Last Z Report" : "Since Start Of Day"}
              </Badge>
              <Badge className="border-stone-300 bg-white/70 text-stone-600">
                Window opened {formatDateTime(reportStartedAt)}
              </Badge>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Current shift snapshot</h2>
              <p className="max-w-2xl text-sm leading-6 text-stone-600">
                {report.cutoffSource === "last-z-report"
                  ? "Sales and item totals reset when a Z report is generated, so this view shows everything recorded since that cutoff."
                  : "No Z report has been finalized yet, so this view is using the current business day as its reporting window."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleRefresh} disabled={isPending} className="gap-2 bg-white/80">
              <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Sales"
          value={formatCurrency(report.totalSales)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Order Count"
          value={report.orderCount}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <StatCard
          title="Average Ticket"
          value={formatCurrency(report.averageOrderValue)}
          icon={<Clock3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Hourly Sales</CardTitle>
            <CardDescription>Revenue grouped by order hour for the active reporting window.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartBars.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-border bg-[rgb(var(--surface-alt))] px-6 py-12 text-center text-sm text-stone-500">
                No sales have been recorded yet for this reporting window.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {chartBars.map((row) => {
                  const barHeight = row.totalSales > 0 ? Math.max((row.totalSales / maxSales) * 100, 10) : 6;

                  return (
                    <div key={row.hour} className="space-y-3">
                      <div className="flex h-44 items-end rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-3">
                        <div
                          className="w-full rounded-[1rem] bg-[linear-gradient(180deg,_rgba(41,37,36,0.95),_rgba(120,113,108,0.82))]"
                          style={{ height: `${barHeight}%` }}
                          title={`${formatHour(row.hour)}: ${formatCurrency(row.totalSales)}`}
                        />
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                          {formatHour(row.hour)}
                        </p>
                        <p className="text-xs text-stone-600">{formatCurrency(row.totalSales)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>Highest-revenue items since the current report window began.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.topSellingItems.length === 0 ? (
              <p className="text-sm text-stone-500">No item sales to display yet.</p>
            ) : (
              report.topSellingItems.map((row, index) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold text-stone-700">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{row.name}</p>
                      <p className="text-sm text-stone-500">{row.quantitySold} sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(row.revenue)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Sales By Item</CardTitle>
            <CardDescription>Full item-level sales breakdown for the active report window.</CardDescription>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-[rgb(var(--surface-alt))] px-3 py-1.5 text-xs font-medium text-stone-600">
            <BarChart3 className="h-3.5 w-3.5" />
            {report.salesByItem.length} tracked item{report.salesByItem.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent>
          {report.salesByItem.length === 0 ? (
            <p className="text-sm text-stone-500">No item sales to display yet.</p>
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] border border-border">
              <div className="grid grid-cols-[minmax(0,1.8fr)_100px_120px] gap-3 bg-[rgb(var(--surface-alt))] px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                <span>Item</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Revenue</span>
              </div>
              <div className="divide-y divide-border">
                {report.salesByItem.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[minmax(0,1.8fr)_100px_120px] gap-3 px-5 py-4 text-sm"
                  >
                    <span className="font-medium text-foreground">{row.name}</span>
                    <span className="text-right text-stone-600">{row.quantitySold}</span>
                    <span className="text-right font-semibold text-foreground">{formatCurrency(row.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
