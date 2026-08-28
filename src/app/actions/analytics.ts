"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

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
