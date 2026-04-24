import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { listChats } from "@/lib/db/manager-copilot-store";
import { getSessionEmployee } from "@/lib/session";

export async function GET() {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const chats = await listChats(50);
  return NextResponse.json({ chats });
}
