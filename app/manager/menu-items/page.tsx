import { redirect } from "next/navigation";
import type { Route } from "next";
import { Coffee } from "lucide-react";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { MenuItemManagementClient } from "@/components/menu-item-management-client";
import { requireEmployeePage } from "@/lib/auth";
import { getMenuItems } from "@/lib/db/menu-items";
import { getAllIngredients } from "@/lib/db/inventory";
import { getManagerNavLinks } from "@/lib/manager-nav";

export default async function MenuItemsPage() {
  const employee = await requireEmployeePage("/manager/menu-items");

  if (!employee.isManager) redirect("/pos");

  const [menuItems, ingredients] = await Promise.all([
    getMenuItems(),
    getAllIngredients(),
  ]);

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Coffee className="h-7 w-7" />}
            sectionLabel="Menu Items"
            title="Menu Item Management"
            subtitle="Create and update menu items and their ingredients."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={getManagerNavLinks("/manager/menu-items" as Route)}
          />
          <MenuItemManagementClient menuItems={menuItems} ingredients={ingredients} />
        </div>
      </main>
    </>
  );
}
