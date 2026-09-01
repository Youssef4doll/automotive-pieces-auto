"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { parseQuery, recordSearchMiss } from "@/lib/search";

// Analytics must never break the shopping experience: any failure here is
// swallowed, not surfaced. A dropped event is an acceptable loss; a broken
// add-to-cart button because the analytics table hiccuped is not.
export async function logEvent(
  name: string,
  sessionId: string,
  path?: string,
  properties?: Record<string, unknown>
) {
  try {
    const user = await getCurrentUser().catch(() => null);
    await prisma.analyticsEvent.create({
      data: {
        name,
        sessionId,
        path,
        userId: user?.id,
        properties: properties ? JSON.parse(JSON.stringify(properties)) : undefined,
      },
    });
  } catch {
    // swallow — see comment above
  }
}

/**
 * A search that came back empty, filed as a want rather than as a log line.
 *
 * Called from the browser after the empty page has rendered, not while the
 * server renders it: a crawler that never runs JavaScript should not be able
 * to write the shop's buying list, and a render must stay free of writes so
 * React can repeat it safely.
 */
export async function logSearchMiss(query: string) {
  try {
    await recordSearchMiss(parseQuery(query));
  } catch {
    // swallow — see comment above
  }
}
