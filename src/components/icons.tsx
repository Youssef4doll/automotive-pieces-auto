/**
 * Lucide-geometry icons, drawn inline.
 *
 * The brief asks for Lucide and also for no unnecessary dependencies; these
 * follow Lucide's grid exactly (24×24, 2px stroke, round caps and joins) so the
 * set is consistent, while adding nothing to the bundle.
 *
 * This set started in the account area and moved out of it when the contact
 * page and the checkout needed the same symbols. One set, one grid: an emoji
 * is not an option, because it is a different drawing on every phone — 💳 is a
 * blue card on Android and a grey one on iOS, and neither matches the site.
 * Everything here is stroked in `currentColor`, so a symbol inherits the
 * colour of the text it sits beside instead of introducing its own.
 */
import { CAR_MARKUP } from "@/lib/part-icons";

type Props = { className?: string };

const base = "shrink-0";
const svg = (className?: string) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: `${base} ${className ?? ""}`,
  "aria-hidden": true,
});

export const IconHome = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const IconOrders = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M6 2h9l3 3v17H6z" />
    <path d="M9 9h6M9 13h6M9 17h4" />
  </svg>
);

/**
 * The car. The one symbol here that is not Lucide geometry, and the only one
 * whose drawing lives elsewhere: it is the shop's own side-view car, defined
 * once in lib/part-icons because the bodywork family's picture is the same
 * drawing, and two copies of a car is how the two would come to differ.
 *
 * Every car on the site is this one. Five components had each grown their own
 * copy of a four-dot hatchback, and the vehicle bar's was a sixth in a
 * hard-coded navy.
 */
export const IconCar = ({ className }: Props) => (
  <svg
    width={22}
    height={22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className={`${base} ${className ?? ""}`}
    aria-hidden="true"
    // Our own literal markup from the module above, never anything a user
    // supplied — the same mechanism FamilyIcon uses, and for the same reason.
    dangerouslySetInnerHTML={{ __html: CAR_MARKUP }}
  />
);

export const IconHelp = ({ className }: Props) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.2-.9.8-.9 1.4v.4" />
    <path d="M12 17h.01" />
  </svg>
);

export const IconUser = ({ className }: Props) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
  </svg>
);

export const IconSearch = ({ className }: Props) => (
  <svg {...svg(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconRepeat = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export const IconChat = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
  </svg>
);

export const IconCheck = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const IconArrowRight = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M5 12h14" />
    <path d="m13 5 7 7-7 7" />
  </svg>
);

export const IconPackage = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="m3 7 9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
  </svg>
);

export const IconTruck = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M3 16V6h11v10" />
    <path d="M14 9h4l3 3.5V16h-2" />
    <circle cx="7.5" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
  </svg>
);

export const IconPhone = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 12l5 2v4a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 5.2 2 2 0 0 1 5 3Z" />
  </svg>
);

export const IconPlus = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconTrash = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M3 6h18M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
  </svg>
);

export const IconShield = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 3l8 4v5.5c0 4.8-3.3 8.4-8 9.5-4.7-1.1-8-4.7-8-9.5V7l8-4Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconAlert = ({ className }: Props) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5" />
    <path d="M12 16.5h.01" />
  </svg>
);

export const IconMapPin = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const IconClock = ({ className }: Props) => (
  <svg {...svg(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 2" />
  </svg>
);

export const IconMail = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

/** Cash on delivery — a banknote, not a card. */
export const IconBanknote = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

export const IconCard = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <path d="M6 15h3" />
  </svg>
);

export const IconStore = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M4 9h16v11H4z" />
    <path d="M3 9 5 4h14l2 5" />
    <path d="M9.5 20v-5h5v5" />
  </svg>
);

export const IconLock = ({ className }: Props) => (
  <svg {...svg(className)}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

/** A return or an exchange: back the way it came. */
export const IconReturn = ({ className }: Props) => (
  <svg {...svg(className)}>
    <path d="M3 12a9 9 0 1 1 3 6.7" />
    <path d="M3 6v6h6" />
  </svg>
);

export const IconWhatsApp = ({ className }: Props) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`${base} ${className ?? ""}`}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.3-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2.1.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.6.1.3.6 1.1 1.4 1.7 1 .8 1.7 1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.8.8c.2.1.4.2.5.3 0 .1 0 .6-.3 1Z" />
  </svg>
);
