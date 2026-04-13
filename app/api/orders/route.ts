import { NextResponse } from "next/server";

import { unauthorizedJson } from "@/lib/auth";
import { completeCurrentOrder } from "@/lib/db/orders";
import { getSessionEmployee } from "@/lib/session";
import { completeOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  const body = await request.json().catch(() => null);
  const parsed = completeOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order." }, { status: 400 });
  }

  try {
    await completeCurrentOrder(employee.employeeId, parsed.data.items, parsed.data.customerGoogleId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
