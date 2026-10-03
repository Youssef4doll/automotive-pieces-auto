import "server-only";
import { appendFile } from "node:fs/promises";
import path from "node:path";

/**
 * Text messages — today only the sign-in codes (lib/phone-code).
 *
 * One provider at a time, chosen by `SMS_PROVIDER`:
 *
 *   twilio  — Twilio's REST API. Needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *             and either TWILIO_FROM (a number or alphanumeric sender id
 *             allowed in Tunisia) or TWILIO_MESSAGING_SERVICE_SID.
 *   outbox  — development and tests only: each message is appended to
 *             `.sms-outbox.jsonl` at the project root and printed to the
 *             console. Refused in production, where it would swallow codes.
 *
 * Unset: `outbox` in development, nothing in production. With nothing,
 * `smsAvailable()` is false, the settings API says so, and the app does not
 * offer "code par SMS" at all — a sign-in path that never delivers its code
 * is worse than none. A Tunisian gateway (Tunisie Telecom, Ooredoo, a local
 * aggregator) is one more branch in `sendSms`, nothing else changes.
 */

const IS_PROD = process.env.NODE_ENV === "production";

type Provider = "twilio" | "outbox" | null;

function provider(): Provider {
  const chosen = (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
  if (chosen === "twilio") {
    const ok =
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_FROM || process.env.TWILIO_MESSAGING_SERVICE_SID);
    return ok ? "twilio" : null;
  }
  if (chosen === "outbox" || (!chosen && !IS_PROD)) return IS_PROD ? null : "outbox";
  return null;
}

/** Whether a code can be sent at all. Read by the settings API for the app. */
export function smsAvailable() {
  return provider() !== null;
}

/** Where the outbox provider writes; the e2e suites read it back. */
export const OUTBOX_FILE = path.join(process.cwd(), ".sms-outbox.jsonl");

/**
 * Send one message to an E.164 number ("+21698765432"). True when the
 * provider accepted it. Never throws: the caller answers the customer the
 * same way either way and logs, so a provider outage is not a 500.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const p = provider();
  try {
    if (p === "outbox") {
      await appendFile(OUTBOX_FILE, JSON.stringify({ to, body, at: new Date().toISOString() }) + "\n");
      console.info(`[sms outbox] ${to}: ${body}`);
      return true;
    }
    if (p === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const form = new URLSearchParams({ To: to, Body: body });
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
      else form.set("From", process.env.TWILIO_FROM!);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) console.warn(`sms: Twilio answered ${res.status}`);
      return res.ok;
    }
    return false;
  } catch (e) {
    // The number and the body stay out of the log: the body is a live code.
    console.warn("sms: not sent", e instanceof Error ? e.message : e);
    return false;
  }
}
