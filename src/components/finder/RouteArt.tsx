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
 * Three rules these follow:
 *
 * **Show the situation, not a symbol.** The reference door used to be a `#`.
 * That glyph means "number" to a developer and nothing at all to a driver
 * holding a greasy box with a code printed on the side — so it is a box with
 * a code printed on the side. The same reasoning turned a magnifying glass
 * into an actual brake disc: "je sais quelle pièce" is about recognising a
 * part, and a part is the thing to draw.
 *
 * **Drawn here, never borrowed.** No manufacturer's mark, no traced
 * photograph, no icon set lifted from another shop. Plain geometry in the
 * site's own two colours.
 *
 * **Readable on both card states.** The plate behind these stays light even
 * when the card is selected and turns navy, so the artwork keeps one fixed
 * palette instead of needing an inverted variant that would drift out of step.
 */

type Props = { className?: string };

const BOX = "0 0 48 48";

function Art({ className = "", children, label }: Props & { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={BOX} className={className} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** A car in side profile — the one shape every driver reads instantly. */
export function ArtCar({ className }: Props) {
  return (
    <Art className={className} label="Une voiture vue de côté">
      <path
        d="M4 32.5 6.6 23.2C7.7 19.6 10.6 17.2 14.2 17.2H29.8C32.4 17.2 34.9 18.2 36.7 20L41.4 24.6C43.1 26.3 44 28.5 44 30.9V33.4C44 34.3 43.3 35 42.4 35H5.6C4.7 35 4 34.3 4 33.4Z"
        className="fill-navy-900"
      />
      {/* Glass in gold: the one warm note, and what separates a car from a
          brick at this size. */}
      <path d="M15 21.2H22.4V26.4H11.6Z" className="fill-gold-500" />
      <path
        d="M25 21.2H29.6C31 21.2 32.3 21.7 33.3 22.7L37 26.4H25Z"
        className="fill-gold-500"
      />
      <circle cx="14.5" cy="35" r="5.6" className="fill-navy-900" />
      <circle cx="14.5" cy="35" r="2.2" className="fill-white" />
      <circle cx="33.5" cy="35" r="5.6" className="fill-navy-900" />
      <circle cx="33.5" cy="35" r="2.2" className="fill-white" />
    </Art>
  );
}

/** A brake disc and its pad — "a part", to somebody who has seen one. */
export function ArtPart({ className }: Props) {
  const bolts = [0, 90, 180, 270].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: 20 + Math.cos(rad) * 8.6, y: 24 + Math.sin(rad) * 8.6 };
  });
  return (
    <Art className={className} label="Un disque de frein et sa plaquette">
      <circle cx="20" cy="24" r="15" className="fill-navy-900" />
      <circle cx="20" cy="24" r="5.4" className="fill-white" />
      {bolts.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r="1.5" className="fill-white" />
      ))}
      {/* The friction face, hinted with two arcs rather than drawn hole by
          hole — at 48px a field of vents turns into grey mush. */}
      <path
        d="M20 10.4A13.6 13.6 0 0 1 33.6 24"
        className="stroke-white"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M20 37.6A13.6 13.6 0 0 1 6.4 24"
        className="stroke-white"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
      <rect x="31" y="14" width="9" height="20" rx="3" className="fill-gold-500" />
      <rect x="39.5" y="16" width="4.5" height="16" rx="2" className="fill-navy-900" />
    </Art>
  );
}

/** A parts box with the code printed on its label. */
export function ArtReference({ className }: Props) {
  return (
    <Art className={className} label="Une boîte de pièce avec sa référence imprimée">
      <rect x="5" y="13" width="38" height="29" rx="3" className="fill-navy-900" />
      {/* Packing tape across the top, so it reads as a box and not a screen. */}
      <rect x="5" y="13" width="38" height="5" rx="2" className="fill-gold-500" />
      <rect x="21.5" y="13" width="5" height="5" className="fill-gold-600" />
      {/* The label, and the code on it — the whole point of this door. */}
      <rect x="11" y="23" width="26" height="14" rx="2" className="fill-white" />
      {[13.5, 16, 17.5, 20, 22.5, 24, 26.5, 29, 30.5, 33].map((x, i) => (
        <rect
          key={x}
          x={x}
          y="25.5"
          width={i % 3 === 0 ? 1.4 : 0.8}
          height="6"
          className="fill-navy-900"
        />
      ))}
      <rect x="13.5" y="33" width="21" height="1.8" rx="0.9" className="fill-gold-600" />
    </Art>
  );
}

/** A phone photographing the part, and somebody answering. */
export function ArtUnknown({ className }: Props) {
  return (
    <Art className={className} label="Envoyer une photo ou demander à un expert">
      <rect x="5" y="7" width="23" height="34" rx="4" className="fill-navy-900" />
      <rect x="8.5" y="11.5" width="16" height="23" rx="1.5" className="fill-white" />
      {/* What is on the screen: the part you could not name. */}
      <circle cx="16.5" cy="23" r="5.2" className="fill-gold-500" />
      <circle cx="16.5" cy="23" r="1.8" className="fill-white" />
      <rect x="13.5" y="37" width="6" height="1.6" rx="0.8" className="fill-white" opacity="0.7" />
      {/* And the answer coming back. Dots rather than a "?" so the door reads
          the same in French, English and Arabic. */}
      <path
        d="M32 12h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-4.2l-4.3 4v-4H32a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3Z"
        className="fill-gold-500"
      />
      <circle cx="34" cy="19" r="1.5" className="fill-navy-900" />
      <circle cx="38.5" cy="19" r="1.5" className="fill-navy-900" />
      <circle cx="43" cy="19" r="1.5" className="fill-navy-900" />
    </Art>
  );
}
