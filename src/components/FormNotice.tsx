import { IconAlert } from "@/components/icons";

/**
 * The shop's way of saying something went wrong.
 *
 * Every form on the site used to invent its own. Sign-in and sign-up printed
 * `text-xs text-red-600` — twelve pixels of loose red text under the last
 * field, with nothing to mark it as a message rather than a caption, which on
 * a phone is easy to miss entirely and looks nothing like the rest of the
 * site. Meanwhile the compatibility warning on the product page is a proper
 * bordered panel with an icon and a heading.
 *
 * This is that panel, in the shop's own colours, used by every form: a navy
 * card with a red rule down the leading edge, the icon in a filled disc, the
 * title in the display face the rest of the site sets headings in. Red is kept
 * for the rule, the disc and the title, not sprayed across the body text,
 * which stays navy so it reads as the shop talking rather than as an error
 * screen.
 *
 * `role="alert"` is on the wrapper: this appears in response to something the
 * person just did, and a customer who cannot see the red is entitled to be
 * told as much as one who can.
 *
 * Leading-edge border (`border-s`), not left: the site ships in Arabic too,
 * and in RTL the rule belongs on the right.
 */
export default function FormNotice({
  title,
  children,
  tone = "error",
}: {
  /** The one-line verdict. Omit for a message that needs no heading. */
  title?: string;
  children: React.ReactNode;
  /** `error` for a refusal, `warn` for something that is merely worth reading. */
  tone?: "error" | "warn";
}) {
  const skin =
    tone === "error"
      ? { rule: "border-s-red-600", disc: "bg-red-600", head: "text-red-700", shell: "bg-red-50/70 border-red-200" }
      : // navy-50 rather than a gold tint: the shop defines gold-400/500/600
        // and nothing lighter, and an undefined Tailwind colour class is
        // dropped silently rather than erroring — see e2e-cleanup [7].
        { rule: "border-s-gold-500", disc: "bg-gold-500", head: "text-navy-950", shell: "bg-navy-50 border-navy-900/15" };

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-xl border border-s-[3px] ${skin.shell} ${skin.rule} p-3 sm:p-3.5`}
    >
      <span
        className={`mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full ${skin.disc} text-white`}
        aria-hidden="true"
      >
        <IconAlert className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className={`font-display text-[13px] font-bold uppercase tracking-wide ${skin.head}`}>{title}</p>
        )}
        <div className={`text-[13px] leading-relaxed text-navy-900 ${title ? "mt-0.5" : ""}`}>{children}</div>
      </div>
    </div>
  );
}

/**
 * The message under a single field.
 *
 * Deliberately not a `FormNotice`: a panel per field would turn a form with
 * three empty boxes into three panels, and the summary at the button is what
 * carries the weight. This is one line, in the same red, with the same icon at
 * a smaller size so the two read as the same family.
 */
export function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <span role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-red-600">
      <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </span>
  );
}
