import { notFound, redirect } from "next/navigation";
import type { Route } from "next";
import { Package } from "lucide-react";

import { OrderDetailClient } from "@/components/order-detail-client";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { PageHeader } from "@/components/page-header";
import { requireEmployeePage } from "@/lib/auth";
import { getRestockOrderById } from "@/lib/db/inventory";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const employee = await requireEmployeePage();

  if (!employee.isManager) redirect("/pos");

  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const order = await getRestockOrderById(id);
  if (!order) notFound();

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="min-h-screen bg-[rgb(var(--background))]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageHeader
            icon={<Package className="h-7 w-7" />}
            sectionLabel="Inventory"
            title={`Order #${order.id}`}
            subtitle="View order details and confirm delivery."
            employeeBadge={`${employee.fullName} (Manager)`}
            links={[{ href: "/manager/inventory" as Route, label: "← Back" }]}
          />
          <OrderDetailClient order={order} />
        </div>
      </main>
    </>
  );
}
