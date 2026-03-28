import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionEmployee } from "@/lib/session";

export default async function LoginPage() {
  const employee = await getSessionEmployee();

  if (employee) {
    redirect("/pos");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
          <CardTitle className="mt-2 text-3xl">Boba Shop POS</CardTitle>
          <CardDescription>Sign in to continue.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
