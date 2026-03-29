import { NextResponse } from "next/server";

import { getSessionEmployee } from "@/lib/session";
import { confirmRestockOrder, getRestockOrderById } from "@/lib/db/inventory";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const employee = await getSessionEmployee();

  if (!employee?.isManager)
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });

  const order = await getRestockOrderById(id);
  if (!order)
    return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (order.status === "confirmed")
    return NextResponse.json({ error: "Order is already confirmed." }, { status: 409 });

  await confirmRestockOrder(id);
  return NextResponse.json({ ok: true });
}