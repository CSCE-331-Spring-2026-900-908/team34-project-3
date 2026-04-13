import type { Route } from "next";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireEmployeePage } from "@/lib/auth";
import { getXReportData } from "@/lib/db/reports";
import { getManagerNavLinks } from "@/lib/manager-nav";
import { formatCurrency } from "@/lib/utils";

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

export default async function XReportPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) {
    redirect("/pos");
  }

  const report = await getXReportData();
  const reportingWindowLabel =
    report.cutoffSource === "last-z-report"
      ? `Showing sales since the last Z report was generated on ${formatDateTime(report.windowStartedAt)}.`
      : `No prior Z report was found, so this report starts at ${formatDateTime(report.windowStartedAt)}.`;

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<BarChart3 className="h-7 w-7" />}
            sectionLabel="Reporting"
            title="X Report"
            subtitle="Live sales snapshot for the current reporting window."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={getManagerNavLinks("/manager/x-report" as Route)}
          />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <section className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardDescription>Total Sales</CardDescription>
                    <CardTitle>{formatCurrency(report.totalSales)}</CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <CardDescription>Order Count</CardDescription>
                    <CardTitle>{report.orderCount}</CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader>
                    <CardDescription>Average Order Value</CardDescription>
                    <CardTitle>{formatCurrency(report.averageOrderValue)}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Hourly Sales</CardTitle>
                  <CardDescription>{reportingWindowLabel}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.hourlySales.length === 0 ? (
                    <p className="text-sm text-stone-500">No orders have been recorded in this reporting window.</p>
                  ) : (
                    report.hourlySales.map((row) => (
                      <div
                        key={row.hour}
                        className="flex items-center justify-between rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3"
                      >
                        <span className="text-sm font-medium text-stone-700">{formatHour(row.hour)}</span>
                        <span className="text-sm font-semibold">{formatCurrency(row.totalSales)}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Selling Items</CardTitle>
                  <CardDescription>Highest-revenue items in the current window.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.topSellingItems.length === 0 ? (
                    <p className="text-sm text-stone-500">No item sales to display yet.</p>
                  ) : (
                    report.topSellingItems.map((row) => (
                      <div
                        key={row.name}
                        className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{row.name}</p>
                            <p className="text-sm text-stone-500">{row.quantitySold} sold</p>
                          </div>
                          <p className="text-sm font-semibold">{formatCurrency(row.revenue)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sales by Item</CardTitle>
                  <CardDescription>Full item breakdown for the current reporting window.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.salesByItem.length === 0 ? (
                    <p className="text-sm text-stone-500">No item sales to display yet.</p>
                  ) : (
                    report.salesByItem.map((row) => (
                      <div
                        key={row.name}
                        className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{row.name}</p>
                            <p className="text-sm text-stone-500">Qty {row.quantitySold}</p>
                          </div>
                          <p className="text-sm font-semibold">{formatCurrency(row.revenue)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
