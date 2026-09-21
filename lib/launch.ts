/** Founding shops the launch promotion covers, in order of registration. */
export const FOUNDERS_CAP = 100;

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
