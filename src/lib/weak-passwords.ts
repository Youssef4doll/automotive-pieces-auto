/**
 * Passwords an attacker tries first.
 *
 * Not a dictionary of every weak word — a short list of what actually leads
 * every leaked-password ranking, plus the local favourites (the keyboard is
 * AZERTY here, and "tunisie2024" is somebody's password today), plus the
 * shapes that are guessed without a list: one character repeated, a run up
 * or down the keyboard, a common word with a year or a few digits on the end.
 *
 * Pure, so the website form, the server action and the app API share it and
 * a test can pin it.
 */

const COMMON = new Set([
  "password", "passw0rd", "motdepasse", "azerty", "azertyuiop", "qwerty", "qwertyuiop", "azerty123",
  "qwerty123", "iloveyou", "jetaime", "bonjour", "soleil", "welcome", "admin", "administrator",
  "letmein", "monkey", "dragon", "football", "baseball", "sunshine", "princess", "master", "shadow",
  "superman", "batman", "starwars", "whatever", "trustno1", "freedom", "loveme", "abc123", "abcd1234",
  "a1b2c3d4", "aaaaaa", "tunisie", "tunisia", "tunis", "sfax", "sousse", "bizerte", "nabeul",
  "monastir", "kairouan", "gabes", "carthage", "esperance", "clubafricain", "etoile", "allah",
  "mohamed", "mohammed", "ahmed", "amine", "yassine", "youssef", "mariem", "salma", "fatma",
  "marwa", "nour", "chouchou", "doudou", "loulou", "bismillah", "hamdoulah", "voiture", "automobile",
  "pieces", "piecesauto", "garage", "mercedes", "renault", "peugeot", "citroen", "volkswagen",
  "toyota", "hyundai", "kia", "bmw", "golf", "clio", "partner", "changeme", "secret", "secret1",
  "test", "testtest", "user", "guest", "login", "compte", "client",
]);

/** Words that only become passwords with digits or symbols bolted on. */
const COMMON_STEMS = [...COMMON].filter((w) => w.length >= 4 && !/\d/.test(w));

const RUNS = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "azertyuiop", "qwertyuiop", "qsdfghjklm", "asdfghjkl", "wxcvbn", "zxcvbnm"];

function isRun(v: string) {
  if (v.length < 4) return false;
  return RUNS.some((run) => run.includes(v) || [...run].reverse().join("").includes(v));
}

export type WeakReason = "common" | "personal";

/**
 * Why this password should be refused, or null. `personal` needs the
 * account's e-mail and name; without them only `common` can be said.
 */
export function weakPassword(password: string, person: { email?: string; name?: string } = {}): WeakReason | null {
  const v = password.normalize("NFKC").toLowerCase();
  if (COMMON.has(v)) return "common";
  if (/^(.)\1+$/.test(v)) return "common";
  if (isRun(v)) return "common";
  // A common word with digits or symbols on either end: "azerty2024", "!tunisie1".
  const stem = v.replace(/^[\d\W_]+|[\d\W_]+$/g, "");
  if (stem.length >= 4 && (COMMON.has(stem) || isRun(stem))) return "common";
  if (!stem && /^\d+$/.test(v) && new Set(v).size <= 2) return "common";
  if (COMMON_STEMS.some((w) => v === w + w)) return "common";

  // Built from the account itself: the e-mail's name part, or the person's name.
  const local = person.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const plain = v.replace(/[^a-z0-9]/g, "");
  if (local.length >= 4 && plain.includes(local)) return "personal";
  const names = (person.name ?? "").toLowerCase().split(/\s+/).filter((n) => n.length >= 4);
  if (names.some((n) => stem === n || plain === n.replace(/[^a-z0-9]/g, ""))) return "personal";
  return null;
}
