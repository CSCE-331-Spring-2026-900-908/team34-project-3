import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

import type { SessionEmployee } from "@/lib/types";

type AppSessionData = {
  employee?: SessionEmployee;
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
  await session.destroy();
}

export async function getSessionEmployee() {
  const session = await getSession();
  return session.employee ?? null;
}
