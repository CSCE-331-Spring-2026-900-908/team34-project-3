import { redirect } from "next/navigation";
import type { Route } from "next";
import { Users } from "lucide-react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { EmployeeManagementClient } from "@/components/employee-management-client";
import { requireEmployeePage } from "@/lib/auth";
import { getEmployees } from "@/lib/db/employees";
import { getManagerNavLinks } from "@/lib/manager-nav";

export default async function EmployeesPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const employees = await getEmployees();

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Users className="h-7 w-7" />}
            sectionLabel="Employees"
            title="Employee Management"
            subtitle="Add and edit employee accounts."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={getManagerNavLinks("/manager/employees" as Route)}
          />
          <EmployeeManagementClient employees={employees} />
        </div>
      </main>
    </>
  );
}
