import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * PRISMA_LOG_QUERIES=1 prints every statement the app runs.
 *
 * How many queries a page costs is the thing that decides whether it feels
 * fast in Tunis, where the database is a few thousand kilometres away and each
 * round trip is real time — and it is not something you can read off the
 * source, because a helper called from a layout, a header and a footer looks
 * like one call in each of three files. Start the server with this set, load a
 * page, count the lines.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "error", "warn"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
