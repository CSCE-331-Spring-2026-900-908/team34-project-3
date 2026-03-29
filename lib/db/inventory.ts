import { prisma } from "@/lib/prisma";

// ── Shared types ──────────────────────────────────────────────────────────────
// Import these in client components instead of redefining them inline.

export type RestockOrderItem = {
  ingredientId: number;
  ingredientName: string;
  quantity: number;
};

export type RestockOrder = {
  id: number;
  orderedAt: string; // ISO string — safe to pass from server to client components
  status: "pending" | "confirmed";
  items: RestockOrderItem[];
};

export type Ingredient = {
  id: number;
  name: string;
  servingsAvailable: number;
  addCost: number;
  recommendedRestockQty?: number;
};

export type CriticalIngredient = {
  id: number;
  name: string;
  servingsAvailable: number;
  recommendedRestockQty: number;
};

// ── Weeks of projected demand used for critical ingredient detection ───────────
const WEEKS_TO_COVER = 4;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getRestockOrders(): Promise<RestockOrder[]> {
  const orders = await prisma.inventoryorder.findMany({
    orderBy: { ordered_at: "desc" },
    include: {
      inventoryorder_ingredient: {
        include: { ingredient: true },
      },
    },
  });

  return orders.map((order) => ({
    id: Number(order.id), // <--- Wrap in Number()
    orderedAt: order.ordered_at.toISOString(),
    status: order.status as "pending" | "confirmed",
    items: order.inventoryorder_ingredient.map((line) => ({
      ingredientId: line.ingredient_id,
      ingredientName: line.ingredient.name,
      quantity: line.quantity,
    })),
  }));
}

export async function getRestockOrderById(id: number): Promise<RestockOrder | null> {
  const order = await prisma.inventoryorder.findUnique({
    where: { id },
    include: {
      inventoryorder_ingredient: {
        include: { ingredient: true },
      },
    },
  });

  if (!order) return null;

  return {
    id: Number(order.id), // <--- Wrap in Number()
    orderedAt: order.ordered_at.toISOString(),
    status: order.status as "pending" | "confirmed",
    items: order.inventoryorder_ingredient.map((line) => ({
      ingredientId: line.ingredient_id,
      ingredientName: line.ingredient.name,
      quantity: line.quantity,
    })),
  };
}

export async function getAllIngredients(): Promise<Ingredient[]> {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: { name: "asc" },
  });

  return ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    servingsAvailable: Number(ing.servings_available),
    addCost: ing.add_cost.toNumber(),
  }));
}

// Uses $queryRaw because the critical detection logic requires correlated
// subqueries that aren't expressible with the Prisma query builder.
export async function getCriticalIngredients(): Promise<CriticalIngredient[]> {
  type RawRow = {
    id: number;
    name: string;
    servings_available: unknown; // Prisma returns numeric columns as string in raw results
    add_cost: unknown;
    recommended_restock_qty: unknown;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      i.id,
      i.name,
      i.servings_available,
      i.add_cost,
      CEIL(
        GREATEST(
          (base.min_to_make_one_of_everything + COALESCE(usage.avg_weekly_usage, 0) * ${WEEKS_TO_COVER}),
          0
        ) * 1.5
      ) AS recommended_restock_qty
    FROM ingredient i
    JOIN (
      SELECT ingredient_id, SUM(quantity) AS min_to_make_one_of_everything
      FROM itemingredient
      GROUP BY ingredient_id
    ) base ON base.ingredient_id = i.id
    LEFT JOIN (
      SELECT ii.ingredient_id, SUM(oi.quantity * ii.quantity) / 30.0 AS avg_weekly_usage
      FROM orders o
      JOIN orderitem oi ON oi.order_id = o.order_id
      JOIN itemingredient ii ON ii.item_id = oi.item_id
      WHERE o.created_at >= NOW() - INTERVAL '30 weeks'
      GROUP BY ii.ingredient_id
    ) usage ON usage.ingredient_id = i.id
    WHERE i.servings_available < (
      base.min_to_make_one_of_everything + COALESCE(usage.avg_weekly_usage, 0) * ${WEEKS_TO_COVER}
    )
    ORDER BY i.servings_available ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    servingsAvailable: Number(row.servings_available),
    addCost: Number(row.add_cost),
    recommendedRestockQty: Number(row.recommended_restock_qty),
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function submitRestockOrder(quantities: Record<number, number>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.inventoryorder.create({
      data: {
        ordered_at: new Date(),
        status: "pending",
      },
    });

    for (const [rawId, quantity] of Object.entries(quantities)) {
      const ingredientId = Number(rawId);

      const ingredient = await tx.ingredient.findUnique({
        where: { id: ingredientId },
      });

      if (!ingredient) throw new Error(`Ingredient ${ingredientId} not found.`);

      await tx.inventoryorder_ingredient.create({
        data: {
          order_id: order.id,
          ingredient_id: ingredientId,
          quantity,
          unit_cost: ingredient.add_cost,
        },
      });
    }
  });
}

export async function confirmRestockOrder(id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.inventoryorder.update({
      where: { id: BigInt(id) }, // Cast to BigInt for the lookup
      data: { status: "confirmed" },
    });

    const lines = await tx.inventoryorder_ingredient.findMany({
      where: { order_id: id },
    });

    for (const line of lines) {
      await tx.ingredient.update({
        where: { id: line.ingredient_id },
        data: {
          servings_available: {
            increment: line.quantity,
          },
        },
      });
    }
  });
}