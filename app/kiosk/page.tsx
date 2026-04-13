import { Button } from "@/components/ui/button";
import { CustomerWeatherCard } from "@/components/customer-weather-card";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCustomerPage } from "@/lib/auth";
import { getOrCreateRewards } from "@/lib/db/rewards";

export default async function KioskPage() {
  const customer = await requireCustomerPage();
  const rewards = await getOrCreateRewards(customer.googleId, customer.email, customer.fullName);

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-screen items-center justify-center px-4 py-8">
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

            <div className="rounded-xl border border-border bg-[rgb(var(--surface-alt))] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">Reward Points</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">{rewards.points.toLocaleString()}</p>
              <p className="mt-1 text-sm text-stone-500">Earn 1 point for every 10 cents spent.</p>
            </div>

            <CustomerWeatherCard />

            <p className="text-sm text-stone-600">
              UNDER CONSTRUCTION...
            </p>
            <form action="/api/auth/customer/logout" method="post">
              <Button type="submit" variant="outline">Sign out</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
