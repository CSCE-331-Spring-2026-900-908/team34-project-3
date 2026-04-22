import { prisma } from "@/lib/prisma";
import { BUSINESS_TIME_ZONE, getBusinessHour } from "@/lib/report-time";
import { getCriticalIngredients } from "@/lib/db/inventory";

type BoundsRow = {
  start_at: Date | string;
  end_at: Date | string;
};

type SummaryRow = {
  total_sales: unknown;
  order_count: number | bigint;
  average_order_value: unknown;
};

type HourlySalesRow = {
  hour: number | bigint;
  total_sales: unknown;
  order_count: number | bigint;
};

type ItemPerformanceRow = {
  name: string;
  quantity_sold: number | bigint;
  revenue: unknown;
};

type DailySalesRow = {
  business_date: Date | string;
  total_sales: unknown;
  order_count: number | bigint;
};

type ForecastHourRow = {
  hour: number | bigint;
  average_sales: unknown;
};

type HistoricalDailySalesRow = {
  business_date: Date | string;
  total_sales: unknown;
  order_count: number | bigint;
};

export type CopilotPeriod = "today" | "yesterday" | "last_7_days";
export type DailySalesHistory = {
  basisDays: number;
  days: DailySalesPoint[];
};

export type SalesSnapshot = {
  period: CopilotPeriod;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
};

export type HourlySalesPoint = {
  hour: number;
  totalSales: number;
  orderCount: number;
};

export type ItemPerformancePoint = {
  name: string;
  quantitySold: number;
  revenue: number;
};

export type InventoryAlert = {
  id: number;
  name: string;
  servingsAvailable: number;
  recommendedRestockQty: number;
};

export type DailySalesPoint = {
  businessDate: string;
  label: string;
  totalSales: number;
  orderCount: number;
};

export type ForecastHourPoint = {
  hour: number;
  label: string;
  projectedSales: number;
};

export type SalesForecast = {
  currentSales: number;
  averageHistoricalRemainingSales: number;
  projectedClose: number;
  nextHours: ForecastHourPoint[];
};

export type WeeklyForecastPoint = {
  businessDate: string;
  label: string;
  projectedSales: number;
  lowerBound: number;
  upperBound: number;
};

export type WeeklySalesForecast = {
  horizonDays: number;
  basisDays: number;
  method: string;
  totalProjectedSales: number;
  days: WeeklyForecastPoint[];
};

export type WeekdaySalesPatternPoint = {
  weekdayIndex: number;
  label: string;
  averageSales: number;
  sampleDays: number;
};

export type WeekdaySalesPattern = {
  basisDays: number;
  days: WeekdaySalesPatternPoint[];
};

export type ManagerCopilotOverview = {
  salesToday: SalesSnapshot;
  hourlySalesToday: HourlySalesPoint[];
  dailySalesLast7Days: DailySalesPoint[];
  topItemsToday: ItemPerformancePoint[];
  inventoryAlerts: InventoryAlert[];
  projectedClose: number;
};

function toDate(value: Date | string) {
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

function formatBusinessDateLabel(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(toDate(value));
}

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 || 12;
  return `${twelveHour} ${suffix}`;
}

function formatShortWeekdayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: BUSINESS_TIME_ZONE
  }).format(value);
}

function weekdayLabelFromIndex(index: number) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[index] ?? `Day ${index}`;
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function linearRegression(values: number[]) {
  if (values.length <= 1) {
    return {
      intercept: values[0] ?? 0,
      slope: 0
    };
  }

  const xs = values.map((_, index) => index);
  const meanX = mean(xs);
  const meanY = mean(values);

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < values.length; index += 1) {
    numerator += (xs[index] - meanX) * (values[index] - meanY);
    denominator += (xs[index] - meanX) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  return { intercept, slope };
}

function sampleStandardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getWeekdayIndexInBusinessTimeZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: BUSINESS_TIME_ZONE
  }).format(date);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return map[parts] ?? 0;
}

function getBusinessDateIsoKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: BUSINESS_TIME_ZONE
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

async function getHistoricalDailySalesSeries(basisDays: number) {
  const safeBasisDays = Math.max(14, Math.min(84, Math.round(basisDays)));
  const { startAt: todayStart } = await getBounds("today");
  const seriesStart = addDays(todayStart, -safeBasisDays);

  const rows = await prisma.$queryRaw<HistoricalDailySalesRow[]>`
    SELECT
      (((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE})::date) AS business_date,
      COALESCE(SUM(cost), 0) AS total_sales,
      COUNT(*)::int AS order_count
    FROM orders
    WHERE created_at >= ${seriesStart}
      AND created_at < ${todayStart}
    GROUP BY business_date
    ORDER BY business_date
  `;

  const byDate = new Map(
    rows.map((row) => [
      getBusinessDateIsoKey(toDate(row.business_date)),
      {
        totalSales: toNumber(row.total_sales),
        orderCount: toNumber(row.order_count)
      }
    ])
  );

  const series = Array.from({ length: safeBasisDays }, (_, index) => {
    const businessDate = addDays(seriesStart, index);
    const key = getBusinessDateIsoKey(businessDate);
    const observed = byDate.get(key);

    return {
      businessDate: businessDate.toISOString(),
      key,
      weekdayIndex: getWeekdayIndexInBusinessTimeZone(businessDate),
      totalSales: observed?.totalSales ?? 0,
      orderCount: observed?.orderCount ?? 0
    };
  });

  return {
    basisDays: safeBasisDays,
    todayStart,
    series
  };
}

async function getBounds(period: CopilotPeriod) {
  let rows: BoundsRow[] = [];

  if (period === "today") {
    rows = await prisma.$queryRaw<BoundsRow[]>`
      SELECT
        (DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE ${BUSINESS_TIME_ZONE}) AT TIME ZONE ${BUSINESS_TIME_ZONE}) AS start_at,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS end_at
    `;
  } else if (period === "yesterday") {
    rows = await prisma.$queryRaw<BoundsRow[]>`
      SELECT
        ((DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE ${BUSINESS_TIME_ZONE}) - INTERVAL '1 day') AT TIME ZONE ${BUSINESS_TIME_ZONE}) AS start_at,
        (DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE ${BUSINESS_TIME_ZONE}) AT TIME ZONE ${BUSINESS_TIME_ZONE}) AS end_at
    `;
  } else {
    rows = await prisma.$queryRaw<BoundsRow[]>`
      SELECT
        ((DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE ${BUSINESS_TIME_ZONE}) - INTERVAL '6 day') AT TIME ZONE ${BUSINESS_TIME_ZONE}) AS start_at,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AS end_at
    `;
  }

  const bounds = rows[0];

  return {
    startAt: toDate(bounds.start_at),
    endAt: toDate(bounds.end_at)
  };
}

export async function getSalesSnapshot(period: CopilotPeriod): Promise<SalesSnapshot> {
  const { startAt, endAt } = await getBounds(period);

  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT
      COALESCE(SUM(cost), 0) AS total_sales,
      COUNT(*)::int AS order_count,
      COALESCE(AVG(cost), 0) AS average_order_value
    FROM orders
    WHERE created_at >= ${startAt} AND created_at < ${endAt}
  `;

  const row = rows[0];

  return {
    period,
    totalSales: toNumber(row?.total_sales),
    orderCount: toNumber(row?.order_count),
    averageOrderValue: toNumber(row?.average_order_value)
  };
}

export async function getHourlySales(period: Extract<CopilotPeriod, "today" | "yesterday">): Promise<HourlySalesPoint[]> {
  const { startAt, endAt } = await getBounds(period);

  const rows = await prisma.$queryRaw<HourlySalesRow[]>`
    SELECT
      EXTRACT(HOUR FROM ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE}))::int AS hour,
      COALESCE(SUM(cost), 0) AS total_sales,
      COUNT(*)::int AS order_count
    FROM orders
    WHERE created_at >= ${startAt} AND created_at < ${endAt}
    GROUP BY hour
    ORDER BY hour
  `;

  return rows.map((row) => ({
    hour: toNumber(row.hour),
    totalSales: toNumber(row.total_sales),
    orderCount: toNumber(row.order_count)
  }));
}

export async function getTopItems(period: CopilotPeriod, limit = 5): Promise<ItemPerformancePoint[]> {
  const { startAt, endAt } = await getBounds(period);
  const safeLimit = Math.max(1, Math.min(10, Math.round(limit)));

  const rows = await prisma.$queryRaw<ItemPerformanceRow[]>`
    SELECT
      item.name,
      COALESCE(SUM(orderitem.quantity), 0)::int AS quantity_sold,
      COALESCE(SUM(orderitem.cost), 0) AS revenue
    FROM orderitem
    JOIN orders ON orders.order_id = orderitem.order_id
    JOIN item ON item.id = orderitem.item_id
    WHERE orders.created_at >= ${startAt} AND orders.created_at < ${endAt}
    GROUP BY item.id, item.name
    ORDER BY revenue DESC, item.name ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    name: row.name,
    quantitySold: toNumber(row.quantity_sold),
    revenue: toNumber(row.revenue)
  }));
}

export async function getInventoryAlerts(limit = 5): Promise<InventoryAlert[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.round(limit)));
  const alerts = await getCriticalIngredients();

  return alerts.slice(0, safeLimit).map((alert) => ({
    id: alert.id,
    name: alert.name,
    servingsAvailable: alert.servingsAvailable,
    recommendedRestockQty: alert.recommendedRestockQty
  }));
}

export async function getDailySales(period: Extract<CopilotPeriod, "last_7_days">): Promise<DailySalesPoint[]> {
  const { startAt, endAt } = await getBounds(period);

  const rows = await prisma.$queryRaw<DailySalesRow[]>`
    SELECT
      (((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE})::date) AS business_date,
      COALESCE(SUM(cost), 0) AS total_sales,
      COUNT(*)::int AS order_count
    FROM orders
    WHERE created_at >= ${startAt} AND created_at < ${endAt}
    GROUP BY business_date
    ORDER BY business_date
  `;

  return rows.map((row) => {
    const businessDate = toDate(row.business_date).toISOString();

    return {
      businessDate,
      label: formatBusinessDateLabel(businessDate),
      totalSales: toNumber(row.total_sales),
      orderCount: toNumber(row.order_count)
    };
  });
}

export async function getDailySalesHistory(basisDays = 7): Promise<DailySalesHistory> {
  const { basisDays: safeBasisDays, series } = await getHistoricalDailySalesSeries(basisDays);

  return {
    basisDays: safeBasisDays,
    days: series.map((point) => ({
      businessDate: point.businessDate,
      label: formatBusinessDateLabel(point.businessDate),
      totalSales: Number(point.totalSales.toFixed(2)),
      orderCount: point.orderCount
    }))
  };
}

export async function getSalesForecast(horizonHours = 4): Promise<SalesForecast> {
  const { startAt: todayStart } = await getBounds("today");
  const currentHour = getBusinessHour(new Date());
  const safeHorizon = Math.max(1, Math.min(6, Math.round(horizonHours)));

  const [todaySnapshot, historicalRows, forecastHourRows] = await Promise.all([
    getSalesSnapshot("today"),
    prisma.$queryRaw<Array<{ sales_after_cutoff: unknown }>>`
      WITH historical_days AS (
        SELECT
          (((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE})::date) AS business_date,
          EXTRACT(HOUR FROM ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE}))::int AS business_hour,
          cost
        FROM orders
        WHERE created_at >= ${todayStart} - INTERVAL '14 day'
          AND created_at < ${todayStart}
      )
      SELECT
        COALESCE(SUM(cost), 0) AS sales_after_cutoff
      FROM historical_days
      WHERE business_hour > ${currentHour}
      GROUP BY business_date
    `,
    prisma.$queryRaw<ForecastHourRow[]>`
      WITH hourly_totals AS (
        SELECT
          (((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE})::date) AS business_date,
          EXTRACT(HOUR FROM ((created_at AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TIME_ZONE}))::int AS hour,
          COALESCE(SUM(cost), 0) AS total_sales
        FROM orders
        WHERE created_at >= ${todayStart} - INTERVAL '14 day'
          AND created_at < ${todayStart}
        GROUP BY business_date, hour
      )
      SELECT
        hour,
        COALESCE(AVG(total_sales), 0) AS average_sales
      FROM hourly_totals
      WHERE hour > ${currentHour}
      GROUP BY hour
      ORDER BY hour
      LIMIT ${safeHorizon}
    `
  ]);

  const averageHistoricalRemainingSales =
    historicalRows.length > 0
      ? historicalRows.reduce((sum, row) => sum + toNumber(row.sales_after_cutoff), 0) / historicalRows.length
      : 0;

  const nextHours = forecastHourRows.map((row) => {
    const hour = toNumber(row.hour);

    return {
      hour,
      label: formatHourLabel(hour),
      projectedSales: Number(toNumber(row.average_sales).toFixed(2))
    };
  });

  return {
    currentSales: todaySnapshot.totalSales,
    averageHistoricalRemainingSales: Number(averageHistoricalRemainingSales.toFixed(2)),
    projectedClose: Number((todaySnapshot.totalSales + averageHistoricalRemainingSales).toFixed(2)),
    nextHours
  };
}

export async function getNextWeekSalesForecast(basisDays = 28): Promise<WeeklySalesForecast> {
  const { basisDays: safeBasisDays, todayStart, series } = await getHistoricalDailySalesSeries(basisDays);
  const salesSeries = series.map((point) => point.totalSales);
  const overallAverage = mean(salesSeries);
  const nonZeroDays = series.filter((point) => point.totalSales > 0).length;
  const regression = linearRegression(salesSeries);

  const weekdayBuckets = new Map<number, number[]>();
  for (const point of series) {
    const current = weekdayBuckets.get(point.weekdayIndex) ?? [];
    current.push(point.totalSales);
    weekdayBuckets.set(point.weekdayIndex, current);
  }

  const weekdayAverages = new Map<number, number>(
    Array.from(weekdayBuckets.entries()).map(([weekdayIndex, values]) => [
      weekdayIndex,
      mean(values)
    ])
  );

  const adjustedResiduals = series.map((point, index) => {
    const trendValue = regression.intercept + regression.slope * index;
    const weekdayAverage = weekdayAverages.get(point.weekdayIndex) ?? overallAverage;
    const weekdayAdjustment = weekdayAverage - overallAverage;
    const blendedEstimate =
      nonZeroDays >= 10
        ? trendValue * 0.6 + (overallAverage + weekdayAdjustment) * 0.4
        : overallAverage + weekdayAdjustment;

    return point.totalSales - blendedEstimate;
  });

  const residualStandardDeviation = sampleStandardDeviation(adjustedResiduals);
  const confidenceMultiplier = 1.96;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(todayStart, index + 1);
    const weekdayIndex = getWeekdayIndexInBusinessTimeZone(date);
    const trendValue = regression.intercept + regression.slope * (series.length + index);
    const weekdayAverage = weekdayAverages.get(weekdayIndex) ?? overallAverage;
    const weekdayAdjustment = weekdayAverage - overallAverage;
    const projectedCore =
      nonZeroDays >= 10
        ? trendValue * 0.6 + (overallAverage + weekdayAdjustment) * 0.4
        : overallAverage + weekdayAdjustment;
    const projectedSales = Math.max(0, Number(projectedCore.toFixed(2)));
    const wideningFactor = Math.sqrt(1 + (index + 1) / Math.max(series.length, 1));
    const confidenceOffset = Number((confidenceMultiplier * residualStandardDeviation * wideningFactor).toFixed(2));
    const lowerBound = Math.max(0, Number((projectedSales - confidenceOffset).toFixed(2)));
    const upperBound = Math.max(projectedSales, Number((projectedSales + confidenceOffset).toFixed(2)));

    return {
      businessDate: date.toISOString(),
      label: formatShortWeekdayLabel(date),
      projectedSales,
      lowerBound,
      upperBound
    };
  });

  return {
    horizonDays: 7,
    basisDays: safeBasisDays,
    method:
      nonZeroDays >= 10
        ? "seasonal_trend_blend_with_95_ci"
        : "weekday_average_fallback_with_95_ci",
    totalProjectedSales: Number(days.reduce((sum, day) => sum + day.projectedSales, 0).toFixed(2)),
    days
  };
}

export async function getWeekdaySalesPattern(basisDays = 28): Promise<WeekdaySalesPattern> {
  const { basisDays: safeBasisDays, series } = await getHistoricalDailySalesSeries(basisDays);
  const weekdayBuckets = new Map<number, Array<{ totalSales: number }>>();

  for (const point of series) {
    const current = weekdayBuckets.get(point.weekdayIndex) ?? [];
    current.push({ totalSales: point.totalSales });
    weekdayBuckets.set(point.weekdayIndex, current);
  }

  return {
    basisDays: safeBasisDays,
    days: Array.from({ length: 7 }, (_, weekdayIndex) => {
      const values = weekdayBuckets.get(weekdayIndex) ?? [];

      return {
        weekdayIndex,
        label: weekdayLabelFromIndex(weekdayIndex),
        averageSales: Number(mean(values.map((value) => value.totalSales)).toFixed(2)),
        sampleDays: values.length
      };
    })
  };
}

export async function getManagerCopilotOverview(): Promise<ManagerCopilotOverview> {
  const [salesToday, hourlySalesToday, dailySalesLast7Days, topItemsToday, inventoryAlerts, forecast] = await Promise.all([
    getSalesSnapshot("today"),
    getHourlySales("today"),
    getDailySales("last_7_days"),
    getTopItems("today", 3),
    getInventoryAlerts(3),
    getSalesForecast(4)
  ]);

  return {
    salesToday,
    hourlySalesToday,
    dailySalesLast7Days,
    topItemsToday,
    inventoryAlerts,
    projectedClose: forecast.projectedClose
  };
}
