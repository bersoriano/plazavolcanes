/**
 * What a listing needs before it can be published, and what would only make it
 * sell better.
 *
 * One source, read twice: the form shows this list to the seller while they
 * type, and the server action runs the same function before it writes
 * `status = 'published'`. A checklist that ticks while the server still refuses
 * is worse than no checklist, so neither side is allowed its own copy of the
 * rules. Every requirement names the control that fixes it, so the checklist
 * can take the seller to the field instead of describing it.
 */

export type ListingReadinessField =
  | "images"
  | "name"
  | "description"
  | "price_mxn"
  | "condition"
  | "used_condition"
  | "units_available"
  | "handling_days"
  | "category_id";

export type ListingReadinessInput = {
  imageCount: number;
  name: string | null;
  description: string | null;
  price_mxn: number | null;
  condition: "new" | "used" | null;
  used_condition: "mint" | "good" | "fair" | "bad" | "scrap" | null;
  units_available: number | null;
  handling_days: number | null;
  category_id: number | null;
};

export type ListingReadinessItem = {
  field: ListingReadinessField;
  label: string;
  /** The `id` of the control on the product form that answers this item. */
  target: string;
};

/** The control each field is edited through, so an item can link to it. */
const TARGETS: Record<ListingReadinessField, string> = {
  images: "product-images",
  name: "name",
  description: "description",
  price_mxn: "price_mxn",
  condition: "condition",
  used_condition: "used-condition",
  units_available: "units_available",
  handling_days: "handling_days",
  category_id: "category-leaf",
};

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 3000;
export const MIN_UNITS = 1;
export const MAX_UNITS = 10;
export const MIN_HANDLING_DAYS = 1;
export const MAX_HANDLING_DAYS = 30;

/** Enough photographs that a buyer sees the piece from more than one side. */
const SUGGESTED_PHOTOS = 3;
/** Shorter than this and a description is a caption, not an answer. */
const SUGGESTED_DESCRIPTION_LENGTH = 120;
/** A title this short rarely carries material, size or brand. */
const SUGGESTED_NAME_LENGTH = 15;

function item(field: ListingReadinessField, label: string): ListingReadinessItem {
  return { field, label, target: TARGETS[field] };
}

function length(value: string | null) {
  return value?.trim().length ?? 0;
}

export function missingForPublication(listing: ListingReadinessInput): ListingReadinessItem[] {
  const missing: ListingReadinessItem[] = [];

  if (listing.imageCount < 1) missing.push(item("images", "Agrega al menos una foto del producto."));
  if (length(listing.name) < NAME_MIN_LENGTH || length(listing.name) > NAME_MAX_LENGTH) {
    missing.push(item("name", "Escribe el nombre del producto."));
  }
  if (
    length(listing.description) < DESCRIPTION_MIN_LENGTH ||
    length(listing.description) > DESCRIPTION_MAX_LENGTH
  ) {
    missing.push(item("description", "Describe tu producto en al menos 20 caracteres."));
  }
  if (listing.price_mxn === null || !(listing.price_mxn > 0)) {
    missing.push(item("price_mxn", "Ponle precio en pesos."));
  }
  if (listing.condition === null) {
    missing.push(item("condition", "Indica si el producto es nuevo o usado."));
  } else if (listing.condition === "used" && listing.used_condition === null) {
    missing.push(item("used_condition", "Indica en qué estado está el producto usado."));
  }
  if (
    listing.units_available === null ||
    listing.units_available < MIN_UNITS ||
    listing.units_available > MAX_UNITS
  ) {
    missing.push(item("units_available", "Indica cuántas unidades tienes."));
  }
  if (
    listing.handling_days === null ||
    listing.handling_days < MIN_HANDLING_DAYS ||
    listing.handling_days > MAX_HANDLING_DAYS
  ) {
    missing.push(item("handling_days", "Indica en cuántos días hábiles lo entregas."));
  }
  if (listing.category_id === null) {
    missing.push(item("category_id", "Elige la subcategoría donde va tu producto."));
  }

  return missing;
}

export function isReadyToPublish(listing: ListingReadinessInput) {
  return missingForPublication(listing).length === 0;
}

/**
 * Advice, never a gate. A tip is only offered once the requirement behind it is
 * met, so nothing appears twice and nothing that blocks publication is ever
 * dressed up as optional.
 */
export function listingQualityTips(listing: ListingReadinessInput): ListingReadinessItem[] {
  const blocked = new Set(missingForPublication(listing).map((entry) => entry.field));
  const tips: ListingReadinessItem[] = [];

  if (!blocked.has("images") && listing.imageCount < SUGGESTED_PHOTOS) {
    tips.push(item("images", "Sube al menos tres fotos: de frente, de lado y de cerca."));
  }
  if (!blocked.has("name") && length(listing.name) < SUGGESTED_NAME_LENGTH) {
    tips.push(item("name", "Agrega material, medida o marca al nombre para que se encuentre."));
  }
  if (!blocked.has("description") && length(listing.description) < SUGGESTED_DESCRIPTION_LENGTH) {
    tips.push(item("description", "Cuenta medidas, materiales y detalles de uso en la descripción."));
  }

  return tips;
}
