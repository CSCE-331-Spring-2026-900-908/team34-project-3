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

export type IngredientRestockRecord = {
  id: number;
  name: string;
  servingsAvailable: number;
  addCost: number;
  recommendedRestockQty: number;
};

export type IngredientRecord = {
  id: number;
  name: string;
  addCost: number;
}

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


export type EmployeeRecord = {
  employeeId: number;
  firstName: string;
  lastName: string;
  isManager: boolean;
};

export type RestockOrderItemRecord = {
  ingredientId: number;
  ingredientName: string;
  quantity: number;
  unitCost: number;
};

export type RestockOrderRecord = {
  id: number;
  orderedAt: string;
  status: string;
  items: RestockOrderItemRecord[];
};