import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { saveEmployee } from "@/lib/db/employees";
import { getSessionEmployee } from "@/lib/session";
import { employeeMutationSchema } from "@/lib/validation";

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
  const parsed = employeeMutationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid employee." }, { status: 400 });
  }

  await saveEmployee(
    Number(params.id),
    parsed.data.firstName.trim(),
    parsed.data.lastName.trim(),
    parsed.data.isManager
  );

  return NextResponse.json({ ok: true });
}