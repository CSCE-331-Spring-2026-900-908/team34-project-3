import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { updateMenuItem } from "@/lib/db/menu-items";
import { getSessionEmployee } from "@/lib/session";
import { menuItemMutationSchema } from "@/lib/validation";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const body = await request.json().catch(() => null);
  const parsed = menuItemMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid menu item." }, { status: 400 });
  }

  const ingredientMap: Record<number, number> = {};
  for (const [key, value] of Object.entries(parsed.data.ingredients)) {
    if (value > 0) {
      ingredientMap[Number(key)] = value;
    }
  }

  await updateMenuItem(
    Number(params.id),
    parsed.data.name.trim(),
    Number(parsed.data.rawCost),
    ingredientMap
  );

  return NextResponse.json({ ok: true });
}
