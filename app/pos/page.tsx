import { PosClient } from "@/components/pos-client";
import { requireEmployeePage } from "@/lib/auth";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";


// The main POS page
export default async function PosPage()
{ 
  const employee = await requireEmployeePage("/pos");
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);

  return <PosClient employee={employee} menuItems={menuItems} ingredients={ingredients} />;
}
