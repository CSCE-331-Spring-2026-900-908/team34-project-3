"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ZReportData } from "@/lib/db/reports";
import { formatCurrency } from "@/lib/utils";

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

export function ZReportClient({ report }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);

    const response = await fetch("/api/reports/z", {
      method: "POST"
    });

    setPending(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to generate Z report.");
      return;
    }

    toast.success("Z report generated.");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Business Date</CardDescription>
            <CardTitle>{formatBusinessDate(report.businessDate)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Sales</CardDescription>
            <CardTitle>{formatCurrency(report.preview.totalSales)}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Order Count</CardDescription>
            <CardTitle>{report.preview.orderCount}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Average Order Value</CardDescription>
            <CardTitle>{formatCurrency(report.preview.averageOrderValue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Current Closeout Preview</CardTitle>
            <CardDescription>This preview covers orders since the last Z report cutoff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
              Business Date: {formatBusinessDate(report.preview.businessDate)}
            </div>
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
              Total Sales: {formatCurrency(report.preview.totalSales)}
            </div>
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
              Order Count: {report.preview.orderCount}
            </div>
            <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3">
              Average Order Value: {formatCurrency(report.preview.averageOrderValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previous Z Reports</CardTitle>
            <CardDescription>Historical closeout summaries in reverse chronological order.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.history.length === 0 ? (
              <p className="text-sm text-stone-500">No previous Z reports found.</p>
            ) : (
              report.history.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-3 text-sm">
                  <p className="font-medium">{formatBusinessDate(entry.businessDate)}</p>
                  <p className="text-stone-600">
                    {formatCurrency(entry.totalSales)} | {entry.orderCount} orders
                  </p>
                  <p className="text-stone-500">Generated {formatDateTime(entry.generatedAt)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            {report.canGenerate
              ? "Ready to generate the Z report for the current business day."
              : "A Z report has already been generated for today."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-stone-500">
            {report.latestGeneratedReport
              ? `Last generated ${formatDateTime(report.latestGeneratedReport.generatedAt)}`
              : "No previous Z report has been recorded yet."}
          </div>
          <Button onClick={handleGenerate} disabled={!report.canGenerate || pending}>
            {!report.canGenerate ? "Already Generated" : pending ? "Generating..." : "Generate Z Report"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
