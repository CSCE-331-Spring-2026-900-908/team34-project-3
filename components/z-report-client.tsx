"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { ReportSectionHeading, ReportSummaryCell } from "@/components/report-primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ZReportData } from "@/lib/db/reports";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/report-time";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  report: ZReportData;
};

function PreviewRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0">
      <dt className="font-medium text-stone-600">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

export function ZReportClient({ report }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const latestGenerated = report.latestGeneratedReport;
  const reportWindowStartedAt = report.preview.lastZReportGeneratedAt ?? report.preview.windowStartedAt;

  function handleRefresh() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleGenerate() {
    setIsGenerating(true);

    const response = await fetch("/api/reports/z", {
      method: "POST"
    });

    setIsGenerating(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to generate Z report.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { report?: { businessDate?: string } }
      | null;

    toast.success(
      payload?.report?.businessDate
        ? `Z report generated for ${formatBusinessDate(payload.report.businessDate)}.`
        : "Z report generated."
    );
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <Card className="rounded-xl">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">Current Closeout</h2>
              <p className="text-sm text-stone-500">
                {report.canGenerate ? "Ready to generate." : "Already generated for today."}
              </p>
              <p className="text-sm text-stone-500">
                {latestGenerated
                  ? `Last generated ${formatBusinessDateTime(latestGenerated.generatedAt)}`
                  : "No previous Z report recorded."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleGenerate} disabled={!report.canGenerate || isGenerating} className="gap-2">
                {report.canGenerate ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                {!report.canGenerate ? "Already Generated" : isGenerating ? "Generating..." : "Generate Z Report"}
              </Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-5">
            <ReportSummaryCell label="Business Date" value={formatBusinessDate(report.businessDate)} />
            <ReportSummaryCell label="Window Start" value={formatBusinessDateTime(reportWindowStartedAt)} />
            <ReportSummaryCell label="Total Sales" value={formatCurrency(report.preview.totalSales)} />
            <ReportSummaryCell label="Order Count" value={report.preview.orderCount} />
            <ReportSummaryCell label="Average Ticket" value={formatCurrency(report.preview.averageOrderValue)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <ReportSectionHeading title="Current Closeout Preview" />
            <dl>
              <PreviewRow label="Business Date" value={formatBusinessDate(report.preview.businessDate)} />
              <PreviewRow label="Window Start" value={formatBusinessDateTime(reportWindowStartedAt)} />
              <PreviewRow label="Total Sales" value={formatCurrency(report.preview.totalSales)} />
              <PreviewRow label="Order Count" value={report.preview.orderCount} />
              <PreviewRow label="Average Order Value" value={formatCurrency(report.preview.averageOrderValue)} />
            </dl>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardContent className="p-0">
            <ReportSectionHeading title="Closeout Status" />
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 px-4 py-3">
                <span className="font-medium text-stone-600">Status</span>
                <span className="text-foreground">
                  {report.canGenerate ? "Ready to generate" : "Already generated for today"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 px-4 py-3">
                <span className="font-medium text-stone-600">Latest Closeout</span>
                <span className="text-foreground">
                  {latestGenerated
                    ? `${formatBusinessDate(latestGenerated.businessDate)} at ${formatBusinessDateTime(latestGenerated.generatedAt)}`
                    : "No previous Z report recorded"}
                </span>
              </div>
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-4 px-4 py-3">
                <span className="font-medium text-stone-600">Generated By</span>
                <span className="text-foreground">
                  {latestGenerated?.generatedByEmployeeName ?? "Unavailable"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          <ReportSectionHeading title="Previous Z Reports" meta={`${report.history.length} report${report.history.length === 1 ? "" : "s"}`} />
          {report.history.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-500">No previous Z reports found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--surface-alt))] text-xs uppercase tracking-[0.14em] text-stone-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Generated</th>
                    <th className="px-4 py-3 text-left font-semibold">By</th>
                    <th className="px-4 py-3 text-right font-semibold">Sales</th>
                    <th className="px-4 py-3 text-right font-semibold">Orders</th>
                    <th className="px-4 py-3 text-right font-semibold">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.history.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{formatBusinessDate(entry.businessDate)}</td>
                      <td className="px-4 py-3 text-stone-600">{formatBusinessDateTime(entry.generatedAt)}</td>
                      <td className="px-4 py-3 text-stone-600">
                        {entry.generatedByEmployeeName ?? "Unavailable"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatCurrency(entry.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-600">{entry.orderCount}</td>
                      <td className="px-4 py-3 text-right text-stone-600">
                        {formatCurrency(entry.averageOrderValue)}
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
