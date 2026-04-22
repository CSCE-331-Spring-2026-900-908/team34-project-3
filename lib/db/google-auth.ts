import { prisma } from "@/lib/prisma";
import { getOrCreateRewards } from "@/lib/db/rewards";
import type { SessionCustomer, SessionEmployee } from "@/lib/types";

type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
};

type AuthUserRow = {
  email: string;
  googleId: string | null;
  employeeId: number | null;
  fullName: string;
  firstName: string;
  lastName: string;
  picture: string | null;
};

let authUserTableEnsured = false;

async function ensureAuthUserTable() {
  if (authUserTableEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS auth_user (
      email VARCHAR(320) PRIMARY KEY,
      google_id VARCHAR(255) UNIQUE NULL,
      employee_id INT NULL REFERENCES employee(employee_id) ON DELETE SET NULL,
      full_name VARCHAR(255) NOT NULL,
      first_name VARCHAR(120) NOT NULL,
      last_name VARCHAR(120) NOT NULL DEFAULT '',
      picture TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_signed_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS auth_user_employee_id_idx ON auth_user(employee_id)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS auth_user_employee_id_unique_idx
    ON auth_user(employee_id)
    WHERE employee_id IS NOT NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS auth_user_google_id_idx ON auth_user(google_id)
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE auth_user
    ALTER COLUMN google_id DROP NOT NULL
  `);

  authUserTableEnsured = true;
}

async function upsertGoogleUser(profile: GoogleProfile) {
  await ensureAuthUserTable();

  const email = profile.email.trim().toLowerCase();
  const firstName = profile.givenName?.trim() || profile.name.trim();
  const lastName = profile.familyName?.trim() || "";
  const fullName = profile.name.trim();
  const rows = await prisma.$queryRaw<AuthUserRow[]>`
    INSERT INTO auth_user (email, google_id, full_name, first_name, last_name, picture)
    VALUES (${email}, ${profile.sub}, ${fullName}, ${firstName}, ${lastName}, ${profile.picture ?? null})
    ON CONFLICT (email) DO UPDATE SET
      google_id = EXCLUDED.google_id,
      full_name = EXCLUDED.full_name,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      picture = EXCLUDED.picture,
      updated_at = NOW(),
      last_signed_in_at = NOW()
    RETURNING
      email,
      google_id AS "googleId",
      employee_id AS "employeeId",
      full_name AS "fullName",
      first_name AS "firstName",
      last_name AS "lastName",
      picture
  `;

  return rows[0] ?? null;
}

export async function resolveGoogleUser(profile: GoogleProfile): Promise<{
  customer: SessionCustomer;
  employee: SessionEmployee | null;
}> {
  const authUser = await upsertGoogleUser(profile);

  if (!authUser) {
    throw new Error("Unable to create or load the Google auth user.");
  }

  const googleId = authUser.googleId ?? profile.sub;

  const customer: SessionCustomer = {
    googleId,
    email: authUser.email,
    role: "customer",
    fullName: authUser.fullName,
    firstName: authUser.firstName,
    lastName: authUser.lastName,
    picture: authUser.picture ?? undefined
  };

  await getOrCreateRewards(googleId, authUser.email, authUser.fullName);

  if (!authUser.employeeId) {
    return { customer, employee: null };
  }

  const employeeRecord = await prisma.employee.findUnique({
    where: {
      employee_id: authUser.employeeId
    }
  });

  if (!employeeRecord) {
    throw new Error(`Auth user ${authUser.email} is linked to employee ${authUser.employeeId}, but that employee record does not exist.`);
  }

  const employee: SessionEmployee = {
    employeeId: employeeRecord.employee_id,
    firstName: authUser.firstName,
    lastName: authUser.lastName,
    fullName: authUser.fullName,
    email: authUser.email,
    googleId,
    role: employeeRecord.is_manager ? "manager" : "cashier",
    isManager: employeeRecord.is_manager,
    picture: authUser.picture ?? undefined
  };

  return { customer, employee };
}

export async function saveEmployeeGoogleAuthLink(input: {
  employeeId: number;
  email: string;
  firstName: string;
  lastName: string;
}) {
  await ensureAuthUserTable();

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = `${firstName} ${lastName}`.trim();

  await prisma.$executeRaw`
    UPDATE auth_user
    SET employee_id = NULL,
        updated_at = NOW()
    WHERE employee_id = ${input.employeeId}
      AND email <> ${email}
  `;

  await prisma.$executeRaw`
    INSERT INTO auth_user (email, google_id, employee_id, full_name, first_name, last_name, picture)
    VALUES (${email}, NULL, ${input.employeeId}, ${fullName}, ${firstName}, ${lastName}, NULL)
    ON CONFLICT (email) DO UPDATE SET
      employee_id = EXCLUDED.employee_id,
      full_name = CASE WHEN auth_user.google_id IS NULL THEN EXCLUDED.full_name ELSE auth_user.full_name END,
      first_name = CASE WHEN auth_user.google_id IS NULL THEN EXCLUDED.first_name ELSE auth_user.first_name END,
      last_name = CASE WHEN auth_user.google_id IS NULL THEN EXCLUDED.last_name ELSE auth_user.last_name END,
      updated_at = NOW()
  `;
}

export async function getEmployeeGoogleAuthMap() {
  await ensureAuthUserTable();

  const rows = await prisma.$queryRaw<Array<{
    employeeId: number;
    email: string;
    googleId: string | null;
  }>>`
    SELECT employee_id AS "employeeId", email, google_id AS "googleId"
    FROM auth_user
    WHERE employee_id IS NOT NULL
  `;

  return new Map(rows.map((row) => [row.employeeId, row]));
}
