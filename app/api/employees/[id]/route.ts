import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { deleteEmployee, saveEmployee } from "@/lib/db/employees";
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
    parsed.data.email.trim().toLowerCase(),
    parsed.data.isManager
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const employeeId = Number(params.id);

  if (!Number.isInteger(employeeId)) {
    return NextResponse.json({ error: "Invalid employee." }, { status: 400 });
  }

  await deleteEmployee(employeeId);

  return NextResponse.json({ ok: true });
}
