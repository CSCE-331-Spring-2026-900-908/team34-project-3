import type { Route } from "next";

export type ManagerNavLink = {
  href: Route;
  label: string;
  active?: boolean;
};

const managerNavLinks: ManagerNavLink[] = [
  { href: "/manager/inventory" as Route, label: "Inventory" },
  { href: "/manager/employees" as Route, label: "Employees" },
  { href: "/manager/menu-items" as Route, label: "Menu Items" },
  { href: "/manager/x-report" as Route, label: "X Report" },
  { href: "/manager/z-report" as Route, label: "Z Report" }
];

export function getManagerNavLinks(activeHref: Route) {
  return managerNavLinks.map((link) => ({
    ...link,
    active: link.href === activeHref
  }));
}
