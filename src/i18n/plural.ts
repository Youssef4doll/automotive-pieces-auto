import type { DictKey } from "./dictionaries";

type Translate = (key: DictKey, vars?: Record<string, string | number>) => string;

/**
 * "1 pièce" or "12 pièces".
 *
 * The dictionary interpolates but does not pluralise, and French and English
 * both change the noun at one. Written once here rather than inline at each
 * call site, because the first two call sites had already disagreed about it.
 *
 * Arabic has more forms than two; its strings use the counted-noun singular,
 * which is correct for 11 and up and reads acceptably below that. A proper
 * Intl.PluralRules pass is worth doing when the Arabic copy gets a review.
 */
export function parts(t: Translate, count: number): string {
  return count === 1 ? t("count.part") : t("count.parts", { count });
}
