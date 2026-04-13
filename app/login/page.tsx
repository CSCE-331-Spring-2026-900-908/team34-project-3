import { redirect } from "next/navigation";

import { OauthSignInCard } from "@/components/oauth-sign-in-card";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
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
        <OauthSignInCard
          title="Employee Sign In"
          description="Sign in with Google. Employee access is assigned in the database."
          googleHref={googleHref}
          helperText="If this email should be a cashier or manager, link it to an employee record in the database."
          errorMessage={errorMessage}
        />
      </main>
    </>
  );
}
