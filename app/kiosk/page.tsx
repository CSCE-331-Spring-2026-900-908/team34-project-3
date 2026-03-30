import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function KioskPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customer Kiosk</p>
          <CardTitle className="text-3xl">Self-Service Ordering</CardTitle>
          <CardDescription>UNDER CONSTRUCTION...</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone-600">
            UNDER CONSTRUCTION...
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
