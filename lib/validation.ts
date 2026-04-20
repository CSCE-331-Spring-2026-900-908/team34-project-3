import { z } from "zod";


const ingredientCost = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Number(value)), "Enter a valid cost.")
  .refine((value) => Number(value) >= 0, "Cost cannot be negative.");
  
export const loginSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, "Enter employee ID")
    .regex(/^\d+$/, "Enter employee ID"),
  password: z.string().trim().min(1, "Enter password")
});

export const ingredientChoiceSchema = z.object({
  ingredientId: z.number().int().positive(),
  quantity: z.number().int().min(1),
  addCost: z.number().nonnegative(),
  name: z.string().min(1)
});

export const orderItemInputSchema = z.object({
  itemId: z.number().int().positive(),
  itemName: z.string().min(1),
  quantity: z.number().int().min(1),
  sweetness: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  ice: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  ingredientChoices: z.array(ingredientChoiceSchema),
  cost: z.number().nonnegative()
});

export const redemptionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("flat"),
    points: z.number().int().min(0).refine((v) => v % 100 === 0, "Flat points must be a multiple of 100.")
  }),
  z.object({ kind: z.literal("addons") }),
  z.object({ kind: z.literal("tier1") }),
  z.object({ kind: z.literal("tier2") })
]);

export const completeOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "Add at least one item."),
  customerGoogleId: z.string().optional(),
  redemption: redemptionSchema.optional().default({ kind: "none" })
});

export const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name cannot be empty."),
  lastName: z.string().trim().min(1, "Last name cannot be empty."),
  email: z.string().trim().email("Enter a valid email address."),
  isManager: z.boolean()
});

export const employeeMutationSchema = employeeFormSchema;

export const menuItemMutationSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty."),
  rawCost: z
    .string()
    .trim()
    .min(1)
    .refine((value) => !Number.isNaN(Number(value)), "Enter a valid cost.")
    .refine((value) => Number(value) >= 0, "Cost cannot be negative."),
  ingredients: z.record(z.string(), z.number().int().min(0))
});

export const ingredientFormSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty."),
  rawCost: ingredientCost,
  rawStartingQuantity: z.string().optional().default("")
});
