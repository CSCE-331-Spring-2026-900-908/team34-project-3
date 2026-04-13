import { prisma } from "@/lib/prisma";

export type XReportHourlySales = {
  hour: number;
  totalSales: number;
};

export type XReportItemSales = {
  name: string;
  quantitySold: number;
  revenue: number;
};

export type XReportData = {
  windowStartedAt: string;
  lastZReportGeneratedAt: string | null;
  cutoffSource: "last-z-report" | "start-of-day";
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  hourlySales: XReportHourlySales[];
  salesByItem: XReportItemSales[];
  topSellingItems: XReportItemSales[];
};

export type ZReportPreview = {
  businessDate: string;
  windowStartedAt: string;
  lastZReportGeneratedAt: string | null;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
};

export type ZReportHistoryEntry = {
  id: number;
  businessDate: string;
  generatedAt: string;
  generatedByEmployeeId: number | null;
  generatedByEmployeeName: string | null;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
};

export type ZReportData = {
  businessDate: string;
  canGenerate: boolean;
  preview: ZReportPreview;
  history: ZReportHistoryEntry[];
  latestGeneratedReport: ZReportHistoryEntry | null;
};

type ReportWindowRow = {
  last_z_report_generated_at: Date | null;
  window_started_at: Date;
};

type CurrentBusinessDateRow = {
  business_date: Date | string;
};

type ReportSummaryRow = {
  total_sales: unknown;
  order_count: number | bigint;
  average_order_value: unknown;
};

type HourlySalesRow = {
  hour: number | bigint;
  total_sales: unknown;
};

type ItemSalesRow = {
  name: string;
  quantity_sold: number | bigint;
  revenue: unknown;
};

type CanGenerateZReportRow = {
  can_generate: boolean;
};

type ZReportHistoryRow = {
  id: number | bigint;
  business_date: Date | string;
  generated_at: Date | string;
  generated_by_employee_id: number | bigint | null;
  generated_by_employee_name: string | null;
  total_sales: unknown;
  order_count: number | bigint;
  average_order_value: unknown;
};

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
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

function mapZReportHistoryRow(row: ZReportHistoryRow): ZReportHistoryEntry {
  return {
    id: toNumber(row.id),
    businessDate: (toDate(row.business_date) ?? new Date()).toISOString(),
    generatedAt: (toDate(row.generated_at) ?? new Date()).toISOString(),
    generatedByEmployeeId: row.generated_by_employee_id == null ? null : toNumber(row.generated_by_employee_id),
    generatedByEmployeeName: row.generated_by_employee_name,
    totalSales: toNumber(row.total_sales),
    orderCount: toNumber(row.order_count),
    averageOrderValue: toNumber(row.average_order_value)
  };
}

export class ZReportAlreadyGeneratedError extends Error {
  constructor() {
    super("Z report has already been generated for today.");
    this.name = "ZReportAlreadyGeneratedError";
  }
}

export async function getXReportData(): Promise<XReportData> {
  const [reportWindow] = await prisma.$queryRaw<ReportWindowRow[]>`
    SELECT
      MAX(generated_at) AS last_z_report_generated_at,
      COALESCE(MAX(generated_at), DATE_TRUNC('day', CURRENT_TIMESTAMP)::timestamp) AS window_started_at
    FROM zreporthistory
  `;

  const windowStartedAt = toDate(reportWindow?.window_started_at) ?? new Date();
  const lastZReportGeneratedAt = toDate(reportWindow?.last_z_report_generated_at);

  const [summaryRows, hourlyRows, itemRows] = await Promise.all([
    prisma.$queryRaw<ReportSummaryRow[]>`
      SELECT
        COALESCE(SUM(cost), 0) AS total_sales,
        COUNT(*)::int AS order_count,
        COALESCE(AVG(cost), 0) AS average_order_value
      FROM orders
      WHERE created_at >= ${windowStartedAt}
    `,
    prisma.$queryRaw<HourlySalesRow[]>`
      SELECT
        EXTRACT(HOUR FROM created_at)::int AS hour,
        COALESCE(SUM(cost), 0) AS total_sales
      FROM orders
      WHERE created_at >= ${windowStartedAt}
      GROUP BY hour
      ORDER BY hour
    `,
    prisma.$queryRaw<ItemSalesRow[]>`
      SELECT
        item.name,
        COALESCE(SUM(orderitem.quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(orderitem.cost), 0) AS revenue
      FROM orderitem
      JOIN orders ON orders.order_id = orderitem.order_id
      JOIN item ON item.id = orderitem.item_id
      WHERE orders.created_at >= ${windowStartedAt}
      GROUP BY item.id, item.name
      ORDER BY revenue DESC, item.name ASC
    `
  ]);

  const summary = summaryRows[0];
  const salesByItem = itemRows.map((row) => ({
    name: row.name,
    quantitySold: toNumber(row.quantity_sold),
    revenue: toNumber(row.revenue)
  }));

  return {
    windowStartedAt: windowStartedAt.toISOString(),
    lastZReportGeneratedAt: lastZReportGeneratedAt?.toISOString() ?? null,
    cutoffSource: lastZReportGeneratedAt ? "last-z-report" : "start-of-day",
    totalSales: toNumber(summary?.total_sales),
    orderCount: toNumber(summary?.order_count),
    averageOrderValue: toNumber(summary?.average_order_value),
    hourlySales: hourlyRows.map((row) => ({
      hour: toNumber(row.hour),
      totalSales: toNumber(row.total_sales)
    })),
    salesByItem,
    topSellingItems: salesByItem.slice(0, 5)
  };
}

export async function getZReportData(): Promise<ZReportData> {
  const [[businessDateRow], [reportWindow], previewRows, [canGenerateRow], historyRows] = await Promise.all([
    prisma.$queryRaw<CurrentBusinessDateRow[]>`
      SELECT CURRENT_DATE AS business_date
    `,
    prisma.$queryRaw<ReportWindowRow[]>`
      SELECT
        MAX(generated_at) AS last_z_report_generated_at,
        COALESCE(MAX(generated_at), DATE_TRUNC('day', CURRENT_TIMESTAMP)::timestamp) AS window_started_at
      FROM zreporthistory
    `,
    prisma.$queryRaw<ReportSummaryRow[]>`
      WITH current_window AS (
        SELECT COALESCE(MAX(generated_at), DATE_TRUNC('day', CURRENT_TIMESTAMP)::timestamp) AS window_started_at
        FROM zreporthistory
      )
      SELECT
        COALESCE(SUM(cost), 0) AS total_sales,
        COUNT(*)::int AS order_count,
        COALESCE(AVG(cost), 0) AS average_order_value
      FROM orders, current_window
      WHERE created_at >= current_window.window_started_at
    `,
    prisma.$queryRaw<CanGenerateZReportRow[]>`
      SELECT NOT EXISTS (
        SELECT 1
        FROM zreporthistory
        WHERE business_date = CURRENT_DATE
      ) AS can_generate
    `,
    prisma.$queryRaw<ZReportHistoryRow[]>`
      SELECT
        z.id,
        z.business_date,
        z.generated_at,
        z.generated_by_employee_id,
        CASE
          WHEN e.employee_id IS NULL THEN NULL
          ELSE CONCAT(e.first_name, ' ', e.last_name)
        END AS generated_by_employee_name,
        z.total_sales,
        z.order_count,
        z.average_order_value
      FROM zreporthistory z
      LEFT JOIN employee e ON e.employee_id = z.generated_by_employee_id
      ORDER BY z.business_date DESC, z.generated_at DESC
    `
  ]);

  const preview = previewRows[0];
  const windowStartedAt = toDate(reportWindow?.window_started_at) ?? new Date();
  const lastZReportGeneratedAt = toDate(reportWindow?.last_z_report_generated_at);
  const history = historyRows.map(mapZReportHistoryRow);

  return {
    businessDate: (toDate(businessDateRow?.business_date) ?? new Date()).toISOString(),
    canGenerate: Boolean(canGenerateRow?.can_generate),
    preview: {
      businessDate: (toDate(businessDateRow?.business_date) ?? new Date()).toISOString(),
      windowStartedAt: windowStartedAt.toISOString(),
      lastZReportGeneratedAt: lastZReportGeneratedAt?.toISOString() ?? null,
      totalSales: toNumber(preview?.total_sales),
      orderCount: toNumber(preview?.order_count),
      averageOrderValue: toNumber(preview?.average_order_value)
    },
    history,
    latestGeneratedReport: history[0] ?? null
  };
}

export async function generateZReport(employeeId: number): Promise<ZReportHistoryEntry> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<ZReportHistoryRow[]>`
      WITH current_window AS (
        SELECT COALESCE(MAX(generated_at), DATE_TRUNC('day', CURRENT_TIMESTAMP)::timestamp) AS window_started_at
        FROM zreporthistory
      ),
      inserted AS (
        INSERT INTO zreporthistory (
          business_date,
          generated_at,
          generated_by_employee_id,
          total_sales,
          order_count,
          average_order_value
        )
        SELECT
          CURRENT_DATE,
          CURRENT_TIMESTAMP::timestamp,
          ${employeeId},
          COALESCE(SUM(o.cost), 0),
          COUNT(o.order_id)::int,
          COALESCE(AVG(o.cost), 0)
        FROM current_window cw
        LEFT JOIN orders o ON o.created_at >= cw.window_started_at
        WHERE NOT EXISTS (
          SELECT 1
          FROM zreporthistory
          WHERE business_date = CURRENT_DATE
        )
        RETURNING
          id,
          business_date,
          generated_at,
          generated_by_employee_id,
          total_sales,
          order_count,
          average_order_value
      )
      SELECT
        inserted.id,
        inserted.business_date,
        inserted.generated_at,
        inserted.generated_by_employee_id,
        CONCAT(e.first_name, ' ', e.last_name) AS generated_by_employee_name,
        inserted.total_sales,
        inserted.order_count,
        inserted.average_order_value
      FROM inserted
      LEFT JOIN employee e ON e.employee_id = inserted.generated_by_employee_id
    `;

    const generated = rows[0];

    if (!generated) {
      throw new ZReportAlreadyGeneratedError();
    }

    return mapZReportHistoryRow(generated);
  });
}
