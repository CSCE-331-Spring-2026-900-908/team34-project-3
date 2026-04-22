import { prisma } from "@/lib/prisma";

export type CustomerRewards = {
  googleId: string;
  email: string;
  fullName: string;
  points: number;
};

type CustomerRewardsRow = {
  googleId: string;
  email: string;
  fullName: string;
  points: number;
};

let rewardsTableEnsured = false;

async function ensureRewardsTable() {
  if (rewardsTableEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS customer_rewards (
      google_id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      points INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE customer_rewards
    ALTER COLUMN created_at SET DEFAULT NOW()
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE customer_rewards
    ALTER COLUMN updated_at SET DEFAULT NOW()
  `);

  rewardsTableEnsured = true;
}

function mapRewardsRow(record: CustomerRewardsRow): CustomerRewards {
  return {
    googleId: record.googleId,
    email: record.email,
    fullName: record.fullName,
    points: record.points
  };
}

export async function getOrCreateRewards(
  googleId: string,
  email: string,
  fullName: string
): Promise<CustomerRewards> {
  await ensureRewardsTable();

  const rows = await prisma.$queryRaw<CustomerRewardsRow[]>`
    INSERT INTO customer_rewards (google_id, email, full_name, points, created_at, updated_at)
    VALUES (${googleId}, ${email}, ${fullName}, 100, NOW(), NOW())
    ON CONFLICT (google_id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      updated_at = NOW()
    RETURNING
      google_id AS "googleId",
      email,
      full_name AS "fullName",
      points
  `;

  const record = rows[0];

  if (!record) {
    throw new Error("Unable to load customer rewards.");
  }

  return mapRewardsRow(record);
}

export async function addRewardPoints(
  googleId: string,
  pointsToAdd: number
): Promise<CustomerRewards> {
  await ensureRewardsTable();

  const rows = await prisma.$queryRaw<CustomerRewardsRow[]>`
    UPDATE customer_rewards
    SET points = points + ${pointsToAdd},
        updated_at = NOW()
    WHERE google_id = ${googleId}
    RETURNING
      google_id AS "googleId",
      email,
      full_name AS "fullName",
      points
  `;

  const record = rows[0];

  if (!record) {
    throw new Error("Unable to update customer rewards.");
  }

  return mapRewardsRow(record);
}

export async function redeemPoints(googleId: string, pointsToRedeem: number): Promise<void> {
  await ensureRewardsTable();

  const rows = await prisma.$queryRaw<Array<{ points: number }>>`
    UPDATE customer_rewards
    SET points = points - ${pointsToRedeem},
        updated_at = NOW()
    WHERE google_id = ${googleId} AND points >= ${pointsToRedeem}
    RETURNING points
  `;

  if (!rows[0]) {
    throw new Error("Insufficient points.");
  }
}

export async function getRewardsBalance(googleId: string): Promise<number> {
  await ensureRewardsTable();

  const rows = await prisma.$queryRaw<Array<{ points: number }>>`
    SELECT points
    FROM customer_rewards
    WHERE google_id = ${googleId}
  `;

  return rows[0]?.points ?? 0;
}
