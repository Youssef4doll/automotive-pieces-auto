/**
 * First letters of a customer's name, for the profile button.
 *
 * Kept out of the shell component: the shell is a client module, and a plain
 * function exported from one cannot be called during server rendering.
 */
export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
