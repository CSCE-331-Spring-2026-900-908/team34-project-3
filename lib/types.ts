export type SessionEmployee = {
  employeeId: number;
  firstName: string;
  lastName: string;
  fullName: string;
  isManager: boolean;
};

export type MenuItemRecord = {
  id: number;
  name: string;
  cost: number;
  ingredients: Record<number, number>;
};

export type IngredientRecord = {
  id: number;
  name: string;
  addCost: number;
};

export type IngredientChoice = {
  ingredientId: number;
  quantity: number;
  addCost: number;
  name: string;
};

export type OrderItemInput = {
  itemId: number;
  itemName: string;
  quantity: number;
  sweetness: number;
  ice: number;
  ingredientChoices: IngredientChoice[];
  cost: number;
};
