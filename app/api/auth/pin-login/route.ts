import { NextResponse } from "next/server";
import { getEmployeeSessionByPasscode } from "@/lib/db/employees";
import { saveEmployeeSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (typeof pin !== "string" && typeof pin !== "number") {
      return NextResponse.json({ error: "Enter your PIN." }, { status: 400 });
    }

    const numericPin = Number(String(pin).trim());

    if (!Number.isInteger(numericPin)) {
      return NextResponse.json({ error: "PIN must be numeric." }, { status: 400 });
    }

    const employee = await getEmployeeSessionByPasscode(numericPin);

    if (employee) {
      await saveEmployeeSession(employee);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  } catch (e) {
    console.error("PIN login failed:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
