import { PrismaClient } from "@prisma/client";

import { buildDatabaseUrl } from "@/lib/env";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = buildDatabaseUrl();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
