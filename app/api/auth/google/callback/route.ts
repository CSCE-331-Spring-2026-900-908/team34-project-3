import { NextRequest, NextResponse } from "next/server";

import { consumeCustomerAuth, saveCustomerSession } from "@/lib/session";

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

function loginErrorUrl(request: NextRequest, error: string) {
  return new URL(`/customer-login?error=${encodeURIComponent(error)}`, request.url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const denied = request.nextUrl.searchParams.get("error");
  const { authState, nextPath } = await consumeCustomerAuth();

  if (denied) {
    return NextResponse.redirect(loginErrorUrl(request, denied));
  }

  if (!code || !state || !authState || state !== authState) {
    return NextResponse.redirect(loginErrorUrl(request, "state"));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(loginErrorUrl(request, "config"));
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
    return NextResponse.redirect(loginErrorUrl(request, "oauth_callback"));
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenData.access_token || tokenData.error) {
    return NextResponse.redirect(loginErrorUrl(request, "oauth_callback"));
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    },
    cache: "no-store"
  });

  if (!profileResponse.ok) {
    return NextResponse.redirect(loginErrorUrl(request, "profile"));
  }

  const profile = (await profileResponse.json()) as GoogleUserProfile;

  if (!profile.sub || !profile.email || !profile.name) {
    return NextResponse.redirect(loginErrorUrl(request, "profile"));
  }

  await saveCustomerSession({
    googleId: profile.sub,
    email: profile.email,
    fullName: profile.name,
    firstName: profile.given_name ?? profile.name,
    lastName: profile.family_name ?? "",
    picture: profile.picture
  });

  return NextResponse.redirect(new URL(nextPath ?? "/kiosk", request.url));
}
