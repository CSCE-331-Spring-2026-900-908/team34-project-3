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

type ReportWindowRow = {
  last_z_report_generated_at: Date | null;
  window_started_at: Date;
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
