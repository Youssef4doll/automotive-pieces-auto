import "server-only";
import { after } from "next/server";

/**
 * Run `work` once the response has gone out — e-mails and pushes that the
 * customer should not wait for. A placed order used to answer only after
 * both SMTP sends finished: seconds on a good day, ten on a slow server,
 * while the phone showed a spinner on "Passer la commande".
 *
 * `after` keeps a serverless function alive until the work settles, so
 * nothing is cut off mid-send. Outside a request (a script, a test) there is
 * no response to wait for and the work simply runs now. The work must catch
 * its own errors; the senders in lib/order-emails and lib/push already do.
 */
export function afterResponse(work: () => Promise<unknown>): void {
  try {
    after(work);
  } catch {
    void work().catch((e) => console.error("[defer]", e));
  }
}
