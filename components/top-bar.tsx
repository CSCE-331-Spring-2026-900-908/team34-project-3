import Link from "next/link";
import type { Route } from "next";

import { Button } from "@/components/ui/button";

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
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}