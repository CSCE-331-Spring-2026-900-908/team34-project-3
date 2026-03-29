import { redirect } from "next/navigation";
import type { Route } from "next";

import { CreateOrderForm } from "@/components/create-order-form";
import { TopBar } from "@/components/top-bar";
import { requireEmployeePage } from "@/lib/auth";
import { getAllIngredients } from "@/lib/db/inventory";

export default async function CreateOrderPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const ingredients = await getAllIngredients();

  return (
    <>
      <TopBar
        title="Create Restock Order"
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[{ href: "/manager/inventory" as Route, label: "← Back" }]}
      />
      <main className="shell-frame">
        <CreateOrderForm ingredients={ingredients} />
      </main>
    </>
  );
}