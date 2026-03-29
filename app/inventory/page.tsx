import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopBar } from "@/components/project2_root/shared/top-bar";
import { requireManagerPage } from "@/lib/auth";
import { getCriticalIngredients, getRestockOrders } from "@/lib/db/inventory";
import { formatCurrency, formatRestockOrderTitle } from "@/lib/utils";

export default async function InventoryPage() {
  const employee = await requireManagerPage();
  const orders = await getRestockOrders();
  const criticalIngredients = await getCriticalIngredients();

  return (
    <div className="app-shell">
      <TopBar
        title="Orders & Inventory"
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[
          { href: "/pos", label: "Cashier" },
          { href: "/manager", label: "Manager Dashboard" },
          { href: "/manager-actions", label: "Manager Actions" }
        ]}
      />

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Previous Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link className="inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90" href="/inventory/create">
              + Create New Order
            </Link>
            {orders.length === 0 ? (
              <p className="text-sm italic text-slate-500">No previous orders found.</p>
            ) : (
              orders.map((order) => {
                const total = order.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
                return (
                  <div key={order.id} className="rounded-lg border border-border p-4">
                    <div className="font-semibold">{formatRestockOrderTitle(order.id, order.orderedAt)}</div>
                    <div className="mt-1 text-sm text-slate-600">Total: {formatCurrency(total)}</div>
                    <div className="text-sm text-slate-600">{order.items.length} item(s)</div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Badge className={order.status.toLowerCase() === "confirmed" ? "border-success text-success" : "border-warning text-warning"}>
                        Status: {order.status}
                      </Badge>
                      <Link className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted" href={`/inventory/${order.id}`}>
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticalIngredients.length === 0 ? (
              <p className="text-sm italic text-slate-500">All ingredients are sufficiently stocked.</p>
            ) : (
              criticalIngredients.map((ingredient) => (
                <div key={ingredient.id} className="rounded-lg border border-danger/30 p-4">
                  <div className="font-semibold">{ingredient.name}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Current stock: {ingredient.servingsAvailable.toFixed(0)} servings
                  </div>
                  <div className="text-sm text-danger">Recommended restock: {ingredient.recommendedRestockQty} units</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}