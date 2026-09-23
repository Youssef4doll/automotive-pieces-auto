/**
 * The shop's standing commitments, as numbers.
 *
 * Twelve months' warranty and fourteen days to return a part are what the
 * conditions page, the delivery-and-returns page, the product page and the
 * checkout already promise in words — this file does not introduce either,
 * it gives them one home a machine can read, so the phone app states the
 * same figures the website does rather than a third copy typed from memory.
 *
 * The website's own pages still spell them out in prose. Pointing those at
 * these constants is a worthwhile follow-up and deliberately not part of the
 * change that introduced the file: it touches legal text, and legal text
 * should change in a commit that says so.
 */
export const WARRANTY_MONTHS = 12;
export const RETURN_DAYS = 14;
