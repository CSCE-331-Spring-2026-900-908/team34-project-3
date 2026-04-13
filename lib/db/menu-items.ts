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
        ingredients: Object.fromEntries(item.itemingredient.map((entry) => [entry.ingredient_id, entry.quantity]))
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
