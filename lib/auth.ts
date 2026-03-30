import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getSessionEmployee } from "@/lib/session";

export async function requireEmployeePage() {
  const employee = await getSessionEmployee();

  if (!employee) {
    redirect("/login");
  }

  return employee;
}

export function unauthorizedJson(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenJson(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}