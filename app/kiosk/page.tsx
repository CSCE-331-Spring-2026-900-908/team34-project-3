import { Button } from "@/components/ui/button";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomerPage } from "@/lib/auth";
import { getIngredientAddOns, getMenuItems } from "@/lib/db/menu-items";
import { KioskClient } from "@/components/kiosk-client";

export default async function KioskPage()
{
    const customer = await requireCustomerPage();
    const [menuItems, ingredients] = await Promise.all([getMenuItems(), getIngredientAddOns()]);

    return <KioskClient customer={customer} menuItems={menuItems} ingredients={ingredients} />;
}
