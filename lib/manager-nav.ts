import type { Route } from "next";

export type ManagerNavLink = {
  href: Route;
  label: string;
  active?: boolean;
};

const managerNavLinks: ManagerNavLink[] = [
  { href: "/manager/inventory" as Route, label: "Inventory" },
  { href: "/manager/employees" as Route, label: "Employees" },
  { href: "/manager/menu-items" as Route, label: "Menu Items" }
];

export function getManagerNavLinks(activeHref: Route) {
  return managerNavLinks.map((link) => ({
    ...link,
    active: link.href === activeHref
  }));
}
