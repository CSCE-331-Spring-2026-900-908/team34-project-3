import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type OauthSignInCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  googleHref: string;
  backHref?: string | null;
  helperText: string;
  errorMessage?: string | null;
};

export function OauthSignInCard({
  eyebrow,
  title,
  description,
  googleHref,
  backHref,
  helperText,
  errorMessage
}: OauthSignInCardProps) {
  return (
    <Card className="w-full max-w-md overflow-hidden">
      <CardHeader className="border-b border-border bg-[rgb(var(--surface-alt))]">
        {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">{eyebrow}</p> : null}
        <CardTitle className="mt-2 text-3xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-8 sm:pt-8">
        <div className="space-y-8">
          <div className="space-y-4">
            <a
              href={googleHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-foreground px-6 py-2.5 text-sm font-medium text-white transition hover:bg-black"
            >
              Continue with Google
            </a>
            <Link
              href={backHref ?? "/"}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-[rgb(var(--muted))]"
            >
              Go Back
            </Link>
          </div>

          <div className="space-y-3">
          <p className="text-sm text-stone-600">{helperText}</p>
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
