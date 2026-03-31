import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomerPage } from "@/lib/auth";

export default async function KioskPage() {
  const customer = await requireCustomerPage();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customer Kiosk</p>
          <CardTitle className="text-3xl">Self-Service Ordering</CardTitle>
          <CardDescription>UNDER CONSTRUCTION...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-stone-600">
            Signed in as <span className="font-medium text-foreground">{customer.fullName}</span> ({customer.email})
          </p>
          <p className="text-sm text-stone-600">
            UNDER CONSTRUCTION...
          </p>
          <form action="/api/auth/customer/logout" method="post">
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
