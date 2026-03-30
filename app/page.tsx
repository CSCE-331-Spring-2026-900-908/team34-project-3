import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { portalDestinations } from "@/lib/portal";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Portal</p>
          <CardTitle className="text-3xl">Boba Shop Interfaces</CardTitle>
          <CardDescription>Select an interface to open.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {portalDestinations.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href}
                className="rounded-[1.5rem] border border-border bg-[rgb(var(--surface-alt))] p-5 transition hover:bg-white"
              >
                <div className="text-lg font-semibold">{destination.title}</div>
                <p className="mt-2 text-sm text-stone-500">{destination.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
