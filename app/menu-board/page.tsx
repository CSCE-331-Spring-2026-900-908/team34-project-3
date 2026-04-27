import { MenuBoardClient } from "@/components/menu-board-client";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";

export default async function MenuBoardPage() {
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);
  return <MenuBoardClient menuItems={menuItems} ingredients={ingredients} />;
}
