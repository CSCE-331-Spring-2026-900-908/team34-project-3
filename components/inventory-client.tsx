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
          <div className="max-h-[600px] space-y-2.5 overflow-y-auto pr-1">
            {orders.map((order) => {
              const confirmed = order.status === "confirmed";
              return (
                <Card key={order.id}>
                  <CardContent className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Order #{order.id} -{" "}
                        {new Date(order.orderedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>
                      <p className="text-sm text-stone-500">{order.items.length} item(s)</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
            })}
          </div>
        )}
      </section>

      {/* Right: All ingredients sorted by criticality */}
      <section className="space-y-4">
        <div className="flex min-h-9 items-center">
          <h2 className="text-lg font-semibold">Ingredient Stock Levels</h2>
        </div>

        {sortedIngredients.length === 0 ? (
          <p className="text-sm italic text-stone-500">No ingredients found.</p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-[1.75rem] border border-border bg-[rgb(var(--surface))] shadow-[0_18px_38px_rgba(83,54,37,0.08)]">
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 border-b border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-stone-500 sm:px-6">
              <span>Ingredient</span>
              <span>Stock</span>
              <span>Status</span>
            </div>

            {sortedIngredients.map((ing, index) => (
              <div
                key={ing.id}
                className={`grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 px-5 py-3 sm:px-6 ${
                  index !== sortedIngredients.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-semibold">{ing.name}</p>
                  {ing.isCritical && ing.recommendedRestockQty != null ? (
                    <p className="mt-1 text-sm text-red-600">
                      Restock {ing.recommendedRestockQty} units
                    </p>
                  ) : null}
                </div>

                <div className="text-sm text-stone-600">
                  {ing.servingsAvailable} servings
                </div>

                <div className="flex items-start">
                  {ing.isCritical ? (
                    <Badge className="border-red-300 text-red-600">Critical</Badge>
                  ) : (
                    <span className="text-sm text-stone-500">OK</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
