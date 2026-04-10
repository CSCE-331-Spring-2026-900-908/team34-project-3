import { notFound, redirect } from "next/navigation";
import type { Route } from "next";

import { OrderDetailClient } from "@/components/order-detail-client";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { TopBar } from "@/components/top-bar";
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
      <TopBar
        title={`Order #${order.id}`}
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[{ href: "/manager/inventory" as Route, label: "← Back" }]}
      />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="shell-frame">
        <OrderDetailClient order={order} />
      </main>
    </>
  );
}
