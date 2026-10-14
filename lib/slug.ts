export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  let candidate = base;
  let suffix = 2;

  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function uniqueShopSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  return uniqueSlug(slugify(name) || "tienda", exists);
}

export async function uniqueProductSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
) {
  return uniqueSlug(slugify(name) || "producto", exists);
}

/** What a product's slug is built from: its name, or a stand-in when the name has nothing to keep. */
function productSlugBase(name: string) {
  return slugify(name) || "producto";
}

/**
 * The same slug with a suffix nobody could have guessed, for when the database
 * says a slug is taken by a row the lookup could not see.
 */
export function randomisedSlug(slug: string) {
  return `${slug}-${crypto.randomUUID().slice(0, 6)}`;
}

/**
 * Whether a product already carries a slug made from this name: the plain one,
 * or the plain one with the suffix a taken slug was given (a count, or the six
 * characters of `randomisedSlug`). A draft whose slug still belongs to its name
 * keeps it, so saving the same draft twice never moves it.
 */
export function slugBelongsToName(slug: string, name: string) {
  const base = productSlugBase(name);
  if (slug === base) return true;

  return slug.startsWith(`${base}-`) && /^(\d+|[0-9a-f]{6})$/.test(slug.slice(base.length + 1));
}
