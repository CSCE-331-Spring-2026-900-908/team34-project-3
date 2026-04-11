import { redirect } from "next/navigation";
import type { Route } from "next";
import { Package } from "lucide-react";

import { InventoryClient } from "@/components/inventory-client";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { requireEmployeePage } from "@/lib/auth";
import { getAllIngredients, getCriticalIngredients, getRestockOrders } from "@/lib/db/inventory";

export default async function InventoryPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const [orders, criticalIngredients, allIngredients] = await Promise.all([
    getRestockOrders(),
    getCriticalIngredients(),
    getAllIngredients(),
  ]);

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Package className="h-7 w-7" />}
            sectionLabel="Inventory"
            title="Orders & Inventory"
            subtitle="Track stock levels and manage restock orders."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={[
              { href: "/manager" as Route, label: "Dashboard" },
              { href: "/manager/employees" as Route, label: "Employees" },
              { href: "/manager/menu-items" as Route, label: "Menu Items" },
            ]}
          />
          <InventoryClient
            orders={orders}
            criticalIngredients={criticalIngredients}
            allIngredients={allIngredients}
          />
        </div>
      </main>
    </>
  );
}
