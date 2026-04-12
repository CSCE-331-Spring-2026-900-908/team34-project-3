import { NextResponse } from "next/server";

import { unauthorizedJson } from "@/lib/auth";
import { getRewardsBalance } from "@/lib/db/rewards";
import { getSessionCustomer } from "@/lib/session";

export async function GET() {
  const customer = await getSessionCustomer();

  if (!customer) {
    return unauthorizedJson();
  }

  const points = await getRewardsBalance(customer.googleId);

  return NextResponse.json({ points });
}
