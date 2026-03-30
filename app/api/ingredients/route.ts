import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { addIngredient } from "@/lib/db/inventory";
import { getSessionEmployee } from "@/lib/session";
import { ingredientFormSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const body = await request.json().catch(() => null);
  const parsed = ingredientFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ingredient." }, { status: 400 });
  }

  const rawStartingQuantity = parsed.data.rawStartingQuantity?.trim() ?? "";
  let startingQuantity = Number.parseInt(rawStartingQuantity, 10);

  if (Number.isNaN(startingQuantity) || startingQuantity < 0) {
    startingQuantity = 0;
  }

  const ingredient = await addIngredient(parsed.data.name.trim(), Number(parsed.data.rawCost.trim()));

  return NextResponse.json({
    ingredient,
    startingQuantity
  });
}