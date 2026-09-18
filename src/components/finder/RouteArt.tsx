/**
 * The four ways into the catalogue, drawn.
 *
 * "Que cherchez-vous ?" offers four doors — I know my car, I know the part, I
 * have the reference, I have no idea — and the mapping is right: it is how
 * people actually arrive. What it asked of them was to read four titles and
 * four hints, thirty-odd words, before the first tap. On a phone, which is
 * where nearly all of this shop's traffic is, that is a wall of text standing
 * between a driver and a brake pad.
 *
 * So each door gets a picture that carries the meaning on its own, and the
 * words become the confirmation rather than the message.
 *
 * These replaced a first attempt that was four 48px glyphs. Glyphs are read as
 * decoration and skipped; a scene is looked at. Each one is a small
 * illustration on its own tinted field, in the shop's two colours, at a size
 * where the disc has vents and the box has a label on it.
 *
 * Four rules they follow:
 *
 * **Show the situation, not a symbol.** The reference door used to be a `#`.
 * That glyph means "number" to a developer and nothing at all to a driver
 * holding a greasy box with a code printed on the side — so it is a box with a
 * code printed on the side. The same reasoning turned a magnifying glass into
 * an actual brake disc: "je sais quelle pièce" is about recognising a part,
 * and a part is the thing to draw.
 *
 * **Drawn here, never borrowed.** No manufacturer's mark, no traced
 * photograph, no icon set lifted from another shop. Plain geometry in the
 * site's own palette.
 *
 * **No code anybody could type in.** The box's label carries bars and the word
 * RÉF., not a real reference. A drawing that says `GDB1330` is a promise that
 * `/reference/GDB1330` resolves, and the shop has no reference rows yet — an
 * illustration is not the place to imply a catalogue that does not exist.
 *
 * **One fixed palette.** These never invert: the field behind them stays light
 * on every card state, so there is no dark variant to keep in step. The card
 * shows which door is chosen with its border and its arrow, not by turning
 * navy underneath the artwork.
 */

type Props = { className?: string };

/** Landscape, so the art sits across the top of a card like a photograph. */
const BOX = "0 0 120 84";

function Art({ className = "", children, label }: Props & { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={BOX} className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

/**
 * The soft field behind each subject.
 *
 * Deliberately not a circle or a rounded rectangle: those read as a button or
 * a badge, and this is a backdrop. Slightly different in each drawing so the
 * row of four does not look stamped from one template.
 */
function Blob({ d, tone = "navy" }: { d: string; tone?: "navy" | "gold" }) {
  return <path d={d} className={tone === "gold" ? "fill-gold-500" : "fill-navy-50"} opacity={tone === "gold" ? 0.28 : 1} />;
}

/** A car in side profile — the one shape every driver reads instantly. */
export function ArtCar({ className }: Props) {
  return (
    <Art className={className} label="Une voiture, vue de côté">
      <Blob d="M10 44c-2-14 10-26 28-28 16-2 26 4 42 3 16-1 28 8 30 19 2 12-10 22-28 24-22 3-38 2-52-2-12-3-18-8-20-16Z" />

      {/* Body. One path so the roofline stays a single curve — a car drawn as
          stacked rectangles reads as a bus. */}
      <path
        d="M16 60V49c0-4 2.4-7.2 6.2-8.3L33 37.5l11-11.2c2.2-2.2 5.1-3.4 8.2-3.4h18.4c4 0 7.7 1.9 10 5.2l6.4 9.1 10.6 3c3.7 1 6.4 4.4 6.4 8.3V60c0 2.2-1.8 4-4 4H20c-2.2 0-4-1.8-4-4Z"
        className="fill-navy-400"
      />
      {/* The sill, a shade darker: it is what stops the body reading flat. */}
      <path d="M16 56h88v4c0 2.2-1.8 4-4 4H20c-2.2 0-4-1.8-4-4Z" className="fill-navy-600" />

      {/* Glass. Two panes with a pillar between them, which is the detail that
          makes it a hatchback rather than a wedge. */}
      <path d="M46.5 38 56 28.6c1-1 2.3-1.5 3.7-1.5H63V38Z" className="fill-white" />
      <path d="M66.5 27.1h4.9c2.7 0 5.2 1.3 6.7 3.5L83 38H66.5Z" className="fill-white" />

      {/* Headlamp and door handle: two small warm marks, nothing more. */}
      <rect x="96" y="44" width="8" height="5" rx="2.5" className="fill-gold-500" />
      <rect x="58" y="46" width="9" height="2.4" rx="1.2" className="fill-navy-600" />

      {[36, 88].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="64" r="11" className="fill-navy-900" />
          <circle cx={cx} cy="64" r="5.4" className="fill-white" />
          <circle cx={cx} cy="64" r="2" className="fill-navy-400" />
        </g>
      ))}

      {/* Ground. A line, not a drop shadow — it sits the car on something
          without pretending to a light source the rest of the page has not
          got. */}
      <rect x="12" y="73" width="96" height="3" rx="1.5" className="fill-navy-300" opacity="0.55" />
    </Art>
  );
}

/** A brake disc and its pads — "a part", to anybody who has seen one. */
export function ArtPart({ className }: Props) {
  const bolts = [90, 162, 234, 306, 18].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 44 + Math.cos(rad) * 12, y: 42 + Math.sin(rad) * 12 };
  });
  // Drilled vents, placed round the friction face rather than drawn one by
  // one, so the count can change without moving twelve hand-written numbers.
  const vents = Array.from({ length: 14 }, (_, i) => (i * 360) / 14);

  return (
    <Art className={className} label="Un disque de frein et ses plaquettes">
      <Blob tone="gold" d="M14 40c-3-13 8-25 26-27 15-2 24 5 38 5 14 0 26 7 28 17 2 11-9 21-26 24-20 4-35 3-48-1-11-3-16-9-18-18Z" />

      <circle cx="44" cy="42" r="30" className="fill-navy-400" />
      <circle cx="44" cy="42" r="30" className="fill-none stroke-navy-600" strokeWidth="3" />
      {vents.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <circle
            key={deg}
            cx={44 + Math.cos(rad) * 23}
            cy={42 + Math.sin(rad) * 23}
            r="1.7"
            className="fill-navy-600"
          />
        );
      })}
      {/* The hub face, and the bolts that hold it to the car. */}
      <circle cx="44" cy="42" r="16" className="fill-white" />
      <circle cx="44" cy="42" r="6.5" className="fill-navy-600" />
      {bolts.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="2.4" className="fill-navy-400" />
      ))}

      {/* Two pads, stacked the way they come out of the box: steel backing
          plate and the friction block on it. */}
      <g>
        <rect x="80" y="26" width="28" height="14" rx="3" className="fill-navy-900" />
        <rect x="80" y="26" width="28" height="5.5" rx="2.5" className="fill-gold-500" />
        <rect x="84" y="46" width="28" height="14" rx="3" className="fill-navy-900" />
        <rect x="84" y="46" width="28" height="5.5" rx="2.5" className="fill-gold-500" />
      </g>
    </Art>
  );
}

/** A parts box with its label — the thing somebody is holding when they
 *  already know the number. */
export function ArtReference({ className }: Props) {
  // Bars of varied width so it reads as a barcode rather than a comb. No code
  // under it: see the note at the top of this file.
  const bars = [0, 3.5, 5.5, 9, 13, 15, 18.5, 22, 24, 27.5, 31, 33];

  return (
    <Art className={className} label="Une boîte de pièce avec son étiquette et son code-barres">
      <Blob d="M12 42c-2-13 9-24 27-26 16-2 25 4 40 4 15 0 27 7 29 18 2 11-10 21-27 24-21 3-37 2-50-2-11-3-17-9-19-18Z" />

      {/* A box seen slightly from above: top, front, side. Three faces is the
          fewest that reads as a box and not as a square. */}
      <path d="M22 34 40 21h58L80 34Z" className="fill-gold-400" />
      <path d="M22 34h58v36H22Z" className="fill-gold-500" />
      <path d="M80 34 98 21v36L80 70Z" className="fill-gold-600" />

      {/* The label, and the code on it — the whole point of this door. */}
      <rect x="30" y="41" width="42" height="22" rx="2" className="fill-white" />
      {bars.map((x, i) => (
        <rect
          key={x}
          x={34 + x}
          y="45"
          width={i % 3 === 0 ? 1.8 : 1}
          height="11"
          className="fill-navy-900"
        />
      ))}
      <rect x="34" y="58.5" width="34" height="2" rx="1" className="fill-navy-300" />
    </Art>
  );
}

/** A phone photographing the part, and somebody on the other end of it. */
export function ArtUnknown({ className }: Props) {
  return (
    <Art className={className} label="Envoyer une photo ou demander à un conseiller">
      <Blob d="M12 42c-2-13 10-25 27-26 16-1 24 5 39 5 15 0 27 7 29 18 2 11-10 21-27 24-21 3-36 2-49-2-11-3-17-10-19-19Z" />

      {/* The phone, held up to the part nobody can name. */}
      <rect x="18" y="12" width="42" height="60" rx="7" className="fill-navy-900" />
      <rect x="22.5" y="18" width="33" height="44" rx="2.5" className="fill-white" />
      <rect x="33" y="65" width="12" height="2.6" rx="1.3" className="fill-white" opacity="0.65" />
      {/* What is on the screen: a camera, pointed at it. */}
      <circle cx="39" cy="40" r="11" className="fill-gold-500" />
      <circle cx="39" cy="40" r="5" className="fill-white" />
      <rect x="30" y="24" width="18" height="5" rx="2.5" className="fill-navy-300" />

      {/* And the answer coming back. Dots rather than a "?" so the door reads
          the same in French, English and Arabic. */}
      <path d="M70 16h32a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5h-9l-7 7v-7h-16a5 5 0 0 1-5-5V21a5 5 0 0 1 5-5Z" className="fill-gold-500" />
      {[79, 87, 95].map((cx) => (
        <circle key={cx} cx={cx} cy="28" r="2.6" className="fill-navy-900" />
      ))}

      {/* The person on the other end, with the headset on. A shoulders-up
          figure: a whole body at this size is a stick man. */}
      <circle cx="88" cy="56" r="9" className="fill-navy-400" />
      <path d="M74 76c0-7.7 6.3-14 14-14s14 6.3 14 14Z" className="fill-navy-600" />
      <path d="M78 56a10 10 0 0 1 20 0" className="fill-none stroke-navy-900" strokeWidth="3" strokeLinecap="round" />
      <rect x="75.5" y="54" width="5" height="8" rx="2.5" className="fill-navy-900" />
      <rect x="95.5" y="54" width="5" height="8" rx="2.5" className="fill-navy-900" />
    </Art>
  );
}

/**
 * A carte grise, for the band that asks for the car once.
 *
 * The VIN is the fastest way in for anybody holding their papers and the
 * slowest for anybody who is not, so the drawing's job is to say *where to
 * look* — a document with a highlighted line on it — rather than to decorate
 * the input.
 */
export function ArtCarteGrise({ className }: Props) {
  return (
    <Art className={className} label="Une carte grise, avec la ligne du numéro de série mise en évidence">
      <rect x="14" y="10" width="92" height="64" rx="5" className="fill-white stroke-navy-300" strokeWidth="2" />
      <rect x="14" y="10" width="92" height="13" rx="5" className="fill-navy-900" />
      <rect x="14" y="18" width="92" height="5" className="fill-navy-900" />
      <rect x="20" y="14" width="26" height="5" rx="2.5" className="fill-white" opacity="0.85" />

      {[30, 38, 46].map((y) => (
        <rect key={y} x="22" y={y} width={y === 46 ? 38 : 54} height="3.5" rx="1.75" className="fill-navy-300" />
      ))}

      {/* The line that matters, picked out in gold — the same colour the band's
          button uses, so the eye goes document → field → button. */}
      <rect x="20" y="54" width="80" height="12" rx="3" className="fill-gold-500" opacity="0.35" />
      <rect x="24" y="58" width="16" height="4" rx="2" className="fill-navy-900" />
      <rect x="44" y="58" width="52" height="4" rx="2" className="fill-navy-600" />
    </Art>
  );
}
