import { NextRequest, NextResponse } from "next/server";

import { resolveGoogleUser } from "@/lib/db/google-auth";
import { sanitizeInternalRedirect } from "@/lib/portal";
import { consumeGoogleAuth, saveCustomerSession, saveEmployeeSession } from "@/lib/session";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserProfile = {
  sub?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  picture?: string;
};

function getGoogleRedirectUri(request: NextRequest) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? new URL("/api/auth/google/callback", request.url).toString();
}

function loginErrorUrl(request: NextRequest, loginPath: string | null, error: string, nextPath: string | null) {
  const safeLoginPath = sanitizeInternalRedirect(loginPath ?? undefined, "/login");
  const url = new URL(safeLoginPath, request.url);
  url.searchParams.set("error", error);

  if (nextPath) {
    url.searchParams.set("next", nextPath);
  }

  return url;
}

function requiresCashierPin(nextPath: string | null) {
  return !!nextPath && nextPath.startsWith("/pos");
}

function requiresManagerAccess(nextPath: string | null) {
  return !!nextPath && nextPath.startsWith("/manager");
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.get("error");
  const { authState, nextPath, loginPath } = await consumeGoogleAuth();

  if (denied) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, denied, nextPath));
  }

  if (!code || !state || !authState || state !== authState) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "state", nextPath));
  }

  if (requiresCashierPin(nextPath)) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "employee_oauth_disabled", nextPath));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "config", nextPath));
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleRedirectUri(request),
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "oauth_callback", nextPath));
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenData.access_token || tokenData.error) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "oauth_callback", nextPath));
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    },
    cache: "no-store"
  });

  if (!profileResponse.ok) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "profile", nextPath));
  }

  const profile = (await profileResponse.json()) as GoogleUserProfile;

  if (!profile.sub || !profile.email || !profile.name) {
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "profile", nextPath));
  }

  try {
    const resolvedUser = await resolveGoogleUser({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      givenName: profile.given_name,
      familyName: profile.family_name,
      picture: profile.picture
    });

    if (requiresManagerAccess(nextPath)) {
      if (!resolvedUser.employee || !resolvedUser.employee.isManager) {
        return NextResponse.redirect(loginErrorUrl(request, loginPath, "manager_access", nextPath));
      }

      await saveEmployeeSession(resolvedUser.employee);
      return NextResponse.redirect(new URL(nextPath ?? "/manager", request.url));
    }

    await saveCustomerSession(resolvedUser.customer);
    return NextResponse.redirect(new URL(nextPath ?? "/kiosk", request.url));
  } catch (error) {
    console.error("Google sign-in failed after profile lookup:", error);
    return NextResponse.redirect(loginErrorUrl(request, loginPath, "authorization", nextPath));
  }
}
