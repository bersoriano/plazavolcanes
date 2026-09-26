/**
 * The launch package (docs/launch-package.md). The database enforces these
 * (private.founders_program); the copy reads them from here so every page
 * states the same numbers.
 */
/** Founding seats, in the order shops earn them. */
export const FOUNDERS_CAP = 100;
/** Live listings every shop gets, free. */
export const BASE_LISTING_LIMIT = 25;
/** Live listings a founding shop gets, locked. */
export const FOUNDER_LISTING_LIMIT = 50;
/** What earns a seat: this many live items within FOUNDER_QUALIFY_DAYS of opening. */
export const FOUNDER_MIN_LIVE_ITEMS = 8;
export const FOUNDER_QUALIFY_DAYS = 7;
/** How long a founder's 0% commission is locked, from earning the seat. */
export const FOUNDER_COMMISSION_LOCK_MONTHS = 12;
/** How long a founder rotates on the home page, from earning the seat. */
export const FOUNDER_FEATURE_DAYS = 90;

/** The one founder sentence, repeated everywhere the offer appears. */
export const FOUNDER_OFFER = `Primeras ${FOUNDERS_CAP} tiendas: ${FOUNDER_LISTING_LIMIT} productos, insignia fundadora y 0% comisión fija ${FOUNDER_COMMISSION_LOCK_MONTHS} meses. Todas las demás: ${BASE_LISTING_LIMIT} productos gratis.`;

/** How a seat is earned, in one line. */
export const FOUNDER_EARN_RULE = `Publica ${FOUNDER_MIN_LIVE_ITEMS} productos en tus primeros ${FOUNDER_QUALIFY_DAYS} días y gana tu lugar.`;

/** Whether a shop still rotates on the home page as a founder. */
export function isFeaturedFounder(founderSince: string | null | undefined, now = Date.now()) {
  if (!founderSince) return false;
  const since = Date.parse(founderSince);
  return Number.isFinite(since) && now - since < FOUNDER_FEATURE_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The founders promotion as the site shows it: whether a new store can still
 * land a spot, and how many are taken (null when there is no count to trust).
 *
 * The cap and the rule live in the database (private.founders_program),
 * next to the ledger of seats; getFoundersProgram() in
 * lib/queries/founders.server.ts reads them once per request. Every block
 * that makes the offer reads `open`, so the offer leaves the site the moment
 * the last seat goes (or administration closes the programme).
 */
export type FoundersProgram = { open: boolean; taken: number | null; cap: number };

/** What the site shows while there is no status to read: the offer, without a number. */
export const FOUNDERS_FALLBACK: FoundersProgram = { open: true, taken: null, cap: FOUNDERS_CAP };

export function toFoundersProgram(
  row: { cap: number; taken: number; is_open: boolean } | null | undefined,
): FoundersProgram {
  if (!row || !Number.isFinite(row.taken) || !Number.isFinite(row.cap)) return FOUNDERS_FALLBACK;
  return { open: row.is_open, taken: row.taken, cap: row.cap };
}

/**
 * Whether sellers can actually bring a history over from another marketplace.
 *
 * Every string on /vender that promises the import reads this flag, so the page
 * can be told the truth in one edit the day the feature ships or slips.
 */
export const REPUTATION_IMPORT_AVAILABLE = true;

/**
 * The founders counter, or null when there is no trustworthy number to show.
 *
 * A made-up count would be the one number on the page a seller could check, so
 * anything short of a real count hides the counter instead of guessing: the
 * hero pill falls back to "Primeras 100 tiendas" and the progress card drops
 * its number and bar while keeping the call to action.
 */
export function resolveFoundersProgress(spotsTaken: number | null | undefined) {
  if (typeof spotsTaken !== "number" || !Number.isFinite(spotsTaken) || spotsTaken < 0) {
    return null;
  }

  const taken = Math.min(Math.floor(spotsTaken), FOUNDERS_CAP);

  return {
    taken,
    left: FOUNDERS_CAP - taken,
    // A shop that just claimed the first spot still deserves a visible sliver.
    percent: taken === 0 ? 0 : Math.max(2, Math.round((taken / FOUNDERS_CAP) * 100)),
  };
}
