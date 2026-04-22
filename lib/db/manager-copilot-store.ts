import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

export type StoredKnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  snippet: string;
  content: string;
  embedding: number[] | null;
  createdAt: string;
};

export type StoredChatSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoningSummary: string | null;
  toolTrace: unknown;
  knowledgeSources: unknown;
  chart: unknown;
  artifact: unknown;
  createdAt: string;
};

let ensurePromise: Promise<void> | null = null;

function parseEmbedding(value: unknown): number[] | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : null;
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is number => typeof item === "number");
  }

  return null;
}

function parseJsonField(value: unknown) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  return value ?? null;
}

export async function ensureManagerCopilotTables() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manager_copilot_documents (
          id TEXT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          snippet TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding JSONB,
          created_by_employee_id INT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS manager_copilot_documents_created_at_idx
        ON manager_copilot_documents (created_at DESC)
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manager_copilot_chats (
          id TEXT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          created_by_employee_id INT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS manager_copilot_chats_updated_at_idx
        ON manager_copilot_chats (updated_at DESC)
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS manager_copilot_messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL REFERENCES manager_copilot_chats(id) ON DELETE CASCADE,
          role VARCHAR(20) NOT NULL,
          content TEXT NOT NULL,
          reasoning_summary TEXT,
          tool_trace JSONB,
          knowledge_sources JSONB,
          chart JSONB,
          artifact JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS manager_copilot_messages_chat_idx
        ON manager_copilot_messages (chat_id, created_at ASC)
      `);
    })();
  }

  await ensurePromise;
}

export async function createKnowledgeDocument(input: {
  title: string;
  category: string;
  content: string;
  snippet: string;
  embedding: number[] | null;
  createdByEmployeeId?: number | null;
}) {
  await ensureManagerCopilotTables();

  const id = randomUUID();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
      INSERT INTO manager_copilot_documents (
        id,
        title,
        category,
        snippet,
        content,
        embedding,
        created_by_employee_id
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING id
    `,
    id,
    input.title,
    input.category,
    input.snippet,
    input.content,
    input.embedding ? JSON.stringify(input.embedding) : null,
    input.createdByEmployeeId ?? null
  );

  return rows[0]?.id ?? id;
}

export async function listKnowledgeDocuments(limit = 50): Promise<StoredKnowledgeDocument[]> {
  await ensureManagerCopilotTables();

  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT id, title, category, snippet, content, embedding, created_at
      FROM manager_copilot_documents
      ORDER BY created_at DESC
      LIMIT $1
    `,
    safeLimit
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    snippet: String(row.snippet),
    content: String(row.content),
    embedding: parseEmbedding(row.embedding),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row.created_at)).toISOString()
  }));
}

export async function listInstructionDocuments() {
  await ensureManagerCopilotTables();

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT id, title, category, snippet, content, embedding, created_at
      FROM manager_copilot_documents
      WHERE category = 'Instruction'
      ORDER BY created_at DESC
      LIMIT 10
    `
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    snippet: String(row.snippet),
    content: String(row.content),
    embedding: parseEmbedding(row.embedding),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row.created_at)).toISOString()
  }));
}

export async function deleteKnowledgeDocument(documentId: string) {
  await ensureManagerCopilotTables();

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM manager_copilot_documents
      WHERE id = $1
    `,
    documentId
  );
}

export async function createChat(input: {
  title: string;
  createdByEmployeeId?: number | null;
}) {
  await ensureManagerCopilotTables();

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO manager_copilot_chats (id, title, created_by_employee_id)
      VALUES ($1, $2, $3)
    `,
    id,
    input.title,
    input.createdByEmployeeId ?? null
  );

  return id;
}

export async function touchChat(chatId: string, title?: string) {
  await ensureManagerCopilotTables();

  if (title) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE manager_copilot_chats
        SET title = $2, updated_at = NOW()
        WHERE id = $1
      `,
      chatId,
      title
    );
    return;
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE manager_copilot_chats
      SET updated_at = NOW()
      WHERE id = $1
    `,
    chatId
  );
}

export async function saveChatMessage(input: {
  chatId: string;
  role: "user" | "assistant";
  content: string;
  reasoningSummary?: string | null;
  toolTrace?: unknown;
  knowledgeSources?: unknown;
  chart?: unknown;
  artifact?: unknown;
}) {
  await ensureManagerCopilotTables();

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO manager_copilot_messages (
        id,
        chat_id,
        role,
        content,
        reasoning_summary,
        tool_trace,
        knowledge_sources,
        chart,
        artifact
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
    `,
    randomUUID(),
    input.chatId,
    input.role,
    input.content,
    input.reasoningSummary ?? null,
    input.toolTrace ? JSON.stringify(input.toolTrace) : null,
    input.knowledgeSources ? JSON.stringify(input.knowledgeSources) : null,
    input.chart ? JSON.stringify(input.chart) : null,
    input.artifact ? JSON.stringify(input.artifact) : null
  );

  await touchChat(input.chatId);
}

export async function listChats(limit = 30): Promise<StoredChatSummary[]> {
  await ensureManagerCopilotTables();

  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT id, title, created_at, updated_at
      FROM manager_copilot_chats
      ORDER BY updated_at DESC
      LIMIT $1
    `,
    safeLimit
  );

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row.created_at)).toISOString(),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(String(row.updated_at)).toISOString()
  }));
}

export async function getChatMessages(chatId: string): Promise<StoredChatMessage[]> {
  await ensureManagerCopilotTables();

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT id, role, content, reasoning_summary, tool_trace, knowledge_sources, chart, artifact, created_at
      FROM manager_copilot_messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
    `,
    chatId
  );

  return rows.map((row) => ({
    id: String(row.id),
    role: String(row.role) === "assistant" ? "assistant" : "user",
    content: String(row.content),
    reasoningSummary: row.reasoning_summary == null ? null : String(row.reasoning_summary),
    toolTrace: parseJsonField(row.tool_trace),
    knowledgeSources: parseJsonField(row.knowledge_sources),
    chart: parseJsonField(row.chart),
    artifact: parseJsonField(row.artifact),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(String(row.created_at)).toISOString()
  }));
}

export async function deleteChat(chatId: string) {
  await ensureManagerCopilotTables();

  await prisma.$executeRawUnsafe(
    `
      DELETE FROM manager_copilot_chats
      WHERE id = $1
    `,
    chatId
  );
}
