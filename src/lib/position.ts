/**
 * Where on the car a part goes, in words.
 *
 * `axle` and `side` are enums held as structured fields precisely so nobody
 * has to parse them back out of a product name — and then two components
 * translated them into French independently. One place, so a card and a
 * product page cannot disagree about which end of the car something fits.
 */
export function positionLabels(axle: string | null | undefined, side: string | null | undefined): string[] {
  return [
    axle === "AVANT" ? "Avant" : axle === "ARRIERE" ? "Arrière" : null,
    side === "GAUCHE" ? "Gauche" : side === "DROITE" ? "Droite" : null,
  ].filter((v): v is string => v !== null);
}
