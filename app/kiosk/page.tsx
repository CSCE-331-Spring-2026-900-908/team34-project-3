import { KioskClient } from "@/components/kiosk-client";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";
import { getSessionCustomer } from "@/lib/session";

export default async function KioskPage() {
  const customer = await getSessionCustomer();
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);

  return <KioskClient customer={customer} menuItems={menuItems} ingredients={ingredients} />;
}
