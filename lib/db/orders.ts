import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OrderItemInput } from "@/lib/types";
import { addRewardPoints } from "@/lib/db/rewards";

function toLegacyAddonColumns(item: OrderItemInput) {
  const normalizedNames = item.ingredientChoices.map((choice) => ({
    ...choice,
    normalizedName: choice.name.trim().toLowerCase()
  }));

  const bobaChoice = normalizedNames.find((choice) => choice.normalizedName.includes("boba"));
  const mangoChoice = normalizedNames.find((choice) => choice.normalizedName.includes("mango"));
  const aloeChoice = normalizedNames.find((choice) => choice.normalizedName.includes("aloe"));

  return {
    // Existing DB constraint expects boba to be 1, 2, or 3 rather than 0/1.
    boba: !bobaChoice ? 1 : bobaChoice.quantity > 1 ? 3 : 2,
    mangoJelly: mangoChoice ? 1 : 0,
    aloeJelly: aloeChoice ? 1 : 0
  };
}

function computeItemTotal(baseCost: number, item: OrderItemInput) {
  const ingredientCost = item.ingredientChoices.reduce(
    (sum, ingredient) => sum + ingredient.addCost * ingredient.quantity,
    0
  );

  return (baseCost + ingredientCost) * item.quantity;
}

export async function completeCurrentOrder(employeeId: number, items: OrderItemInput[], customerGoogleId?: string) {
  const orderTotal = await prisma.$transaction(async (tx) => {
    const order = await tx.orders.create({
      data: {
        employee_id: employeeId,
        created_at: new Date(),
        cost: new Prisma.Decimal(0)
      }
    });

    let total = 0;

    for (const item of items) {
      const menuItem = await tx.item.findUnique({
        where: {
          id: item.itemId
        }
      });

      if (!menuItem) {
        throw new Error(`Menu item ${item.itemId} not found.`);
      }

      const lineCost = computeItemTotal(menuItem.cost.toNumber(), item);
      const legacyAddons = toLegacyAddonColumns(item);
      total += lineCost;

      await tx.orderitem.create({
        data: {
          order_id: order.order_id,
          item_id: item.itemId,
          quantity: item.quantity,
          sweetness: item.sweetness,
          ice: item.ice,
          boba: legacyAddons.boba,
          mango_jelly: legacyAddons.mangoJelly,
          aloe_jelly: legacyAddons.aloeJelly,
          cost: new Prisma.Decimal(lineCost)
        }
      });

      const baseIngredients = await tx.itemingredient.findMany({
        where: {
          item_id: item.itemId
        }
      });

      for (const ingredient of baseIngredients) {
        await tx.ingredient.update({
          where: {
            id: ingredient.ingredient_id
          },
          data: {
            servings_available: {
              decrement: new Prisma.Decimal(ingredient.quantity * item.quantity)
            }
          }
        });
      }

      for (const choice of item.ingredientChoices) {
        await tx.ingredient.update({
          where: {
            id: choice.ingredientId
          },
          data: {
            servings_available: {
              decrement: new Prisma.Decimal(choice.quantity * item.quantity)
            }
          }
        });
      }
    }

    await tx.orders.update({
      where: {
        order_id: order.order_id
      },
      data: {
        cost: new Prisma.Decimal(total)
      }
    });

    return total;
  });

  if (customerGoogleId) {
    const pointsEarned = Math.floor(orderTotal * 4);
    if (pointsEarned > 0) {
      await addRewardPoints(customerGoogleId, pointsEarned);
    }
  }
}
