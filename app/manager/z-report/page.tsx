import type { Route } from "next";
import { redirect } from "next/navigation";
import { FileClock } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { ZReportClient } from "@/components/z-report-client";
import { requireEmployeePage } from "@/lib/auth";
import { getZReportData } from "@/lib/db/reports";
import { getManagerNavLinks } from "@/lib/manager-nav";

export default async function ZReportPage() {
  const employee = await requireEmployeePage("/manager/z-report");

  if (!employee.isManager) {
    redirect("/pos");
  }

  const report = await getZReportData();

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<FileClock className="h-7 w-7" />}
            sectionLabel="Reporting"
            title="Z Report"
            subtitle="Finalize the day with end-of-day totals and sales summaries."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={getManagerNavLinks("/manager/z-report" as Route)}
          />
          <ZReportClient report={report} />
        </div>
      </main>
    </>
  );
}
