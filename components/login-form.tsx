"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pinLoginSchema } from "@/lib/validation";

type LoginFormProps = {
  nextPath: string;
  initialError?: string | null;
};

export function LoginForm({ nextPath, initialError }: LoginFormProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [inlineError, setInlineError] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = pinLoginSchema.safeParse({ pin });

    if (!parsed.success) {
      setInlineError(parsed.error.issues[0]?.message ?? "Invalid login.");
      return;
    }

    setPending(true);
    setInlineError("");

    const response = await fetch("/api/auth/pin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(parsed.data)
    });

    setPending(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = payload?.error ?? "Invalid login.";
      setInlineError(message);
      toast.error(message);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="pin">Employee PIN</Label>
        <Input
          id="pin"
          type="password"
          value={pin}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={4}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
        />
      </div>
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <p className="min-h-5 text-center text-sm text-danger">{inlineError}</p>
    </form>
  );
}
