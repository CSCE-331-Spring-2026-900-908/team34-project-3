import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { getSessionCustomer, getSessionEmployee } from "@/lib/session";

export async function requireEmployeePage(nextPath = "/pos") {
  const employee = await getSessionEmployee();

  if (!employee) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return employee;
}

export async function requireCustomerPage() {
  const customer = await getSessionCustomer();

  if (!customer) {
    redirect("/customer-login?next=/kiosk");
  }

  return customer;
}

export function unauthorizedJson(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbiddenJson(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
