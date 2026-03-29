"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RestockOrder } from "@/lib/db/inventory"


type Props = {
  order: RestockOrder;
};

export function OrderDetailClient({ order }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const confirmed = order.status === "confirmed";

  async function handleConfirm() {
    setPending(true);
    const response = await fetch(`/api/inventory/orders/${order.id}/confirm`, {
      method: "POST",
    });
    setPending(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      toast.error(payload?.error ?? "Failed to confirm order.");
      return;
    }

    toast.success("Order confirmed.");
    router.push("/manager/inventory");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">
          Order #{order.id} —{" "}
          {new Date(order.orderedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </h2>
        <Badge
          className={
            confirmed
              ? "border-green-300 text-green-700"
              : "border-orange-300 text-orange-600"
          }
        >
          {order.status}
        </Badge>
      </div>

      <div className="space-y-2">
        {order.items.length === 0 ? (
          <p className="text-sm italic text-stone-500">No items found for this order.</p>
        ) : (
          order.items.map((item) => (
            <div
              key={item.ingredientId}
              className="flex items-center justify-between rounded-2xl border border-border px-4 py-3"
            >
              <span className="text-sm font-medium">{item.ingredientName}</span>
              <span className="text-sm text-stone-500">qty: {item.quantity}</span>
            </div>
          ))
        )}
      </div>


      <Button className="w-full" onClick={handleConfirm} disabled={confirmed || pending}>
        {confirmed ? "Already Confirmed" : pending ? "Confirming..." : "Confirm Order"}
      </Button>
    </div>
  );
}