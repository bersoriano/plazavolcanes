/**
 * A shop may rewrite its delivery policy once a month. The rule lives in a
 * database trigger, because row-level security lets an owner update their own
 * shop directly; these helpers only mirror it, so the panel can say when the
 * field opens again instead of letting a seller type into a doomed textarea.
 */
export const DELIVERY_POLICY_INTERVAL_DAYS = 30;

/** The exact message the cadence trigger raises, matched when mapping errors. */
export const DELIVERY_POLICY_CADENCE_ERROR =
  "Puedes actualizar la política de entregas una vez al mes.";

const INTERVAL_MS = DELIVERY_POLICY_INTERVAL_DAYS * 24 * 60 * 60 * 1000;

export function deliveryPolicyUnlocksAt(updatedAt: string | null) {
  return updatedAt ? new Date(new Date(updatedAt).getTime() + INTERVAL_MS) : null;
}

export function isDeliveryPolicyEditable(updatedAt: string | null, now = new Date()) {
  const unlocksAt = deliveryPolicyUnlocksAt(updatedAt);
  return !unlocksAt || unlocksAt.getTime() <= now.getTime();
}
