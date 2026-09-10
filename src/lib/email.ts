import "server-only";

/**
 * Sending mail, without committing the shop to one provider.
 *
 * Until now the site sent nothing at all: a customer placed an order, saw a
 * confirmation page, closed the tab and had no record of it; the shop found
 * out an order existed by refreshing /admin/commandes. That is the single
 * biggest gap between this and a real operation, and it is the one part of it
 * that is code rather than data entry.
 *
 * Two transports, picked from the environment, both optional:
 *
 *  - **Resend** — set `RESEND_API_KEY`. Talks to their REST endpoint with
 *    plain `fetch`, so it adds no dependency at all. This is the recommended
 *    path: no package to install, nothing to keep patched.
 *  - **SMTP** — set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Uses
 *    nodemailer, imported lazily so the package is only needed by shops that
 *    actually choose this path (`npm i nodemailer`). Missing it is reported
 *    as a plain instruction rather than a stack trace.
 *
 * With neither configured — which is the state today — `sendMail` returns
 * `{ ok: false, skipped }` and writes one line to the server log. It does not
 * throw, and it is never allowed to fail a checkout: an order that is in the
 * database with stock already claimed is not undone because a mail server was
 * unreachable. Every caller treats sending as best-effort and says so.
 *
 * `EMAIL_FROM` is the envelope sender ("Boutique <commandes@exemple.tn>").
 * With Resend it must be on a domain verified in their dashboard, or the API
 * rejects the message — the error text comes back verbatim in the log.
 */

export type Mail = {
  to: string;
  subject: string;
  html: string;
  /** Always provide one: some clients refuse HTML-only mail, and it is what
   *  a screen reader and a spam filter read first. */
  text: string;
  /** Where a reply should go — the shop's own address, not the sender. */
  replyTo?: string;
};

export type SendResult =
  | { ok: true; via: "resend" | "smtp"; id?: string }
  | { ok: false; skipped: string }
  | { ok: false; error: string };

function transport(): "resend" | "smtp" | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return "smtp";
  return null;
}

/** True when the shop has wired up a way to send. Used by the admin settings
 *  page to say so out loud rather than leaving the owner guessing. */
export function emailConfigured(): boolean {
  return transport() !== null && !!process.env.EMAIL_FROM;
}

/** Which one, for the same panel. Never includes the key itself. */
export function emailTransportName(): string | null {
  const t = transport();
  if (!t) return null;
  return t === "resend" ? "Resend" : `SMTP (${process.env.SMTP_HOST})`;
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  const via = transport();

  if (!via || !from) {
    const missing = !via ? "no RESEND_API_KEY or SMTP_* configured" : "no EMAIL_FROM configured";
    // One line, not a stack: this is the expected state for a shop that has
    // not set it up yet, and it should read as a to-do, not a failure.
    console.info(`[email] not sent (${missing}) — would have sent "${mail.subject}" to ${mail.to}`);
    return { ok: false, skipped: missing };
  }

  try {
    return via === "resend" ? await sendViaResend(mail, from) : await sendViaSmtp(mail, from);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[email] failed to send "${mail.subject}" to ${mail.to}: ${error}`);
    return { ok: false, error };
  }
}

async function sendViaResend(mail: Mail, from: string): Promise<SendResult> {
  // Overridable so the end-to-end suite can point this at a local stand-in and
  // assert on the message the shop's customers would actually receive, rather
  // than trusting that the template renders. Also lets a shop route through a
  // Resend-compatible gateway. Defaults to Resend proper.
  const endpoint = process.env.RESEND_API_URL || "https://api.resend.com/emails";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
    // A checkout is waiting on this. Ten seconds is already generous; past
    // that the customer's confirmation page matters more than the email.
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    // Resend explains refusals properly ("domain is not verified"), so the
    // body is worth more in the log than the status code alone.
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
  }

  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, via: "resend", id: data.id };
}

/**
 * Just enough of nodemailer's shape to call it.
 *
 * Declared structurally rather than with `typeof import("nodemailer")`,
 * because the package is genuinely optional: importing its types would make
 * `tsc` fail on every machine that has not installed it, which is every
 * machine until a shop picks the SMTP path.
 */
type NodemailerLike = {
  createTransport: (opts: {
    host?: string;
    port: number;
    secure: boolean;
    auth: { user?: string; pass?: string };
  }) => {
    sendMail: (m: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
      replyTo?: string;
    }) => Promise<{ messageId?: string }>;
  };
};

async function sendViaSmtp(mail: Mail, from: string): Promise<SendResult> {
  let nodemailer: NodemailerLike;
  try {
    // Optional dependency: only shops that chose SMTP need it installed. The
    // specifier is built at runtime so the bundler does not try to resolve a
    // package that is not there and fail the build.
    const specifier = "nodemailer";
    nodemailer = (await import(/* webpackIgnore: true */ specifier)) as unknown as NodemailerLike;
  } catch {
    return {
      ok: false,
      error: "SMTP is configured but nodemailer is not installed — run `npm i nodemailer`",
    };
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const sender = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plaintext and upgrade with
    // STARTTLS, which nodemailer does on its own.
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  const info = await sender.sendMail({
    from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    ...(mail.replyTo ? { replyTo: mail.replyTo } : {}),
  });

  return { ok: true, via: "smtp", id: info.messageId };
}
