import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * A missing signing secret in production is not a warning, it is a forged
 * session for anybody who reads this file on GitHub. Development still gets a
 * default so `npm run dev` works on a fresh clone, but production refuses to
 * boot rather than silently signing tokens with a public string.
 */
function readSecret() {
  const secret = process.env.SESSION_SECRET;
  if (IS_PROD) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to at least 32 random characters in production. " +
          "Generate one with: openssl rand -base64 48",
      );
    }
    return secret;
  }
  return secret || "dev-only-insecure-secret";
}

const SECRET = readSecret();

/**
 * The `__Host-` prefix is enforced by the browser: it refuses the cookie unless
 * it is Secure, path=/ and has no Domain attribute, which stops a compromised
 * or attacker-controlled subdomain from writing a session cookie for the apex.
 * The prefix requires HTTPS, so plain-http development keeps the bare name.
 */
const COOKIE_NAME = IS_PROD ? "__Host-apa_session" : "apa_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Never select the whole user row. `passwordHash` has no business leaving the
 * database, and a server component that passes `user` to a client component
 * would otherwise ship the bcrypt hash inside the RSC payload.
 */
const SAFE_USER_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

export type SessionPayload = {
  userId: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function createSession(payload: SessionPayload) {
  const token = jwt.sign(payload, SECRET, { expiresIn: MAX_AGE_SECONDS });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  // Overwrite with the same attributes rather than `delete()`.
  //
  // `delete()` emits `Set-Cookie: __Host-apa_session=; Max-Age=0; Path=/` with
  // no `Secure` flag — and a `__Host-`-prefixed cookie without `Secure` is
  // invalid, so the browser throws the header away and keeps the cookie it
  // already has. The customer was told they had signed out, landed on the home
  // page, and was still fully signed in; their next visit to /compte walked
  // straight back into the account. On a shared or borrowed phone that is the
  // whole point of the button failing silently.
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, SECRET) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

/** Cached per-request: returns the logged-in user, or null. */
export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: SAFE_USER_FIELDS,
  });
  if (!user) return null;
  // The role is re-read from the database rather than trusted from the token:
  // a demoted admin must lose access on their next request, not in 30 days.
  return user;
});

/** Throws-by-redirect DAL check for pages that require any logged-in user. */
export async function requireUser() {
  const user = await getCurrentUser();
  return user;
}

/** DAL check for admin-only areas. Returns null if not an admin. */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}
