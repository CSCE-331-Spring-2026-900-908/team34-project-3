import { NextResponse } from "next/server";

import { getSessionEmployee } from "@/lib/session";
import { submitRestockOrder } from "@/lib/db/inventory";

export async function POST(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee?.isManager)
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    quantities?: Record<string, number>;
  } | null;

  if (!body?.quantities || typeof body.quantities !== "object")
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  // Filter to valid non-zero integer-keyed entries only
  const quantities: Record<number, number> = {};
  for (const [key, value] of Object.entries(body.quantities)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (typeof value !== "number" || value <= 0) continue;
    quantities[id] = value;
  }

  if (Object.keys(quantities).length === 0)
    return NextResponse.json({ error: "At least one item is required." }, { status: 400 });

  await submitRestockOrder(quantities);
  return NextResponse.json({ ok: true }, { status: 201 });
}