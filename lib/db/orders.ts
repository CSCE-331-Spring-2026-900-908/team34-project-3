import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OrderItemInput } from "@/lib/types";

function computeItemTotal(baseCost: number, item: OrderItemInput) {
  const ingredientCost = item.ingredientChoices.reduce(
    (sum, ingredient) => sum + ingredient.addCost * ingredient.quantity,
    0
  );

  return (baseCost + ingredientCost) * item.quantity;
}

export async function completeCurrentOrder(employeeId: number, items: OrderItemInput[]) {
  await prisma.$transaction(async (tx) => {
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
      total += lineCost;

      await tx.orderitem.create({
        data: {
          order_id: order.order_id,
          item_id: item.itemId,
          quantity: item.quantity,
          sweetness: item.sweetness,
          ice: item.ice,
          boba: 0,
          mango_jelly: 0,
          aloe_jelly: 0,
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
  });
}
