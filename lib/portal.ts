export type PortalDestination = {
  title: string;
  description: string;
  href: string;
};

export const portalDestinations: PortalDestination[] = [
  {
    title: "Cashier POS",
    description: "Employee checkout interface.",
    href: "/login?next=/pos"
  },
  {
    title: "Manager",
    description: "Inventory and manager tools.",
    href: "/login?next=/manager"
  },
  {
    title: "Customer Kiosk",
    description: "Customer self-service tools.",
    href: "/customer-login?next=/kiosk"
  },
  {
    title: "Customer Menu",
    description: "Browse the drink menu and compare prices before ordering.",
    href: "/menu-board"
  }
];

export function sanitizeInternalRedirect(value: string | string[] | undefined, fallback: string) {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
}
