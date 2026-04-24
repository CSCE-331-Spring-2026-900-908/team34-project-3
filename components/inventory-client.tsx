"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RestockOrder, Ingredient, CriticalIngredient } from "@/lib/db/inventory";

type Props = {
  orders: RestockOrder[];
  criticalIngredients: CriticalIngredient[];
  allIngredients: Ingredient[];
};

export function InventoryClient({ orders, criticalIngredients, allIngredients }: Props) {
  const sortedIngredients = useMemo(() => {
    const criticalIds = new Set(criticalIngredients.map((c) => c.id));
    const criticalMap = new Map(criticalIngredients.map((c) => [c.id, c]));

    const critical = allIngredients
      .filter((ing) => criticalIds.has(ing.id))
      .sort((a, b) => a.servingsAvailable - b.servingsAvailable);

    const nonCritical = allIngredients
      .filter((ing) => !criticalIds.has(ing.id))
      .sort((a, b) => a.servingsAvailable - b.servingsAvailable);

    return [...critical, ...nonCritical].map((ing) => ({
      ...ing,
      isCritical: criticalIds.has(ing.id),
      recommendedRestockQty: criticalMap.get(ing.id)?.recommendedRestockQty
    }));
  }, [allIngredients, criticalIngredients]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">

      {/* Left: Previous orders */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Previous Orders</h2>
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

      {/* Right: All ingredients sorted by criticality */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Ingredient Stock Levels</h2>

        {sortedIngredients.length === 0 ? (
          <p className="text-sm italic text-stone-500">No ingredients found.</p>
        ) : (
          sortedIngredients.map((ing) => (
            <Card key={ing.id} className={ing.isCritical ? "border-red-200" : ""}>
              <CardContent className="space-y-1 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{ing.name}</p>
                  {ing.isCritical ? (
                    <Badge className="border-red-300 text-red-600">Critical</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-stone-500">
                  Current stock: {ing.servingsAvailable} servings
                </p>
                {ing.isCritical && ing.recommendedRestockQty != null ? (
                  <p className="text-sm text-red-600">
                    Recommended restock: {ing.recommendedRestockQty} units
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </section>

    </div>
  );
}
