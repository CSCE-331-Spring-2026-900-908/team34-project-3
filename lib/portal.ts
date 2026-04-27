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
    href: "/api/auth/google/start?next=/manager&login=/login"
  },
  {
    title: "Customer Kiosk",
    description: "Customer self-service tools.",
    href: "/kiosk"
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
