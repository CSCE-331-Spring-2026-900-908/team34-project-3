import { NextResponse } from "next/server";

import { validateEmployeeLogin } from "@/lib/db/auth";
import { saveEmployeeSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid login request." }, { status: 400 });
  }

  const employee = await validateEmployeeLogin(Number(parsed.data.employeeId), parsed.data.password);

  if (!employee) {
    return NextResponse.json({ error: "Employee ID or password was incorrect." }, { status: 401 });
  }

  await saveEmployeeSession(employee);

  return NextResponse.json({ ok: true });
}
