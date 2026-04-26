import { NextResponse } from "next/server";
import { getEmployeeByPasscode } from "@/lib/db/employees"; // The function you just wrote
import { saveEmployeeSession } from "@/lib/session"; // From your auth logic [7]

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();
    
    // Ensure the PIN is a number
    const numericPin = Number(pin);
    if (isNan(numericPin)) {
      return NextResponse.json({ error: "Invalid PIN format." }, { status: 400 });
    }

    // Use your function to find the employee
    const employee = await getEmployeeByPasscode(numericPin);

    if (employee) {
      // If an employee is found, save their session
      await saveEmployeeSession(employee);
      return NextResponse.json({ ok: true, employee });
    } else {
      // If no employee is found, return an unauthorized error
      return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}