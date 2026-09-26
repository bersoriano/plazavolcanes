/** Founding shops the launch promotion covers, in order of registration. */
export const FOUNDERS_CAP = 100;

/**
 * The founders promotion as the site shows it: whether a new store can still
 * land a spot, and how many are taken (null when there is no count to trust).
 *
 * The window and the cap live in the database (private.founders_program),
 * next to the ledger that decides who is a founder; getFoundersProgram() in
 * lib/queries/founders.server.ts reads them once per request. Every block
 * that makes the offer reads `open`, so the offer leaves the site the moment
 * the window closes or the last spot goes.
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
