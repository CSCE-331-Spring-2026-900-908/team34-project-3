import type { Route } from "next";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";

import { ManagerCopilotClient } from "@/components/manager-copilot-client";
import { PageHeader } from "@/components/page-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { requireEmployeePage } from "@/lib/auth";
import { getManagerNavLinks } from "@/lib/manager-nav";

export default async function ManagerInsightsPage() {
  const employee = await requireEmployeePage("/manager/insights");

  if (!employee.isManager) {
    redirect("/pos");
  }

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Bot className="h-7 w-7" />}
            sectionLabel="Intelligence"
            title="Manager Copilot"
            subtitle="Your AI assistant for managerial endeavors"
            employeeBadge={`${employee.fullName} (Manager)`}
            links={getManagerNavLinks("/manager/insights" as Route)}
          />
          <ManagerCopilotClient />
        </div>
      </main>
    </>
  );
}
