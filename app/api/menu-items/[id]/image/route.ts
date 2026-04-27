import { writeFile } from "fs/promises";
import path from "path";

import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import { getSessionEmployee } from "@/lib/session";

const MAX_SIZE = 2 * 1024 * 1024;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const { id } = await params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image." }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dest = path.join(process.cwd(), "public", "menu-items", `menuitem_${itemId}.png`);
  await writeFile(dest, buffer);

  return NextResponse.json({ ok: true });
}
