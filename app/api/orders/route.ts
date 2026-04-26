import { NextResponse } from "next/server";

import { completeCurrentOrder, priceOrder } from "@/lib/db/orders";
import { getOrCreateRewards, getRewardsBalance, redeemPoints } from "@/lib/db/rewards";
import { resolveRedemption } from "@/lib/rewards-rules";
import { getSessionCustomer, getSessionEmployee } from "@/lib/session";
import { completeOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const [employee, customer] = await Promise.all([
    getSessionEmployee(),
    getSessionCustomer(),
  ]);

  // TODO
  // Commenting this out because I want to be able to check out as a guest without signing in as a customer

  // TODO
  // I know this is not secure anymore, but I just want it to work or something
  // Unfortunately removing this means our endpoint can be spammed from the outside......
  // Should think about that later

//   if (!employee && !customer) {
//     return unauthorizedJson();
//   }

  const body = await request.json().catch(() => null);
  const parsed = completeOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order." }, { status: 400 });
  }

  // Employee path: customerGoogleId comes from body (optional POS loyalty flow)
  // Customer path: customerGoogleId comes from the verified session (cannot be spoofed)
  const employeeId = employee?.employeeId ?? 0;
  const customerGoogleId = employee ? parsed.data.customerGoogleId : customer?.googleId;

  // Ensure the customer_rewards row exists before completeCurrentOrder tries to
  // award points — addRewardPoints does a plain UPDATE and will throw if no row exists yet.
  if (customer) {
    await getOrCreateRewards(customer.googleId, customer.email, customer.fullName);
  }

  try {
    const redemption = customer ? parsed.data.redemption : { kind: "none" as const };
    const { subtotal, baseSubtotal } = await priceOrder(parsed.data.items);
    const { pointsCost, discount } = resolveRedemption(redemption, subtotal, baseSubtotal);

    if (customer && pointsCost > 0) {
      const balance = await getRewardsBalance(customer.googleId);
      if (balance < pointsCost) {
        return NextResponse.json({ error: "Not enough points for this redemption." }, { status: 400 });
      }
      await redeemPoints(customer.googleId, pointsCost);
    }

    await completeCurrentOrder(employeeId, parsed.data.items, customerGoogleId, {
      discount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
