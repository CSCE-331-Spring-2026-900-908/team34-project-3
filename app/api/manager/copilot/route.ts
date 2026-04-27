import { NextResponse } from "next/server";

import { forbiddenJson, unauthorizedJson } from "@/lib/auth";
import {
  getDailySales,
  getDailySalesHistory,
  getHourlySales,
  getInventoryAlerts,
  getNextWeekSalesForecast,
  getSalesSnapshot,
  getSalesForecast,
  getTopItems,
  getWeekdaySalesPattern,
  type CopilotPeriod
} from "@/lib/db/manager-copilot";
import { createChat, saveChatMessage } from "@/lib/db/manager-copilot-store";
import {
  getManagerInstructionContext,
  searchManagerKnowledge,
  type KnowledgeSearchResult
} from "@/lib/manager-copilot-knowledge";
import { createQuickChart, type QuickChartResult } from "@/lib/quickchart";
import { prisma } from "@/lib/prisma";
import { getSessionEmployee } from "@/lib/session";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenAIResponse = {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
  }>;
  error?: {
    message?: string;
  };
};

type AssistantPayload = {
  reply?: string;
  reasoningSummary?: string;
  artifact?: {
    type: "brief" | "comparison" | "html_demo";
    title: string;
    subtitle?: string;
    highlights?: string[];
    sections?: Array<{
      title: string;
      body: string;
    }>;
    metrics?: Array<{
      label: string;
      value: string;
    }>;
    html?: string;
  } | null;
};

type ToolTraceEntry = {
  name: string;
  arguments: Record<string, unknown>;
};

type AdditionalIngredientRow = {
  addon_name: string;
  quantity_sold: number | bigint;
};

const model = process.env.MANAGER_COPILOT_MODEL ?? "gpt-4o-mini";
const managerCopilotFinalMaxTokens = Number(process.env.MANAGER_COPILOT_FINAL_MAX_TOKENS ?? 900);
const managerCopilotHtmlMaxTokens = Number(process.env.MANAGER_COPILOT_HTML_MAX_TOKENS ?? 12000);
const SQL_SCHEMA_GUIDE = [
  "auth_user(email, google_id, employee_id, full_name, first_name, last_name, picture, created_at, updated_at, last_signed_in_at)",
  "orders(order_id, employee_id, created_at, cost)",
  "orderitem(order_item_id, order_id, item_id, quantity, sweetness, ice, boba, mango_jelly, aloe_jelly, cost)",
  "item(id, name, cost)",
  "ingredient(id, name, servings_available, add_cost)",
  "itemingredient(item_id, ingredient_id, quantity)",
  "inventoryorder(id, ordered_at, status)",
  "inventoryorder_ingredient(order_id, ingredient_id, quantity, unit_cost)",
  "zreporthistory(id, business_date, total_sales, order_count, average_order_value)",
  "manager_copilot_order_lines(order_id, employee_id, created_at, order_total, order_item_id, item_id, item_name, quantity, line_total, sweetness, ice, boba, mango_jelly, aloe_jelly)",
  "manager_copilot_daily_sales(business_date, order_count, total_sales, average_order_value)",
  "manager_copilot_item_daily_sales(business_date, item_id, item_name, quantity_sold, revenue)",
  "manager_copilot_weekday_sales(weekday_index, weekday_label, sample_days, average_sales, total_sales)",
  "manager_copilot_employee_sales(employee_id, order_count, total_sales, average_order_value)"
].join("; ");

function sanitizeReply(reply: string) {
  return reply
    .replace(/\[([^\]]+)\]\(https?:\/\/quickchart\.io\/chart[^)]+\)/gi, "$1")
    .replace(/https?:\/\/quickchart\.io\/chart\S*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeHtmlDemo(html: unknown) {
  if (typeof html !== "string") {
    return "";
  }

  return html
    .replace(/<\s*(iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\s(?:src|href|action)\s*=\s*(['"])\s*(?!#|data:image\/)[\s\S]*?\1/gi, "")
    .replace(/\s(?:src|href|action)\s*=\s*[^\s>]+/gi, "")
    .slice(0, 60000)
    .trim();
}

function normalizeArtifact(artifact: AssistantPayload["artifact"]) {
  if (!artifact || typeof artifact !== "object") {
    return null;
  }

  if (artifact.type === "html_demo") {
    const html = sanitizeHtmlDemo(artifact.html);

    if (!html) {
      return null;
    }

    return {
      type: "html_demo" as const,
      title: typeof artifact.title === "string" && artifact.title.trim() ? artifact.title.trim() : "Interactive Demo",
      subtitle: typeof artifact.subtitle === "string" ? artifact.subtitle.trim() : undefined,
      html
    };
  }

  if (artifact.type !== "brief" && artifact.type !== "comparison") {
    return null;
  }

  return artifact;
}

function wantsChart(message: string) {
  return /\b(chart|graph|plot|visuali[sz]e|trendline)\b/i.test(message);
}

function wantsHtmlDemo(message: string) {
  return /\b(html|interactive|demo|demonstration|tutorial|walkthrough|simulation)\b/i.test(message) &&
    /\b(generate|create|build|make|render|show)\b/i.test(message);
}

function wantsRenderedBrief(message: string) {
  return /\b(shift brief|manager handoff|handoff brief|brief for.*handoff|daily brief)\b/i.test(message);
}

function wantsNextWeekForecast(message: string) {
  return /\b(next week|upcoming week)\b/i.test(message) && /\b(forecast|predict|projection|projected)\b/i.test(message);
}

function wantsWeekdayPattern(message: string) {
  return /\b(generally|usually|typically|tend to|on average)\b/i.test(message) &&
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|weekday|weekdays)\b/i.test(message);
}

function wantsBroadAnalytics(message: string) {
  return /\b(generally|usually|typically|trend|compare|pattern|correlat|breakdown|group by|highest|lowest|best|worst|which day|which item)\b/i.test(
    message
  );
}

function wantsAdditionalIngredientAnalytics(message: string) {
  return /\b(common|popular|top|most|frequent|frequently|best)\b/i.test(message) &&
    /\b(additional ingredient|additional ingredients|add[- ]?on|add[- ]?ons|extra ingredient|extra ingredients|topping|toppings)\b/i.test(message);
}

function wantsItemSalesChart(message: string) {
  return /\b(chart|graph|plot|visuali[sz]e)\b/i.test(message) &&
    /\b(item|items|drink|drinks|menu)\b/i.test(message) &&
    /\b(last month|past month|30 days|month)\b/i.test(message);
}

const SQL_ALLOWED_TABLES = [
  "auth_user",
  "orders",
  "orderitem",
  "item",
  "employee",
  "ingredient",
  "itemingredient",
  "inventoryorder",
  "inventoryorder_ingredient",
  "customer_rewards",
  "zreporthistory",
  "manager_copilot_order_lines",
  "manager_copilot_daily_sales",
  "manager_copilot_item_daily_sales",
  "manager_copilot_weekday_sales",
  "manager_copilot_employee_sales"
];

function guardReadOnlySql(sql: string) {
  const normalized = sql.trim().replace(/;+$/g, "");

  if (!normalized) {
    throw new Error("SQL query cannot be empty.");
  }

  if (!/^(select|with)\b/i.test(normalized)) {
    throw new Error("Only read-only SELECT or WITH queries are allowed.");
  }

  if (normalized.includes(";")) {
    throw new Error("Only a single SQL statement is allowed.");
  }

  if (
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|merge|call|copy|refresh|vacuum)\b/i.test(
      normalized
    )
  ) {
    throw new Error("This SQL tool is read-only and blocks write or admin statements.");
  }

  const referencedTables = Array.from(
    normalized.matchAll(/\b(?:from|join)\s+("?[\w.]+"?)/gi),
    (match) => match[1].replace(/"/g, "").split(".").pop() ?? ""
  ).filter(Boolean);

  const disallowedTable = referencedTables.find((table) => !SQL_ALLOWED_TABLES.includes(table));

  if (disallowedTable) {
    throw new Error(`Table "${disallowedTable}" is not exposed to the manager copilot SQL tool.`);
  }

  const limited = /\blimit\s+(\d+)\b/i.exec(normalized);
  if (limited) {
    const limitValue = Number(limited[1]);
    if (!Number.isFinite(limitValue) || limitValue < 1 || limitValue > 200) {
      throw new Error("SQL LIMIT must be between 1 and 200 rows.");
    }
    return normalized;
  }

  return `${normalized}\nLIMIT 200`;
}

async function queryManagerDatabase(sql: string) {
  const guardedSql = guardReadOnlySql(sql);
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(guardedSql);

  return {
    sql: guardedSql,
    rowCount: rows.length,
    rows: toJsonSafe(rows)
  };
}

function toNumber(value: unknown) {
  if (value == null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return Number(value);
}

function toJsonSafe(value: unknown): unknown {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafe(entry));
  }

  if (typeof value === "object") {
    if ("toNumber" in value && typeof value.toNumber === "function") {
      return value.toNumber();
    }

    if ("toJSON" in value && typeof value.toJSON === "function") {
      return value.toJSON();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toJsonSafe(entry)])
    );
  }

  return String(value);
}

async function getTopAdditionalIngredients(limit = 3) {
  const safeLimit = Math.max(1, Math.min(10, Math.round(limit)));
  const rows = await prisma.$queryRaw<AdditionalIngredientRow[]>`
    SELECT addon_name, quantity_sold
    FROM (
      SELECT 'Boba'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.boba > 1 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
      FROM orderitem oi
      UNION ALL
      SELECT 'Mango Jelly'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.mango_jelly > 0 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
      FROM orderitem oi
      UNION ALL
      SELECT 'Aloe Jelly'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.aloe_jelly > 0 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
      FROM orderitem oi
    ) add_on_trends
    WHERE quantity_sold > 0
    ORDER BY quantity_sold DESC, addon_name ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    name: row.addon_name,
    quantitySold: toNumber(row.quantity_sold)
  }));
}

function extractChartableQueryResult(result: unknown) {
  if (!result || typeof result !== "object" || !("rows" in result)) {
    return null;
  }

  const rows = Array.isArray((result as { rows?: unknown }).rows)
    ? ((result as { rows: Array<Record<string, unknown>> }).rows ?? [])
    : [];

  if (rows.length === 0) {
    return null;
  }

  const sampleRow = rows[0];
  const labelKey = Object.keys(sampleRow).find((key) => typeof sampleRow[key] === "string");
  const valueKey = Object.keys(sampleRow).find(
    (key) => Number.isFinite(Number(sampleRow[key]))
  );

  if (!labelKey || !valueKey) {
    return null;
  }

  const labels: string[] = [];
  const values: number[] = [];

  for (const row of rows) {
    const label = row[labelKey];
    const value = Number(row[valueKey]);

    if (typeof label !== "string" || !Number.isFinite(value)) {
      continue;
    }

    labels.push(label);
    values.push(value);
  }

  if (labels.length === 0 || values.length === 0) {
    return null;
  }

  return {
    labels,
    values,
    labelKey,
    valueKey
  };
}

const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_sales_snapshot",
      description: "Get total sales, order count, and average ticket for a recent sales period.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "last_7_days"],
            description: "The business period to summarize."
          }
        },
        required: ["period"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_daily_sales_history",
      description: "Get sales totals grouped by business day for a recent rolling window such as 7, 30, or 60 days.",
      parameters: {
        type: "object",
        properties: {
          basisDays: {
            type: "number",
            description: "How many recent days of sales history to return. Use 7 for last week and 30 for last month."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_next_week_sales_forecast",
      description: "Forecast each day of next week's sales using the last month of daily sales as the basis.",
      parameters: {
        type: "object",
        properties: {
          basisDays: {
            type: "number",
            description: "How many recent days of sales history to use as the basis, usually 28."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weekday_sales_pattern",
      description: "Compare average sales by weekday over recent weeks to answer questions like whether Fridays generally outperform other days.",
      parameters: {
        type: "object",
        properties: {
          basisDays: {
            type: "number",
            description: "How many recent days of sales history to use, usually 28."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_hourly_sales",
      description: "Get hourly sales and order counts for today or yesterday.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday"],
            description: "The business day to inspect hour by hour."
          }
        },
        required: ["period"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_sales_forecast",
      description: "Project the current business day's close and estimate the next few hours using historical trends.",
      parameters: {
        type: "object",
        properties: {
          horizonHours: {
            type: "number",
            description: "How many upcoming hours to project, usually 3 to 5."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_items",
      description: "Get the best performing menu items for a recent period.",
      parameters: {
        type: "object",
        properties: {
          period: {
            type: "string",
            enum: ["today", "yesterday", "last_7_days"],
            description: "The business period to summarize."
          },
          limit: {
            type: "number",
            description: "Maximum number of items to return. Use 3 to 5 for concise answers."
          }
        },
        required: ["period"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_alerts",
      description: "Get the ingredients that currently look most at risk and suggested restock quantities.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of inventory alerts to return."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_additional_ingredients",
      description:
        "Get the most commonly selected paid add-on ingredients or toppings on ordered drinks, such as boba, mango jelly, and aloe jelly.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Maximum number of add-on ingredients to return. Use 1 for the single most common add-on."
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_database",
      description:
        "Run a guarded read-only SQL query for broader manager analytics when the predefined tools do not fit the question.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "A single read-only SELECT or WITH query over allowed tables and views, especially manager_copilot_daily_sales, manager_copilot_item_daily_sales, manager_copilot_weekday_sales, manager_copilot_order_lines, and manager_copilot_employee_sales."
          }
        },
        required: ["sql"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_manager_knowledge",
      description: "Search manager notes, SOPs, vendor notes, and promotion notes for operational context.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "A short search query describing the manager question."
          },
          limit: {
            type: "number",
            description: "Maximum number of knowledge snippets to return."
          }
        },
        required: ["query"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_chart_image",
      description: "Generate a custom chart image through the QuickChart API for a visual answer.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string"
          },
          type: {
            type: "string",
            enum: ["bar", "line"]
          },
          labels: {
            type: "array",
            items: { type: "string" }
          },
          datasetLabel: {
            type: "string"
          },
          values: {
            type: "array",
            items: { type: "number" }
          }
        },
        required: ["title", "type", "labels", "datasetLabel", "values"],
        additionalProperties: false
      }
    }
  }
];

function parsePeriod(value: unknown): CopilotPeriod {
  return value === "yesterday" || value === "last_7_days" ? value : "today";
}

async function runTool(name: string, parsedArguments: Record<string, unknown>) {
  if (name === "get_sales_snapshot") {
    return getSalesSnapshot(parsePeriod(parsedArguments.period));
  }

  if (name === "get_daily_sales_history") {
    const basisDays = typeof parsedArguments.basisDays === "number" ? parsedArguments.basisDays : 7;
    return getDailySalesHistory(basisDays);
  }

  if (name === "get_hourly_sales") {
    const period = parsedArguments.period === "yesterday" ? "yesterday" : "today";
    return getHourlySales(period);
  }

  if (name === "get_weekday_sales_pattern") {
    const basisDays = typeof parsedArguments.basisDays === "number" ? parsedArguments.basisDays : 28;
    return getWeekdaySalesPattern(basisDays);
  }

  if (name === "get_next_week_sales_forecast") {
    const basisDays = typeof parsedArguments.basisDays === "number" ? parsedArguments.basisDays : 28;
    return getNextWeekSalesForecast(basisDays);
  }

  if (name === "get_sales_forecast") {
    const horizonHours = typeof parsedArguments.horizonHours === "number" ? parsedArguments.horizonHours : 4;
    return getSalesForecast(horizonHours);
  }

  if (name === "get_top_items") {
    const limit = typeof parsedArguments.limit === "number" ? parsedArguments.limit : 5;
    return getTopItems(parsePeriod(parsedArguments.period), limit);
  }

  if (name === "get_inventory_alerts") {
    const limit = typeof parsedArguments.limit === "number" ? parsedArguments.limit : 5;
    return getInventoryAlerts(limit);
  }

  if (name === "get_top_additional_ingredients") {
    const limit = typeof parsedArguments.limit === "number" ? parsedArguments.limit : 3;
    return getTopAdditionalIngredients(limit);
  }

  if (name === "query_database") {
    const sql = typeof parsedArguments.sql === "string" ? parsedArguments.sql : "";
    return queryManagerDatabase(sql);
  }

  if (name === "search_manager_knowledge") {
    const query = typeof parsedArguments.query === "string" ? parsedArguments.query : "";
    const limit = typeof parsedArguments.limit === "number" ? parsedArguments.limit : 3;
    return searchManagerKnowledge(query, limit);
  }

  if (name === "create_chart_image") {
    const title = typeof parsedArguments.title === "string" ? parsedArguments.title : "Manager Chart";
    const type = parsedArguments.type === "line" ? "line" : "bar";
    const labels = Array.isArray(parsedArguments.labels)
      ? parsedArguments.labels.filter((value): value is string => typeof value === "string")
      : [];
    const datasetLabel =
      typeof parsedArguments.datasetLabel === "string" ? parsedArguments.datasetLabel : "Value";
    const values = Array.isArray(parsedArguments.values)
      ? parsedArguments.values.filter((value): value is number => typeof value === "number")
      : [];

    return createQuickChart({
      title,
      type,
      labels,
      datasetLabel,
      values
    });
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function POST(request: Request) {
  const employee = await getSessionEmployee();

  if (!employee) {
    return unauthorizedJson();
  }

  if (!employee.isManager) {
    return forbiddenJson();
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Manager Copilot is not configured because OPENAI_API_KEY is missing." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    message?: string;
    history?: ChatMessage[];
    chatId?: string;
  } | null;

  const message = body?.message?.trim();
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
  const requestedChatId = body?.chatId?.trim() || null;

  if (!message) {
    return NextResponse.json({ error: "Ask a manager question first." }, { status: 400 });
  }

  const recentIntentText = [...history.slice(-4).map((entry) => entry.content), message].join("\n");
  const htmlDemoRequested = wantsHtmlDemo(message) || wantsHtmlDemo(recentIntentText);
  const renderedBriefRequested = wantsRenderedBrief(message) || wantsRenderedBrief(recentIntentText);
  const htmlArtifactRequested = htmlDemoRequested || renderedBriefRequested;
  const instructionContext = await getManagerInstructionContext();
  const chatId =
    requestedChatId ??
    (await createChat({
      title: message.slice(0, 72),
      createdByEmployeeId: employee.employeeId
    }));

  await saveChatMessage({
    chatId,
    role: "user",
    content: message
  });

  const messages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content: [
        "You are Store Advisor, a manager copilot for Brew 34.",
        "You help with sales performance, item trends, inventory risk, and manager operating questions.",
        "You must use tools before making factual claims about store performance or inventory.",
        "Use get_daily_sales_history for week-over-week or daily trend questions.",
        "Use get_weekday_sales_pattern for questions about whether Fridays, weekends, weekdays, or other named days generally perform better over recent weeks.",
        "Use get_next_week_sales_forecast for next-week or upcoming-week predictions based on historical daily sales.",
        "Use get_sales_forecast for predictive analysis and projected close questions.",
        "Use get_top_additional_ingredients for questions about the most common, popular, or frequent additional ingredients, add-ons, extras, or toppings added to drinks.",
        "Use query_database for broader analytics that do not fit the predefined tools, but only with read-only SQL.",
        `Allowed SQL tables: ${SQL_ALLOWED_TABLES.join(", ")}.`,
        `Schema reference: ${SQL_SCHEMA_GUIDE}`,
        "Prefer the manager_copilot_* analytics views first when they answer the question, because they are safer and easier to query correctly than raw transaction tables.",
        "When writing SQL, use the real schema names exactly. orders joins to orderitem on orders.order_id = orderitem.order_id, and orderitem joins to item on orderitem.item_id = item.id.",
        "For item revenue, use SUM(orderitem.cost). For quantities, use SUM(orderitem.quantity). Do not use orders.id or orderitem.price because those columns do not exist.",
        "Additional drink add-ons are tracked directly on orderitem: boba is selected when boba > 1, mango jelly when mango_jelly > 0, and aloe jelly when aloe_jelly > 0. Count selected add-ons with SUM(orderitem.quantity), not by joining itemingredient, because itemingredient is the base recipe.",
        "orders.cost has been validated to match the summed orderitem.cost for each order in the available data.",
        "For item trend charts, manager_copilot_item_daily_sales is usually the best source.",
        "For daily sales or forecasting support, manager_copilot_daily_sales is usually the best source.",
        "For weekday performance questions, manager_copilot_weekday_sales is usually the best source.",
        "SQL should be a single read-only statement without a trailing semicolon.",
        "Prefer the predefined tools first when they directly match the user request because they return cleaner business summaries.",
        "Use search_manager_knowledge when SOPs, vendor notes, promotions, or manager notes could add context.",
        instructionContext
          ? `Manager instruction documents that should be respected on every answer:\n${instructionContext}`
          : "",
        "Use create_chart_image when a visual trend or comparison would help the manager.",
        "If the user explicitly asks for a chart, graph, plot, or visualization, you should produce chart data and call create_chart_image.",
        "You can generate and render interactive HTML demonstrations when a manager asks for an HTML tutorial, demo, walkthrough, simulation, or interactive learning aid.",
        "For HTML demos, create a self-contained artifact with type html_demo. Use inline CSS and optional inline JavaScript only. Do not use external URLs, external scripts, images, forms, iframes, object tags, embed tags, localStorage, cookies, or network requests.",
        "Do not add charts or visual analytics to an HTML demo unless the user explicitly asks for a chart, graph, plot, visualization, or data comparison. For brief tutorials, prefer tabs, checklists, step cards, mini quizzes, and action buttons.",
        "Do not invent metrics, restock levels, item rankings, or document content.",
        "Do not answer with a promise to check data later. Either call the needed tool now, answer from completed tool results, ask a clarifying question, or say the available tools cannot answer it.",
        "Keep answers concise, decision-oriented, and professional.",
        "If a question is outside the available tools, say what you can answer instead."
      ].join("\n")
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content
    })),
    {
      role: "user",
      content: message
    }
  ];

  if (wantsNextWeekForecast(message)) {
    messages.splice(1, 0, {
      role: "system",
      content: "This request is specifically about next week's sales. You should call get_next_week_sales_forecast with basisDays 28 before answering."
    });
  }

  if (/\b(last month|past month|30 days|month of sales)\b/i.test(message)) {
    messages.splice(1, 0, {
      role: "system",
      content:
        "This request is about roughly the last month of sales history. You should call get_daily_sales_history with basisDays 30 before answering, unless a SQL analytics view is even better."
    });
  }

  if (wantsWeekdayPattern(message)) {
    messages.splice(1, 0, {
      role: "system",
      content: "This request asks about a general weekday pattern over recent weeks. You should call get_weekday_sales_pattern with basisDays 28 before answering."
    });
  }

  if (wantsBroadAnalytics(message)) {
    messages.splice(1, 0, {
      role: "system",
      content:
        "If the predefined manager tools are not enough to answer this analytic question precisely, call query_database with a guarded read-only SQL query instead of giving up."
    });
  }

  if (wantsAdditionalIngredientAnalytics(message)) {
    messages.splice(1, 0, {
      role: "system",
      content:
        "This request is about additional ingredients or add-ons selected on drinks. You should call get_top_additional_ingredients before answering. If you use SQL instead, count orderitem add-on columns directly: boba > 1, mango_jelly > 0, aloe_jelly > 0, weighted by orderitem.quantity."
    });
  }

  if (htmlArtifactRequested) {
    messages.splice(1, 0, {
      role: "system",
      content:
        renderedBriefRequested
          ? "This request asks for a manager shift brief or handoff. You should satisfy it by returning an html_demo artifact in the final response so the app renders the brief in the sandboxed iframe."
          : "This request asks for an interactive HTML demo or tutorial. You should satisfy it by returning an html_demo artifact in the final response. Do not refuse by saying you cannot generate HTML; this app can render sandboxed HTML artifacts."
    });
  }

  if (wantsChart(message)) {
    messages.splice(1, 0, {
      role: "system",
      content: "The user explicitly asked for a chart or graph. You should return a visual answer by calling create_chart_image once you have the relevant data."
    });
  }

  if (wantsItemSalesChart(message)) {
    messages.splice(1, 0, {
      role: "system",
      content:
        "For a last-month item sales chart, prefer query_database against manager_copilot_item_daily_sales, for example: SELECT item_name, SUM(revenue) AS total_sales, SUM(quantity_sold) AS total_quantity FROM manager_copilot_item_daily_sales WHERE business_date >= CURRENT_DATE - INTERVAL '30 days' GROUP BY item_name ORDER BY total_sales DESC LIMIT 20"
    });
  }

  const toolTrace: ToolTraceEntry[] = [];
  const knowledgeSources: KnowledgeSearchResult[] = [];
  let chart: QuickChartResult | null = null;
  const toolResults = new Map<string, unknown[]>();

  for (let step = 0; step < 6; step += 1) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        tools,
        tool_choice: "auto",
        messages
      })
    });

    const data = (await response.json().catch(() => null)) as OpenAIResponse | null;

    if (!response.ok) {
      const apiError =
        typeof data?.error?.message === "string"
          ? data.error.message
          : "The manager copilot could not answer right now.";

      return NextResponse.json({ error: apiError }, { status: response.status });
    }

    const assistantMessage = data?.choices?.[0]?.message;

    if (!assistantMessage) {
      break;
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push({
        role: "assistant",
        content: assistantMessage.content ?? "",
        tool_calls: assistantMessage.tool_calls
      });

      for (const toolCall of assistantMessage.tool_calls) {
        let parsedArguments: Record<string, unknown> = {};

        try {
          parsedArguments = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        } catch {
          parsedArguments = {};
        }

        toolTrace.push({
          name: toolCall.function.name,
          arguments: parsedArguments
        });

        try {
          const toolResult = await runTool(toolCall.function.name, parsedArguments);
          toolResults.set(toolCall.function.name, [...(toolResults.get(toolCall.function.name) ?? []), toolResult]);

          if (toolCall.function.name === "search_manager_knowledge" && Array.isArray(toolResult)) {
            knowledgeSources.push(
              ...toolResult.filter(
                (entry): entry is KnowledgeSearchResult =>
                  !!entry &&
                  typeof entry === "object" &&
                  "title" in entry &&
                  "snippet" in entry &&
                  "category" in entry
              )
            );
          }

          if (
            toolCall.function.name === "create_chart_image" &&
            toolResult &&
            typeof toolResult === "object" &&
            "url" in toolResult
          ) {
            chart = toolResult as QuickChartResult;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content:
              toolCall.function.name === "create_chart_image"
                ? JSON.stringify({
                    status: "chart_ready",
                    title: (toolResult as QuickChartResult).title,
                    type: (toolResult as QuickChartResult).type
                  })
                : JSON.stringify(toJsonSafe(toolResult))
          });
        } catch (error) {
          const toolError =
            error instanceof Error ? error.message : `Unable to run tool ${toolCall.function.name}.`;

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: toolError })
          });
        }
      }

      continue;
    }

    break;
  }

  if (wantsAdditionalIngredientAnalytics(message) && !toolResults.has("get_top_additional_ingredients")) {
    const toolResult = await getTopAdditionalIngredients(3);
    toolResults.set("get_top_additional_ingredients", [toolResult]);
    toolTrace.push({
      name: "get_top_additional_ingredients",
      arguments: { limit: 3 }
    });
    messages.push({
      role: "system",
      content: `Completed get_top_additional_ingredients with this JSON result: ${JSON.stringify(toolResult)}`
    });
  }

  if (!chart && wantsChart(message)) {
    const nextWeekForecast = toolResults.get("get_next_week_sales_forecast")?.[0] as
      | { days?: Array<{ label: string; projectedSales: number; lowerBound?: number; upperBound?: number }> }
      | undefined;
    const dailySalesHistory = toolResults.get("get_daily_sales_history")?.[0] as
      | { basisDays?: number; days?: Array<{ label: string; totalSales: number }> }
      | undefined;
    const weekdayPattern = toolResults.get("get_weekday_sales_pattern")?.[0] as
      | { days?: Array<{ label: string; averageSales: number }> }
      | undefined;
    const sqlQueryResult = toolResults.get("query_database")?.find((result) => !!extractChartableQueryResult(result));
    const hourlySales = toolResults.get("get_hourly_sales")?.[0] as
      | Array<{ hour: number; totalSales: number }>
      | undefined;

    if (nextWeekForecast?.days?.length) {
      chart = createQuickChart({
        title: "Projected Sales for Next Week",
        type: "line",
        labels: nextWeekForecast.days.map((day) => day.label),
        datasets: [
          {
            label: "Projected Sales ($)",
            values: nextWeekForecast.days.map((day) => day.projectedSales),
            type: "line",
            backgroundColor: "rgba(23, 23, 23, 0.15)",
            borderColor: "#171717"
          },
          {
            label: "Lower 95% Bound",
            values: nextWeekForecast.days.map((day) => day.lowerBound ?? day.projectedSales),
            type: "line",
            backgroundColor: "rgba(120, 113, 108, 0.08)",
            borderColor: "#78716c",
            borderDash: [6, 4]
          },
          {
            label: "Upper 95% Bound",
            values: nextWeekForecast.days.map((day) => day.upperBound ?? day.projectedSales),
            type: "line",
            backgroundColor: "rgba(120, 113, 108, 0.08)",
            borderColor: "#a8a29e",
            borderDash: [6, 4]
          }
        ]
      });
      toolTrace.push({
        name: "create_chart_image",
        arguments: { title: "Projected Sales for Next Week", type: "line" }
      });
    } else if (weekdayPattern?.days?.length) {
      chart = createQuickChart({
        title: "Average Sales by Weekday",
        type: "bar",
        labels: weekdayPattern.days.map((day) => day.label),
        datasetLabel: "Average Sales ($)",
        values: weekdayPattern.days.map((day) => day.averageSales)
      });
      toolTrace.push({
        name: "create_chart_image",
        arguments: { title: "Average Sales by Weekday", type: "bar" }
      });
    } else if (sqlQueryResult) {
      const chartableResult = extractChartableQueryResult(sqlQueryResult);

      if (chartableResult) {
        const valueLabel =
          chartableResult.valueKey === "total_sales"
            ? "Total Sales ($)"
            : chartableResult.valueKey === "total_quantity"
              ? "Units Sold"
              : chartableResult.valueKey.replace(/_/g, " ");

        chart = createQuickChart({
          title: "Manager Query Results",
          type: "bar",
          labels: chartableResult.labels,
          datasetLabel: valueLabel,
          values: chartableResult.values
        });
        toolTrace.push({
          name: "create_chart_image",
          arguments: { title: "Manager Query Results", type: "bar" }
        });
      }
    } else if (dailySalesHistory?.days?.length) {
      chart = createQuickChart({
        title: `Last ${dailySalesHistory.basisDays ?? dailySalesHistory.days.length} Days Sales`,
        type: "bar",
        labels: dailySalesHistory.days.map((day) => day.label),
        datasetLabel: "Total Sales ($)",
        values: dailySalesHistory.days.map((day) => day.totalSales)
      });
      toolTrace.push({
        name: "create_chart_image",
        arguments: {
          title: `Last ${dailySalesHistory.basisDays ?? dailySalesHistory.days.length} Days Sales`,
          type: "bar"
        }
      });
    } else if (Array.isArray(hourlySales) && hourlySales.length > 0) {
      chart = createQuickChart({
        title: "Hourly Sales",
        type: "bar",
        labels: hourlySales.map((row) => String(row.hour)),
        datasetLabel: "Total Sales ($)",
        values: hourlySales.map((row) => row.totalSales)
      });
      toolTrace.push({
        name: "create_chart_image",
        arguments: { title: "Hourly Sales", type: "bar" }
      });
    }
  }

  const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: htmlArtifactRequested ? managerCopilotHtmlMaxTokens : managerCopilotFinalMaxTokens,
        response_format: {
          type: "json_object"
        },
      messages: [
        {
          role: "system",
          content: [
            "You are formatting a final manager copilot response.",
            'Return JSON with this exact shape: {"reply":"string","reasoningSummary":"string","artifact":null|{"type":"brief"|"comparison","title":"string","subtitle":"string","highlights":["string"],"sections":[{"title":"string","body":"string"}],"metrics":[{"label":"string","value":"string"}]}|{"type":"html_demo","title":"string","subtitle":"string","html":"string"}}',
            "The reply should be concise and useful for a manager.",
            "The reasoningSummary should be a short, safe summary of how the conclusion was reached.",
            "Do not say you will check, look up, retrieve, or analyze something unless the final answer also gives the completed result. Report what was already done.",
            htmlDemoRequested
              ? "The user asked for an interactive HTML demo/tutorial. Return an html_demo artifact with complete self-contained HTML. Include inline CSS and small inline JavaScript for interactions such as tabs, checklists, quizzes, sliders, or step navigation. Keep the reply short, but do not truncate the HTML or leave tags, scripts, styles, or JSON strings unfinished. Do not include fake charts, external resources, URLs, iframes, forms, network requests, cookies, or localStorage."
              : renderedBriefRequested
                ? "The user asked for a shift brief or manager handoff. Return an html_demo artifact with complete self-contained HTML that renders a polished handoff card. Use inline CSS only unless a tiny inline script is truly necessary. Include the sales metrics, top items, inventory alerts, and clear next-shift notes from the completed tool results. Keep the reply short, but do not truncate the HTML or leave tags, styles, or JSON strings unfinished. Do not include external resources, URLs, iframes, forms, network requests, cookies, or localStorage."
                : "Use html_demo artifacts when an interactive tutorial, simulation, or demonstration would be more useful than plain text.",
            "Use artifact when the user asked for a brief, report, comparison, summary, or action plan, or when a richer structured presentation would clearly help.",
            "If artifact is not useful, return null for artifact.",
            "Do not reveal hidden private chain-of-thought. Summarize only the evidence and tool usage at a high level.",
            "Do not include raw URLs, markdown links, or references to attached chart links in the reply."
          ].join("\n")
        },
        ...messages
      ]
    })
  });

  const finalData = (await finalResponse.json().catch(() => null)) as OpenAIResponse | null;

  if (!finalResponse.ok) {
    const apiError =
      typeof finalData?.error?.message === "string"
        ? finalData.error.message
        : "The manager copilot could not format a response right now.";

    return NextResponse.json({ error: apiError }, { status: finalResponse.status });
  }

  let assistantPayload: AssistantPayload | null = null;
  const finalContent = finalData?.choices?.[0]?.message?.content;

  if (typeof finalContent === "string") {
    try {
      assistantPayload = JSON.parse(finalContent) as AssistantPayload;
    } catch {
      const looksLikeJson = /^\s*[{[]/.test(finalContent);
      assistantPayload = {
        reply: looksLikeJson
          ? "I generated a response, but it was not formatted correctly enough to render. Please try the request again."
          : finalContent,
        reasoningSummary: looksLikeJson
          ? "The model returned malformed JSON instead of a renderable manager copilot response."
          : undefined
      };
    }
  }

  const safeReply = sanitizeReply(
    assistantPayload?.reply?.trim() ??
      "I gathered manager context, but I need you to rephrase that request a bit more specifically."
  );
  const safeReasoningSummary =
    assistantPayload?.reasoningSummary?.trim() ??
    "I checked the relevant manager tools and summarized the strongest signals.";
  const artifact = normalizeArtifact(assistantPayload?.artifact ?? null);

  await saveChatMessage({
    chatId,
    role: "assistant",
    content: safeReply,
    reasoningSummary: safeReasoningSummary,
    toolTrace,
    knowledgeSources: knowledgeSources.slice(0, 5),
    chart,
    artifact
  });

  return NextResponse.json({
    chatId,
    reply: safeReply,
    reasoningSummary: safeReasoningSummary,
    toolTrace,
    knowledgeSources: knowledgeSources.slice(0, 5),
    chart,
    artifact
  });
}
