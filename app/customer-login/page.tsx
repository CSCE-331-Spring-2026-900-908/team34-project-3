import { redirect } from "next/navigation";
import Link from "next/link";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeInternalRedirect } from "@/lib/portal";
import { getSessionCustomer } from "@/lib/session";

type CustomerLoginPageProps = {
  searchParams?: {
    next?: string | string[];
    error?: string | string[];
  };
};

const errorMessages: Record<string, string> = {
  config: "Google sign-in is not configured yet.",
  state: "Your sign-in session expired. Please try again.",
  access_denied: "Google sign-in was canceled.",
  oauth_callback: "Google sign-in could not be completed.",
  profile: "We signed you in with Google, but could not read your profile.",
  authorization: "We could not save or look up that Google account.",
  unknown: "Something went wrong during sign-in. Please try again."
};

export default async function CustomerLoginPage({ searchParams }: CustomerLoginPageProps) {
  const customer = await getSessionCustomer();
  const nextPath = sanitizeInternalRedirect(searchParams?.next, "/kiosk");
  const rawError = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const errorMessage = rawError ? errorMessages[rawError] ?? errorMessages.unknown : null;

  if (customer) {
    redirect(nextPath);
  }

  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}&login=${encodeURIComponent("/customer-login")}`;

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md overflow-hidden">
          <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Customer Access</p>
            <CardTitle className="mt-2 text-3xl">Sign In With Google</CardTitle>
            <CardDescription>Customers can use Google to enter the kiosk experience.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-8">
            <a
              href={googleHref}
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-16 py-2.5 text-sm font-medium text-white transition hover:bg-black"
            >
              Continue with Google
            </a>
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-[rgb(var(--muted))]"
            >
              Back to Portal
            </Link>
            <p className="text-sm text-stone-600">
              After sign-in, we create or refresh a database record for this email and use that to decide access.
            </p>
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
