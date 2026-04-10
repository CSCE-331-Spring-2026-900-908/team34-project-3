import { redirect } from "next/navigation";
import Link from "next/link";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TopBar } from "@/components/top-bar";
import { requireEmployeePage } from "@/lib/auth";

// Returns the page for the manager
export default async function ManagerPage()
{
  const employee = await requireEmployeePage();

  // If the employee is not a manager, they have no access to this page
  if (!employee.isManager)
  {
    redirect("/pos");
  }

  return (
    <>
      <SkipLink />
      <TopBar title="Manager" employeeLabel={`${employee.fullName} (Manager)`} />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="shell-frame">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Manager Dashboard</CardTitle>
            <CardDescription>Landing page for manager interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/manager/inventory"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
            >
              Open Inventory
            </Link>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
