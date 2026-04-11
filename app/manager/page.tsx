import { redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { LayoutDashboard, Package, Users, Coffee } from "lucide-react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireEmployeePage } from "@/lib/auth";

const managerLinks: { href: Route; label: string; icon: typeof Package; description: string }[] = [
  { href: "/manager/inventory" as Route, label: "Inventory", icon: Package, description: "Track stock levels and manage restock orders." },
  { href: "/manager/employees" as Route, label: "Employees", icon: Users, description: "Add and edit employee accounts." },
  { href: "/manager/menu-items" as Route, label: "Menu Items", icon: Coffee, description: "Create and update menu items." }
];

export default async function ManagerPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) {
    redirect("/pos");
  }

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<LayoutDashboard className="h-7 w-7" />}
            sectionLabel="Manager"
            title={employee.fullName}
            subtitle="Manage your store."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={managerLinks.map((l) => ({ href: l.href, label: l.label }))}
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {managerLinks.map((link) => {
              const LinkIcon = link.icon;
              return (
                <Link key={link.href} href={link.href} className="group">
                  <Card className="transition hover:border-foreground/30">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-[rgb(var(--surface-alt))] text-foreground">
                          <LinkIcon className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-lg">{link.label}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-stone-500">{link.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
