import { redirect } from "next/navigation";
import type { Route } from "next";

import { InventoryClient } from "@/components/inventory-client";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { TopBar } from "@/components/top-bar";
import { requireEmployeePage } from "@/lib/auth";
import { getCriticalIngredients, getRestockOrders } from "@/lib/db/inventory";

export default async function InventoryPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const [orders, criticalIngredients] = await Promise.all([
    getRestockOrders(),
    getCriticalIngredients(),
  ]);

  return (
    <>
      <SkipLink />
      <TopBar
        title="Orders & Inventory"
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[{ href: "/manager" as Route, label: "Manager Dashboard" }]}
      />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="shell-frame">
        <InventoryClient orders={orders} criticalIngredients={criticalIngredients} />
      </main>
    </>
  );
}
