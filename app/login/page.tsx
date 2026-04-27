import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { OauthSignInCard } from "@/components/oauth-sign-in-card";
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
  employee_oauth_disabled: "Cashier access uses a 4-digit PIN, not Google sign-in.",
  config: "Google sign-in is not configured yet.",
  state: "Your sign-in session expired. Please try again.",
  access_denied: "Google sign-in was canceled.",
  oauth_callback: "Google sign-in could not be completed.",
  profile: "We signed you in with Google, but could not read your profile.",
  manager_access: "That Google account is not linked to a manager employee account.",
  authorization: "We could not save or look up that Google account.",
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

  if (nextPath.startsWith("/manager")) {
    const googleHref = `/api/auth/google/start?next=${encodeURIComponent(nextPath)}&login=${encodeURIComponent("/login")}`;

    return (
      <>
        <SkipLink />
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-screen items-center justify-center px-4 py-8">
          <OauthSignInCard
            eyebrow="Manager Access"
            title="Manager Sign In"
            description="Use the Google account linked to your manager employee record."
            googleHref={googleHref}
            backHref="/"
            helperText="Cashiers use a PIN for the POS. Managers continue with Google for manager tools."
            errorMessage={errorMessage}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md overflow-hidden">
          <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">Employee Access</p>
            <CardTitle className="mt-2 text-3xl">Cashier Sign In</CardTitle>
            <CardDescription>Enter the PIN stored in the employee password field.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 sm:pt-8">
            <LoginForm nextPath={nextPath} initialError={errorMessage} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
