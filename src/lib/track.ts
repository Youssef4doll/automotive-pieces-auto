"use client";

import { logEvent } from "@/app/actions/analytics";

const SESSION_KEY = "apa-session-id";

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / storage blocked — fall back to a per-call id
    // rather than losing the event's session grouping entirely.
    return "no-storage";
  }
}

/**
 * Fire-and-forget product analytics. Never throws, never awaited by
 * callers — a slow or failed write must not block the UI it's attached to.
 */
export function track(name: string, properties?: Record<string, unknown>) {
  try {
    const sessionId = getSessionId();
    const path = typeof window !== "undefined" ? window.location.pathname : undefined;
    void logEvent(name, sessionId, path, properties);
  } catch {
    // never throw from tracking
  }
}
