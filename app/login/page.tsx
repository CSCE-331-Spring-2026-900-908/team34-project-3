import Link from "next/link";
import { redirect } from "next/navigation";

import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeInternalRedirect } from "@/lib/portal";
import { getSessionEmployee } from "@/lib/session";

type LoginPageProps = {
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
  employee_access: "That Google account is not linked to an employee record yet.",
  authorization: "We could not map that Google account to an allowed role.",
  unknown: "Something went wrong during sign-in. Please try again."
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const employee = await getSessionEmployee();
  const nextPath = sanitizeInternalRedirect(searchParams?.next, "/pos");
  const rawError = Array.isArray(searchParams?.error) ? searchParams?.error[0] : searchParams?.error;
  const errorMessage = rawError ? errorMessages[rawError] ?? errorMessages.unknown : null;

  if (employee) {
    redirect(nextPath);
  }

  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}&login=${encodeURIComponent("/login")}`;

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md overflow-hidden">
          <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
            <CardTitle className="mt-2 text-3xl">Employee Sign In</CardTitle>
            <CardDescription>Sign in with Google. Employee access is assigned in the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <a
              href={googleHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
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
              If this email should be a cashier or manager, link it to an employee record in the database.
            </p>
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
