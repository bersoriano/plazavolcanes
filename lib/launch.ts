/** Founding shops the launch promotion covers, in order of registration. */
export const FOUNDERS_CAP = 100;

/**
 * When the founders promotion stops taking shops, as an ISO 8601 instant
 * (e.g. "2026-12-31T23:59:59-06:00"), or null while no end date is set.
 *
 * Every block that makes the offer (the launch bar, the landing's founders
 * card, 0% block and closing call, and the founders section on /vender)
 * reads isFoundersPromoActive(), so the offer leaves the site in one edit and
 * no page goes on promising it after it has ended.
 */
export const FOUNDERS_PROMO_ENDS_AT: string | null = null;

export function isFoundersPromoActive(now: Date = new Date(), endsAt: string | null = FOUNDERS_PROMO_ENDS_AT) {
  if (!endsAt) return true;
  const end = new Date(endsAt);
  // A malformed date must not quietly keep an ended offer on the page.
  if (Number.isNaN(end.getTime())) return false;
  return now < end;
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
