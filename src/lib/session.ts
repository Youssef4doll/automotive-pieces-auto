import "server-only";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-secret";
const COOKIE_NAME = "apa_session";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

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
  cookieStore.delete(COOKIE_NAME);
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
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
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
