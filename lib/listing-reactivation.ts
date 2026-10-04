/**
 * Whether an expired listing can go back up, decided the same way for one
 * listing and for "Reactivar todos". The database enforces the cover and the
 * listing limit on its own; these rules say so before it has to.
 */

export type ReactivationBlocker = "cover" | "units" | "category" | "limit";

const BLOCKER_LABELS: Record<ReactivationBlocker, string> = {
  cover: "sin portada",
  units: "sin unidades",
  category: "subcategoría no válida",
  limit: "límite de publicaciones",
};

/**
 * Every way back up is a change of status into "published" — a lapsed row is
 * filed as expired first, because sellers may not write its date — and the
 * database demands a cover on that change. So a cover is always required.
 */
export function listingPublishBlocker(listing: { image_path: string | null; units_available: number | null }): "cover" | "units" | null {
  if (!listing.image_path) return "cover";
  if ((listing.units_available ?? 0) < 1) return "units";
  return null;
}

export type ReactivationCandidate = {
  id: number;
  name: string;
  image_path: string | null;
  units_available: number | null;
  category_id: number | null;
  /** An expired row needs a free slot; a lapsed row still marked published already holds one. */
  needsSlot: boolean;
};

export function planReactivation<T extends ReactivationCandidate>(
  candidates: T[],
  { publishableCategoryIds, slotsLeft }: { publishableCategoryIds: ReadonlySet<number>; slotsLeft: number },
): { reactivate: T[]; skipped: { name: string; reason: ReactivationBlocker }[] } {
  const reactivate: T[] = [];
  const skipped: { name: string; reason: ReactivationBlocker }[] = [];
  let slots = slotsLeft;

  for (const candidate of candidates) {
    const blocker =
      listingPublishBlocker(candidate) ??
      (candidate.category_id === null || !publishableCategoryIds.has(candidate.category_id) ? "category" : null) ??
      (candidate.needsSlot && slots <= 0 ? "limit" : null);
    if (blocker) {
      skipped.push({ name: candidate.name, reason: blocker });
      continue;
    }
    if (candidate.needsSlot) slots -= 1;
    reactivate.push(candidate);
  }

  return { reactivate, skipped };
}

export function reactivationMessage(reactivated: number, skipped: { name: string; reason: ReactivationBlocker }[]): string {
  const reasons = skipped.map((item) => `${item.name} (${BLOCKER_LABELS[item.reason]})`).join(", ");
  if (reactivated === 0) {
    return reasons ? `No pudimos reactivar ningún producto: ${reasons}.` : "No hay productos vencidos.";
  }
  const done = `Reactivamos ${reactivated} ${reactivated === 1 ? "producto" : "productos"}.`;
  return reasons ? `${done} No reactivamos: ${reasons}.` : done;
}
