import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument
} from "@/lib/db/manager-copilot-store";
import { embedManagerText } from "@/lib/manager-copilot-embeddings";
import { getSessionEmployee } from "@/lib/session";

const allowedCategories = ["Instruction", "Manager Note", "SOP", "Vendor", "Promotion"] as const;
const allowedSources = ["manual", "upload"] as const;

export async function GET() {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const documents = await listKnowledgeDocuments(100);
  return NextResponse.json({
    documents: documents.map((document) => ({
      ...document,
      canEdit: document.source === "manual" && document.createdByEmployeeId === employee.employeeId
    }))
  });
}

export async function POST(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        category?: string;
        content?: string;
        source?: string;
      }
    | null;

  const title = body?.title?.trim();
  const category = body?.category?.trim();
  const content = body?.content?.trim();
  const source = body?.source?.trim() ?? "manual";

  if (!title || !category || !content) {
    return NextResponse.json({ error: "Title, category, and content are required." }, { status: 400 });
  }

  if (!allowedCategories.includes(category as (typeof allowedCategories)[number])) {
    return NextResponse.json({ error: "That document category is not supported." }, { status: 400 });
  }

  if (!allowedSources.includes(source as (typeof allowedSources)[number])) {
    return NextResponse.json({ error: "That document source is not supported." }, { status: 400 });
  }

  const snippet = content.slice(0, 220);
  const embedding = await embedManagerText(`${title}\n${content}`);
  const id = await createKnowledgeDocument({
    title,
    category,
    content,
    snippet,
    embedding,
    source: source as (typeof allowedSources)[number],
    createdByEmployeeId: employee.employeeId
  });

  return NextResponse.json({ id });
}

export async function PUT(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const body = (await request.json().catch(() => null)) as
    | {
        id?: string;
        title?: string;
        category?: string;
        content?: string;
      }
    | null;

  const documentId = body?.id?.trim();
  const title = body?.title?.trim();
  const category = body?.category?.trim();
  const content = body?.content?.trim();

  if (!documentId || !title || !category || !content) {
    return NextResponse.json({ error: "Document id, title, category, and content are required." }, { status: 400 });
  }

  if (!allowedCategories.includes(category as (typeof allowedCategories)[number])) {
    return NextResponse.json({ error: "That document category is not supported." }, { status: 400 });
  }

  const documents = await listKnowledgeDocuments(100);
  const existingDocument = documents.find((document) => document.id === documentId);

  if (!existingDocument) {
    return NextResponse.json({ error: "That document no longer exists." }, { status: 404 });
  }

  const canEdit =
    existingDocument.source === "manual" && existingDocument.createdByEmployeeId === employee.employeeId;

  if (!canEdit) {
    return NextResponse.json(
      { error: "Only documents you created directly in the editor can be changed." },
      { status: 403 }
    );
  }

  const snippet = content.slice(0, 220);
  const embedding = await embedManagerText(`${title}\n${content}`);

  await updateKnowledgeDocument({
    id: documentId,
    title,
    category,
    content,
    snippet,
    embedding
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  const url = new URL(request.url);
  const documentId = url.searchParams.get("id")?.trim();

  if (!documentId) {
    return NextResponse.json({ error: "A document id is required." }, { status: 400 });
  }

  await deleteKnowledgeDocument(documentId);
  return NextResponse.json({ ok: true });
}
