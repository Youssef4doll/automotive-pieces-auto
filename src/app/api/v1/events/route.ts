import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { customerForRequest } from "@/lib/customer-session";
import { callerKey, hit, LIMITS } from "@/lib/rate-limit";
import { fail, guard, ok, preflightWrite, readJson } from "../_lib/respond";

/** Write CORS: this route reads no cookie; the optional bearer is the app's own. */
const POLICY = { cors: "write" as const };

export const OPTIONS = preflightWrite;

/** snake_case, as the website's own event names. Anything else is not ours. */
const EVENT_NAME = /^[a-z][a-z0-9_]{1,47}$/;
const MAX_PROPS_BYTES = 2_048;

const body = z.object({
  /** Anonymous, made on the phone at install. Not a person. */
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(32).optional(),
  events: z
    .array(
      z.object({
        name: z.string().regex(EVENT_NAME),
        path: z.string().max(200).optional(),
        at: z.iso.datetime().optional(),
        props: z.record(z.string().max(48), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(25),
});

/**
 * The app's analytics, into the website's own AnalyticsEvent table so both
 * front doors are read on one dashboard.
 *
 * What is refused, and why:
 *   - a user id in the body. The account, when there is one, is read from
 *     the bearer session; a client cannot file events under somebody else.
 *   - property bags over 2 KB, and more than 25 events a batch — this is a
 *     funnel log, not a place to store things.
 *   - a timestamp more than a day out: a phone's clock is not trusted, and
 *     an event from the future would sit on top of every "last N days".
 *
 * Every event is tagged `app: true` with the platform and version, so the
 * website's events and the app's can be told apart and compared.
 */
export async function POST(request: Request) {
  return guard(
    async () => {
      const gate = hit(await callerKey("events"), LIMITS.events.limit, LIMITS.events.windowMs);
      if (!gate.ok) return fail("rate_limited", POLICY, { "Retry-After": String(gate.retryAfter) });

      const parsed = body.safeParse(await readJson(request, 32_768));
      if (!parsed.success) return fail("bad_request", POLICY);
      const { sessionId, platform, appVersion, events } = parsed.data;

      const customer = await customerForRequest(request);
      const now = Date.now();
      const rows = events.flatMap((e) => {
        const props = { ...(e.props ?? {}), app: true, platform, ...(appVersion ? { appVersion } : {}) };
        const json = JSON.stringify(props);
        if (json.length > MAX_PROPS_BYTES) return [];
        const at = e.at ? new Date(e.at).getTime() : now;
        const createdAt = Math.abs(at - now) > 24 * 60 * 60_000 ? new Date(now) : new Date(at);
        return [
          {
            name: e.name,
            sessionId,
            userId: customer?.id,
            path: e.path,
            properties: JSON.parse(json),
            createdAt,
          },
        ];
      });
      if (rows.length) await prisma.analyticsEvent.createMany({ data: rows });
      return ok({ accepted: rows.length }, POLICY);
    },
    "events",
    POLICY,
  );
}
