"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RestockOrder, Ingredient, CriticalIngredient } from "@/lib/db/inventory"

type Props = {
  orders: RestockOrder[];
  criticalIngredients: CriticalIngredient[];
};

export function InventoryClient({ orders, criticalIngredients }: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">

      {/* Left: Previous orders */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Previous Orders</h2>
          {/* FIX: Wrapped Button in Link and removed asChild */}
          <Link href="/manager/inventory/create">
            <Button size="sm">
              + New Order
            </Button>
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="text-sm italic text-stone-500">No previous orders found.</p>
        ) : (
          orders.map((order) => {
            const confirmed = order.status === "confirmed";
            return (
              <Card key={order.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Order #{order.id} —{" "}
                      {new Date(order.orderedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-sm text-stone-500">{order.items.length} item(s)</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      className={
                        confirmed
                          ? "border-green-300 text-green-700"
                          : "border-orange-300 text-orange-600"
                      }
                    >
                      {order.status}
                    </Badge>
                    {/* FIX: Wrapped Button in Link and removed asChild */}
                    <Link href={`/manager/inventory/${order.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* Right: Critical items */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Critical Items</h2>

        {criticalIngredients.length === 0 ? (
          <p className="text-sm italic text-stone-500">All ingredients are sufficiently stocked.</p>
        ) : (
          criticalIngredients.map((ing) => (
            <Card key={ing.id} className="border-red-200">
              <CardContent className="space-y-1 py-4">
                <p className="font-semibold">{ing.name}</p>
                <p className="text-sm text-stone-500">
                  Current stock: {ing.servingsAvailable} servings
                </p>
                <p className="text-sm text-danger">
                  Recommended restock: {ing.recommendedRestockQty} units
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </section>

    </div>
  );
}