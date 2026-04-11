import { redirect } from "next/navigation";
import type { Route } from "next";
import { Package } from "lucide-react";

import { CreateOrderForm } from "@/components/create-order-form";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { requireEmployeePage } from "@/lib/auth";
import { getAllIngredients } from "@/lib/db/inventory";

export default async function CreateOrderPage() {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const ingredients = await getAllIngredients();

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Package className="h-7 w-7" />}
            sectionLabel="Inventory"
            title="Create Restock Order"
            subtitle="Select ingredients and quantities to restock."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={[{ href: "/manager/inventory" as Route, label: "← Back" }]}
          />
          <CreateOrderForm ingredients={ingredients} />
        </div>
      </main>
    </>
  );
}
