import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { IngredientRecord, MenuItemRecord } from "@/lib/types";
import { decimalToNumber } from "@/lib/utils";

export async function getMenuItems() {
  const items = await prisma.item.findMany({
    include: {
      itemingredient: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return items.map(
    (item) =>
      ({
        id: item.id,
        name: item.name,
        cost: decimalToNumber(item.cost),
        ingredients: Object.fromEntries(item.itemingredient.map((entry) => [entry.ingredient_id, entry.quantity])),
        imageUrl: `/menu-items/menuitem_${item.id}.png`
      }) satisfies MenuItemRecord
  );
}

export async function getIngredientAddOns() {
  const ingredients = await prisma.ingredient.findMany({
    orderBy: {
      name: "asc"
    }
  });

  return ingredients.map(
    (ingredient) =>
      ({
        id: ingredient.id,
        name: ingredient.name,
        addCost: decimalToNumber(ingredient.add_cost)
      }) satisfies IngredientRecord
  );
}

export async function createMenuItem(
  name: string,
  cost: number,
  ingredients: Record<number, number>
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        name,
        cost: new Prisma.Decimal(cost)
      }
    });

    for (const [rawId, quantity] of Object.entries(ingredients)) {
      if (quantity <= 0) continue;

      await tx.itemingredient.create({
        data: {
          item_id: item.id,
          ingredient_id: Number(rawId),
          quantity
        }
      });
    }

    return item.id;
  });
}

export async function updateMenuItem(
  id: number,
  name: string,
  cost: number,
  ingredients: Record<number, number>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.item.update({
      where: { id },
      data: {
        name,
        cost: new Prisma.Decimal(cost)
      }
    });

    await tx.itemingredient.deleteMany({
      where: { item_id: id }
    });

    for (const [rawId, quantity] of Object.entries(ingredients)) {
      if (quantity <= 0) continue;

      await tx.itemingredient.create({
        data: {
          item_id: id,
          ingredient_id: Number(rawId),
          quantity
        }
      });
    }
  });
}

export async function deleteMenuItem(id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.itemingredient.deleteMany({
      where: { item_id: id }
    });

    await tx.orderitem.deleteMany({
      where: { item_id: id }
    });

    await tx.item.delete({
      where: { id }
    });
  });
}
