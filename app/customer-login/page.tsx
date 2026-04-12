import { redirect } from "next/navigation";

import { OauthSignInCard } from "@/components/oauth-sign-in-card";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/skip-link";
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
        <OauthSignInCard
          eyebrow="Customer Access"
          title="Sign In With Google"
          description="Customers can use Google to enter the kiosk experience."
          googleHref={googleHref}
          helperText="After sign-in, we create or refresh a database record for this email and use that to decide access."
          errorMessage={errorMessage}
        />
      </main>
    </>
  );
}
