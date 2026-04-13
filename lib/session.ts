import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import type { SessionCustomer, SessionEmployee } from "@/lib/types";

type AppSessionData = {
  employee?: SessionEmployee;
  customer?: SessionCustomer;
  customerAuthState?: string;
  customerAuthNext?: string;
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
  await session.save();
}

export async function destroyEmployeeSession() {
  const session = await getSession();
  delete session.employee;

  if (!session.customer && !session.customerAuthState && !session.customerAuthNext) {
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
  delete session.customerAuthState;
  delete session.customerAuthNext;
  await session.save();
}

export async function destroyCustomerSession() {
  const session = await getSession();
  delete session.customer;
  delete session.customerAuthState;
  delete session.customerAuthNext;

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

export async function beginCustomerAuth(state: string, nextPath: string) {
  const session = await getSession();
  session.customerAuthState = state;
  session.customerAuthNext = nextPath;
  await session.save();
}

export async function consumeCustomerAuth() {
  const session = await getSession();
  const authState = session.customerAuthState ?? null;
  const nextPath = session.customerAuthNext ?? null;
  delete session.customerAuthState;
  delete session.customerAuthNext;
  await session.save();

  return { authState, nextPath };
}
