import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ItemTrendRow = {
  name: string;
  quantity_sold: number | bigint;
  revenue: unknown;
};

type PreferenceRow = {
  preference_value: number | bigint;
  quantity_sold: number | bigint;
};

type AddOnTrendRow = {
  addon_name: string;
  quantity_sold: number | bigint;
};

type PairingTrendRow = {
  name: string;
  quantity_sold: number | bigint;
};

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

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function formatPercent(part: number, total: number) {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((part / total) * 100)}%`;
}

function iceLabel(value: number) {
  switch (value) {
    case 0:
      return "No Ice";
    case 1:
      return "Light Ice";
    case 2:
      return "Regular Ice";
    case 3:
      return "Extra Ice";
    default:
      return `Ice ${value}`;
  }
}

function summarizePreferenceRows(
  rows: PreferenceRow[],
  formatLabel: (value: number) => string
) {
  const total = rows.reduce((sum, row) => sum + toNumber(row.quantity_sold), 0);

  if (total === 0 || rows.length === 0) {
    return "No reliable preference signal yet.";
  }

  return rows
    .slice(0, 3)
    .map((row) => {
      const quantitySold = toNumber(row.quantity_sold);
      const value = toNumber(row.preference_value);
      return `${formatLabel(value)} (${formatPercent(quantitySold, total)})`;
    })
    .join(", ");
}

export async function getChatTrendSummary(cartItemNames: string[]) {
  const normalizedCartItemNames = Array.from(
    new Set(
      cartItemNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    )
  );

  const [topItemRows, sweetnessRows, iceRows, addOnRows] = await Promise.all([
    prisma.$queryRaw<ItemTrendRow[]>`
      SELECT
        i.name,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold,
        COALESCE(SUM(oi.cost), 0) AS revenue
      FROM orderitem oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN item i ON i.id = oi.item_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY i.id, i.name
      ORDER BY quantity_sold DESC, revenue DESC, i.name ASC
      LIMIT 6
    `,
    prisma.$queryRaw<PreferenceRow[]>`
      SELECT
        oi.sweetness AS preference_value,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
      FROM orderitem oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY oi.sweetness
      ORDER BY quantity_sold DESC, preference_value ASC
    `,
    prisma.$queryRaw<PreferenceRow[]>`
      SELECT
        oi.ice AS preference_value,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_sold
      FROM orderitem oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY oi.ice
      ORDER BY quantity_sold DESC, preference_value ASC
    `,
    prisma.$queryRaw<AddOnTrendRow[]>`
      SELECT addon_name, quantity_sold
      FROM (
        SELECT 'Boba'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.boba > 1 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
        FROM orderitem oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT 'Mango Jelly'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.mango_jelly > 0 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
        FROM orderitem oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT 'Aloe Jelly'::text AS addon_name, COALESCE(SUM(CASE WHEN oi.aloe_jelly > 0 THEN oi.quantity ELSE 0 END), 0)::int AS quantity_sold
        FROM orderitem oi
        JOIN orders o ON o.order_id = oi.order_id
        WHERE o.created_at >= NOW() - INTERVAL '30 days'
      ) add_on_trends
      WHERE quantity_sold > 0
      ORDER BY quantity_sold DESC, addon_name ASC
      LIMIT 3
    `
  ]);

  let pairingRows: PairingTrendRow[] = [];

  if (normalizedCartItemNames.length > 0) {
    pairingRows = await prisma.$queryRaw<PairingTrendRow[]>`
      SELECT
        paired.name,
        COALESCE(SUM(oi2.quantity), 0)::int AS quantity_sold
      FROM orders o
      JOIN orderitem oi1 ON oi1.order_id = o.order_id
      JOIN item seed ON seed.id = oi1.item_id
      JOIN orderitem oi2 ON oi2.order_id = o.order_id AND oi2.item_id <> oi1.item_id
      JOIN item paired ON paired.id = oi2.item_id
      WHERE o.created_at >= NOW() - INTERVAL '30 days'
        AND seed.name IN (${Prisma.join(normalizedCartItemNames)})
      GROUP BY paired.id, paired.name
      ORDER BY quantity_sold DESC, paired.name ASC
      LIMIT 5
    `;
  }

  const topItemsSummary =
    topItemRows.length > 0
      ? topItemRows
          .map((row) => `${row.name} (${toNumber(row.quantity_sold)} sold, ${formatMoney(toNumber(row.revenue))} revenue)`)
          .join(", ")
      : "No order history yet.";

  const addOnSummary =
    addOnRows.length > 0
      ? addOnRows.map((row) => `${row.addon_name} (${toNumber(row.quantity_sold)} drinks)`).join(", ")
      : "No clear add-on trend yet.";

  const pairingSummary =
    pairingRows.length > 0
      ? pairingRows.map((row) => `${row.name} (${toNumber(row.quantity_sold)} co-orders)`).join(", ")
      : "No strong pairings for current cart items yet.";

  return [
    `Top drinks (last 30 days): ${topItemsSummary}`,
    `Sweetness trend (last 30 days): ${summarizePreferenceRows(sweetnessRows, (value) => `${value}% sweetness`)}`,
    `Ice trend (last 30 days): ${summarizePreferenceRows(iceRows, iceLabel)}`,
    `Popular add-ons (last 30 days): ${addOnSummary}`,
    `Frequently paired with current cart items (last 30 days): ${pairingSummary}`
  ].join("\n");
}
