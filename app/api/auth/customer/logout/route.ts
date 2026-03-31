import { NextResponse } from "next/server";

import { destroyCustomerSession } from "@/lib/session";

export async function POST(request: Request) {
  await destroyCustomerSession();
  return NextResponse.redirect(new URL("/customer-login", request.url), { status: 303 });
}
