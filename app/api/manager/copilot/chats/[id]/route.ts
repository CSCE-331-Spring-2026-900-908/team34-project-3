import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { deleteChat, getChatMessages } from "@/lib/db/manager-copilot-store";
import { getSessionEmployee } from "@/lib/session";

export async function GET(_: Request, context: { params: { id: string } }) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const messages = await getChatMessages(context.params.id);
  return NextResponse.json({ messages });
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  await deleteChat(context.params.id);
  return NextResponse.json({ ok: true });
}
