import { CreateOrderClient } from "@/components/project2_root/order-inventory/create-order-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopBar } from "@/components/project2_root/shared/top-bar";
import { requireManagerPage } from "@/lib/auth";
import { getAllIngredients, getRecommendedOrderQuantities } from "@/lib/db/inventory";

export default async function CreateInventoryOrderPage() {
  const employee = await requireManagerPage();
  const [ingredients, recommendedQuantities] = await Promise.all([
    getAllIngredients(),
    getRecommendedOrderQuantities()
  ]);

  return (
    <div className="app-shell">
      <TopBar
        title="Create Order"
        employeeLabel={`${employee.fullName} (Manager)`}
        links={[{ href: "/inventory", label: "Back" }]}
      />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Card className="border-none shadow-none">
          <CardHeader className="px-0">
            <CardTitle>Create Restock Order</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <CreateOrderClient ingredients={ingredients} recommendedQuantities={recommendedQuantities} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}