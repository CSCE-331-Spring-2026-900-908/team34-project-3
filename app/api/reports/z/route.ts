import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { generateZReport, ZReportAlreadyGeneratedError } from "@/lib/db/reports";
import { getSessionEmployee } from "@/lib/session";

export async function POST() {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  try {
    const report = await generateZReport(employee.employeeId);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    if (error instanceof ZReportAlreadyGeneratedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Unable to generate Z report.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
