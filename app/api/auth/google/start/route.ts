import { NextRequest, NextResponse } from "next/server";

import { sanitizeInternalRedirect } from "@/lib/portal";
import { beginGoogleAuth } from "@/lib/session";

function getGoogleRedirectUri(request: NextRequest) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? new URL("/api/auth/google/callback", request.url).toString();
}

function getDefaultLoginPath(nextPath: string) {
  return nextPath.startsWith("/kiosk") ? "/customer-login" : "/login";
}

export async function GET(request: NextRequest) {
  const nextPath = sanitizeInternalRedirect(request.nextUrl.searchParams.get("next") ?? undefined, "/kiosk");
  const loginPath = sanitizeInternalRedirect(
    request.nextUrl.searchParams.get("login") ?? undefined,
    getDefaultLoginPath(nextPath)
  );
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(new URL(`${loginPath}?error=config`, request.url));
  }

  const state = crypto.randomUUID();
  await beginGoogleAuth(state, nextPath, loginPath);

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
