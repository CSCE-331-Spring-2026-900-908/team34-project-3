import { KioskClient } from "@/components/kiosk-client";
import { requireCustomerPage } from "@/lib/auth";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";

export default async function KioskPage() {
  const customer = await requireCustomerPage();
  const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);

  return <KioskClient customer={customer} menuItems={menuItems} ingredients={ingredients} />;
}
