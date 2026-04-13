import { NextRequest, NextResponse } from "next/server";

import { sanitizeInternalRedirect } from "@/lib/portal";
import { beginCustomerAuth } from "@/lib/session";

function getGoogleRedirectUri(request: NextRequest) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? new URL("/api/auth/google/callback", request.url).toString();
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(new URL("/customer-login?error=config", request.url));
  }

  const nextPath = sanitizeInternalRedirect(request.nextUrl.searchParams.get("next") ?? undefined, "/kiosk");
  const state = crypto.randomUUID();
  await beginCustomerAuth(state, nextPath);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleRedirectUri(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account"
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
