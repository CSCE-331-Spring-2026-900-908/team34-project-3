import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeInternalRedirect } from "@/lib/portal";
import { getSessionEmployee } from "@/lib/session";

type LoginPageProps = {
  searchParams?: {
    next?: string | string[];
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const employee = await getSessionEmployee();
  const nextPath = sanitizeInternalRedirect(searchParams?.next, "/pos");

  if (employee) {
    redirect(nextPath);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
          <CardTitle className="mt-2 text-3xl">Employee Sign In</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <LoginForm nextPath={nextPath} />
        </CardContent>
      </Card>
    </main>
  );
}
