"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOrderStore } from "@/lib/stores/order-store";

type PageHeaderLink = {
  href: Route;
  label: string;
};

type PageHeaderProps = {
  icon: ReactNode;
  sectionLabel: string;
  title: string;
  subtitle?: string;
  links?: PageHeaderLink[];
  employeeBadge?: string;
  showLogout?: boolean;
};

export function PageHeader({
  icon,
  sectionLabel,
  title,
  subtitle,
  links = [],
  employeeBadge,
  showLogout = true
}: PageHeaderProps) {
  const router = useRouter();
  const clear = useOrderStore((state) => state.clear);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-[rgb(var(--surface))] p-5">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-[rgb(var(--surface-alt))] text-foreground">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">{sectionLabel}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-stone-500">{subtitle}</p> : null}
      </div>

      {links.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button variant="outline" size="sm" className="min-w-fit">
                {link.label}
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {employeeBadge ? (
          <div className="rounded-2xl border border-border bg-[rgb(var(--surface-alt))] px-4 py-2 text-sm text-stone-600">
            {employeeBadge}
          </div>
        ) : null}

        {showLogout ? (
          <Button variant="outline" onClick={logout} className="gap-2">
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        ) : null}
      </div>
    </div>
  );
}
