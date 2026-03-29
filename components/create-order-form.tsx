"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RestockOrder, Ingredient, CriticalIngredient } from "@/lib/db/inventory"


type Props = {
  ingredients: Ingredient[];
};

export function CreateOrderForm({ ingredients }: Props) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);

  function setQty(id: number, raw: string) {
    const val = Math.max(0, parseInt(raw, 10) || 0);
    setQuantities((prev) => ({ ...prev, [id]: val }));
  }

  function handleAutoPopulate() {
    const recommended: Record<number, number> = {};
    for (const ing of ingredients) {
      if (ing.recommendedRestockQty && ing.recommendedRestockQty > 0)
        recommended[ing.id] = ing.recommendedRestockQty;
    }
    setQuantities(recommended);
  }

  const orderItems = ingredients.filter((i) => (quantities[i.id] ?? 0) > 0);
  const total = orderItems.reduce((sum, i) => sum + (quantities[i.id] ?? 0) * i.addCost, 0);

  async function handleSubmit() {
    if (orderItems.length === 0) {
      toast.error("Add at least one item before submitting.");
      return;
    }

    setPending(true);
    const response = await fetch("/api/inventory/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantities }),
    });
    setPending(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to submit order.");
      return;
    }

    toast.success("Order submitted.");
    router.push("/manager/inventory");
    router.refresh();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">

      {/* Left: Ingredient picker */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Select Ingredients</h2>
          <Button variant="outline" size="sm" onClick={handleAutoPopulate}>
            Auto-populate
          </Button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing) => (
            <div
              key={ing.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-3"
            >
              <span className="text-sm font-medium">{ing.name}</span>
              <input
                type="number"
                min={0}
                value={quantities[ing.id] ?? 0}
                onChange={(e) => setQty(ing.id, e.target.value)}
                className="w-20 rounded-xl border border-border px-3 py-1.5 text-center text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Right: Order summary */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Order Summary</h2>
        <Card>
          <CardContent className="space-y-2 py-4">
            {orderItems.length === 0 ? (
              <p className="text-sm italic text-stone-500">No items added yet.</p>
            ) : (
              orderItems.map((ing) => (
                <div key={ing.id} className="flex justify-between text-sm">
                  <span>{ing.name}</span>
                  <span>x{quantities[ing.id]}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-sm font-semibold">Total: ${total.toFixed(2)}</p>

        <div className="flex gap-3">
          <Button className="flex-1" onClick={handleSubmit} disabled={pending}>
            {pending ? "Submitting..." : "Submit Order"}
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => router.push("/manager/inventory")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </section>

    </div>
  );
}