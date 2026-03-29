"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOrderStore } from "@/lib/stores/order-store";

type TopBarLink = {
  href: Route;
  label: string;
};

type TopBarProps = {
  title: string;
  employeeLabel: string;
  links?: TopBarLink[];
};

export function TopBar({ title, employeeLabel, links = [] }: TopBarProps) {
  const router = useRouter();
  const clear = useOrderStore((state) => state.clear);

  async function logout() {
    // 1. Hit your auth endpoint to clear the session cookie
    await fetch("/api/auth/logout", { method: "POST" });
    
    // 2. Clear any lingering order state from Zustand
    clear();
    
    // 3. Redirect the user back to the login page
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="shell-frame pb-0">
      <div className="shell-header">
        <div className="min-w-0 space-y-1">
          <p className="section-label">{title}</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {links.map((link) => (
            <Button key={link.href} asChild variant="outline" size="sm" className="min-w-fit">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-2 text-sm text-stone-600">
            {employeeLabel}
          </div>
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}