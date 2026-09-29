import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaStaleWarned?: boolean;
};

/** The client's own name for each model: `ReturnRequest` → `returnRequest`. */
const DELEGATES = Object.values(Prisma.ModelName).map((m) => m.charAt(0).toLowerCase() + m.slice(1));

/**
 * The client kept on `globalThis` between hot reloads — but only while it
 * still knows every model the generated client does. After a `prisma
 * generate` in a running dev server, the old instance would otherwise live on
 * and answer `prisma.returnRequest` with `undefined`.
 */
function cached(): PrismaClient | undefined {
  const c = globalForPrisma.prisma as unknown as Record<string, unknown> | undefined;
  return c && DELEGATES.every((d) => d in c) ? (c as unknown as PrismaClient) : undefined;
}

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
  cached() ??
  new PrismaClient({
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "error", "warn"]
        : process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * A client generated from an older schema.
 *
 * `git pull` brings a new model and a migration; `npm run db:migrate` puts the
 * tables in the database; but the generated client in node_modules is only
 * rewritten by `prisma generate` — and until it is, every query on the new
 * model fails as "Cannot read properties of undefined (reading 'findMany')",
 * which reads like a bug in the code. `dev`, `dev:lan` and `db:migrate` now
 * generate first; this catches any other way of getting there, once, in words.
 */
if (process.env.NODE_ENV === "development" && !globalForPrisma.prismaStaleWarned) {
  globalForPrisma.prismaStaleWarned = true;
  try {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const known = new Set<string>(Object.values(Prisma.ModelName));
    const missing = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]).filter((m) => !known.has(m));
    if (missing.length) {
      console.error(
        `\n[prisma] The generated client is older than prisma/schema.prisma (missing: ${missing.join(", ")}).\n` +
          `[prisma] Run \`npx prisma generate\` (or \`npm install\`), then restart the dev server.\n`,
      );
    }
  } catch {
    // No schema file next to the server (a deployed build): nothing to compare.
  }
}
