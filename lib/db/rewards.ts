import { prisma } from "@/lib/prisma";

export type CustomerRewards = {
  googleId: string;
  email: string;
  fullName: string;
  points: number;
};

export async function getOrCreateRewards(
  googleId: string,
  email: string,
  fullName: string
): Promise<CustomerRewards> {
  const record = await prisma.customer_rewards.upsert({
    where: { google_id: googleId },
    update: {
      email,
      full_name: fullName
    },
    create: {
      google_id: googleId,
      email,
      full_name: fullName,
      points: 0
    }
  });

  return {
    googleId: record.google_id,
    email: record.email,
    fullName: record.full_name,
    points: record.points
  };
}

export async function addRewardPoints(
  googleId: string,
  pointsToAdd: number
): Promise<CustomerRewards> {
  const record = await prisma.customer_rewards.update({
    where: { google_id: googleId },
    data: {
      points: { increment: pointsToAdd }
    }
  });

  return {
    googleId: record.google_id,
    email: record.email,
    fullName: record.full_name,
    points: record.points
  };
}

export async function getRewardsBalance(googleId: string): Promise<number> {
  const record = await prisma.customer_rewards.findUnique({
    where: { google_id: googleId }
  });

  return record?.points ?? 0;
}
