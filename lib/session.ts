import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import type { SessionCustomer, SessionEmployee } from "@/lib/types";

type AppSessionData = {
  employee?: SessionEmployee;
  customer?: SessionCustomer;
  googleAuthState?: string;
  googleAuthNext?: string;
  googleAuthLogin?: string;
};

const fallbackSecret = "development-session-secret-please-change";

const sessionOptions: SessionOptions = {
  cookieName: "boba-pos-session",
  password: process.env.SESSION_SECRET ?? fallbackSecret,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  }
};

export async function getSession() {
  return getIronSession<AppSessionData>(cookies(), sessionOptions);
}

export async function saveEmployeeSession(employee: SessionEmployee) {
  const session = await getSession();
  session.employee = employee;
  delete session.customer;
  delete session.googleAuthState;
  delete session.googleAuthNext;
  delete session.googleAuthLogin;
  await session.save();
}

export async function destroyEmployeeSession() {
  const session = await getSession();
  delete session.employee;

  if (!session.customer && !session.googleAuthState && !session.googleAuthNext && !session.googleAuthLogin) {
    await session.destroy();
    return;
  }

  await session.save();
}

export async function getSessionEmployee() {
  const session = await getSession();
  return session.employee ?? null;
}

export async function saveCustomerSession(customer: SessionCustomer) {
  const session = await getSession();
  session.customer = customer;
  delete session.employee;
  delete session.googleAuthState;
  delete session.googleAuthNext;
  delete session.googleAuthLogin;
  await session.save();
}

export async function destroyCustomerSession() {
  const session = await getSession();
  delete session.customer;
  delete session.googleAuthState;
  delete session.googleAuthNext;
  delete session.googleAuthLogin;

  if (!session.employee) {
    await session.destroy();
    return;
  }

  await session.save();
}

export async function getSessionCustomer() {
  const session = await getSession();
  return session.customer ?? null;
}

export async function beginGoogleAuth(state: string, nextPath: string, loginPath: string) {
  const session = await getSession();
  session.googleAuthState = state;
  session.googleAuthNext = nextPath;
  session.googleAuthLogin = loginPath;
  await session.save();
}

export async function consumeGoogleAuth() {
  const session = await getSession();
  const authState = session.googleAuthState ?? null;
  const nextPath = session.googleAuthNext ?? null;
  const loginPath = session.googleAuthLogin ?? null;
  delete session.googleAuthState;
  delete session.googleAuthNext;
  delete session.googleAuthLogin;
  await session.save();

  return { authState, nextPath, loginPath };
}
