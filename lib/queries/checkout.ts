/**
 * What `public.shop_pickup_point` answered. The coarse form is what everybody
 * gets; the street arrives only once the seller has accepted the order, so every
 * consumer has to be able to render without it.
 */
export type PickupPoint = {
  locality: string;
  administrative_area_code: string;
  address_line1?: string;
  postal_code?: string;
  notes?: string | null;
};

export function parsePickupPoint(value: unknown): PickupPoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.locality !== "string" || typeof raw.administrative_area_code !== "string") {
    return null;
  }

  const point: PickupPoint = {
    locality: raw.locality,
    administrative_area_code: raw.administrative_area_code,
  };
  if (typeof raw.address_line1 === "string") point.address_line1 = raw.address_line1;
  if (typeof raw.postal_code === "string") point.postal_code = raw.postal_code;
  if (typeof raw.notes === "string" || raw.notes === null) point.notes = raw.notes ?? null;
  return point;
}

export function hasFullAddress(point: PickupPoint | null): boolean {
  return Boolean(point?.address_line1);
}
