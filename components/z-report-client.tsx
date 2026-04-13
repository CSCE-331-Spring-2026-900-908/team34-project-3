"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileClock,
  History,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TrendingUp
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ZReportData, ZReportHistoryEntry } from "@/lib/db/reports";
import { cn, formatCurrency } from "@/lib/utils";

type Props = {
  report: ZReportData;
};

function formatBusinessDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function MetricCard({
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

function HistoryEntryCard({ entry }: { entry: ZReportHistoryEntry }) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{formatBusinessDate(entry.businessDate)}</p>
          <p className="text-sm text-stone-600">Generated {formatDateTime(entry.generatedAt)}</p>
        </div>
        <Badge className="border-stone-300 bg-white text-stone-600">
          {entry.generatedByEmployeeName ?? "Manager generated"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Sales</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(entry.totalSales)}</p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Orders</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{entry.orderCount}</p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/70 px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Average</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(entry.averageOrderValue)}</p>
        </div>
      </div>
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
    <div className="grid gap-6">
      <Card className="overflow-hidden border-stone-900/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(237,241,236,0.92)_44%,_rgba(218,225,216,0.84)_100%)]">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "bg-white/80",
                  report.canGenerate ? "border-emerald-300 text-emerald-700" : "border-amber-300 text-amber-700"
                )}
              >
                {report.canGenerate ? "Ready To Close" : "Already Closed Today"}
              </Badge>
              <Badge className="border-stone-300 bg-white/70 text-stone-600">
                Business date {formatBusinessDate(report.businessDate)}
              </Badge>
              <Badge className="border-stone-300 bg-white/70 text-stone-600">
                Window started {formatDateTime(reportWindowStartedAt)}
              </Badge>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Daily closeout control</h2>
              <p className="max-w-2xl text-sm leading-6 text-stone-600">
                Review the current shift totals, confirm the closeout snapshot, and lock the reporting window by
                generating the Z report. Once generated, the next X report begins from that new cutoff.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <span>
                {latestGenerated
                  ? `Last generated ${formatDateTime(latestGenerated.generatedAt)}`
                  : "No previous Z report has been recorded yet."}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing} className="gap-2 bg-white/80">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={handleGenerate} disabled={!report.canGenerate || isGenerating} className="gap-2">
              {report.canGenerate ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
              {!report.canGenerate ? "Already Generated" : isGenerating ? "Generating..." : "Generate Z Report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Business Date"
          value={formatBusinessDate(report.businessDate)}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <MetricCard
          title="Total Sales"
          value={formatCurrency(report.preview.totalSales)}
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <MetricCard
          title="Order Count"
          value={report.preview.orderCount}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <MetricCard
          title="Average Ticket"
          value={formatCurrency(report.preview.averageOrderValue)}
          icon={<Clock3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current Closeout Preview</CardTitle>
            <CardDescription>These are the totals that will be written if you generate the Z report now.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Business Date</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{formatBusinessDate(report.preview.businessDate)}</p>
              <p className="mt-1 text-sm text-stone-500">The daily closeout this Z report will lock.</p>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Report Window</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{formatDateTime(reportWindowStartedAt)}</p>
              <p className="mt-1 text-sm text-stone-500">Orders recorded since this cutoff are included.</p>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Sales Total</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(report.preview.totalSales)}</p>
              <p className="mt-1 text-sm text-stone-500">Gross revenue that will be captured in today&apos;s closeout.</p>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Orders And Average</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {report.preview.orderCount} orders · {formatCurrency(report.preview.averageOrderValue)}
              </p>
              <p className="mt-1 text-sm text-stone-500">Count of completed orders and their average ticket size.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Closeout Status</CardTitle>
            <CardDescription>Track whether today&apos;s Z report is still pending or already locked.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                "rounded-[1.5rem] border p-4",
                report.canGenerate
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border-amber-200 bg-amber-50/80 text-amber-900"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {report.canGenerate ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {report.canGenerate ? "Ready to generate" : "Already generated for today"}
                  </p>
                  <p className="text-sm">
                    {report.canGenerate
                      ? "No Z report exists for the current business date, so the closeout can be finalized now."
                      : "A Z report for this business date already exists, so the reporting window is locked until tomorrow."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
                <FileClock className="h-4 w-4" />
                Latest recorded closeout
              </div>
              <p className="mt-3 text-sm text-stone-600">
                {latestGenerated
                  ? `${formatBusinessDate(latestGenerated.businessDate)} at ${formatDateTime(latestGenerated.generatedAt)}`
                  : "No previous Z report has been recorded yet."}
              </p>
              {latestGenerated?.generatedByEmployeeName ? (
                <p className="mt-1 text-sm text-stone-500">Generated by {latestGenerated.generatedByEmployeeName}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Previous Z Reports</CardTitle>
            <CardDescription>Historical closeout snapshots in reverse chronological order.</CardDescription>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-[rgb(var(--surface-alt))] px-3 py-1.5 text-xs font-medium text-stone-600">
            <History className="h-3.5 w-3.5" />
            {report.history.length} recorded report{report.history.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent>
          {report.history.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-border bg-[rgb(var(--surface-alt))] px-6 py-12 text-center text-sm text-stone-500">
              No previous Z reports found.
            </div>
          ) : (
            <div className="grid gap-4">
              {report.history.map((entry) => (
                <HistoryEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
