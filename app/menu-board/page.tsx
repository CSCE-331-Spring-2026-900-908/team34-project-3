import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The page for the seasonal items
const featuredItems = ["UNDER CONSTRUCTION...", "UNDER CONSTRUCTION...", "UNDER CONSTRUCTION...", "UNDER CONSTRUCTION..."];

export default function MenuBoardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Menu Board</p>
          <CardTitle className="text-3xl">Featured Drinks</CardTitle>
          <CardDescription>UNDER CONSTRUCTION...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredItems.map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-4">
                <div className="font-medium">{item}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
