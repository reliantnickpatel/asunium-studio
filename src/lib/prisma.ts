import { PrismaClient } from "@prisma/client";

/** True when a database connection string is configured. */
export const dbConfigured = Boolean(process.env.DATABASE_URL);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Only construct the client when a database is actually configured, so a
// missing DATABASE_URL (e.g. a default Vercel deploy) can't crash route
// handlers on import — they check `dbConfigured` and fall back gracefully.
export const prisma: PrismaClient = (dbConfigured
  ? globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    })
  : undefined) as PrismaClient;

if (dbConfigured && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
