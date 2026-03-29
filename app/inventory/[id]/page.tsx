import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { TopBar } from "@/components/project2_root/shared/top-bar";
import { requireManagerPage } from "@/lib/auth";
import { getRestockOrderById } from "@/lib/db/inventory";
import { formatRestockOrderTitle } from "@/lib/utils";

export default async function InventoryOrderDetailPage({ params }: { params: { id: string } }) {
  const employee = await requireManagerPage();
  const order = await getRestockOrderById(Number(params.id));

  if (!order) {
    notFound();
  }

  return (
    <div className="app-shell">
      <TopBar
        title="Order Detail"
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[{ href: "/inventory", label: "Back" }]}
      />
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{formatRestockOrderTitle(order.id, order.orderedAt)}</h1>
          <Badge className={order.status.toLowerCase() === "confirmed" ? "border-success text-success" : "border-warning text-warning"}>
            Status: {order.status}
          </Badge>
          <div className="space-y-3">
            {order.items.length === 0 ? (
              <p className="text-sm italic text-slate-500">No items found for this order.</p>
            ) : (
              order.items.map((item) => (
                <div key={`${item.ingredientId}-${item.ingredientName}`} className="rounded-lg border border-border p-3 text-sm">
                  {item.ingredientName} — qty: {item.quantity}
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href="/inventory">
              Back
            </Link>
            {order.status.toLowerCase() === "confirmed" ? (
              <span className="inline-flex rounded-md bg-muted px-4 py-2 text-sm font-medium text-slate-500">
                Already Confirmed
              </span>
            ) : (
              <form action={`/api/restock-orders/${order.id}/confirm`} method="post">
                <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90" type="submit">
                  Confirm Order
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}