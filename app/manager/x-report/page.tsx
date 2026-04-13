import type { Route } from "next";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { XReportClient } from "@/components/x-report-client";
import { PageHeader } from "@/components/page-header";
import { requireEmployeePage } from "@/lib/auth";
import { getXReportData } from "@/lib/db/reports";
import { getManagerNavLinks } from "@/lib/manager-nav";

export default async function XReportPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) {
    redirect("/pos");
  }

  const report = await getXReportData();

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
          <XReportClient report={report} />
        </div>
      </main>
    </>
  );
}
