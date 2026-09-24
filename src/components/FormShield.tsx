"use client";

import { useEffect, useRef } from "react";

const HONEYPOT_FIELD = "company_website";
const TIMESTAMP_FIELD = "form_loaded_at";

/**
 * The two hidden inputs `src/lib/bot-check.ts` reads. Drop it inside any form
 * whose action calls `checkForm`.
 *
 * The honeypot is hidden the way a bot is least likely to notice: off-screen
 * and inert, rather than `display:none`, which the more careful scripts test
 * for. It is removed from the tab order and from the accessibility tree so a
 * keyboard or screen-reader user never lands in it.
 *
 * The timestamp is written after mount rather than rendered on the server, so
 * a cached page cannot ship a stale one that makes every visitor look fast.
 */
export default function FormShield() {
  // Written straight into the field once mounted: no state, no second render.
  const loadedAt = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loadedAt.current) loadedAt.current.value = String(Date.now());
  }, []);

  return (
    <>
      {/* `-start-` and not `-left-`: `inset-inline-start`, so the trap goes off
          whichever edge the writing direction starts at.

          As a physical `left: -9999px` this was fine in French and broke every
          page in Arabic. Overflow past the start edge is not scrollable —
          which is the whole trick — but in RTL the start edge is the right
          one, so a fixed `left` offset put the input 9999px the *other* side
          of the origin and made it real, scrollable width. Measured: every
          route in Arabic had a 10,373px-wide document against a 390px screen,
          which a phone answers by zooming the whole page out to fit. */}
      <div aria-hidden="true" className="absolute w-px h-px -start-[9999px] overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Ne pas remplir</label>
        <input
          id={HONEYPOT_FIELD}
          type="text"
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <input ref={loadedAt} type="hidden" name={TIMESTAMP_FIELD} defaultValue="" />
    </>
  );
}
