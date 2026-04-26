import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const employee = await getSessionEmployee();
  const nextPath = sanitizeInternalRedirect(searchParams?.next, "/pos");

  if (employee) {
    redirect(nextPath);
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
            <LoginForm nextPath={nextPath} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
