"use client";

import { useEffect, useState } from "react";

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
  const [loadedAt, setLoadedAt] = useState("");

  useEffect(() => {
    setLoadedAt(String(Date.now()));
  }, []);

  return (
    <>
      <div aria-hidden="true" className="absolute w-px h-px -left-[9999px] overflow-hidden">
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
      <input type="hidden" name={TIMESTAMP_FIELD} value={loadedAt} readOnly />
    </>
  );
}
